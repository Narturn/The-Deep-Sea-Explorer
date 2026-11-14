from django.urls import path
from .views import IndexView, OceanGlobeView

app_name = 'explorer'

urlpatterns = [
    path('', OceanGlobeView.as_view(), name='globe'),
    path('mariana-trench/', IndexView.as_view(), name='index'),
]

