from django.views.generic import TemplateView
from .models import ExplorerItem, OceanLayer


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
