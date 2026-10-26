from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set')
        
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(unique=True, max_length=255)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    groups = models.ManyToManyField(
        'auth.Group',
        blank=True,
        related_name='customuser_set',
        related_query_name='user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        blank=True,
        related_name='customuser_set',
        related_query_name='user',
    )

    objects = CustomUserManager()

    USERNAME_FIELD = 'username'
    email = models.EmailField(unique=True, null=True, blank=True)


    def __str__(self):
        return self.username

class RadioStation(models.Model):
    name = models.CharField(max_length=255, unique=True)
    url = models.URLField(max_length=500)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class SongDetails(models.Model):
    """Rich metadata for a song once Shazam has identified it at least once."""
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    album = models.CharField(max_length=255, blank=True, default='')
    label = models.CharField(max_length=255, blank=True, default='')
    released = models.CharField(max_length=64, blank=True, default='')
    writers = models.JSONField(default=list, blank=True)
    performers = models.JSONField(default=list, blank=True)
    genres = models.JSONField(default=list, blank=True)
    artwork_url = models.URLField(max_length=500, blank=True, default='')
    shazam_key = models.CharField(max_length=64, blank=True, default='')
    raw = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('title', 'artist')
        ordering = ('title',)

    def __str__(self):
        return f"{self.title} - {self.artist}"


class DetailBackfillRequest(models.Model):
    """One pending/attempted Shazam look-up to enrich SongDetails."""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('no_results', 'No results'),
        ('failed', 'Failed'),
        ('rate_limited', 'Rate limited'),
    )
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    source = models.CharField(max_length=16, choices=(('catalog', 'Catalog'), ('played', 'Played')), default='catalog')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.status}: {self.title} - {self.artist}"


class SongPlayed(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    album = models.CharField(max_length=255)
    radio_name = models.CharField(max_length=255,null=True,blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} by {self.artist}"
