from django.urls import path
from .views import RegisterUser, MyTokenObtainPairView, RadioStationView
from .views import SongPlayedView, SongPlayedDetailView, SongDetailsView, SongDetailsDetailView
urlpatterns = [
    path('login/', MyTokenObtainPairView.as_view(), name='login'),
    path('register/', RegisterUser, name='register'), 
    path('songplayed/', SongPlayedView.as_view(), name='songplayed'),
    path('songplayed/<int:pk>/', SongPlayedDetailView.as_view(), name='songplayed-detail'),
    path('radiostations/', RadioStationView.as_view(), name='radiostations'),
    path('songdetails/', SongDetailsView.as_view(), name='songdetails'),
    path('songdetails/<int:pk>/', SongDetailsDetailView.as_view(), name='songdetails-detail'),

]