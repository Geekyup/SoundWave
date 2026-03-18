from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('uploader', '0011_loop_preview_file_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='loop',
            name='bpm_detection_confidence',
        ),
        migrations.RemoveField(
            model_name='loop',
            name='bpm_last_detected_at',
        ),
        migrations.RemoveField(
            model_name='loop',
            name='bpm_needs_review',
        ),
    ]
