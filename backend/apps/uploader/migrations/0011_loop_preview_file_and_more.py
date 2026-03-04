from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('uploader', '0010_loop_bpm_detection_confidence_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='loop',
            name='preview_file',
            field=models.FileField(blank=True, null=True, upload_to='loops/previews/'),
        ),
        migrations.AddField(
            model_name='loop',
            name='preview_source_file',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='sample',
            name='preview_file',
            field=models.FileField(blank=True, null=True, upload_to='samples/previews/'),
        ),
        migrations.AddField(
            model_name='sample',
            name='preview_source_file',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
