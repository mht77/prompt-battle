import os
import asyncio
from django.test import TransactionTestCase
from django.core.files.base import ContentFile
from django.db import IntegrityError
from channels.testing import WebsocketCommunicator
from core.asgi import application
from .models import GameSession, Player, Round, Submission, SubmissionImageHistory, Rating
from .consumers import GameConsumer
from .gemini import generate_fallback_image

class PromptBattleGameTests(TransactionTestCase):

    def setUp(self):
        os.environ["ADMIN_PASSWORD"] = "test-secret-pass"

    def tearDown(self):
        if "ADMIN_PASSWORD" in os.environ:
            del os.environ["ADMIN_PASSWORD"]

    def test_models_setup(self):
        session = GameSession.objects.create(
            code="ABCD",
            prompt_time_limit=45,
            vote_time_limit=20,
            player_count=6,
            stage="LOBBY"
        )
        self.assertEqual(session.code, "ABCD")
        self.assertEqual(session.player_count, 6)
        self.assertEqual(session.stage, "LOBBY")

        player = Player.objects.create(session=session, name="Alice", is_admin=False)
        self.assertEqual(player.name, "Alice")
        self.assertFalse(player.is_admin)

        round_obj = Round.objects.create(session=session, round_number=1, target_prompt="A green apple")
        round_obj.target_image.save("target.jpg", ContentFile(b"fake_image_bytes"))
        self.assertEqual(round_obj.round_number, 1)

        submission = Submission.objects.create(round=round_obj, player=player, prompt="My green apple attempt")
        submission.image.save("sub.jpg", ContentFile(b"fake_sub_bytes"))
        self.assertEqual(submission.prompt, "My green apple attempt")

        history = SubmissionImageHistory.objects.create(submission=submission, prompt="My green apple attempt")
        history.image.save("sub_hist.jpg", ContentFile(b"fake_sub_bytes"))
        self.assertEqual(history.submission, submission)

    async def test_websocket_create_game_success(self):
        communicator = WebsocketCommunicator(application, "ws/game/HELO/")
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({
            "type": "create_game",
            "data": {
                "admin_name": "HostAdmin",
                "admin_password": "test-secret-pass",
                "prompt_time_limit": 40,
                "vote_time_limit": 12,
                "player_count": 5
            }
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "game_created")
        self.assertEqual(response["data"]["code"], "HELO")
        self.assertEqual(response["data"]["prompt_time_limit"], 40)
        self.assertEqual(response["data"]["vote_time_limit"], 12)
        self.assertEqual(response["data"]["player_count"], 5)

        # Verify DB entry
        session = await GameConsumer().get_session("HELO")
        self.assertIsNotNone(session)
        self.assertEqual(session.player_count, 5)
        self.assertEqual(session.prompt_time_limit, 40)

        await communicator.disconnect()

    async def test_websocket_create_game_invalid_password(self):
        communicator = WebsocketCommunicator(application, "ws/game/HELO/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({
            "type": "create_game",
            "data": {
                "admin_name": "HostAdmin",
                "admin_password": "wrong-password",
                "prompt_time_limit": 40,
                "vote_time_limit": 12,
                "player_count": 5
            }
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Invalid admin password")

        await communicator.disconnect()

    async def test_websocket_create_game_invalid_limits(self):
        communicator = WebsocketCommunicator(application, "ws/game/HELO/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({
            "type": "create_game",
            "data": {
                "admin_name": "HostAdmin",
                "admin_password": "test-secret-pass",
                "prompt_time_limit": -10,
                "vote_time_limit": 0,
                "player_count": 5
            }
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("must be positive integers", response["message"])

        await communicator.disconnect()

    async def test_websocket_join_game_and_players_list(self):
        admin_comm = WebsocketCommunicator(application, "ws/game/JOIN/")
        connected_admin, _ = await admin_comm.connect()
        self.assertTrue(connected_admin)

        await admin_comm.send_json_to({
            "type": "create_game",
            "data": {
                "admin_name": "Admin",
                "admin_password": "test-secret-pass",
                "prompt_time_limit": 30,
                "vote_time_limit": 10,
                "player_count": 2
            }
        })
        await admin_comm.receive_json_from() # game_created

        player_comm = WebsocketCommunicator(application, "ws/game/JOIN/")
        connected_player, _ = await player_comm.connect()
        self.assertTrue(connected_player)

        await player_comm.send_json_to({
            "type": "join_game",
            "data": {}
        })

        player_response = await player_comm.receive_json_from()
        self.assertEqual(player_response["type"], "game_joined")
        self.assertEqual(player_response["data"]["player_count"], 2)
        self.assertEqual(player_response["data"]["prompt_time_limit"], 30)

        # Admin receives players_list update
        admin_response = await admin_comm.receive_json_from()
        self.assertEqual(admin_response["type"], "players_list")
        self.assertEqual(len(admin_response["data"]), 1)
        self.assertEqual(admin_response["data"][0]["name"], "Player 1")

        await player_comm.disconnect()
        await admin_comm.disconnect()

    async def test_scoring_rules_and_prevent_rating_own_submission(self):
        consumer = GameConsumer()
        # Create session and players manually
        session = await consumer.create_session("TEST", 30, 10, 3)
        player_admin = await consumer.create_player(session, "Admin", is_admin=True, channel_name="c1")
        player_alice = await consumer.create_player(session, "Alice", is_admin=False, channel_name="c2")
        player_bob = await consumer.create_player(session, "Bob", is_admin=False, channel_name="c3")

        # Create round and submission
        round_obj = await consumer.create_next_round(session, "Target Prompt", b"target_bytes")
        submission_alice, _ = await consumer.save_submission_and_history(round_obj, player_alice, "Alice's prompt", b"alice_img_bytes")

        # Bob rates Alice's submission
        rating_bob = await consumer.save_rating(submission_alice.id, player_bob, 6)
        self.assertIsNotNone(rating_bob)

        # Alice tries to rate her own submission -> Should be blocked and return None
        rating_alice = await consumer.save_rating(submission_alice.id, player_alice, 7)
        self.assertIsNone(rating_alice)

        # Finalize scoring (first time)
        results = await consumer.finalize_submission_score(submission_alice.id, gemini_score=4)
        # Ratings: [6] (Bob) + [4] (Gemini) -> Avg = 5.0
        self.assertEqual(results["gemini_score"], 4)
        self.assertEqual(results["average_score"], 5.0)

        # Check Alice player score (updated by 5.0 points)
        alice_updated = await consumer.get_player(player_alice.id)
        self.assertEqual(alice_updated.score, 5.0)

        # Attempt to finalize scoring again (simulating duplicate event)
        results_dup = await consumer.finalize_submission_score(submission_alice.id, gemini_score=5)
        # Scores should match, but Alice score should not increase again (should remain 5.0)
        alice_dup = await consumer.get_player(player_alice.id)
        self.assertEqual(alice_dup.score, 5.0)

    async def test_ask_player_names_flow(self):
        # 1. Create a game session that asks for player names
        admin_comm = WebsocketCommunicator(application, "ws/game/NAME/")
        connected_admin, _ = await admin_comm.connect()
        self.assertTrue(connected_admin)

        await admin_comm.send_json_to({
            "type": "create_game",
            "data": {
                "admin_name": "Host",
                "admin_password": "test-secret-pass",
                "prompt_time_limit": 30,
                "vote_time_limit": 10,
                "player_count": 2,
                "ask_player_names": True
            }
        })
        await admin_comm.receive_json_from() # game_created

        # 2. Join a player without a name -> should ask for name
        player1_comm = WebsocketCommunicator(application, "ws/game/NAME/")
        connected_p1, _ = await player1_comm.connect()
        self.assertTrue(connected_p1)

        await player1_comm.send_json_to({
            "type": "join_game",
            "data": {}
        })
        response = await player1_comm.receive_json_from()
        self.assertEqual(response["type"], "name_required")

        # 3. Join with an empty name -> should fail with error
        await player1_comm.send_json_to({
            "type": "join_game",
            "data": {"name": "   "}
        })
        response = await player1_comm.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("cannot be empty", response["message"])

        # 4. Join with name "Charlie" -> should succeed
        await player1_comm.send_json_to({
            "type": "join_game",
            "data": {"name": "Charlie"}
        })
        response = await player1_comm.receive_json_from()
        self.assertEqual(response["type"], "game_joined")
        self.assertEqual(response["data"]["name"], "Charlie")

        # 5. Join a second player with duplicate name "Charlie" -> should fail
        player2_comm = WebsocketCommunicator(application, "ws/game/NAME/")
        connected_p2, _ = await player2_comm.connect()
        self.assertTrue(connected_p2)

        await player2_comm.send_json_to({
            "type": "join_game",
            "data": {"name": "Charlie"}
        })
        response = await player2_comm.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("already taken", response["message"])

        await admin_comm.disconnect()
        await player1_comm.disconnect()
        await player2_comm.disconnect()
