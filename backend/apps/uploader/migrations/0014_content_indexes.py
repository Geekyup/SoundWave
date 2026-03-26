from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('uploader', '0013_alter_loop_genre_alter_sample_genre'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='loop',
            index=models.Index(fields=['author'], name='upl_loop_author_idx'),
        ),
        migrations.AddIndex(
            model_name='loop',
            index=models.Index(fields=['-uploaded_at'], name='upl_loop_uploaded_idx'),
        ),
        migrations.AddIndex(
            model_name='loop',
            index=models.Index(fields=['-downloads'], name='upl_loop_downloads_idx'),
        ),
        migrations.AddIndex(
            model_name='loop',
            index=models.Index(fields=['author', '-uploaded_at'], name='upl_loop_author_up_idx'),
        ),
        migrations.AddIndex(
            model_name='sample',
            index=models.Index(fields=['author'], name='upl_sample_author_idx'),
        ),
        migrations.AddIndex(
            model_name='sample',
            index=models.Index(fields=['-uploaded_at'], name='upl_sample_uploaded_idx'),
        ),
        migrations.AddIndex(
            model_name='sample',
            index=models.Index(fields=['-downloads'], name='upl_sample_downloads_idx'),
        ),
        migrations.AddIndex(
            model_name='sample',
            index=models.Index(fields=['author', '-uploaded_at'], name='upl_sample_author_up_idx'),
        ),
    ]
