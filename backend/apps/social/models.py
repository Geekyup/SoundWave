from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Q

from apps.drumkits.models import DrumKit
from apps.uploader.models import Loop, Sample


class Follow(models.Model):
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='following_relations',
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='follower_relations',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['follower', 'author'],
                name='social_unique_follow',
            ),
            models.CheckConstraint(
                condition=~Q(follower=F('author')),
                name='social_prevent_self_follow',
            ),
        ]

    def __str__(self):
        return f'{self.follower.username} -> {self.author.username}'


class LoopLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loop_likes')
    loop = models.ForeignKey(Loop, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'loop'],
                name='social_unique_loop_like',
            ),
        ]

    def __str__(self):
        return f'{self.user.username} likes {self.loop.name}'


class SampleLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sample_likes')
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'sample'],
                name='social_unique_sample_like',
            ),
        ]

    def __str__(self):
        return f'{self.user.username} likes {self.sample.name}'


class DrumKitLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='drumkit_likes')
    drumkit = models.ForeignKey(DrumKit, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'drumkit'],
                name='social_unique_drumkit_like',
            ),
        ]

    def __str__(self):
        return f'{self.user.username} likes {self.drumkit.title}'


class LoopComment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loop_comments')
    loop = models.ForeignKey(Loop, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} on {self.loop.name}'


class DrumKitComment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='drumkit_comments')
    drumkit = models.ForeignKey(DrumKit, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} on {self.drumkit.title}'
