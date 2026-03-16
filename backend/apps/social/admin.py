from django.contrib import admin

from .models import (
    DrumKitComment,
    DrumKitLike,
    Follow,
    LoopComment,
    LoopLike,
    SampleLike,
)


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'author', 'created_at')
    search_fields = ('follower__username', 'author__username')
    list_filter = ('created_at',)


@admin.register(LoopLike)
class LoopLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'loop', 'created_at')
    search_fields = ('user__username', 'loop__name')
    list_filter = ('created_at',)


@admin.register(SampleLike)
class SampleLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'sample', 'created_at')
    search_fields = ('user__username', 'sample__name')
    list_filter = ('created_at',)


@admin.register(DrumKitLike)
class DrumKitLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'drumkit', 'created_at')
    search_fields = ('user__username', 'drumkit__title')
    list_filter = ('created_at',)


@admin.register(LoopComment)
class LoopCommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'loop', 'created_at')
    search_fields = ('user__username', 'loop__name', 'text')
    list_filter = ('created_at',)


@admin.register(DrumKitComment)
class DrumKitCommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'drumkit', 'created_at')
    search_fields = ('user__username', 'drumkit__title', 'text')
    list_filter = ('created_at',)
