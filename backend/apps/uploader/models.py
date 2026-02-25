from django.db import models

GENRE_CHOICES = [
    ('electronic', 'Electronic'),
    ('hip-hop', 'Hip-Hop'),
    ('hoodtrap', 'Hoodtrap'),
    ('drill', 'Drill'),
    ('voice', 'Voice'),
    ('ambient', 'Ambient'),
    ('house', 'House'),
    ('techno', 'Techno'),
    ('drum-and-bass', 'Drum and Bass'),
    ('pop', 'Pop'),
    ('rock', 'Rock'),
    ('experimental', 'Experimental'),
    ('other', 'Other'),
]

class Loop(models.Model):
    name = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES, default='other')
    bpm = models.IntegerField(default=120, help_text='Tempo in BPM')
    audio_file = models.FileField(upload_to='loops/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    downloads = models.IntegerField(default=0)
    keywords = models.CharField(max_length=300, blank=True)


    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Loop'
        verbose_name_plural = 'Loops'

    def __str__(self):
        return f"{self.name} by {self.author}"
    
    def get_file_size(self):
        try:
            return f"{self.audio_file.size / (1024 * 1024):.2f} MB"
        except:
            return "0 MB"
    

class Sample(models.Model):
    SAMPLE_TYPE_CHOICES = [
        ('bass', 'Bass'),
        ('hi_hat', 'Hi Hat'),
        ('clap', 'Clap'),
        ('kick', 'Kick'),
        ('snare', 'Snare'),
        ('tom', 'Tom'),
        ('perc', 'Perc'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=200)
    author = models.CharField(max_length=100, blank=True, default='')
    sample_type = models.CharField(max_length=20, choices=SAMPLE_TYPE_CHOICES)
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES, default='other')
    audio_file = models.FileField(upload_to='samples/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    downloads = models.IntegerField(default=0)  

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Sample'
        verbose_name_plural = 'Samples'

    def __str__(self):
        return f"{self.name} - {self.get_sample_type_display()}"

    def get_file_size(self):
        if self.audio_file:
            size = self.audio_file.size / (1024 * 1024)
            return f"{size:.2f} MB"
        return "0 MB"
