from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('drumkits', '0003_alter_drumkit_genre'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='drumkit',
            index=models.Index(fields=['author'], name='drmkit_author_idx'),
        ),
        migrations.AddIndex(
            model_name='drumkit',
            index=models.Index(fields=['-created_at'], name='drmkit_created_idx'),
        ),
        migrations.AddIndex(
            model_name='drumkit',
            index=models.Index(fields=['-downloads'], name='drmkit_downloads_idx'),
        ),
        migrations.AddIndex(
            model_name='drumkit',
            index=models.Index(fields=['author', '-created_at'], name='drmkit_author_cr_idx'),
        ),
        migrations.AddIndex(
            model_name='drumkit',
            index=models.Index(fields=['is_public', '-created_at'], name='drmkit_public_cr_idx'),
        ),
    ]
