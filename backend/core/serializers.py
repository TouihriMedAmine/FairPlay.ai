from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework.validators import UniqueValidator
from .models import SongPlayed, RadioStation, SongDetails
class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField( 
            required=True,
            validators=[UniqueValidator(queryset=User.objects.all())]
            )

    password = serializers.CharField(write_only=True, required=True)
    

    class Meta:
        model = User
        fields = ('id','username', 'password', 'email')#, 'first_name', 'last_name','is_active'
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True}
        }

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            # first_name=validated_data['first_name'],
            # last_name=validated_data['last_name'],
            # is_active=True
        )

        user.set_password(validated_data['password'])
        user.save()

        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id','username', 'email', 'first_name', 'last_name','is_active')


class SongPlayedSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongPlayed
        fields = (
            'id', 'timestamp', 'title', 'artist', 'album', 'radio_name',
            'start_time', 'end_time', 'duration'
        )


class RadioStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RadioStation
        fields = ('id', 'name', 'url', 'is_active', 'created_at')


class SongDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongDetails
        fields = (
            'id', 'title', 'artist', 'album', 'label', 'released',
            'writers', 'performers', 'genres', 'artwork_url', 'shazam_key',
            'raw', 'updated_at',
        )
        extra_kwargs = {'raw': {'write_only': True}}
