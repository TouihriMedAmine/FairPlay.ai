from django.http import JsonResponse, Http404
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import RegisterSerializer, UserSerializer, RadioStationSerializer
from rest_framework import generics
from django.db.models import Q
from .models import SongPlayed, RadioStation, SongDetails
from .serializers import SongPlayedSerializer, SongDetailsSerializer
from rest_framework_simplejwt.tokens import RefreshToken


@api_view(['POST'])
@permission_classes([AllowAny])
def RegisterUser(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Generate JWT manually
        refresh = RefreshToken.for_user(user)

        # ✅ Add username into the token payload
        refresh['username'] = user.username

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'username': user.username
        })
    return Response(serializer.errors, status=400)


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # ✅ Include username in login tokens too
        token['username'] = user.username
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


@method_decorator(csrf_exempt, name='dispatch')
class SongPlayedView(generics.ListCreateAPIView):
    queryset = SongPlayed.objects.all()
    serializer_class = SongPlayedSerializer
    permission_classes = [AllowAny]


@method_decorator(csrf_exempt, name='dispatch')
class SongPlayedDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SongPlayed.objects.all()
    serializer_class = SongPlayedSerializer
    permission_classes = [AllowAny]


class RadioStationView(generics.ListCreateAPIView):
    queryset = RadioStation.objects.filter(is_active=True)
    serializer_class = RadioStationSerializer
    permission_classes = [AllowAny]


@method_decorator(csrf_exempt, name='dispatch')
class SongDetailsView(generics.ListCreateAPIView):
    """GET: list/search song details (?search=title or artist)
    POST: upsert a details dict from the fetcher (unique by title+artist)"""
    serializer_class = SongDetailsSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = SongDetails.objects.all()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(artist__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        obj, created = SongDetails.objects.update_or_create(
            title=data.get('title', ''), artist=data.get('artist', ''),
            defaults={k: v for k, v in data.items()
                      if k not in ('title', 'artist')},
        )
        out = SongDetailsSerializer(obj, context={'request': request})
        return Response(out.data, status=201 if created else 200)


class SongDetailsDetailView(generics.RetrieveAPIView):
    queryset = SongDetails.objects.all()
    serializer_class = SongDetailsSerializer
    permission_classes = [AllowAny]
