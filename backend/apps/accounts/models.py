from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_save
from django.dispatch import receiver

from SoundWave.storage_backends import get_image_storage

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/%Y/%m/%d/', blank=True, storage=get_image_storage())
    bio = models.TextField(max_length=500, blank=True)

    def __str__(self):
        return self.user.username


class UserDownload(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='downloads_library')
    loop = models.ForeignKey('uploader.Loop', on_delete=models.CASCADE, null=True, blank=True, related_name='downloaded_by_users')
    sample = models.ForeignKey('uploader.Sample', on_delete=models.CASCADE, null=True, blank=True, related_name='downloaded_by_users')
    drumkit = models.ForeignKey('drumkits.DrumKit', on_delete=models.CASCADE, null=True, blank=True, related_name='downloaded_by_users')
    downloaded_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-downloaded_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(loop__isnull=False) & Q(sample__isnull=True) & Q(drumkit__isnull=True))
                    | (Q(loop__isnull=True) & Q(sample__isnull=False) & Q(drumkit__isnull=True))
                    | (Q(loop__isnull=True) & Q(sample__isnull=True) & Q(drumkit__isnull=False))
                ),
                name='acct_udl_one_target_chk',
            ),
            models.UniqueConstraint(
                fields=['user', 'loop'],
                condition=Q(loop__isnull=False),
                name='acct_udl_user_loop_uq',
            ),
            models.UniqueConstraint(
                fields=['user', 'sample'],
                condition=Q(sample__isnull=False),
                name='acct_udl_user_sample_uq',
            ),
            models.UniqueConstraint(
                fields=['user', 'drumkit'],
                condition=Q(drumkit__isnull=False),
                name='acct_udl_user_drumkit_uq',
            ),
        ]
        indexes = [
            models.Index(fields=['user', '-downloaded_at'], name='acct_udl_user_dt_idx'),
        ]

    def __str__(self):
        target = self.loop or self.sample or self.drumkit
        return f'{self.user.username} downloaded {target}'


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
