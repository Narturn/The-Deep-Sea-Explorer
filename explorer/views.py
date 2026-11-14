from django.db.models import Prefetch
from django.http import Http404
from django.urls import reverse
from django.views.generic import TemplateView
from .models import ExplorerItem, MarineSpecies, OceanLayer, OceanLocation, SpeciesEcosystem


class OceanGlobeView(TemplateView):
    template_name = 'explorer/globe.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Ocean Explorer – Khám phá các vùng biển trên thế giới'

        published_species_links_prefetch = Prefetch(
            'ecosystems__species_links',
            queryset=(
                SpeciesEcosystem.objects.filter(species__is_published=True)
                .select_related('species')
                .order_by('-is_key_species', 'species__vietnamese_name', 'species__name')
            ),
        )

        locations_qs = (
            OceanLocation.objects.filter(is_published=True)
            .prefetch_related('ecosystems', published_species_links_prefetch)
            .order_by('sort_order')
        )

        locations_data = []
        for location in locations_qs:
            ecosystems_data = []
            for eco in location.ecosystems.all():
                species_data = []
                for link in eco.species_links.all():
                    sp = getattr(link, 'species', None)
                    if not sp or not getattr(sp, 'is_published', False):
                        continue
                    species_data.append({
                        'id': sp.id,
                        'name': sp.name,
                        'vietnamese_name': sp.vietnamese_name,
                        'scientific_name': sp.scientific_name,
                        'slug': sp.slug,
                        'image_url': sp.image_url,
                        'detail_url': reverse('explorer:species_detail', kwargs={'slug': sp.slug}),
                    })

                ecosystems_data.append({
                    'id': eco.id,
                    'name': eco.name,
                    'vietnamese_name': eco.vietnamese_name,
                    'slug': eco.slug,
                    'ecosystem_type': eco.ecosystem_type,
                    'ecosystem_type_display': eco.get_ecosystem_type_display(),
                    'depth_range_text': eco.depth_range_text,
                    'temperature_range_text': eco.temperature_range_text,
                    'light_level': eco.light_level,
                    'light_level_display': eco.get_light_level_display(),
                    'description': eco.description,
                    'species': species_data,
                })

            locations_data.append({
                'id': location.id,
                'name': location.name,
                'vietnamese_name': location.vietnamese_name,
                'slug': location.slug,
                'region': location.region,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'max_depth_m': location.max_depth_m,
                'short_description': location.short_description,
                'description': location.description,
                'image_url': location.image_url,
                'is_explorable': location.is_explorable,
                'explore_url': location.explore_url if location.is_explorable else '',
                'sort_order': location.sort_order,
                'ecosystems': ecosystems_data,
            })

        context['ocean_locations_data'] = locations_data
        return context


class MarineSpeciesDetailView(TemplateView):
    template_name = 'explorer/species_detail.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        slug = self.kwargs.get('slug')

        ecosystem_links_prefetch = Prefetch(
            'ecosystem_links',
            queryset=(
                SpeciesEcosystem.objects.select_related('ecosystem', 'ecosystem__location')
                .order_by('ecosystem__location__sort_order', 'ecosystem__name')
            ),
        )

        try:
            species = (
                MarineSpecies.objects.filter(is_published=True)
                .prefetch_related(
                    'references',
                    ecosystem_links_prefetch,
                )
                .get(slug=slug)
            )
        except MarineSpecies.DoesNotExist as exc:
            raise Http404("Sinh vật không tồn tại hoặc chưa được xuất bản.") from exc

        context['species'] = {
            'id': species.id,
            'name': species.name,
            'vietnamese_name': species.vietnamese_name,
            'scientific_name': species.scientific_name,
            'slug': species.slug,
            'species_group': species.species_group,
            'species_group_display': species.get_species_group_display(),
            'conservation_status': species.conservation_status,
            'conservation_status_display': species.get_conservation_status_display(),
            'min_depth_m': species.min_depth_m,
            'max_depth_m': species.max_depth_m,
            'short_description': species.short_description,
            'description': species.description,
            'biological_traits': species.biological_traits,
            'image_url': species.image_url,
            'image_source_url': species.image_source_url,
            'image_credit': species.image_credit,
            'image_license': species.image_license,
        }
        context['ecosystem_links'] = [
            {
                'ecosystem_slug': link.ecosystem.slug,
                'ecosystem_name': link.ecosystem.name,
                'ecosystem_vietnamese_name': link.ecosystem.vietnamese_name,
                'ecosystem_type_display': link.ecosystem.get_ecosystem_type_display(),
                'ecosystem_depth_range_text': link.ecosystem.depth_range_text,
                'ecosystem_temperature_range_text': link.ecosystem.temperature_range_text,
                'location_name': link.ecosystem.location.name,
                'location_vietnamese_name': link.ecosystem.location.vietnamese_name,
                'local_depth_range_text': link.local_depth_range_text,
                'adaptation_notes': link.adaptation_notes,
            }
            for link in species.ecosystem_links.all()
        ]
        context['references'] = [
            {
                'title': ref.title,
                'publisher': ref.publisher,
                'published_year': ref.published_year,
                'url': ref.url,
                'notes': ref.notes,
            }
            for ref in species.references.all()
        ]
        context['title'] = f"{species.vietnamese_name} ({species.name}) – Ocean Explorer"
        return context


class IndexView(TemplateView):
    template_name = 'explorer/index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'The Deep Sea Explorer – Hành trình thám hiểm biển sâu'

        # Lấy toàn bộ OceanLayer, sắp xếp theo sort_order
        layers_qs = OceanLayer.objects.all().order_by('sort_order')
        layers_data = [
            {
                'id': layer.id,
                'name': layer.name,
                'vietnamese_name': layer.vietnamese_name,
                'depth_start_m': layer.depth_start_m,
                'depth_end_m': layer.depth_end_m,
                'sort_order': layer.sort_order,
                'color_start': layer.color_start,
                'color_end': layer.color_end,
                'description': layer.description,
            }
            for layer in layers_qs
        ]

        # Lấy ExplorerItem có is_published=True, tối ưu bằng select_related, sắp xếp theo depth_m
        items_qs = (
            ExplorerItem.objects.filter(is_published=True)
            .select_related('layer')
            .order_by('depth_m')
        )
        items_data = [
            {
                'id': item.id,
                'name': item.name,
                'slug': item.slug,
                'item_type': item.item_type,
                'scientific_name': item.scientific_name,
                'depth_m': item.depth_m,
                'layer_id': item.layer_id,
                'layer_name': item.layer.vietnamese_name,
                'short_description': item.short_description,
                'fact': item.fact,
                'image_url': item.image_url,
                'image_source_url': item.image_source_url,
                'image_credit': item.image_credit,
                'image_license': item.image_license,
                'detail_url': item.detail_url,
                'is_verified': item.is_verified,
            }
            for item in items_qs
        ]

        context['ocean_layers_data'] = layers_data
        context['explorer_items_data'] = items_data
        return context
