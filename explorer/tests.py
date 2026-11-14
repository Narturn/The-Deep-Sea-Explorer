import json
from unittest.mock import MagicMock, patch
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from explorer.models import (
    Ecosystem,
    ExplorerItem,
    MarineSpecies,
    OceanLayer,
    OceanLocation,
    ReferenceSource,
    SpeciesEcosystem,
)
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

    def test_marine_species_validation_and_defaults(self):
        species = MarineSpecies(
            name='Giant Tube Worm',
            vietnamese_name='Giun ống khổng lồ',
            scientific_name='Riftia pachyptila',
            species_group=MarineSpecies.SpeciesGroup.INVERTEBRATE,
            description='Sinh vật cộng sinh hóa tổng hợp quanh miệng phun thủy nhiệt.',
            min_depth_m=1500,
            max_depth_m=2800,
        )
        species.clean()
        self.assertEqual(species.slug, 'giant-tube-worm')
        self.assertFalse(species.is_published)
        self.assertFalse(species.is_verified)
        self.assertEqual(species.conservation_status, MarineSpecies.ConservationStatus.NE)
        self.assertEqual(str(species), 'Giun ống khổng lồ (Riftia pachyptila)')

        invalid_species = MarineSpecies(
            name='Invalid Depth Fish',
            vietnamese_name='Cá lỗi độ sâu',
            scientific_name='Pisces invalidus',
            description='Kiểm tra lỗi min_depth_m > max_depth_m',
            min_depth_m=3000,
            max_depth_m=1000,
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_species.clean()
        self.assertIn('min_depth_m', ctx.exception.message_dict)
        self.assertIn('max_depth_m', ctx.exception.message_dict)

    def test_species_ecosystem_constraints_and_str(self):
        loc = OceanLocation(
            name='East Pacific Rise',
            vietnamese_name='Đới nâng Đông Thái Bình Dương',
            slug='east-pacific-rise',
            region='Đông Nam Thái Bình Dương',
            latitude=-9.8333,
            longitude=-104.2833,
            max_depth_m=2800,
            short_description='Đới tách giãn đại dương',
            description='Mô tả chi tiết',
        )
        eco = Ecosystem(
            location=loc,
            name='Black Smoker Vents',
            vietnamese_name='Quần xã ống khói đen',
            slug='black-smoker-vents',
            ecosystem_type=Ecosystem.EcosystemType.HYDROTHERMAL_VENT,
            depth_range_text='2.400m – 2.800m',
            light_level=Ecosystem.LightLevel.NONE,
            description='Hệ sinh thái hóa tổng hợp',
        )
        species = MarineSpecies(
            name='Giant Tube Worm',
            vietnamese_name='Giun ống khổng lồ',
            scientific_name='Riftia pachyptila',
            slug='giant-tube-worm',
            description='Mô tả',
            min_depth_m=1500,
            max_depth_m=2800,
        )
        link = SpeciesEcosystem(
            species=species,
            ecosystem=eco,
            local_depth_range_text='2.450m – 2.750m',
            adaptation_notes='Sống nhờ vi khuẩn oxy hóa H2S trong cơ quan trophosome.',
            is_key_species=True,
        )
        self.assertEqual(str(link), 'Giun ống khổng lồ @ Quần xã ống khói đen')

        constraint_names = [c.name for c in SpeciesEcosystem._meta.constraints]
        self.assertIn('unique_species_per_ecosystem', constraint_names)


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

    @patch('explorer.views.OceanLocation.objects')
    def test_species_list_in_ecosystems_and_shared_green_turtle(self, mock_loc_qs):
        gbr_loc = self.mock_locations[0]

        coral_eco = MagicMock()
        coral_eco.id = 11
        coral_eco.name = 'Coral Reef'
        coral_eco.vietnamese_name = 'Rạn san hô nhiệt đới'
        coral_eco.slug = 'gbr-coral-reef'
        coral_eco.ecosystem_type = Ecosystem.EcosystemType.CORAL_REEF
        coral_eco.get_ecosystem_type_display.return_value = 'Rạn san hô (Coral Reef)'
        coral_eco.depth_range_text = '0m – 40m'
        coral_eco.temperature_range_text = '22°C – 29°C'
        coral_eco.light_level = Ecosystem.LightLevel.HIGH
        coral_eco.get_light_level_display.return_value = 'Cao'
        coral_eco.description = 'Mô tả rạn san hô'

        seagrass_eco = MagicMock()
        seagrass_eco.id = 12
        seagrass_eco.name = 'Seagrass Meadow'
        seagrass_eco.vietnamese_name = 'Thảm cỏ biển ven đầm phá'
        seagrass_eco.slug = 'gbr-seagrass-meadow'
        seagrass_eco.ecosystem_type = Ecosystem.EcosystemType.SEAGRASS
        seagrass_eco.get_ecosystem_type_display.return_value = 'Thảm cỏ biển (Seagrass)'
        seagrass_eco.depth_range_text = '1m – 35m'
        seagrass_eco.temperature_range_text = '21°C – 28°C'
        seagrass_eco.light_level = Ecosystem.LightLevel.HIGH
        seagrass_eco.get_light_level_display.return_value = 'Cao'
        seagrass_eco.description = 'Mô tả thảm cỏ biển'

        percula = MarineSpecies(
            id=201,
            name='Eastern Clown Anemonefish',
            vietnamese_name='Cá hề miền Đông',
            scientific_name='Amphiprion percula',
            slug='amphiprion-percula',
            image_url='https://upload.wikimedia.org/wikipedia/commons/0/08/Amphiprion_percula_1.jpg',
            min_depth_m=1,
            max_depth_m=15,
            is_published=True,
        )
        green_turtle = MarineSpecies(
            id=202,
            name='Green Sea Turtle',
            vietnamese_name='Rùa xanh (Vích)',
            scientific_name='Chelonia mydas',
            slug='green-sea-turtle',
            image_url='https://upload.wikimedia.org/wikipedia/commons/e/e5/Green_turtle_swimming_over_coral_reefs_in_Kona.jpg',
            min_depth_m=0,
            max_depth_m=50,
            is_published=True,
        )
        dugong = MarineSpecies(
            id=203,
            name='Dugong',
            vietnamese_name='Bò biển (Cá cúi)',
            scientific_name='Dugong dugon',
            slug='dugong',
            image_url='https://upload.wikimedia.org/wikipedia/commons/9/91/Dugong_Marsa_Alam.jpg',
            min_depth_m=1,
            max_depth_m=37,
            is_published=True,
        )
        unpublished_fish = MarineSpecies(
            id=204,
            name='Hidden Draft Fish',
            vietnamese_name='Cá nháp chưa công bố',
            scientific_name='Draftus secretus',
            slug='hidden-draft-fish',
            image_url='',
            min_depth_m=5,
            max_depth_m=20,
            is_published=False,
        )

        coral_eco.species_links.all.return_value = [
            MagicMock(species=percula),
            MagicMock(species=green_turtle),
            MagicMock(species=unpublished_fish),
        ]
        seagrass_eco.species_links.all.return_value = [
            MagicMock(species=green_turtle),
            MagicMock(species=dugong),
        ]
        gbr_loc.ecosystems.all.return_value = [coral_eco, seagrass_eco]

        mock_loc_qs.filter.return_value.prefetch_related.return_value.order_by.return_value = [gbr_loc]

        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

        gbr_data = response.context['ocean_locations_data'][0]
        coral_species_slugs = [s['slug'] for s in gbr_data['ecosystems'][0]['species']]
        seagrass_species_slugs = [s['slug'] for s in gbr_data['ecosystems'][1]['species']]

        # Rùa xanh xuất hiện ở cả hai hệ sinh thái Coral Reef và Seagrass Meadow
        self.assertIn('green-sea-turtle', coral_species_slugs)
        self.assertIn('green-sea-turtle', seagrass_species_slugs)
        self.assertIn('amphiprion-percula', coral_species_slugs)
        self.assertIn('dugong', seagrass_species_slugs)

        # Sinh vật chưa xuất bản (is_published=False) không được hiển thị
        self.assertNotIn('hidden-draft-fish', coral_species_slugs)

        content = response.content.decode()
        self.assertIn('Eastern Clown Anemonefish', content)
        self.assertIn('Cá hề miền Đông', content)
        self.assertIn('Amphiprion percula', content)
        self.assertIn('Green Sea Turtle', content)
        self.assertIn('Rùa xanh (Vích)', content)
        self.assertIn('Chelonia mydas', content)
        self.assertIn('href="/species/green-sea-turtle/"', content)
        self.assertEqual(content.count('href="/species/green-sea-turtle/"'), 2)
        self.assertNotIn('Hidden Draft Fish', content)
        self.assertNotIn('Draftus secretus', content)


class MarineSpeciesDetailViewTests(SimpleTestCase):
    def setUp(self):
        self.species_obj = MarineSpecies(
            id=202,
            name='Green Sea Turtle',
            vietnamese_name='Rùa xanh (Vích)',
            scientific_name='Chelonia mydas',
            slug='green-sea-turtle',
            species_group=MarineSpecies.SpeciesGroup.REPTILE_BIRD,
            conservation_status=MarineSpecies.ConservationStatus.LC,
            min_depth_m=0,
            max_depth_m=50,
            short_description='Loài rùa biển lớn ăn thực vật khi trưởng thành.',
            description='Mô tả tổng quan về rùa xanh tại Great Barrier Reef.',
            biological_traits='Hàm răng cưa giúp xén lá cỏ biển.',
            image_url='https://upload.wikimedia.org/wikipedia/commons/e/e5/Green_turtle_swimming_over_coral_reefs_in_Kona.jpg',
            image_source_url='https://commons.wikimedia.org/wiki/File:Green_turtle_swimming_over_coral_reefs_in_Kona.jpg',
            image_credit='Brocken Inaglory',
            image_license='CC BY-SA 3.0',
            is_published=True,
        )

        loc = OceanLocation(
            id=1,
            name='Great Barrier Reef',
            vietnamese_name='Rạn san hô Great Barrier',
            slug='great-barrier-reef',
            region='Biển San Hô, Úc',
            latitude=-18.2871,
            longitude=147.6992,
            max_depth_m=2000,
            short_description='Mô tả ngắn',
            description='Mô tả chi tiết',
        )

        eco_1 = Ecosystem(
            id=11,
            location=loc,
            name='Coral Reef',
            vietnamese_name='Rạn san hô nhiệt đới',
            slug='gbr-coral-reef',
            ecosystem_type=Ecosystem.EcosystemType.CORAL_REEF,
            depth_range_text='0m – 40m',
            temperature_range_text='22°C – 29°C',
            light_level=Ecosystem.LightLevel.HIGH,
            description='Mô tả rạn san hô',
        )
        eco_2 = Ecosystem(
            id=12,
            location=loc,
            name='Seagrass Meadow',
            vietnamese_name='Thảm cỏ biển ven đầm phá',
            slug='gbr-seagrass-meadow',
            ecosystem_type=Ecosystem.EcosystemType.SEAGRASS,
            depth_range_text='1m – 35m',
            temperature_range_text='21°C – 28°C',
            light_level=Ecosystem.LightLevel.HIGH,
            description='Mô tả thảm cỏ biển',
        )

        self.link_1 = SpeciesEcosystem(
            id=301,
            species=self.species_obj,
            ecosystem=eco_1,
            local_depth_range_text='',
            adaptation_notes='Nghỉ ngơi dưới gờ đá san hô.',
        )
        self.link_2 = SpeciesEcosystem(
            id=302,
            species=self.species_obj,
            ecosystem=eco_2,
            local_depth_range_text='1m – 15m',
            adaptation_notes='Chăn thả cỏ biển ở đầm phá nông.',
        )

        self.ref = ReferenceSource(
            id=401,
            title='Marine Turtles and Dugongs on the Great Barrier Reef',
            publisher='GBRMPA',
            published_year=2024,
            url='https://www2.gbrmpa.gov.au/learn/reef-animals',
            notes='Tài liệu GBRMPA',
        )

    @patch('explorer.views.MarineSpecies.objects')
    def test_published_species_detail_page(self, mock_species_qs):
        mock_species = MagicMock(wraps=self.species_obj)
        mock_species.id = self.species_obj.id
        mock_species.name = self.species_obj.name
        mock_species.vietnamese_name = self.species_obj.vietnamese_name
        mock_species.scientific_name = self.species_obj.scientific_name
        mock_species.slug = self.species_obj.slug
        mock_species.species_group = self.species_obj.species_group
        mock_species.get_species_group_display.return_value = self.species_obj.get_species_group_display()
        mock_species.conservation_status = self.species_obj.conservation_status
        mock_species.get_conservation_status_display.return_value = self.species_obj.get_conservation_status_display()
        mock_species.min_depth_m = self.species_obj.min_depth_m
        mock_species.max_depth_m = self.species_obj.max_depth_m
        mock_species.short_description = self.species_obj.short_description
        mock_species.description = self.species_obj.description
        mock_species.biological_traits = self.species_obj.biological_traits
        mock_species.image_url = self.species_obj.image_url
        mock_species.image_source_url = self.species_obj.image_source_url
        mock_species.image_credit = self.species_obj.image_credit
        mock_species.image_license = self.species_obj.image_license
        mock_species.ecosystem_links.all.return_value = [self.link_1, self.link_2]
        mock_species.references.all.return_value = [self.ref]
        mock_species_qs.filter.return_value.prefetch_related.return_value.get.return_value = mock_species

        response = self.client.get('/species/green-sea-turtle/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'explorer/species_detail.html')
        mock_species_qs.filter.assert_called_once_with(is_published=True)

        content = response.content.decode()
        self.assertIn('Rùa xanh (Vích)', content)
        self.assertIn('Green Sea Turtle', content)
        self.assertIn('Chelonia mydas', content)
        self.assertIn('0m – 50m', content)
        self.assertIn('Ít quan tâm (LC)', content)
        self.assertIn('Mô tả tổng quan về rùa xanh tại Great Barrier Reef.', content)
        self.assertIn('Hàm răng cưa giúp xén lá cỏ biển.', content)
        self.assertIn('Brocken Inaglory', content)
        self.assertIn('CC BY-SA 3.0', content)
        self.assertIn('Rạn san hô nhiệt đới', content)
        self.assertIn('Thảm cỏ biển ven đầm phá', content)
        self.assertIn('Marine Turtles and Dugongs on the Great Barrier Reef', content)
        self.assertIn('https://www2.gbrmpa.gov.au/learn/reef-animals', content)

    @patch('explorer.views.MarineSpecies.objects')
    def test_unpublished_or_missing_species_returns_404(self, mock_species_qs):
        mock_qs = MagicMock()
        mock_qs.model = MarineSpecies
        mock_qs.get.side_effect = MarineSpecies.DoesNotExist
        mock_qs.all.return_value.get.side_effect = MarineSpecies.DoesNotExist
        mock_species_qs.filter.return_value.prefetch_related.return_value = mock_qs

        response = self.client.get('/species/unpublished-species/')
        self.assertEqual(response.status_code, 404)
        mock_species_qs.filter.assert_called_once_with(is_published=True)


