from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
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


class OceanLocation(models.Model):
    """
    Quản lý các địa điểm đại dương hiển thị trên quả địa cầu 3D (Ocean Explorer).
    """
    name = models.CharField(max_length=150, verbose_name="Tên quốc tế")
    vietnamese_name = models.CharField(max_length=150, verbose_name="Tên tiếng Việt")
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Định danh (Slug)")
    region = models.CharField(max_length=150, verbose_name="Khu vực / Đại dương")
    latitude = models.FloatField(
        validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)],
        verbose_name="Vĩ độ",
    )
    longitude = models.FloatField(
        validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)],
        verbose_name="Kinh độ",
    )
    max_depth_m = models.PositiveIntegerField(verbose_name="Độ sâu tối đa (m)")
    short_description = models.TextField(verbose_name="Mô tả ngắn")
    description = models.TextField(verbose_name="Mô tả chi tiết")
    image_url = models.URLField(max_length=500, blank=True, verbose_name="URL hình ảnh")
    explore_url = models.CharField(max_length=255, blank=True, verbose_name="Đường dẫn khám phá")
    is_explorable = models.BooleanField(default=False, verbose_name="Cho phép khám phá sâu")
    is_published = models.BooleanField(default=True, verbose_name="Được xuất bản")
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name="Thứ tự hiển thị")

    class Meta:
        verbose_name = "Địa điểm đại dương"
        verbose_name_plural = "Các địa điểm đại dương"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.vietnamese_name} ({self.name})"

    def clean(self):
        super().clean()
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        if self.latitude is not None and not (-90.0 <= self.latitude <= 90.0):
            raise ValidationError({"latitude": "Vĩ độ phải nằm trong khoảng từ -90 đến 90."})
        if self.longitude is not None and not (-180.0 <= self.longitude <= 180.0):
            raise ValidationError({"longitude": "Kinh độ phải nằm trong khoảng từ -180 đến 180."})


class Ecosystem(models.Model):
    """
    Quản lý các quần xã sinh vật gắn với từng địa điểm đại dương.
    """
    class EcosystemType(models.TextChoices):
        CORAL_REEF = "CORAL_REEF", "Rạn san hô (Coral Reef)"
        MANGROVE = "MANGROVE", "Rừng ngập mặn (Mangrove)"
        KELP_FOREST = "KELP_FOREST", "Rừng tảo bẹ (Kelp Forest)"
        SEAGRASS = "SEAGRASS", "Thảm cỏ biển (Seagrass)"
        POLAR_ICE = "POLAR_ICE", "Băng cực (Polar Ice)"
        HYDROTHERMAL_VENT = "HYDROTHERMAL_VENT", "Miệng phun thủy nhiệt (Hydrothermal Vent)"
        HADAL_TRENCH = "HADAL_TRENCH", "Rãnh sâu Hadal (Hadal Trench)"

    class LightLevel(models.TextChoices):
        HIGH = "HIGH", "Cao (Ánh sáng mặt trời dồi dào)"
        MEDIUM = "MEDIUM", "Trung bình (Ánh sáng khuếch tán / Mùa cực)"
        LOW = "LOW", "Thấp (Chạng vạng / Ánh sáng yếu)"
        NONE = "NONE", "Không có ánh sáng (Tối hoàn toàn / Hóa tổng hợp)"

    location = models.ForeignKey(
        OceanLocation,
        on_delete=models.CASCADE,
        related_name="ecosystems",
        verbose_name="Địa điểm đại dương",
    )
    name = models.CharField(max_length=150, verbose_name="Tên quốc tế")
    vietnamese_name = models.CharField(max_length=150, verbose_name="Tên tiếng Việt")
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Định danh (Slug)")
    ecosystem_type = models.CharField(
        max_length=30,
        choices=EcosystemType.choices,
        verbose_name="Nhóm quần xã",
    )
    depth_range_text = models.CharField(max_length=100, verbose_name="Khoảng độ sâu")
    temperature_range_text = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Khoảng nhiệt độ",
    )
    light_level = models.CharField(
        max_length=20,
        choices=LightLevel.choices,
        verbose_name="Mức độ ánh sáng",
    )
    description = models.TextField(verbose_name="Mô tả sinh thái")

    class Meta:
        verbose_name = "Quần xã sinh vật"
        verbose_name_plural = "Các quần xã sinh vật"
        ordering = ["location__sort_order", "name"]

    def __str__(self):
        return f"{self.vietnamese_name} ({self.name}) – {self.location.vietnamese_name}"

    def clean(self):
        super().clean()
        if not self.slug and self.name:
            self.slug = slugify(self.name)


class MarineSpecies(models.Model):
    """
    Quản lý thông tin sinh học gốc của từng loài sinh vật đại dương (không trùng lặp loài).
    Một loài có thể liên kết với nhiều quần xã (Ecosystem) khác nhau thông qua SpeciesEcosystem.
    """
    class SpeciesGroup(models.TextChoices):
        FISH = "FISH", "Cá (Fish)"
        MAMMAL = "MAMMAL", "Thú biển (Marine Mammal)"
        INVERTEBRATE = "INVERTEBRATE", "Động vật không xương sống (Invertebrate)"
        CORAL_FLORA = "CORAL_FLORA", "San hô & Thực vật biển (Coral & Marine Flora)"
        REPTILE_BIRD = "REPTILE_BIRD", "Bò sát & Chim biển (Marine Reptile & Seabird)"

    class ConservationStatus(models.TextChoices):
        LC = "LC", "Ít quan tâm (LC)"
        NT = "NT", "Sắp bị đe dọa (NT)"
        VU = "VU", "Sắp nguy cấp (VU)"
        EN = "EN", "Nguy cấp (EN)"
        CR = "CR", "Cực kỳ nguy cấp (CR)"
        DD = "DD", "Thiếu dữ liệu (DD)"
        NE = "NE", "Chưa đánh giá (NE)"

    name = models.CharField(max_length=150, verbose_name="Tên phổ thông quốc tế")
    vietnamese_name = models.CharField(max_length=150, verbose_name="Tên phổ thông tiếng Việt")
    scientific_name = models.CharField(
        max_length=150,
        unique=True,
        verbose_name="Tên khoa học",
        help_text="Tên khoa học chuẩn hai phần, duy nhất cho mỗi loài",
    )
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Định danh (Slug)")
    species_group = models.CharField(
        max_length=30,
        choices=SpeciesGroup.choices,
        default=SpeciesGroup.FISH,
        verbose_name="Nhóm sinh vật",
    )
    short_description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Mô tả ngắn",
    )
    description = models.TextField(verbose_name="Mô tả tổng quan")
    biological_traits = models.TextField(
        blank=True,
        verbose_name="Đặc điểm sinh học & thích nghi",
    )
    min_depth_m = models.PositiveIntegerField(
        default=0,
        verbose_name="Độ sâu phân bố tối thiểu (m)",
    )
    max_depth_m = models.PositiveIntegerField(
        verbose_name="Độ sâu phân bố tối đa (m)",
    )
    conservation_status = models.CharField(
        max_length=10,
        choices=ConservationStatus.choices,
        default=ConservationStatus.NE,
        verbose_name="Tình trạng bảo tồn (IUCN)",
    )

    # Quản lý hình ảnh và bản quyền
    image_url = models.URLField(max_length=500, blank=True, verbose_name="URL hình ảnh trực tiếp")
    image_source_url = models.URLField(max_length=500, blank=True, verbose_name="URL trang nguồn ảnh")
    image_credit = models.CharField(max_length=200, blank=True, verbose_name="Tác giả / Sở hữu bản quyền")
    image_license = models.CharField(max_length=100, blank=True, verbose_name="Giấy phép hình ảnh")

    # Liên kết nhiều-nhiều với Ecosystem qua bảng trung gian SpeciesEcosystem và tái sử dụng ReferenceSource
    ecosystems = models.ManyToManyField(
        Ecosystem,
        through="SpeciesEcosystem",
        related_name="species",
        blank=True,
        verbose_name="Các quần xã sinh sống",
    )
    references = models.ManyToManyField(
        ReferenceSource,
        blank=True,
        related_name="marine_species",
        verbose_name="Nguồn tham khảo",
    )

    # Trạng thái kiểm duyệt và xuất bản (mặc định chưa công khai)
    is_verified = models.BooleanField(
        default=False,
        verbose_name="Đã xác minh nguồn",
    )
    is_published = models.BooleanField(
        default=False,
        verbose_name="Được xuất bản",
        help_text="Mặc định tắt để tránh công khai dữ liệu chưa được kiểm duyệt",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Cập nhật lần cuối")

    class Meta:
        verbose_name = "Sinh vật đại dương"
        verbose_name_plural = "Các sinh vật đại dương"
        ordering = ["vietnamese_name", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(min_depth_m__lte=models.F("max_depth_m")),
                name="species_min_depth_lte_max_depth",
            ),
        ]

    def __str__(self):
        return f"{self.vietnamese_name} ({self.scientific_name})"

    def clean(self):
        super().clean()
        if not self.slug and (self.name or self.scientific_name):
            self.slug = slugify(self.name or self.scientific_name)

        if self.min_depth_m is not None and self.max_depth_m is not None:
            if self.min_depth_m > self.max_depth_m:
                raise ValidationError({
                    "min_depth_m": "Độ sâu phân bố tối thiểu không được lớn hơn độ sâu phân bố tối đa.",
                    "max_depth_m": "Độ sâu phân bố tối đa phải lớn hơn hoặc bằng độ sâu tối thiểu.",
                })


class SpeciesEcosystem(models.Model):
    """
    Bảng trung gian kết nối MarineSpecies và Ecosystem.
    Cho phép cùng một loài xuất hiện ở nhiều quần xã và lưu thông tin thích nghi theo từng môi trường.
    """
    species = models.ForeignKey(
        MarineSpecies,
        on_delete=models.CASCADE,
        related_name="ecosystem_links",
        verbose_name="Loài sinh vật",
    )
    ecosystem = models.ForeignKey(
        Ecosystem,
        on_delete=models.CASCADE,
        related_name="species_links",
        verbose_name="Quần xã sinh vật",
    )
    local_depth_range_text = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Khoảng độ sâu tại quần xã",
        help_text="Tùy chọn: Độ sâu cư trú thực tế của loài riêng tại quần xã này",
    )
    adaptation_notes = models.TextField(
        blank=True,
        verbose_name="Ghi chú thích nghi tại quần xã",
        help_text="Tùy chọn: Đặc điểm thích nghi hoặc vai trò sinh thái của loài tại môi trường này",
    )
    is_key_species = models.BooleanField(
        default=False,
        verbose_name="Loài đặc trưng của quần xã",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")

    class Meta:
        verbose_name = "Liên kết Loài – Quần xã"
        verbose_name_plural = "Các liên kết Loài – Quần xã"
        ordering = ["ecosystem__location__sort_order", "ecosystem__name", "species__vietnamese_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["species", "ecosystem"],
                name="unique_species_per_ecosystem",
            ),
        ]

    def __str__(self):
        return f"{self.species.vietnamese_name} @ {self.ecosystem.vietnamese_name}"


