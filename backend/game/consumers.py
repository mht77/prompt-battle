import asyncio
import logging
import random
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.files.base import ContentFile
from django.db.models import F
from django.utils import timezone
from django.db import IntegrityError

from .models import GameSession, Player, Round, Submission, SubmissionImageHistory, Rating
from .gemini import generate_target_image, evaluate_image_similarity, generate_fallback_image

logger = logging.getLogger(__name__)

LATE_GENERATION_MAX_WAIT_SECONDS = 30
SLIDESHOW_INTERVAL_SECONDS = 5
MIN_PROMPT_TIME_LIMIT = 60
MIN_VOTE_TIME_LIMIT = 15


class GameConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"game_{self.room_code}"
        self.player_id = None
        self.is_admin = False
        self._prompting_timer_task = None
        self._voting_timer_task = None

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self._prompting_timer_task and not self._prompting_timer_task.done():
            self._prompting_timer_task.cancel()
        if self._voting_timer_task and not self._voting_timer_task.done():
            self._voting_timer_task.cancel()
        if self.player_id:
            await self.set_player_channel(self.player_id, None)
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive_json(self, content):
        event_type = content.get("type")
        data = content.get("data", {})

        handler_map = {
            "create_game": self.handle_create_game,
            "join_game": self.handle_join_game,
            "start_round": self.handle_start_round,
            "submit_prompt": self.handle_submit_prompt,
            "show_submission": self.handle_show_submission,
            "submit_rating": self.handle_submit_rating,
            "show_leaderboard": self.handle_show_leaderboard,
            "send_emoji": self.handle_send_emoji,
        }
        handler = handler_map.get(event_type)
        if handler:
            await handler(data)

    async def handle_create_game(self, data):

        admin_name = data.get("admin_name", "Host")
        if not admin_name:
            admin_name = "Host"
        try:
            prompt_limit = int(data.get("prompt_time_limit", 60))
            vote_limit = int(data.get("vote_time_limit", 15))
            player_count = int(data.get("player_count", 4))
            if prompt_limit < MIN_PROMPT_TIME_LIMIT or vote_limit < MIN_VOTE_TIME_LIMIT or player_count <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            await self.send_json({"type": "error", "message": f"Prompt time must be at least {MIN_PROMPT_TIME_LIMIT}s, vote time at least {MIN_VOTE_TIME_LIMIT}s, and player count must be positive"})
            return

        ask_player_names = bool(data.get("ask_player_names", False))
        word_limit = data.get("word_limit")
        if word_limit is not None:
            try:
                word_limit = int(word_limit)
                if word_limit < 1:
                    word_limit = None
            except (ValueError, TypeError):
                word_limit = None
        try:
            session = await self.create_session(self.room_code, prompt_limit, vote_limit, player_count, ask_player_names, word_limit=word_limit)
        except IntegrityError:
            await self.send_json({"type": "error", "message": "Room code collision. Please try again."})
            return

        player = await self.create_player(session, admin_name, is_admin=True, channel_name=self.channel_name)

        self.player_id = player.id
        self.is_admin = True

        await self.send_json({
            "type": "game_created",
            "data": {
                "session_id": session.id,
                "player_id": player.id,
                "code": session.code,
                "prompt_time_limit": session.prompt_time_limit,
                "vote_time_limit": session.vote_time_limit,
                "player_count": session.player_count,
                "ask_player_names": session.ask_player_names,
                "word_limit": session.word_limit,
                "host_name": player.name,
            }
        })

    async def handle_join_game(self, data):
        session = await self.get_session(self.room_code)
        if not session:
            await self.send_json({"type": "error", "message": "Room not found"})
            return

        rejoin_player_id = data.get("player_id")
        player = None
        if rejoin_player_id:
            player = await self.get_player_by_id_and_session(rejoin_player_id, session)

        if player:
            await self.set_player_channel(player.id, self.channel_name)
            self.player_id = player.id
            self.is_admin = player.is_admin
        else:
            if session.stage != "LOBBY":
                await self.send_json({"type": "error", "message": "Game already in progress"})
                return

            current_count = await self.get_non_admin_player_count(session)
            if current_count >= session.player_count:
                await self.send_json({"type": "error", "message": "Game is full"})
                return

            if session.ask_player_names and not data.get("name"):
                await self.send_json({
                    "type": "name_required",
                    "data": {"code": session.code}
                })
                return

            if session.ask_player_names:
                player_name = str(data.get("name", "")).strip()
                if not player_name:
                    await self.send_json({"type": "error", "message": "Name cannot be empty"})
                    return
                name_taken = await self.is_player_name_taken(session, player_name)
                if name_taken:
                    await self.send_json({"type": "error", "message": f"Name '{player_name}' is already taken"})
                    return
            else:
                player_number = await self.get_next_player_number(session)
                player_name = f"Player {player_number}"

            player = await self.create_player(session, player_name, is_admin=False, channel_name=self.channel_name)
            self.player_id = player.id

        host_name = await self.get_host_name(session)

        current_round = None
        target_image_url = ""
        if session.stage in ["PROMPTING", "VOTING", "RESULTS"]:
            round_obj = await self.get_current_round(session)
            if round_obj:
                current_round = round_obj.round_number
                target_image_url = round_obj.target_image.url if round_obj.target_image else ""

        await self.send_json({
            "type": "game_joined",
            "data": {
                "session_id": session.id,
                "player_id": player.id,
                "name": player.name,
                "code": session.code,
                "player_count": session.player_count,
                "prompt_time_limit": session.prompt_time_limit,
                "vote_time_limit": session.vote_time_limit,
                "host_name": host_name,
                "word_limit": session.word_limit,
                "stage": session.stage,
                "current_round": current_round,
                "target_image_url": target_image_url,
            }
        })

        players = await self.get_session_players(session)
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "broadcast_players", "players": players}
        )

    async def handle_start_round(self, data):
        if not self.is_admin:
            return

        target_prompt = data.get("target_prompt")
        session = await self.get_session(self.room_code)

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "broadcast_status", "status": "Generating target image..."}
        )

        image_bytes = await asyncio.to_thread(generate_target_image, target_prompt)
        round_obj = await self.create_next_round(session, target_prompt, image_bytes)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_round_started",
                "round_number": round_obj.round_number,
                "target_image_url": round_obj.target_image.url,
                "prompt_time_limit": session.prompt_time_limit,
                "target_prompt": target_prompt,
                "word_limit": session.word_limit,
            }
        )

        if self._prompting_timer_task and not self._prompting_timer_task.done():
            self._prompting_timer_task.cancel()
        self._prompting_timer_task = asyncio.create_task(
            self.run_prompting_timer(session.id, round_obj.id, session.prompt_time_limit)
        )

    async def run_prompting_timer(self, session_id, round_id, duration):
        try:
            await asyncio.sleep(duration)

            # Check if there are active generations when timer ends
            active_gens = await self.count_active_generations(round_id)
            if active_gens > 0:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_status",
                        "status": f"Waiting for late prompt generations ({active_gens} remaining)..."
                    }
                )

            # Wait for active generations to complete (up to 30 seconds)
            for i in range(LATE_GENERATION_MAX_WAIT_SECONDS):
                active_gens = await self.count_active_generations(round_id)
                if active_gens == 0:
                    break
                if i > 0:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "broadcast_status",
                            "status": f"Waiting for late prompt generations ({active_gens} remaining)..."
                        }
                    )
                await asyncio.sleep(1)

            submissions = await self.end_prompting_stage(session_id, round_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_prompting_ended",
                    "submissions": submissions
                }
            )
        except Exception as e:
            logger.error("Error in prompting timer for session %s: %s", session_id, e, exc_info=True)

    @database_sync_to_async
    def end_prompting_stage(self, session_id, round_id):
        session = GameSession.objects.get(id=session_id)
        if session.stage == "PROMPTING":
            session.stage = "VOTING"
            session.save()

        players = Player.objects.filter(session=session, is_admin=False)
        submissions_list = []
        for player in players:
            sub, _ = Submission.objects.get_or_create(round_id=round_id, player=player)
            if not sub.image:
                if sub.is_generating:
                    sub.is_generating = False
                mock_bytes = generate_fallback_image(f"A blank canvas for {player.name}")
                sub.prompt = sub.prompt or "No prompt submitted"
                sub.image.save(f"sub_{sub.id}_empty.jpg", ContentFile(mock_bytes), save=True)

            submissions_list.append({
                "id": sub.id,
                "player_name": player.name,
            })
        return submissions_list

    async def handle_submit_prompt(self, data):
        prompt = data.get("prompt")
        session = await self.get_session(self.room_code)
        if session.stage != "PROMPTING":
            await self.send_json({"type": "error", "message": "Not in prompting stage"})
            return

        player = await self.get_player(self.player_id)

        if not await self.player_belongs_to_session(player.id, session.id):
            await self.send_json({"type": "error", "message": "You are not in this session"})
            return

        current_round = await self.get_current_round(session)
        if not current_round:
            await self.send_json({"type": "error", "message": "No active round"})
            return

        word_limit = session.word_limit
        if word_limit and len(prompt.split()) > word_limit:
            await self.send_json({"type": "error", "message": f"Prompt exceeds {word_limit} word limit"})
            return

        await self.set_submission_generating(current_round, player, True)
        try:
            image_bytes = await asyncio.to_thread(generate_target_image, prompt)
            submission, history_item = await self.save_submission_and_history(current_round, player, prompt, image_bytes)
        finally:
            await self.set_submission_generating(current_round, player, False)

        await self.send_json({
            "type": "prompt_generated",
            "data": {
                "submission_id": submission.id,
                "image_url": history_item.image.url,
                "prompt": history_item.prompt,
                "history": await self.get_submission_history_urls(submission)
            }
        })

    async def handle_show_submission(self, data):
        if not self.is_admin:
            return

        session = await self.get_session(self.room_code)
        if session.stage not in ("VOTING", "RESULTS"):
            await self.send_json({"type": "error", "message": "Not in voting stage"})
            return

        submission_id = data.get("submission_id")
        submission_data = await self.get_submission_data(submission_id)
        history = submission_data.get("history", [])
        slideshow_delay = max(0, (len(history) - 1) * SLIDESHOW_INTERVAL_SECONDS)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_show_submission",
                "submission_id": submission_id,
                "player_name": submission_data["player_name"],
                "image_url": submission_data["image_url"],
                "prompt": submission_data["prompt"],
                "history": history,
            }
        )

        if self._voting_timer_task and not self._voting_timer_task.done():
            self._voting_timer_task.cancel()
        self._voting_timer_task = asyncio.create_task(
            self.run_voting_timer(session.id, submission_id, session.vote_time_limit, slideshow_delay)
        )

    async def run_voting_timer(self, session_id, submission_id, duration, slideshow_delay=0):
        try:
            if slideshow_delay > 0:
                await asyncio.sleep(slideshow_delay)

            target_bytes, sub_bytes = await self.get_images_for_rating(submission_id)
            gemini_score_task = asyncio.create_task(
                asyncio.to_thread(evaluate_image_similarity, target_bytes, sub_bytes)
            )

            await asyncio.sleep(duration)

            try:
                gemini_score = await asyncio.wait_for(asyncio.shield(gemini_score_task), timeout=10)
            except asyncio.TimeoutError:
                gemini_score_task.cancel()
                gemini_score = random.randint(3, 6)
                logger.warning(
                    "Gemini evaluation timed out for submission %s, using fallback score %s",
                    submission_id, gemini_score
                )

            results = await self.finalize_submission_score(submission_id, gemini_score)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_voting_ended",
                    "submission_id": submission_id,
                    "gemini_score": results["gemini_score"],
                    "average_score": results["average_score"],
                    "player_ratings": results["player_ratings"]
                }
            )
        except asyncio.CancelledError:
            logger.info("Voting timer cancelled for submission %s", submission_id)
        except Exception as e:
            logger.error("Error in voting timer for submission %s: %s", submission_id, e, exc_info=True)

    async def handle_submit_rating(self, data):
        session = await self.get_session(self.room_code)
        if session.stage != "VOTING":
            return

        try:
            score = int(data.get("score", 0))
        except (TypeError, ValueError):
            return
        if not (1 <= score <= 7):
            return

        submission_id = data.get("submission_id")
        if not submission_id:
            return

        player = await self.get_player(self.player_id)
        await self.save_rating(submission_id, player, score)

    async def handle_show_leaderboard(self, data):
        if not self.is_admin:
            return

        session = await self.get_session(self.room_code)
        await self.update_session_stage(session, "RESULTS")
        leaderboard = await self.get_leaderboard_data(session)

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "broadcast_leaderboard", "leaderboard": leaderboard}
        )

    async def broadcast_players(self, event):
        await self.send_json({
            "type": "players_list",
            "data": event["players"]
        })

    async def broadcast_status(self, event):
        await self.send_json({
            "type": "status_update",
            "message": event["status"]
        })

    async def broadcast_round_started(self, event):
        await self.send_json({
            "type": "round_started",
            "data": {
                "round_number": event["round_number"],
                "target_image_url": event["target_image_url"],
                "prompt_time_limit": event["prompt_time_limit"],
                "target_prompt": event.get("target_prompt", ""),
                "word_limit": event.get("word_limit"),
            }
        })

    async def broadcast_prompting_ended(self, event):
        await self.send_json({
            "type": "prompting_ended",
            "data": event["submissions"]
        })

    async def broadcast_show_submission(self, event):
        await self.send_json({
            "type": "show_submission",
            "data": {
                "submission_id": event["submission_id"],
                "player_name": event["player_name"],
                "image_url": event["image_url"],
                "prompt": event["prompt"],
                "history": event.get("history", [])
            }
        })

    async def broadcast_voting_ended(self, event):
        await self.send_json({
            "type": "voting_ended",
            "data": {
                "submission_id": event["submission_id"],
                "gemini_score": event["gemini_score"],
                "average_score": event["average_score"],
                "player_ratings": event["player_ratings"]
            }
        })

    async def broadcast_leaderboard(self, event):
        await self.send_json({
            "type": "leaderboard",
            "data": event["leaderboard"]
        })

    async def handle_send_emoji(self, data):
        emoji = data.get("emoji", "")
        allowed_emojis = ["🔥", "😂", "🎨", "🤯", "💀"]
        if emoji not in allowed_emojis:
            return
        player = await self.get_player(self.player_id)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_emoji",
                "emoji": emoji,
                "player_name": player.name,
            }
        )

    async def broadcast_emoji(self, event):
        await self.send_json({
            "type": "emoji_reaction",
            "data": {
                "emoji": event["emoji"],
                "player_name": event["player_name"],
            }
        })

    @database_sync_to_async
    def create_session(self, code, prompt_limit, vote_limit, player_count, ask_player_names=False, word_limit=None):
        return GameSession.objects.create(
            code=code,
            prompt_time_limit=prompt_limit,
            vote_time_limit=vote_limit,
            player_count=player_count,
            ask_player_names=ask_player_names,
            word_limit=word_limit,
            stage="LOBBY"
        )

    @database_sync_to_async
    def get_session(self, code):
        return GameSession.objects.filter(code=code).first()

    @database_sync_to_async
    def get_next_player_number(self, session):
        return session.players.filter(is_admin=False).count() + 1

    @database_sync_to_async
    def get_non_admin_player_count(self, session):
        return session.players.filter(is_admin=False).count()

    @database_sync_to_async
    def get_host_name(self, session):
        host = session.players.filter(is_admin=True).first()
        return host.name if host else "Host"

    @database_sync_to_async
    def get_player_by_id_and_session(self, player_id, session):
        return session.players.filter(id=player_id).first()

    @database_sync_to_async
    def create_player(self, session, name, is_admin, channel_name):
        player, created = Player.objects.get_or_create(
            session=session,
            name=name,
            defaults={"is_admin": is_admin, "channel_name": channel_name}
        )
        if not created:
            player.channel_name = channel_name
            player.save()
        return player

    @database_sync_to_async
    def is_player_name_taken(self, session, name):
        return session.players.filter(name=name).exists()

    @database_sync_to_async
    def get_player(self, player_id):
        return Player.objects.get(id=player_id)

    @database_sync_to_async
    def set_player_channel(self, player_id, channel_name):
        Player.objects.filter(id=player_id).update(channel_name=channel_name)

    @database_sync_to_async
    def get_session_players(self, session):
        return list(session.players.filter(is_admin=False).values("id", "name", "score"))

    @database_sync_to_async
    def create_next_round(self, session, target_prompt, image_bytes):
        session.current_round_number += 1
        session.stage = "PROMPTING"
        session.save()

        round_obj = Round.objects.create(
            session=session,
            round_number=session.current_round_number,
            target_prompt=target_prompt,
            started_at=timezone.now()
        )
        round_obj.target_image.save(f"target_{round_obj.id}.jpg", ContentFile(image_bytes), save=True)
        return round_obj

    @database_sync_to_async
    def get_current_round(self, session):
        return session.rounds.filter(round_number=session.current_round_number).first()

    @database_sync_to_async
    def player_belongs_to_session(self, player_id, session_id):
        return Player.objects.filter(id=player_id, session_id=session_id).exists()

    @database_sync_to_async
    def save_submission_and_history(self, current_round, player, prompt, image_bytes):
        submission, _ = Submission.objects.get_or_create(round=current_round, player=player)
        submission.prompt = prompt

        filename = f"sub_{submission.id}_{int(timezone.now().timestamp())}.jpg"
        submission.image.save(filename, ContentFile(image_bytes), save=False)
        submission.save()

        history_item = SubmissionImageHistory.objects.create(
            submission=submission,
            prompt=prompt
        )
        history_item.image.save(filename, ContentFile(image_bytes), save=True)

        return submission, history_item

    @database_sync_to_async
    def get_submission_history_urls(self, submission):
        return [item.image.url for item in submission.history.all().order_by("-created_at")]

    @database_sync_to_async
    def get_submission_data(self, submission_id):
        sub = Submission.objects.get(id=submission_id)
        history = list(sub.history.all().order_by("created_at"))
        history_data = [
            {
                "image_url": item.image.url if item.image else "",
                "prompt": item.prompt or ""
            }
            for item in history
            if item.image
        ]
        if not history_data:
            history_data = [{
                "image_url": sub.image.url if sub.image else "",
                "prompt": sub.prompt or ""
            }]
        return {
            "player_name": sub.player.name,
            "image_url": sub.image.url if sub.image else "",
            "prompt": sub.prompt or "",
            "history": history_data
        }

    @database_sync_to_async
    def get_images_for_rating(self, submission_id):
        sub = Submission.objects.get(id=submission_id)
        target = sub.round.target_image

        target.open()
        target_bytes = target.read()
        target.close()

        if sub.image:
            sub.image.open()
            sub_bytes = sub.image.read()
            sub.image.close()
        else:
            sub_bytes = generate_fallback_image("A blank placeholder image")

        return target_bytes, sub_bytes

    @database_sync_to_async
    def save_rating(self, submission_id, player, score):
        sub = Submission.objects.get(id=submission_id)
        if sub.player_id == player.id:
            return None
        return Rating.objects.update_or_create(
            submission_id=submission_id,
            player=player,
            defaults={"score": score}
        )

    @database_sync_to_async
    def finalize_submission_score(self, submission_id, gemini_score):
        sub = Submission.objects.get(id=submission_id)
        ratings = list(sub.ratings.all().values_list("score", flat=True))

        all_scores = ratings + [gemini_score]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0

        is_already_finalized = sub.gemini_rating is not None

        sub.gemini_rating = gemini_score
        sub.average_rating = avg_score
        sub.save()

        if not is_already_finalized:
            Player.objects.filter(id=sub.player_id).update(score=F('score') + avg_score)

        return {
            "gemini_score": gemini_score,
            "average_score": avg_score,
            "player_ratings": ratings
        }

    @database_sync_to_async
    def get_leaderboard_data(self, session):
        players = session.players.filter(is_admin=False).order_by("-score")
        return list(players.values("id", "name", "score"))

    @database_sync_to_async
    def update_session_stage(self, session, stage):
        session.stage = stage
        session.save()

    @database_sync_to_async
    def set_submission_generating(self, current_round, player, is_generating):
        sub, _ = Submission.objects.get_or_create(round=current_round, player=player)
        sub.is_generating = is_generating
        sub.save()

    @database_sync_to_async
    def count_active_generations(self, round_id):
        return Submission.objects.filter(round_id=round_id, is_generating=True).count()
