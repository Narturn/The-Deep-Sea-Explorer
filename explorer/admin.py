from django.contrib import admin
from .models import ExplorerItem, OceanLayer, ReferenceSource


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
