from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


class OceanLayer(models.Model):
    """
    Quản lý 5 tầng đại dương chính trong hành trình thám hiểm.
    """
    MAX_SYSTEM_DEPTH = 10928

    name = models.CharField(max_length=50, verbose_name="Tên quốc tế")
    vietnamese_name = models.CharField(max_length=100, verbose_name="Tên tiếng Việt")
    depth_start_m = models.PositiveIntegerField(verbose_name="Độ sâu bắt đầu (m)")
    depth_end_m = models.PositiveIntegerField(verbose_name="Độ sâu kết thúc (m)")
    sort_order = models.PositiveSmallIntegerField(unique=True, verbose_name="Thứ tự hiển thị")
    color_start = models.CharField(max_length=7, verbose_name="Mã màu bắt đầu (HEX)")
    color_end = models.CharField(max_length=7, verbose_name="Mã màu kết thúc (HEX)")
    description = models.TextField(blank=True, verbose_name="Mô tả đặc điểm tầng")

    class Meta:
        verbose_name = "Tầng đại dương"
        verbose_name_plural = "Các tầng đại dương"
        ordering = ["sort_order"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(depth_start_m__gte=0) & models.Q(depth_end_m__lte=10928),
                name="layer_within_system_bounds",
            ),
            models.CheckConstraint(
                condition=models.Q(depth_start_m__lt=models.F("depth_end_m")),
                name="layer_start_less_than_end",
            ),
        ]

    def __str__(self):
        return f"{self.vietnamese_name} ({self.name}) [{self.depth_start_m}m - {self.depth_end_m}m]"

    def clean(self):
        super().clean()
        if self.depth_start_m is not None and self.depth_end_m is not None:
            if self.depth_start_m >= self.depth_end_m:
                raise ValidationError({
                    "depth_end_m": "Độ sâu kết thúc phải lớn hơn độ sâu bắt đầu."
                })
            if self.depth_end_m > self.MAX_SYSTEM_DEPTH:
                raise ValidationError({
                    "depth_end_m": f"Độ sâu kết thúc không được vượt quá {self.MAX_SYSTEM_DEPTH}m."
                })

            # Kiểm tra chồng lấn phạm vi với các tầng khác
            existing_layers = OceanLayer.objects.exclude(pk=self.pk)
            for other in existing_layers:
                # Hai khoảng [s1, e1) và [s2, e2) chồng lấn nếu max(s1, s2) < min(e1, e2)
                if max(self.depth_start_m, other.depth_start_m) < min(self.depth_end_m, other.depth_end_m):
                    raise ValidationError(
                        f"Phạm vi độ sâu [{self.depth_start_m}m - {self.depth_end_m}m] "
                        f"bị chồng lấn với tầng '{other.vietnamese_name}' [{other.depth_start_m}m - {other.depth_end_m}m]."
                    )

    def contains_depth(self, depth: int) -> bool:
        """
        Kiểm tra độ sâu có thuộc tầng biển này hay không.
        Tầng thông thường là [start, end), riêng tầng kết thúc tại 10.928m bao gồm cả mốc cuối.
        """
        if self.depth_end_m == self.MAX_SYSTEM_DEPTH:
            return self.depth_start_m <= depth <= self.depth_end_m
        return self.depth_start_m <= depth < self.depth_end_m


class ReferenceSource(models.Model):
    """
    Quản lý nguồn tài liệu, sách báo và xuất bản khoa học dùng để đối chứng dữ liệu.
    """
    title = models.CharField(max_length=255, verbose_name="Tiêu đề tài liệu / nguồn")
    url = models.URLField(max_length=500, blank=True, verbose_name="Đường link tài liệu")
    publisher = models.CharField(max_length=150, blank=True, verbose_name="Cơ quan xuất bản / Nguồn")
    published_year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Năm xuất bản")
    notes = models.TextField(blank=True, verbose_name="Ghi chú thẩm định")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Cập nhật lần cuối")

    class Meta:
        verbose_name = "Nguồn tham khảo khoa học"
        verbose_name_plural = "Các nguồn tham khảo khoa học"
        ordering = ["-published_year", "title"]

    def __str__(self):
        year_str = f" ({self.published_year})" if self.published_year else ""
        return f"{self.title}{year_str}"


class ExplorerItem(models.Model):
    """
    Quản lý sinh vật và cột mốc xuất hiện dọc hành trình lặn biển sâu.
    """
    class ItemType(models.TextChoices):
        CREATURE = "CREATURE", "Sinh vật"
        MILESTONE = "MILESTONE", "Cột mốc"

    MAX_SYSTEM_DEPTH = 10928

    name = models.CharField(max_length=150, verbose_name="Tên hiển thị")
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Định danh (Slug)")
    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        verbose_name="Loại đối tượng",
    )
    scientific_name = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="Tên khoa học",
        help_text="Áp dụng cho sinh vật biển (ví dụ: Glaucus atlanticus)",
    )
    depth_m = models.PositiveIntegerField(
        db_index=True,
        verbose_name="Độ sâu (mét)",
        help_text="Độ sâu xuất hiện từ 0m đến 10.928m",
    )
    layer = models.ForeignKey(
        OceanLayer,
        on_delete=models.PROTECT,
        related_name="items",
        verbose_name="Tầng đại dương",
    )
    short_description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Mô tả ngắn",
        help_text="Hiển thị trên tooltip và thẻ tóm tắt",
    )
    fact = models.TextField(
        blank=True,
        verbose_name="Sự thật thú vị / Giải thích khoa học",
        help_text="Nội dung thú vị hoặc giải thích khoa học chuyên sâu",
    )

    # Quản lý hình ảnh và bản quyền
    image_url = models.URLField(max_length=500, blank=True, verbose_name="URL hình ảnh trực tiếp")
    image_source_url = models.URLField(max_length=500, blank=True, verbose_name="URL trang nguồn ảnh")
    image_credit = models.CharField(max_length=200, blank=True, verbose_name="Tác giả / Sở hữu bản quyền")
    image_license = models.CharField(max_length=100, blank=True, verbose_name="Giấy phép hình ảnh")
    detail_url = models.URLField(max_length=500, blank=True, verbose_name="Link tài liệu tham khảo chi tiết")

    # Trạng thái thẩm định và xuất bản
    is_verified = models.BooleanField(
        default=False,
        verbose_name="Đã xác minh nguồn",
        help_text="Đánh dấu khi dữ liệu khoa học/lịch sử đã được kiểm chứng bằng nguồn tin cậy",
    )
    is_published = models.BooleanField(
        default=False,
        verbose_name="Được xuất bản",
        help_text="Chỉ đối tượng được xuất bản mới xuất hiện trên website công khai",
    )

    references = models.ManyToManyField(
        ReferenceSource,
        blank=True,
        related_name="items",
        verbose_name="Nguồn tham khảo",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Cập nhật lần cuối")

    class Meta:
        verbose_name = "Đối tượng thám hiểm"
        verbose_name_plural = "Các đối tượng thám hiểm"
        ordering = ["depth_m", "name"]
        indexes = [
            models.Index(fields=["depth_m", "is_published"], name="item_depth_published_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(depth_m__gte=0) & models.Q(depth_m__lte=10928),
                name="valid_item_depth_range",
            ),
        ]

    def __str__(self):
        return f"[{self.depth_m}m] {self.name} ({self.get_item_type_display()})"

    def clean(self):
        super().clean()

        # Tự động tạo slug nếu trống
        if not self.slug and self.name:
            self.slug = slugify(self.name)

        # Kiểm tra khoảng độ sâu hệ thống
        if self.depth_m is not None:
            if not (0 <= self.depth_m <= self.MAX_SYSTEM_DEPTH):
                raise ValidationError({
                    "depth_m": f"Độ sâu phải nằm trong khoảng từ 0m đến {self.MAX_SYSTEM_DEPTH}m."
                })

            # Kiểm tra độ sâu phải thuộc tầng biển liên kết
            if self.layer_id:
                if not self.layer.contains_depth(self.depth_m):
                    if self.layer.depth_end_m == self.MAX_SYSTEM_DEPTH:
                        valid_range = f"[{self.layer.depth_start_m}m - {self.layer.depth_end_m}m]"
                    else:
                        valid_range = f"[{self.layer.depth_start_m}m - {self.layer.depth_end_m}m)"

                    raise ValidationError({
                        "depth_m": (
                            f"Độ sâu {self.depth_m}m không thuộc phạm vi của tầng "
                            f"'{self.layer.vietnamese_name}' {valid_range}."
                        )
                    })
