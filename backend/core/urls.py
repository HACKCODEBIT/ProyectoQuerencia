"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI
from rutas.auth import router as auth_router
from rutas.usuario import router as usuario_router
from rutas.caja import caja_router
from rutas.wompi import wompi_router

api = NinjaAPI(
    title="Proyecto Querencia API",
    description="Backend para el aplicativo web Proyecto Querencia - Sprint 1 (Login, Logout y CRUD de Usuarios)",
    version="1.0.0"
)

api.add_router("/auth", auth_router)
api.add_router("/usuarios", usuario_router)
api.add_router("/caja", caja_router)
api.add_router("/pagos", wompi_router)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
]
