from django import forms
from django.contrib.auth.models import User
from .models import Profile
from django.core.exceptions import ValidationError

class ProfileForm(forms.ModelForm):
    username = forms.CharField(max_length=150, required=True, label='Nickname')

    class Meta:
        model = Profile
        fields = ['avatar', 'bio']

    def __init__(self, *args, **kwargs):
        # instance is Profile instance
        super().__init__(*args, **kwargs)
        if self.instance and getattr(self.instance, 'user', None):
            self.fields['username'].initial = self.instance.user.username

    def clean_username(self):
        username = self.cleaned_data['username'].strip()
        qs = User.objects.filter(username__iexact=username)
        if self.instance and getattr(self.instance, 'user', None):
            qs = qs.exclude(pk=self.instance.user.pk)
        if qs.exists():
            raise ValidationError('This username is already taken.')
        return username

    def save(self, commit=True):
        profile = super().save(commit=False)
        username = self.cleaned_data.get('username')
        if self.instance and getattr(self.instance, 'user', None) and username:
            user = self.instance.user
            user.username = username
            if commit:
                user.save()
        if commit:
            profile.save()
        else:
            # ensure profile.user is still set for later saving
            profile.user = self.instance.user
        return profile