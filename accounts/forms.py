from django import forms
from django.contrib.auth.models import User
from .models import Profile


class ProfileForm(forms.ModelForm):
    username = forms.CharField(max_length=150, label='Nickname')

    class Meta:
        model = Profile
        fields = ['avatar', 'bio']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].initial = self.instance.user.username

    def clean_username(self):
        username = self.cleaned_data['username'].strip()
        if User.objects.filter(username__iexact=username).exclude(pk=self.instance.user.pk).exists():
            raise forms.ValidationError('This username is already taken.')
        return username

    def save(self, commit=True):
        profile = super().save(commit=False)
        profile.user.username = self.cleaned_data['username']
        if commit:
            profile.user.save()
            profile.save()
        return profile
