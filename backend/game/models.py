from django.db import models

class GameSession(models.Model):
    STAGE_CHOICES = [
        ("LOBBY", "Lobby"),
        ("PROMPTING", "Prompting"),
        ("VOTING", "Voting"),
        ("RESULTS", "Results"),
        ("FINISHED", "Finished"),
    ]
    code = models.CharField(max_length=10, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="LOBBY")
    prompt_time_limit = models.IntegerField(default=60)
    vote_time_limit = models.IntegerField(default=15)
    player_count = models.IntegerField(default=4)
    ask_player_names = models.BooleanField(default=False)
    current_round_number = models.IntegerField(default=0)

    def __str__(self):
        return f"Session {self.code} ({self.stage})"

class Player(models.Model):
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="players")
    name = models.CharField(max_length=50)
    is_admin = models.BooleanField(default=False)
    channel_name = models.CharField(max_length=255, blank=True, null=True)
    score = models.FloatField(default=0.0)

    class Meta:
        unique_together = ("session", "name")

    def __str__(self):
        return f"{self.name} in {self.session.code}"

class Round(models.Model):
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="rounds")
    round_number = models.IntegerField()
    target_prompt = models.TextField()
    target_image = models.ImageField(upload_to="targets/")
    started_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("session", "round_number")

    def __str__(self):
        return f"Round {self.round_number} for {self.session.code}"

class Submission(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="submissions")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="submissions")
    prompt = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="submissions/", blank=True, null=True)
    gemini_rating = models.IntegerField(null=True, blank=True)
    average_rating = models.FloatField(default=0.0)
    is_generating = models.BooleanField(default=False)

    class Meta:
        unique_together = ("round", "player")

    def __str__(self):
        return f"Submission by {self.player.name} in round {self.round.round_number}"

class SubmissionImageHistory(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="history")
    image = models.ImageField(upload_to="submissions_history/")
    prompt = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"History item for {self.submission}"

class Rating(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="ratings")
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    score = models.IntegerField()

    class Meta:
        unique_together = ("submission", "player")

    def __str__(self):
        return f"Rating {self.score} by {self.player.name} on {self.submission}"
