from django.contrib import admin

from .models import GameSession, Player, Round, Submission, SubmissionImageHistory, Rating


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ("code", "stage", "player_count", "prompt_time_limit", "vote_time_limit", "created_at")
    list_filter = ("stage",)
    search_fields = ("code",)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "session", "is_admin", "score")
    list_filter = ("is_admin",)
    search_fields = ("name",)


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ("session", "round_number", "target_prompt", "started_at")


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("player", "round", "prompt", "average_rating", "gemini_rating")


@admin.register(SubmissionImageHistory)
class SubmissionImageHistoryAdmin(admin.ModelAdmin):
    list_display = ("submission", "prompt", "created_at")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("submission", "player", "score")
