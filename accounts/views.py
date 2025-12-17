from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Sum
from uploader.models import Loop, Sample


def login_view(request):
    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == 'POST' and form.is_valid():
        login(request, form.get_user())
        return redirect('main:index')
    return render(request, 'accounts/login.html', {'form': form})


def register_view(request):
    form = UserCreationForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        messages.success(
            request,
            'Registration successful! Please log in to your account.',
        )
        return redirect('accounts:login')
    return render(request, 'accounts/register.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('main:index')


@login_required(login_url='accounts:login')
def profile_view(request):
    user = request.user
    username = user.username

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
        'user': user,
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


