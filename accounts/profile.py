from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.db.models import Sum

from .models import Profile
from .forms import ProfileForm
from uploader.models import Loop, Sample


def profile_view(request, username=None):
    if username:
        profile_user = get_object_or_404(User, username=username)
    else:
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        profile_user = request.user

    profile, _ = Profile.objects.get_or_create(user=profile_user)

    username = profile_user.username
    user_loops = Loop.objects.filter(author=username)
    user_samples = Sample.objects.filter(author=username)

    loops_count = user_loops.count()
    samples_count = user_samples.count()
    total_uploads = loops_count + samples_count

    total_downloads = (
        user_loops.aggregate(Sum('downloads'))['downloads__sum'] or 0
    ) + (user_samples.aggregate(Sum('downloads'))['downloads__sum'] or 0)

    recent_loops = user_loops[:8]
    recent_samples = user_samples[:8]

    top_loops = user_loops.order_by('-downloads')[:5]
    top_samples = user_samples.order_by('-downloads')[:5]

    context = {
        'user': profile_user,
        'profile': profile,
        'loops_count': loops_count,
        'samples_count': samples_count,
        'total_uploads': total_uploads,
        'total_downloads': total_downloads,
        'recent_loops': recent_loops,
        'recent_samples': recent_samples,
        'top_loops': top_loops,
        'top_samples': top_samples,
    }

    return render(request, 'accounts/profile.html', context)


@login_required
def profile_edit(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated.')
            return redirect('accounts:profile', username=request.user.username)
    else:
        form = ProfileForm(instance=profile)
    return render(request, 'accounts/profile_edit.html', {'form': form})
