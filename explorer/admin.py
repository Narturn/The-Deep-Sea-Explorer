from django.contrib import admin
from .models import (
    Ecosystem,
    ExplorerItem,
    MarineSpecies,
    OceanLayer,
    OceanLocation,
    ReferenceSource,
    SpeciesEcosystem,
)


@admin.register(OceanLayer)
class OceanLayerAdmin(admin.ModelAdmin):
    list_display = (
        "sort_order",
        "vietnamese_name",
        "name",
        "depth_range_display",
        "color_preview",
        "item_count",
    )
    list_display_links = ("vietnamese_name", "name")
    ordering = ("sort_order",)
    search_fields = ("name", "vietnamese_name", "description")

    fieldsets = (
        (
            "Thông tin tầng đại dương",
            {
                "fields": (
                    "sort_order",
                    "vietnamese_name",
                    "name",
                    ("depth_start_m", "depth_end_m"),
                    "description",
                ),
            },
        ),
        (
            "Định hướng thị giác",
            {
                "fields": (("color_start", "color_end"),),
            },
        ),
    )

    @admin.display(description="Phạm vi độ sâu")
    def depth_range_display(self, obj):
        return f"{obj.depth_start_m:,}m – {obj.depth_end_m:,}m"

    @admin.display(description="Màu bắt đầu / kết thúc")
    def color_preview(self, obj):
        return f"{obj.color_start} → {obj.color_end}"

    @admin.display(description="Số đối tượng")
    def item_count(self, obj):
        return obj.items.count()


@admin.register(ReferenceSource)
class ReferenceSourceAdmin(admin.ModelAdmin):
    list_display = ("title", "publisher", "published_year", "has_url", "created_at")
    list_filter = ("publisher", "published_year")
    search_fields = ("title", "publisher", "notes")
    ordering = ("-published_year", "title")

    @admin.display(boolean=True, description="Có link")
    def has_url(self, obj):
        return bool(obj.url)


@admin.register(ExplorerItem)
class ExplorerItemAdmin(admin.ModelAdmin):
    list_display = (
        "depth_display",
        "name",
        "scientific_name",
        "item_type",
        "layer",
        "is_verified",
        "is_published",
    )
    list_display_links = ("name",)
    list_filter = ("item_type", "layer", "is_verified", "is_published")
    search_fields = ("name", "scientific_name", "short_description", "fact")
    ordering = ("depth_m", "name")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("references",)
    list_editable = ("is_published", "is_verified")
    save_on_top = True

    fieldsets = (
        (
            "Thông tin cơ bản",
            {
                "fields": (
                    ("name", "slug"),
                    ("item_type", "scientific_name"),
                    ("depth_m", "layer"),
                ),
            },
        ),
        (
            "Nội dung & Giải thích khoa học",
            {
                "fields": (
                    "short_description",
                    "fact",
                ),
                "description": "Mô tả ngắn dùng cho tooltip / thẻ tóm tắt. Fact dùng cho giải thích khoa học chuyên sâu hoặc sự thật thú vị trong Inspector Drawer.",
            },
        ),
        (
            "Hình ảnh và Bản quyền",
            {
                "fields": (
                    "image_url",
                    "image_source_url",
                    ("image_credit", "image_license"),
                    "detail_url",
                ),
            },
        ),
        (
            "Thẩm định & Xuất bản",
            {
                "fields": (
                    ("is_verified", "is_published"),
                    "references",
                ),
            },
        ),
    )

    @admin.display(description="Độ sâu (m)", ordering="depth_m")
    def depth_display(self, obj):
        return f"{obj.depth_m:,}m"


class EcosystemInline(admin.StackedInline):
    model = Ecosystem
    extra = 1
    prepopulated_fields = {"slug": ("name",)}
    fields = (
        ("name", "vietnamese_name", "slug"),
        ("ecosystem_type", "light_level"),
        ("depth_range_text", "temperature_range_text"),
        "description",
    )


@admin.register(OceanLocation)
class OceanLocationAdmin(admin.ModelAdmin):
    list_display = (
        "sort_order",
        "vietnamese_name",
        "name",
        "region",
        "coordinates_display",
        "max_depth_display",
        "ecosystem_count",
        "is_explorable",
        "is_published",
    )
    list_display_links = ("vietnamese_name", "name")
    list_filter = ("is_explorable", "is_published", "region")
    search_fields = ("name", "vietnamese_name", "region", "short_description", "description")
    ordering = ("sort_order", "name")
    prepopulated_fields = {"slug": ("name",)}
    list_editable = ("is_explorable", "is_published")
    inlines = [EcosystemInline]
    save_on_top = True

    fieldsets = (
        (
            "Thông tin địa điểm",
            {
                "fields": (
                    "sort_order",
                    ("name", "vietnamese_name"),
                    ("slug", "region"),
                    ("latitude", "longitude", "max_depth_m"),
                ),
            },
        ),
        (
            "Nội dung & Hình ảnh",
            {
                "fields": (
                    "short_description",
                    "description",
                    "image_url",
                ),
            },
        ),
        (
            "Điều hướng & Trạng thái",
            {
                "fields": (
                    ("is_explorable", "is_published"),
                    "explore_url",
                ),
            },
        ),
    )

    @admin.display(description="Tọa độ (Lat, Lng)")
    def coordinates_display(self, obj):
        return f"{obj.latitude:.4f}, {obj.longitude:.4f}"

    @admin.display(description="Độ sâu tối đa", ordering="max_depth_m")
    def max_depth_display(self, obj):
        return f"{obj.max_depth_m:,}m"

    @admin.display(description="Số quần xã")
    def ecosystem_count(self, obj):
        return obj.ecosystems.count()


class SpeciesEcosystemInline(admin.TabularInline):
    model = SpeciesEcosystem
    extra = 1
    autocomplete_fields = ("species", "ecosystem")
    fields = (
        "species",
        "ecosystem",
        "is_key_species",
        "local_depth_range_text",
        "adaptation_notes",
    )


@admin.register(Ecosystem)
class EcosystemAdmin(admin.ModelAdmin):
    list_display = (
        "vietnamese_name",
        "name",
        "location",
        "ecosystem_type",
        "depth_range_text",
        "light_level",
        "species_count",
    )
    list_display_links = ("vietnamese_name", "name")
    list_filter = ("ecosystem_type", "light_level", "location")
    search_fields = ("name", "vietnamese_name", "description", "location__name", "location__vietnamese_name")
    ordering = ("location__sort_order", "name")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [SpeciesEcosystemInline]

    @admin.display(description="Số loài sinh vật")
    def species_count(self, obj):
        return obj.species.count()


@admin.register(MarineSpecies)
class MarineSpeciesAdmin(admin.ModelAdmin):
    list_display = (
        "vietnamese_name",
        "name",
        "scientific_name",
        "species_group",
        "depth_range_display",
        "conservation_status",
        "ecosystem_count",
        "is_verified",
        "is_published",
    )
    list_display_links = ("vietnamese_name", "name")
    list_filter = (
        "species_group",
        "conservation_status",
        "is_verified",
        "is_published",
        "ecosystems__location",
        "ecosystems",
    )
    search_fields = (
        "vietnamese_name",
        "name",
        "scientific_name",
        "short_description",
        "description",
        "biological_traits",
    )
    ordering = ("vietnamese_name", "name")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("references",)
    list_editable = ("is_verified", "is_published")
    inlines = [SpeciesEcosystemInline]
    save_on_top = True

    fieldsets = (
        (
            "Thông tin định danh loài",
            {
                "fields": (
                    ("vietnamese_name", "name"),
                    ("scientific_name", "slug"),
                    ("species_group", "conservation_status"),
                    ("min_depth_m", "max_depth_m"),
                ),
            },
        ),
        (
            "Mô tả & Đặc điểm sinh học",
            {
                "fields": (
                    "short_description",
                    "description",
                    "biological_traits",
                ),
            },
        ),
        (
            "Hình ảnh & Bản quyền",
            {
                "fields": (
                    "image_url",
                    "image_source_url",
                    ("image_credit", "image_license"),
                ),
            },
        ),
        (
            "Thẩm định & Xuất bản",
            {
                "fields": (
                    ("is_verified", "is_published"),
                    "references",
                ),
            },
        ),
    )

    @admin.display(description="Độ sâu phân bố", ordering="min_depth_m")
    def depth_range_display(self, obj):
        return f"{obj.min_depth_m:,}m – {obj.max_depth_m:,}m"

    @admin.display(description="Số quần xã")
    def ecosystem_count(self, obj):
        return obj.ecosystems.count()


@admin.register(SpeciesEcosystem)
class SpeciesEcosystemAdmin(admin.ModelAdmin):
    list_display = (
        "species",
        "ecosystem",
        "location_display",
        "local_depth_range_text",
        "is_key_species",
    )
    list_filter = ("is_key_species", "ecosystem__location", "ecosystem")
    search_fields = (
        "species__vietnamese_name",
        "species__name",
        "species__scientific_name",
        "ecosystem__vietnamese_name",
        "ecosystem__name",
        "adaptation_notes",
    )
    autocomplete_fields = ("species", "ecosystem")
    list_editable = ("is_key_species",)

    @admin.display(description="Địa điểm đại dương", ordering="ecosystem__location__sort_order")
    def location_display(self, obj):
        return obj.ecosystem.location


