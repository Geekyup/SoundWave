from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('drumkits', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='drumkit',
            name='genre',
            field=models.CharField(
                choices=[
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
                ],
                default='other',
                max_length=50,
            ),
        ),
    ]
