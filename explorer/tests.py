import json
from unittest.mock import MagicMock, patch
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from explorer.models import ExplorerItem, OceanLayer, ReferenceSource
from explorer.views import IndexView


class ExplorerRouteAndDataFlowTests(SimpleTestCase):
    def setUp(self):
        # Tạo mock 5 tầng đại dương
        self.mock_layers = []
        layer_configs = [
            (1, 'Epipelagic', 'Tầng Nắng rọi', 0, 200, '#1ca7d0', '#0d5c8a'),
            (2, 'Mesopelagic', 'Tầng Chạng vạng', 200, 1000, '#0d5c8a', '#101c42'),
            (3, 'Bathypelagic', 'Tầng Nửa đêm', 1000, 4000, '#101c42', '#080b18'),
            (4, 'Abyssopelagic', 'Tầng Vực thẳm', 4000, 6000, '#080b18', '#04060c'),
            (5, 'Hadalpelagic', 'Tầng Địa ngục', 6000, 10928, '#04060c', '#020408'),
        ]
        for sort_order, name, vi_name, start, end, c_start, c_end in layer_configs:
            m = MagicMock()
            m.id = sort_order
            m.name = name
            m.vietnamese_name = vi_name
            m.depth_start_m = start
            m.depth_end_m = end
            m.sort_order = sort_order
            m.color_start = c_start
            m.color_end = c_end
            m.description = f'Mô tả {vi_name}'
            self.mock_layers.append(m)

        # Tạo mock ExplorerItem đã xuất bản
        self.mock_published_item = MagicMock()
        self.mock_published_item.id = 101
        self.mock_published_item.name = 'Rồng xanh biển'
        self.mock_published_item.slug = 'rong-xanh-bien'
        self.mock_published_item.item_type = 'CREATURE'
        self.mock_published_item.scientific_name = 'Glaucus atlanticus'
        self.mock_published_item.depth_m = 15
        self.mock_published_item.layer_id = 1
        self.mock_published_item.layer = self.mock_layers[0]
        self.mock_published_item.short_description = 'Sên biển xanh'
        self.mock_published_item.fact = 'Có khả năng tích lũy nọc độc từ con sứa Physalia physalis để tự vệ.'
        self.mock_published_item.image_url = 'https://example.com/glaucus.jpg'
        self.mock_published_item.image_source_url = 'https://example.com/glaucus-source'
        self.mock_published_item.image_credit = 'Sylke Rohrlach'
        self.mock_published_item.image_license = 'CC BY-SA 2.0'
        self.mock_published_item.detail_url = 'https://example.com/details'
        self.mock_published_item.is_verified = True
        self.mock_published_item.is_published = True

    @patch('explorer.views.ExplorerItem.objects')
    @patch('explorer.views.OceanLayer.objects')
    def test_homepage_status_and_data_embedding(self, mock_layer_qs, mock_item_qs):
        mock_layer_qs.all.return_value.order_by.return_value = self.mock_layers
        mock_item_qs.filter.return_value.select_related.return_value.order_by.return_value = [
            self.mock_published_item
        ]

        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'explorer/index.html')
        self.assertTemplateUsed(response, 'base.html')

        # Xác nhận có 5 tầng trong context
        layers_context = response.context['ocean_layers_data']
        self.assertEqual(len(layers_context), 5)
        self.assertEqual(layers_context[0]['name'], 'Epipelagic')
        self.assertEqual(layers_context[4]['name'], 'Hadalpelagic')

        # Xác nhận đối tượng published có trong context
        items_context = response.context['explorer_items_data']
        self.assertEqual(len(items_context), 1)
        self.assertEqual(items_context[0]['slug'], 'rong-xanh-bien')
        self.assertEqual(items_context[0]['layer_name'], 'Tầng Nắng rọi')

        # Xác nhận JSON được nhúng an toàn bằng json_script vào HTML
        content = response.content.decode()
        self.assertIn('id="ocean-layers-data"', content)
        self.assertIn('id="explorer-items-data"', content)
        self.assertRegex(content, r'/static/js/main(\.[a-f0-9]+)?\.js')

        # Parse trực tiếp nội dung json_script để đảm bảo client JS đọc được chính xác tiếng Việt
        items_script_content = content.split('<script id="explorer-items-data" type="application/json">')[1].split('</script>')[0]
        parsed_items = json.loads(items_script_content)
        self.assertEqual(len(parsed_items), 1)
        self.assertEqual(parsed_items[0]['name'], 'Rồng xanh biển')
        self.assertEqual(parsed_items[0]['scientific_name'], 'Glaucus atlanticus')
        self.assertEqual(parsed_items[0]['fact'], 'Có khả năng tích lũy nọc độc từ con sứa Physalia physalis để tự vệ.')
        self.assertEqual(parsed_items[0]['image_credit'], 'Sylke Rohrlach')

        layers_script_content = content.split('<script id="ocean-layers-data" type="application/json">')[1].split('</script>')[0]
        parsed_layers = json.loads(layers_script_content)
        self.assertEqual(len(parsed_layers), 5)
        self.assertEqual(parsed_layers[0]['vietnamese_name'], 'Tầng Nắng rọi')
        self.assertEqual(parsed_layers[0]['description'], 'Mô tả Tầng Nắng rọi')

        # Xác nhận các thành phần Frontend Core (Phase 5) hiện diện đầy đủ
        self.assertIn('class="depth-hud"', content)
        self.assertIn('id="depth-counter-value"', content)
        self.assertIn('id="hud-layer-badge"', content)
        self.assertIn('id="env-pressure-value"', content)
        self.assertIn('id="env-temp-value"', content)
        self.assertIn('id="ocean-background"', content)
        self.assertIn('id="ocean-spotlight"', content)
        self.assertIn('id="particles-container"', content)
        self.assertIn('id="ocean-stage"', content)
        self.assertIn('id="vertical-track"', content)
        self.assertRegex(content, r'variables(\.[a-f0-9]+)?\.css')
        self.assertRegex(content, r'base(\.[a-f0-9]+)?\.css')
        self.assertRegex(content, r'hud(\.[a-f0-9]+)?\.css')
        self.assertRegex(content, r'stage(\.[a-f0-9]+)?\.css')
        self.assertIn('type="module"', content)

        # Xác nhận các thành phần Phase 6 & Phase Content Management (Quick Jump & Inspector Drawer with Fact)
        self.assertRegex(content, r'quick_jump(\.[a-f0-9]+)?\.css')
        self.assertRegex(content, r'inspector(\.[a-f0-9]+)?\.css')
        self.assertIn('id="quick-jump-trigger"', content)
        self.assertIn('id="quick-jump-panel"', content)
        self.assertIn('id="quick-jump-layers-list"', content)
        self.assertIn('id="quick-jump-items-list"', content)
        self.assertIn('id="inspector-backdrop"', content)
        self.assertIn('id="inspector-drawer"', content)
        self.assertIn('id="inspector-close-btn"', content)
        self.assertIn('id="inspector-type-badge"', content)
        self.assertIn('id="inspector-title"', content)
        self.assertIn('id="inspector-depth-val"', content)
        self.assertIn('id="inspector-fact-container"', content)
        self.assertIn('id="inspector-fact"', content)
        self.assertIn('id="inspector-detail-link"', content)

    @patch('explorer.views.ExplorerItem.objects')
    @patch('explorer.views.OceanLayer.objects')
    def test_multiple_published_items_data_flow(self, mock_layer_qs, mock_item_qs):
        mock_layer_qs.all.return_value.order_by.return_value = self.mock_layers[:1]

        item1 = MagicMock()
        item1.id = 1
        item1.name = 'Rồng xanh'
        item1.slug = 'rong-xanh'
        item1.item_type = 'CREATURE'
        item1.scientific_name = 'Glaucus'
        item1.depth_m = 15
        item1.layer_id = 1
        item1.layer = self.mock_layers[0]
        item1.short_description = 'Mô tả sên'
        item1.fact = 'Nội dung fact'
        item1.image_url = 'https://example.com/1.jpg'
        item1.image_source_url = 'https://example.com/src'
        item1.image_credit = 'Credit'
        item1.image_license = 'CC'
        item1.detail_url = 'https://example.com/detail'
        item1.is_verified = True
        item1.is_published = True

        item2 = MagicMock()
        item2.id = 2
        item2.name = 'Tượng Chúa Cứu thế'
        item2.slug = 'tuong-chua'
        item2.item_type = 'MILESTONE'
        item2.scientific_name = ''
        item2.depth_m = 17
        item2.layer_id = 1
        item2.layer = self.mock_layers[0]
        item2.short_description = 'Tượng đồng dưới đáy vịnh'
        item2.fact = 'Tượng đồng dưới đáy vịnh'
        item2.image_url = ''
        item2.image_source_url = ''
        item2.image_credit = ''
        item2.image_license = ''
        item2.detail_url = ''
        item2.is_verified = True
        item2.is_published = True

        mock_item_qs.filter.return_value.select_related.return_value.order_by.return_value = [item1, item2]

        view = IndexView()
        context = view.get_context_data()
        items = context['explorer_items_data']
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['name'], 'Rồng xanh')
        self.assertEqual(items[1]['name'], 'Tượng Chúa Cứu thế')
        self.assertEqual(items[1]['depth_m'], 17)

    @patch('explorer.views.ExplorerItem.objects')
    @patch('explorer.views.OceanLayer.objects')
    def test_unpublished_items_are_excluded_by_filter(self, mock_layer_qs, mock_item_qs):
        mock_layer_qs.all.return_value.order_by.return_value = self.mock_layers
        mock_item_qs.filter.return_value.select_related.return_value.order_by.return_value = []

        view = IndexView()
        context = view.get_context_data()

        # Xác nhận filter(is_published=True) đã được gọi
        mock_item_qs.filter.assert_called_once_with(is_published=True)
        self.assertEqual(len(context['explorer_items_data']), 0)

    @patch('explorer.views.ExplorerItem.objects')
    @patch('explorer.views.OceanLayer.objects')
    def test_data_structure_contains_only_necessary_fields(self, mock_layer_qs, mock_item_qs):
        mock_layer_qs.all.return_value.order_by.return_value = self.mock_layers[:1]
        mock_item_qs.filter.return_value.select_related.return_value.order_by.return_value = [
            self.mock_published_item
        ]

        view = IndexView()
        context = view.get_context_data()

        layer_data = context['ocean_layers_data'][0]
        expected_layer_keys = {
            'id', 'name', 'vietnamese_name', 'depth_start_m', 'depth_end_m',
            'sort_order', 'color_start', 'color_end', 'description'
        }
        self.assertEqual(set(layer_data.keys()), expected_layer_keys)

        item_data = context['explorer_items_data'][0]
        expected_item_keys = {
            'id', 'name', 'slug', 'item_type', 'scientific_name', 'depth_m',
            'layer_id', 'layer_name', 'short_description', 'fact', 'image_url',
            'image_source_url', 'image_credit', 'image_license',
            'detail_url', 'is_verified'
        }
        self.assertEqual(set(item_data.keys()), expected_item_keys)

    def test_admin_route_exists(self):
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 302)


class ExplorerValidationTests(SimpleTestCase):
    def test_ocean_layer_contains_depth_logic(self):
        layer_epipelagic = OceanLayer(
            name='Epipelagic',
            vietnamese_name='Tầng Nắng rọi',
            depth_start_m=0,
            depth_end_m=200,
            sort_order=1
        )
        self.assertTrue(layer_epipelagic.contains_depth(0))
        self.assertTrue(layer_epipelagic.contains_depth(199))
        self.assertFalse(layer_epipelagic.contains_depth(200))
        self.assertFalse(layer_epipelagic.contains_depth(300))

        layer_hadalpelagic = OceanLayer(
            name='Hadalpelagic',
            vietnamese_name='Tầng Địa ngục',
            depth_start_m=6000,
            depth_end_m=10928,
            sort_order=5
        )
        self.assertTrue(layer_hadalpelagic.contains_depth(6000))
        self.assertTrue(layer_hadalpelagic.contains_depth(10928))
        self.assertFalse(layer_hadalpelagic.contains_depth(5999))
        self.assertFalse(layer_hadalpelagic.contains_depth(10929))

    def test_explorer_item_depth_validation_within_layer(self):
        layer_meso = OceanLayer(
            id=2,
            name='Mesopelagic',
            vietnamese_name='Tầng Chạng vạng',
            depth_start_m=200,
            depth_end_m=1000,
            sort_order=2
        )

        valid_item = ExplorerItem(
            name='Cá mắt thùng',
            slug='ca-mat-thung',
            item_type=ExplorerItem.ItemType.CREATURE,
            depth_m=600,
            layer=layer_meso,
            fact='Mắt hình ống nằm trong vòm đầu trong suốt chứa đầy chất lỏng.'
        )
        valid_item.clean()
        self.assertFalse(valid_item.is_verified)
        self.assertFalse(valid_item.is_published)
        self.assertEqual(valid_item.fact, 'Mắt hình ống nằm trong vòm đầu trong suốt chứa đầy chất lỏng.')

        invalid_item = ExplorerItem(
            name='Cá lạc tầng',
            slug='ca-lac-tang',
            item_type=ExplorerItem.ItemType.CREATURE,
            depth_m=150,
            layer=layer_meso
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_item.clean()
        self.assertIn('depth_m', ctx.exception.message_dict)

    def test_explorer_item_system_depth_bounds(self):
        layer_hadal = OceanLayer(
            id=5,
            name='Hadalpelagic',
            vietnamese_name='Tầng Địa ngục',
            depth_start_m=6000,
            depth_end_m=10928,
            sort_order=5
        )
        beyond_item = ExplorerItem(
            name='Vượt đáy',
            slug='vuot-day',
            item_type=ExplorerItem.ItemType.MILESTONE,
            depth_m=10929,
            layer=layer_hadal
        )
        with self.assertRaises(ValidationError) as ctx:
            beyond_item.clean()
        self.assertIn('depth_m', ctx.exception.message_dict)

    def test_reference_source_string_representation(self):
        ref = ReferenceSource(
            title='NOAA Ocean Exploration Report',
            publisher='NOAA',
            published_year=2023
        )
        self.assertEqual(str(ref), 'NOAA Ocean Exploration Report (2023)')
