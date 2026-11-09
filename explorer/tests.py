from django.test import SimpleTestCase


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
