import json
from unittest.mock import MagicMock, patch
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from explorer.models import Ecosystem, ExplorerItem, OceanLayer, OceanLocation, ReferenceSource
from explorer.views import IndexView, OceanGlobeView


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

        response = self.client.get('/mariana-trench/')
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


class OceanGlobeViewTests(SimpleTestCase):
    def setUp(self):
        # Tạo mock 7 địa điểm đại dương theo dữ liệu chuẩn
        location_specs = [
            (1, 'Great Barrier Reef', 'Rạn san hô Great Barrier', 'great-barrier-reef', 'Biển San Hô, Úc', -18.2871, 147.6992, 2000, False, ''),
            (2, 'Sundarbans', 'Rừng ngập mặn Sundarbans', 'sundarbans', 'Vịnh Bengal', 21.9497, 89.1833, 50, False, ''),
            (3, 'Monterey Bay', 'Vịnh Monterey', 'monterey-bay', 'Đông Bắc Thái Bình Dương', 36.8, -121.9, 3600, False, ''),
            (4, 'Shark Bay', 'Vịnh Cá Mập', 'shark-bay', 'Tây Úc', -25.7833, 113.7, 29, False, ''),
            (5, 'Antarctic Peninsula', 'Bán đảo Nam Cực', 'antarctic-peninsula', 'Nam Đại Dương', -65.5, -64.0, 1500, False, ''),
            (6, 'East Pacific Rise', 'Đới nâng Đông Thái Bình Dương', 'east-pacific-rise', 'Đông Nam Thái Bình Dương', -9.8333, -104.2833, 2800, False, ''),
            (7, 'Mariana Trench', 'Rãnh Mariana', 'mariana-trench', 'Tây Bắc Thái Bình Dương', 11.3493, 142.1996, 10928, True, '/mariana-trench/'),
        ]

        self.mock_locations = []
        for idx, name, vi_name, slug, region, lat, lng, depth, explorable, url in location_specs:
            loc = MagicMock()
            loc.id = idx
            loc.name = name
            loc.vietnamese_name = vi_name
            loc.slug = slug
            loc.region = region
            loc.latitude = lat
            loc.longitude = lng
            loc.max_depth_m = depth
            loc.short_description = f'Mô tả ngắn {vi_name}'
            loc.description = f'Mô tả chi tiết {vi_name}'
            loc.image_url = ''
            loc.is_explorable = explorable
            loc.explore_url = url
            loc.is_published = True
            loc.sort_order = idx

            eco = MagicMock()
            eco.id = idx * 10
            eco.name = f'{name} Ecosystem'
            eco.vietnamese_name = f'Quần xã {vi_name}'
            eco.slug = f'{slug}-eco'
            eco.ecosystem_type = Ecosystem.EcosystemType.HADAL_TRENCH if explorable else Ecosystem.EcosystemType.CORAL_REEF
            eco.get_ecosystem_type_display.return_value = 'Rãnh sâu Hadal (Hadal Trench)' if explorable else 'Rạn san hô (Coral Reef)'
            eco.depth_range_text = f'0m – {depth}m'
            eco.temperature_range_text = '1°C – 25°C'
            eco.light_level = Ecosystem.LightLevel.NONE if explorable else Ecosystem.LightLevel.HIGH
            eco.get_light_level_display.return_value = 'Không có ánh sáng' if explorable else 'Cao'
            eco.description = f'Đặc điểm sinh thái {vi_name}'

            loc.ecosystems.all.return_value = [eco]
            self.mock_locations.append(loc)

    @patch('explorer.views.OceanLocation.objects')
    def test_globe_homepage_status_template_and_locations(self, mock_loc_qs):
        mock_loc_qs.filter.return_value.prefetch_related.return_value.order_by.return_value = self.mock_locations

        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'explorer/globe.html')
        self.assertTemplateUsed(response, 'base.html')

        # Chỉ truy vấn các địa điểm có is_published=True
        mock_loc_qs.filter.assert_called_once_with(is_published=True)

        locations_data = response.context['ocean_locations_data']
        self.assertEqual(len(locations_data), 7)

        # Kiểm tra 6 địa điểm đầu không có link Explore hoạt động
        for loc_dict in locations_data[:6]:
            self.assertFalse(loc_dict['is_explorable'])
            self.assertEqual(loc_dict['explore_url'], '')

        # Kiểm tra Mariana Trench có link /mariana-trench/
        mariana = locations_data[6]
        self.assertEqual(mariana['name'], 'Mariana Trench')
        self.assertTrue(mariana['is_explorable'])
        self.assertEqual(mariana['explore_url'], '/mariana-trench/')

        # Kiểm tra dữ liệu Ecosystem đi kèm từng địa điểm
        self.assertEqual(len(mariana['ecosystems']), 1)
        self.assertEqual(mariana['ecosystems'][0]['ecosystem_type'], 'HADAL_TRENCH')
        self.assertEqual(mariana['ecosystems'][0]['depth_range_text'], '0m – 10928m')

        # Kiểm tra HTML render và json_script
        content = response.content.decode()
        self.assertIn('id="globe-container"', content)
        self.assertIn('id="globe-canvas"', content)
        self.assertIn('id="ocean-locations-data"', content)
        self.assertIn('href="/mariana-trench/"', content)
        self.assertEqual(content.count('class="location-explore-btn"'), 1)
        self.assertEqual(content.count('Hành trình lặn chi tiết đang được cập nhật'), 6)

        # Đảm bảo JSON trong json_script hợp lệ và chứa đủ 7 địa điểm
        script_json = content.split('<script id="ocean-locations-data" type="application/json">')[1].split('</script>')[0]
        parsed_locations = json.loads(script_json)
        self.assertEqual(len(parsed_locations), 7)
        self.assertEqual(parsed_locations[6]['slug'], 'mariana-trench')
        self.assertEqual(parsed_locations[6]['explore_url'], '/mariana-trench/')

    @patch('explorer.views.OceanLocation.objects')
    def test_unpublished_locations_are_excluded(self, mock_loc_qs):
        mock_loc_qs.filter.return_value.prefetch_related.return_value.order_by.return_value = []

        view = OceanGlobeView()
        context = view.get_context_data()

        mock_loc_qs.filter.assert_called_once_with(is_published=True)
        self.assertEqual(context['ocean_locations_data'], [])

