from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from explorer.models import ExplorerItem, OceanLayer, ReferenceSource


class ExplorerRouteTests(SimpleTestCase):
    def test_homepage_status_and_template(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'explorer/index.html')
        self.assertTemplateUsed(response, 'base.html')
        self.assertContains(response, 'The Deep Sea Explorer')

    def test_admin_route_exists(self):
        response = self.client.get('/admin/')
        # Admin redirects unauthenticated visitors to login
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
        # Standard layer range is [start, end)
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
        # Deepest layer includes 10,928m
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

        # Valid depth within [200, 1000)
        valid_item = ExplorerItem(
            name='Cá mắt thùng',
            slug='ca-mat-thung',
            item_type=ExplorerItem.ItemType.CREATURE,
            depth_m=600,
            layer=layer_meso
        )
        valid_item.clean()
        self.assertFalse(valid_item.is_verified)
        self.assertFalse(valid_item.is_published)

        # Invalid depth outside layer range
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
