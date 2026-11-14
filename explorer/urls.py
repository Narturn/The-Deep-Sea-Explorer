from django.urls import path
from .views import IndexView, MarineSpeciesDetailView, OceanGlobeView

app_name = 'explorer'

urlpatterns = [
    path('', OceanGlobeView.as_view(), name='globe'),
    path('mariana-trench/', IndexView.as_view(), name='index'),
    path('species/<slug:slug>/', MarineSpeciesDetailView.as_view(), name='species_detail'),
]

