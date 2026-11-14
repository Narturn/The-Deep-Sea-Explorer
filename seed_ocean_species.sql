-- ============================================================================
-- FILE: seed_ocean_species.sql
-- MỤC ĐÍCH: Bổ sung dữ liệu sinh vật biển mẫu (MarineSpecies & SpeciesEcosystem)
--           cho 6 địa điểm còn lại của Ocean Explorer trên PostgreSQL:
--             1. Sundarbans
--             2. Monterey Bay
--             3. Shark Bay
--             4. Antarctic Peninsula
--             5. East Pacific Rise
--             6. Mariana Trench
--
-- ĐẶC ĐIỂM AN TOÀN:
--   - Sử dụng giao dịch BEGIN ... COMMIT.
--   - Chỉ INSERT, tuyệt đối KHÔNG UPDATE hay DELETE dữ liệu hiện có.
--   - Không hardcode ID: tra cứu khóa ngoại qua slug / scientific_name.
--   - Chống trùng lặp bằng WHERE NOT EXISTS + ON CONFLICT DO NOTHING.
--   - Đặt is_published = TRUE, is_verified = FALSE cho dữ liệu mẫu mới.
--   - Các trường hình ảnh để chuỗi rỗng '' khi chưa xác minh nguồn ảnh.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHẦN 1: THÊM 19 BẢN GHI MỚI VÀO BẢNG explorer_marinespecies
-- (5 loài của Great Barrier Reef đã tồn tại sẽ không bị tạo lại)
-- ============================================================================

INSERT INTO explorer_marinespecies (
    name,
    vietnamese_name,
    scientific_name,
    slug,
    species_group,
    short_description,
    description,
    biological_traits,
    min_depth_m,
    max_depth_m,
    conservation_status,
    image_url,
    image_source_url,
    image_credit,
    image_license,
    is_verified,
    is_published,
    created_at,
    updated_at
)
SELECT
    v.name,
    v.vietnamese_name,
    v.scientific_name,
    v.slug,
    v.species_group,
    v.short_description,
    v.description,
    v.biological_traits,
    v.min_depth_m,
    v.max_depth_m,
    v.conservation_status,
    '',
    '',
    '',
    '',
    FALSE,
    TRUE,
    NOW(),
    NOW()
FROM (
    VALUES
    -- ------------------------------------------------------------------------
    -- 1. SUNDARBANS (3 loài mới)
    -- ------------------------------------------------------------------------
    (
        'Giant Mudskipper',
        'Cá thòi lòi khổng lồ',
        'Periophthalmodon schlosseri',
        'giant-mudskipper',
        'FISH',
        'Loài cá lưỡng cư đặc trưng của rừng ngập mặn và bãi bùn thủy triều, có khả năng hô hấp qua da và di chuyển trên cạn.',
        'Cá thòi lòi khổng lồ sinh sống dọc theo các bờ kênh nước lợ và bãi bùn ngập triều tại rừng ngập mặn Sundarbans. Chúng đào hang sâu trong bùn mềm để trú ẩn khi thủy triều lên và kiếm ăn trên mặt bùn khi nước rút.',
        'Đôi mắt lồi nằm trên đỉnh đầu cho phép quan sát 360 độ ngoài không khí; buồng mang mở rộng giữ nước kết hợp với lớp da giàu mạch máu giúp cá trao đổi oxy trực tiếp trên cạn. Vây ngực khỏe có cấu trúc như cánh tay giúp chúng trườn và bật nhảy trên bùn.',
        0,
        5,
        'LC'
    ),
    (
        'Giant Mud Crab',
        'Cua bùn rừng ngập mặn',
        'Scylla serrata',
        'giant-mud-crab',
        'INVERTEBRATE',
        'Loài giáp xác lớn sống đáy tại các hệ thống cửa sông rừng ngập mặn và bãi bùn thủy triều Ấn Độ Dương – Thái Bình Dương.',
        'Cua bùn Scylla serrata là loài động vật không xương sống đóng vai trò mắt xích sinh thái quan trọng tại Sundarbans. Chúng ẩn mình giữa hệ thống rễ cây ngập mặn và đào hang trên các bãi bùn cửa sông.',
        'Cặp càng lớn và cực khỏe dùng để nghiền vỡ vỏ của các loài thân mềm hai mảnh vỏ và ốc nước lợ. Loài này chịu đựng tốt sự biến động độ mặn lớn (euryhaline) theo chu kỳ thủy triều lên xuống hàng ngày.',
        0,
        20,
        'LC'
    ),
    (
        'Irrawaddy Dolphin',
        'Cá heo Irrawaddy',
        'Orcaella brevirostris',
        'irrawaddy-dolphin',
        'MAMMAL',
        'Loài cá heo đầu tròn quý hiếm thích nghi với vùng nước lợ cửa sông và hệ thống kênh rạch rừng ngập mặn.',
        'Khu vực rừng ngập mặn Sundarbans là một trong những nơi cư trú quan trọng nhất của cá heo Irrawaddy tại Vịnh Bengal. Chúng bơi thành từng nhóm nhỏ dọc theo các luồng lạch sâu và ngã ba sông nước lợ.',
        'Đầu tròn phồng không có mỏ rõ rệt, cổ linh hoạt có thể cử động sang hai bên và khả năng định vị bằng tiếng vang (echolocation) tần số cao giúp chúng săn cá, tôm trong môi trường nước phù sa đục ngầu.',
        1,
        25,
        'EN'
    ),

    -- ------------------------------------------------------------------------
    -- 2. MONTEREY BAY (4 loài mới)
    -- ------------------------------------------------------------------------
    (
        'Giant Kelp',
        'Tảo bẹ khổng lồ',
        'Macrocystis pyrifera',
        'giant-kelp',
        'CORAL_FLORA',
        'Loài tảo nâu lớn nhất thế giới tạo nên những cánh rừng dưới nước cao vút dọc bờ biển ôn đới Vịnh Monterey.',
        'Macrocystis pyrifera mọc bám trên nền đá ngầm ven bờ Vịnh Monterey, nơi có dòng nước trỗi lạnh giàu dinh dưỡng. Các tán tảo vươn thẳng lên mặt nước tạo thành hệ sinh thái rừng tảo bẹ đa tầng.',
        'Bám chặt vào đá đáy bằng bộ phận giữ (holdfast) dạng rễ và nâng toàn bộ tán lá hướng về phía ánh sáng mặt trời nhờ các túi khí (pneumatocyst) ở gốc mỗi phiến lá. Trong điều kiện thuận lợi, tảo có thể dài thêm tới 30–50 cm mỗi ngày.',
        2,
        30,
        'NE'
    ),
    (
        'Southern Sea Otter',
        'Rái cá biển phương Nam',
        'Enhydra lutris',
        'southern-sea-otter',
        'MAMMAL',
        'Loài thú biển chủ chốt (keystone species) bảo vệ rừng tảo bẹ khỏi sự phá hủy của quần thể cầu gai.',
        'Rái cá biển phương Nam sinh sống tại các cánh rừng tảo bẹ ven bờ California, đặc biệt là Vịnh Monterey. Chúng dành phần lớn cuộc đời trên mặt nước và thường quấn cơ thể vào tán tảo bẹ để không bị sóng cuốn trôi khi ngủ.',
        'Không có lớp mỡ dày như cá voi hay hải cẩu, rái cá biển giữ ấm trong làn nước lạnh 10°C – 16°C nhờ bộ lông dày nhất trong giới động vật (lên tới hơn 150.000 sợi lông/cm²) và biết dùng đá làm công cụ đập vỡ vỏ cầu gai, bào ngư.',
        0,
        40,
        'EN'
    ),
    (
        'Vampire Squid',
        'Mực ma cà rồng',
        'Vampyroteuthis infernalis',
        'vampire-squid',
        'INVERTEBRATE',
        'Loài chân đầu cổ xưa sống trong tầng nước tối nghèo oxy của Hẻm núi ngầm Monterey.',
        'Dù mang tên mực ma cà rồng nhưng Vampyroteuthis infernalis là loài hiền lành chuyên ăn tuyết biển (marine snow) – các mảnh vụn hữu cơ rơi xuống vực sâu tại Hẻm núi ngầm Monterey.',
        'Thích nghi hoàn hảo với tầng tối thiểu oxy (oxygen minimum zone) nhờ sắc tố máu hemocyanin có ái lực liên kết oxy cực cao và tốc độ trao đổi chất rất thấp. Khi gặp nguy hiểm, chúng lộn ngược màng da nối giữa các xúc tu và phát quang sinh học để đánh lạc hướng kẻ săn mồi.',
        600,
        1200,
        'LC'
    ),
    (
        'Pacific Barreleye',
        'Cá mắt thùng Thái Bình Dương',
        'Macropinna microstoma',
        'pacific-barreleye',
        'FISH',
        'Loài cá biển sâu kỳ dị với vòm đầu trong suốt và đôi mắt hình ống màu xanh lục hướng lên trên.',
        'Được ghi hình sống động tại vùng nước sâu của Hẻm núi ngầm Monterey, cá mắt thùng thường lơ lửng gần như bất động trong bóng tối chạng vạng để rình mồi.',
        'Đôi mắt hình trụ cực nhạy sáng nằm hoàn toàn bên trong lớp vòm sọ trong suốt chứa đầy dịch lỏng, giúp bảo vệ mắt khỏi tế bào gai độc khi cá cướp thức ăn từ xúc tu của các loài sứa ống (siphonophore). Mắt có thể xoay từ hướng nhìn thẳng lên trên sang nhìn về phía trước khi đớp mồi.',
        400,
        1000,
        'LC'
    ),

    -- ------------------------------------------------------------------------
    -- 3. SHARK BAY (3 loài mới; kết hợp tái sử dụng Dugong và Green Sea Turtle)
    -- ------------------------------------------------------------------------
    (
        'Tiger Shark',
        'Cá mập hổ',
        'Galeocerdo cuvier',
        'tiger-shark',
        'FISH',
        'Kẻ săn mồi đỉnh chuỗi thức ăn điều tiết hành vi chăn thả của bò biển và rùa biển tại các thảm cỏ biển Shark Bay.',
        'Tại Vịnh Cá Mập (Shark Bay), cá mập hổ tuần tra dọc theo các vùng nước nông và rìa thảm cỏ biển Wooramel. Sự hiện diện của chúng ngăn cản các loài ăn cỏ tập trung quá mức tại một điểm, giúp thảm cỏ biển duy trì trạng thái cân bằng.',
        'Sở hữu các vệt sọc tối màu dọc thân như vằn hổ (rõ nhất ở cá thể non) và hàm răng hình lưỡi cưa cong độc đáo có thể cắt xuyên qua mai rùa biển cứng cũng như xương thú biển.',
        0,
        350,
        'NT'
    ),
    (
        'Indo-Pacific Bottlenose Dolphin',
        'Cá heo mũi chai Ấn Độ – Thái Bình Dương',
        'Tursiops aduncus',
        'indo-pacific-bottlenose-dolphin',
        'MAMMAL',
        'Quần thể cá heo nổi tiếng tại Shark Bay với tập tính truyền dạy cách dùng bọt biển bảo vệ mõm khi kiếm ăn.',
        'Sinh sống tại các vùng vịnh nông, kênh cát và thảm cỏ biển của Shark Bay, quần thể Tursiops aduncus tại đây là một trong những đối tượng nghiên cứu tập tính học thú biển lâu đời nhất thế giới.',
        'Một số cá thể tại Shark Bay sử dụng bọt biển tự nhiên đội lên đầu mõm như một chiếc găng tay bảo hộ khi sục tìm cá đáy trên nền đá và cát thô (hành vi "sponging" được truyền từ cá mẹ sang cá con).',
        1,
        30,
        'NT'
    ),
    (
        'Wire Weed Seagrass',
        'Cỏ biển dây thép Amphibolis',
        'Amphibolis antarctica',
        'amphibolis-antarctica',
        'CORAL_FLORA',
        'Loài cỏ biển ôn đới – cận nhiệt đới tạo nên diện tích sinh khối chính của thảm cỏ biển Wooramel tại Shark Bay.',
        'Amphibolis antarctica chiếm tỷ lệ diện tích lớn nhất trong hệ thống thảm cỏ biển rộng hơn 4.000 km² của Shark Bay, đóng góp vào việc bẫy trầm tích tạo nên các dải ngân hàng cát nông hạn chế dòng tuần hoàn nước ở các vịnh trong như Hamelin Pool.',
        'Thân cây cứng, dai như dây thép mang các chùm lá dẹt ở ngọn; cây con nảy mầm ngay trên cây mẹ (vivipary) và có cấu trúc móc bám dạng lược giúp neo giữ vào nền đáy cát trước dòng chảy thủy triều.',
        1,
        15,
        'LC'
    ),

    -- ------------------------------------------------------------------------
    -- 4. ANTARCTIC PENINSULA (3 loài mới)
    -- ------------------------------------------------------------------------
    (
        'Antarctic Krill',
        'Nhuyễn thể Nam Cực (Krill)',
        'Euphausia superba',
        'antarctic-krill',
        'INVERTEBRATE',
        'Loài giáp xác nhỏ tạo thành các đàn khổng lồ dưới thềm băng, là mắt xích nền tảng của toàn bộ lưới thức ăn Nam Đại Dương.',
        'Phân bố dày đặc quanh vùng biển Bán đảo Nam Cực, Euphausia superba là một trong những loài động vật có tổng sinh khối lớn nhất trên Trái Đất, nuôi sống cá voi tấm sừng, hải cẩu, chim cánh cụt và mực biển.',
        'Vào mùa đông, ấu trùng và cá thể trưởng thành gặm lớp tảo băng mọc ở mặt dưới các tảng băng trôi; chúng có khả năng co nhỏ kích thước cơ thể và sử dụng dự trữ lipid để sống sót qua hơn 200 ngày thiếu thức ăn mùa đông vùng cực.',
        0,
        600,
        'LC'
    ),
    (
        'Emperor Penguin',
        'Chim cánh cụt Hoàng đế',
        'Aptenodytes forsteri',
        'emperor-penguin',
        'REPTILE_BIRD',
        'Loài chim cánh cụt lớn nhất và lặn sâu nhất thế giới, săn mồi dưới lớp băng biển Nam Cực.',
        'Chim cánh cụt Hoàng đế sinh sống và kiếm ăn tại vùng biển băng giá quanh Châu Nam Cực và Bán đảo Nam Cực, nơi chúng lặn xuống dưới các tảng băng trôi để bắt nhuyễn thể, cá bạc Nam Cực và mực.',
        'Có khả năng lặn sâu tới 500m và nín thở hơn 20 phút nhờ hàm lượng myoglobin dự trữ oxy cao trong cơ bắp, xương đặc giảm lực nổi và hệ thống tuần hoàn đối lưu nhiệt giúp giữ ấm chân, vây bơi trong nước biển -1.8°C.',
        0,
        500,
        'NT'
    ),
    (
        'Blackfin Icefish',
        'Cá băng máu trắng vây đen',
        'Chaenocephalus aceratus',
        'blackfin-icefish',
        'FISH',
        'Loài cá đáy vùng cực kỳ lạ có dòng máu trong suốt không chứa hemoglobin và sở hữu protein chống đông tự nhiên.',
        'Sinh sống trên thềm lục địa và đáy biển lạnh quanh Bán đảo Nam Cực, cá băng vây đen là đại diện tiêu biểu của họ Channichthyidae – nhóm động vật có xương sống duy nhất không có hồng cầu lúc trưởng thành.',
        'Trong môi trường nước biển lạnh tới -1.8°C giàu oxy hòa tan, cá băng hấp thụ oxy trực tiếp vào huyết tương không màu, đồng thời có quả tim kích thước lớn bơm lượng máu gấp 4–5 lần cá xương thông thường và tổng hợp glycoprotein chống đông (AFGP) ngăn tinh thể băng hình thành trong máu.',
        5,
        770,
        'LC'
    ),

    -- ------------------------------------------------------------------------
    -- 5. EAST PACIFIC RISE (3 loài mới)
    -- ------------------------------------------------------------------------
    (
        'Giant Tube Worm',
        'Giun ống khổng lồ',
        'Riftia pachyptila',
        'giant-tube-worm',
        'INVERTEBRATE',
        'Biểu tượng của các miệng phun thủy nhiệt biển sâu, sống hoàn toàn nhờ vi khuẩn hóa tổng hợp mà không cần miệng hay ruột.',
        'Phát triển thành từng cụm dày đặc quanh các miệng phun khói đen trên Đới nâng Đông Thái Bình Dương ở độ sâu khoảng 2.500m, nơi dòng nước nóng giàu khoáng chất hòa trộn với nước biển sâu lạnh giá.',
        'Khi trưởng thành, Riftia pachyptila hoàn toàn không có miệng, ống tiêu hóa hay hậu môn. Chiếc mào đỏ tươi giàu hemoglobin hấp thụ H2S, O2 và CO2 từ nước biển để vận chuyển tới cơ quan trophosome bên trong cơ thể – nơi hàng tỷ vi khuẩn cộng sinh oxy hóa lưu huỳnh để tổng hợp chất hữu cơ nuôi sống giun.',
        1500,
        2800,
        'NE'
    ),
    (
        'Pompeii Worm',
        'Giun Pompeii chịu nhiệt',
        'Alvinella pompejana',
        'pompeii-worm',
        'INVERTEBRATE',
        'Một trong những loài động vật đa bào chịu nhiệt cao nhất hành tinh, làm tổ trực tiếp trên thành ống khói đen.',
        'Giun nhiều tơ Alvinella pompejana chỉ được tìm thấy tại các miệng phun thủy nhiệt trên Đới nâng Đông Thái Bình Dương, nơi chúng xây dựng các ống giấy khoáng chất bám ngay trên bề mặt ống khói lưu huỳnh.',
        'Sống trong chênh lệch nhiệt độ khắc nghiệt: phần đuôi nằm trong ống tiếp xúc với dòng nước nóng lên tới 80°C trong khi phần đầu thò ra vùng nước 22°C để hô hấp. Lớp lông tơ màu xám trên lưng thực chất là tập đoàn vi khuẩn cộng sinh tạo màng cách nhiệt và giải độc kim loại nặng.',
        2400,
        2800,
        'NE'
    ),
    (
        'Hydrothermal Vent Crab',
        'Cua trắng miệng phun thủy nhiệt',
        'Bythograea thermydron',
        'bythograea-thermydron',
        'INVERTEBRATE',
        'Loài cua săn mồi mù màu trắng đặc hữu tại các trường miệng phun thủy nhiệt Đông Thái Bình Dương.',
        'Bythograea thermydron là loài động vật ăn thịt và ăn xác thối phổ biến nhất bò quanh các cụm giun ống khổng lồ tại Đới nâng Đông Thái Bình Dương.',
        'Khi còn là ấu trùng trôi nổi, chúng có mắt phát triển bình thường; nhưng khi định cư tại đáy sâu 2.500m không có ánh sáng mặt trời, mắt biến đổi thành cơ quan cảm nhận bức xạ hồng ngoại mờ phát ra từ dòng nước nóng 350°C của ống khói đen.',
        2400,
        2800,
        'NE'
    ),

    -- ------------------------------------------------------------------------
    -- 6. MARIANA TRENCH (3 loài mới)
    -- ------------------------------------------------------------------------
    (
        'Mariana Snailfish',
        'Cá sên Mariana',
        'Pseudoliparis swirei',
        'mariana-snailfish',
        'FISH',
        'Một trong những loài cá có xương sống cư trú sâu nhất từng được thu mẫu và định danh khoa học tại Rãnh Mariana.',
        'Cá sên Mariana sinh sống dọc theo các sườn dốc của tầng Hadal thuộc Rãnh Mariana ở độ sâu từ hơn 6.000m đến khoảng 8.100m, nơi không có kẻ săn mồi lớn nào khác có thể tồn tại.',
        'Cơ thể màu hồng nhạt trong mờ, không có vảy, hộp sọ không hóa xương hoàn toàn và không có bóng hơi giúp tránh bị ép vỡ dưới áp suất gấp 800 lần mặt biển. Tế bào chứa nồng độ cao hợp chất TMAO (trimethylamine N-oxide) đóng vai trò chất ổn định áp suất (piezolyte) giữ cho protein không bị biến tính.',
        6198,
        8076,
        'NE'
    ),
    (
        'Supergiant Amphipod',
        'Giáp xác chân kiếm Hadal',
        'Hirondellea gigas',
        'hirondellea-gigas',
        'INVERTEBRATE',
        'Loài giáp xác ăn mùn hữu cơ thống trị điểm sâu nhất Challenger Deep nhờ lớp giáp gel nhôm bảo vệ vỏ.',
        'Hirondellea gigas xuất hiện với mật độ lớn từ sườn rãnh Hadal xuống tận đáy vực Challenger Deep (10.928m) của Rãnh Mariana.',
        'Ở độ sâu trên 10.000m, canxi cacbonat dễ bị hòa tan bởi áp suất cực đại; loài giáp xác này tiết enzyme tiêu hóa chiết tách ion nhôm từ bùn trầm tích để tạo thành lớp màng gel nhôm hydroxit bao phủ bên ngoài vỏ kitin, đồng thời sở hữu enzyme cellulase tiêu hóa mảnh gỗ chìm từ đất liền.',
        6500,
        10928,
        'NE'
    ),
    (
        'Hadal Sea Cucumber',
        'Hải sâm biển sâu Benthodytes',
        'Benthodytes typica',
        'benthodytes-typica',
        'INVERTEBRATE',
        'Loài da gai thân mềm dạng gelatin chuyên lọc ăn lớp trầm tích mùn đáy tại vùng vực thẳm và rãnh sâu.',
        'Các loài hải sâm biển sâu đóng vai trò như những cỗ máy dọn vệ sinh chủ đạo trên nền bùn mềm dưới đáy sâu Rãnh Mariana, nơi nguồn dinh dưỡng duy nhất là lớp tuyết biển lắng đọng.',
        'Cơ thể cấu tạo chủ yếu từ mô liên kết giàu nước có độ nén tương đương nước biển xung quanh, giúp chúng chịu được áp suất thủy tĩnh khổng lồ mà không cần bộ xương cứng.',
        1800,
        9500,
        'LC'
    )
) AS v (
    name,
    vietnamese_name,
    scientific_name,
    slug,
    species_group,
    short_description,
    description,
    biological_traits,
    min_depth_m,
    max_depth_m,
    conservation_status
)
WHERE NOT EXISTS (
    SELECT 1
    FROM explorer_marinespecies existing
    WHERE existing.slug = v.slug
       OR existing.scientific_name = v.scientific_name
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- PHẦN 2: THÊM 27 LIÊN KẾT SINH VẬT VỚI HỆ SINH THÁI (explorer_speciesecosystem)
-- Tra cứu động species_id qua slug và ecosystem_id qua slug.
-- Bao gồm cả việc liên kết các loài dùng chung cho nhiều hệ sinh thái.
-- ============================================================================

INSERT INTO explorer_speciesecosystem (
    species_id,
    ecosystem_id,
    local_depth_range_text,
    adaptation_notes,
    is_key_species,
    created_at
)
SELECT
    sp.id AS species_id,
    eco.id AS ecosystem_id,
    link.local_depth_range_text,
    link.adaptation_notes,
    link.is_key_species,
    NOW()
FROM (
    VALUES
    -- ------------------------------------------------------------------------
    -- 1. SUNDARBANS: sundarbans-mangrove-forest & sundarbans-tidal-mudflat
    -- ------------------------------------------------------------------------
    (
        'giant-mudskipper',
        'sundarbans-mangrove-forest',
        '0m – 3m',
        'Bám trên các rễ thở và gốc cây ngập mặn khi thủy triều dâng để tránh các loài cá săn mồi dưới nước.',
        TRUE
    ),
    (
        'giant-mudskipper',
        'sundarbans-tidal-mudflat',
        '0m – 5m',
        'Đào hang hình chữ J sâu trong bùn mềm để đẻ trứng và bảo vệ lãnh thổ kiếm ăn khi bãi bùn lộ ra lúc triều kiệt.',
        TRUE
    ),
    (
        'giant-mud-crab',
        'sundarbans-mangrove-forest',
        '0m – 10m',
        'Ẩn nấp trong mạng lưới rễ đước chằng chịt để lột xác và săn các loài ốc, hà bám trên thân rễ.',
        TRUE
    ),
    (
        'giant-mud-crab',
        'sundarbans-tidal-mudflat',
        '0m – 20m',
        'Vùi mình dưới lớp bùn thủy triều giàu mùn hữu cơ và săn động vật hai mảnh vỏ dọc bờ kênh.',
        FALSE
    ),
    (
        'irrawaddy-dolphin',
        'sundarbans-mangrove-forest',
        '1m – 10m',
        'Di chuyển theo thủy triều vào các luồng kênh rừng ngập mặn sâu để săn cá đàn và tôm cửa sông bằng sóng siêu âm.',
        TRUE
    ),

    -- ------------------------------------------------------------------------
    -- 2. MONTEREY BAY: monterey-giant-kelp-forest & monterey-submarine-canyon
    -- ------------------------------------------------------------------------
    (
        'giant-kelp',
        'monterey-giant-kelp-forest',
        '2m – 30m',
        'Hấp thụ nitrat và photphat dồi dào từ dòng nước trỗi lạnh California để tạo thành tán rừng dày đặc từ đáy đá lên mặt biển.',
        TRUE
    ),
    (
        'southern-sea-otter',
        'monterey-giant-kelp-forest',
        '0m – 30m',
        'Săn cầu gai tím trên nền đá đáy, ngăn chặn hiện tượng cầu gai ăn trụi gốc tảo bẹ và bảo vệ cấu trúc rừng tảo.',
        TRUE
    ),
    (
        'vampire-squid',
        'monterey-submarine-canyon',
        '600m – 1.200m',
        'Thả hai sợi dây xúc giác mảnh thu gom tuyết biển hữu cơ trôi lơ lửng trong vùng tối nghèo oxy của hẻm núi ngầm.',
        TRUE
    ),
    (
        'pacific-barreleye',
        'monterey-submarine-canyon',
        '400m – 1.000m',
        'Sử dụng đôi mắt ống hướng lên trên để phát hiện bóng dáng con mồi in trên nền ánh sáng chạng vạng cực yếu từ mặt biển.',
        TRUE
    ),

    -- ------------------------------------------------------------------------
    -- 3. SHARK BAY: shark-bay-seagrass-meadow & shark-bay-stromatolite-community
    -- (Tái sử dụng bản ghi dugong & green-sea-turtle sẵn có trong DB)
    -- ------------------------------------------------------------------------
    (
        'dugong',
        'shark-bay-seagrass-meadow',
        '1m – 15m',
        'Di chuyển theo mùa giữa các vùng nước ấm và kiếm ăn trên thảm cỏ biển rộng lớn của Shark Bay dưới áp lực cảnh giác cá mập hổ.',
        TRUE
    ),
    (
        'green-sea-turtle',
        'shark-bay-seagrass-meadow',
        '1m – 15m',
        'Chăn thả cỏ biển và điều chỉnh vị trí kiếm ăn sang các vùng rìa an toàn hơn khi mật độ cá mập hổ tăng cao vào mùa ấm.',
        FALSE
    ),
    (
        'tiger-shark',
        'shark-bay-seagrass-meadow',
        '1m – 15m',
        'Săn mồi dọc các luồng lạch cắt qua thảm cỏ biển nông, đóng vai trò điều hòa sinh thái từ trên xuống (top-down control).',
        TRUE
    ),
    (
        'indo-pacific-bottlenose-dolphin',
        'shark-bay-seagrass-meadow',
        '1m – 15m',
        'Săn cá đàn trên thảm cỏ biển và sử dụng bọt biển bảo vệ mõm khi sục tìm con mồi ở các kênh đáy cát sỏi.',
        TRUE
    ),
    (
        'indo-pacific-bottlenose-dolphin',
        'shark-bay-stromatolite-community',
        '0m – 4m',
        'Bơi kiếm ăn tại vùng nước nông ven bờ tiếp giáp các thềm đá Stromatolite khi thủy triều dâng cao.',
        FALSE
    ),
    (
        'amphibolis-antarctica',
        'shark-bay-seagrass-meadow',
        '1m – 15m',
        'Hình thành các dải thảm dày giữ trầm tích và chịu đựng tốt độ mặn cao đặc trưng của vùng vịnh Shark Bay.',
        TRUE
    ),
    (
        'amphibolis-antarctica',
        'shark-bay-stromatolite-community',
        '1m – 4m',
        'Các gờ cỏ biển ngoài cửa vịnh làm chậm dòng trao đổi nước, góp phần duy trì độ mặn siêu cao bảo vệ quần xã Stromatolite khỏi động vật ăn rêu.',
        TRUE
    ),

    -- ------------------------------------------------------------------------
    -- 4. ANTARCTIC PENINSULA: antarctic-sea-ice-krill & antarctic-cold-seafloor
    -- ------------------------------------------------------------------------
    (
        'antarctic-krill',
        'antarctic-sea-ice-krill',
        '0m – 200m',
        'Tập trung thành đàn mật độ cao ngay dưới mặt băng biển mùa xuân để ăn tảo băng và thực vật phù du.',
        TRUE
    ),
    (
        'antarctic-krill',
        'antarctic-cold-seafloor',
        '200m – 600m',
        'Thực hiện di cư thẳng đứng và lặn xuống kiếm ăn lớp trầm tích hữu cơ dưới đáy biển lạnh vùng thềm lục địa Nam Cực.',
        FALSE
    ),
    (
        'emperor-penguin',
        'antarctic-sea-ice-krill',
        '0m – 200m',
        'Sử dụng băng biển làm nền tảng nghỉ ngơi và lao xuống tầng nước dưới băng để săn nhuyễn thể cùng cá bạc Nam Cực.',
        TRUE
    ),
    (
        'blackfin-icefish',
        'antarctic-cold-seafloor',
        '200m – 770m',
        'Phục kích con mồi sát đáy biển băng giá nhờ tốc độ trao đổi chất thấp và máu trong suốt chứa protein chống đông.',
        TRUE
    ),

    -- ------------------------------------------------------------------------
    -- 5. EAST PACIFIC RISE: epr-hydrothermal-vent
    -- ------------------------------------------------------------------------
    (
        'giant-tube-worm',
        'epr-hydrothermal-vent',
        '2.400m – 2.800m',
        'Neo chặt ống kitin vào nền đá bazan quanh miệng phun để tiếp cận đồng thời dòng nước ấm giàu H2S và nước biển sâu giàu O2.',
        TRUE
    ),
    (
        'pompeii-worm',
        'epr-hydrothermal-vent',
        '2.400m – 2.800m',
        'Làm tổ trực tiếp trên thành ống khói sunfua nóng tới 80°C nhờ lớp thảm vi khuẩn cộng sinh bảo vệ trên lưng.',
        TRUE
    ),
    (
        'bythograea-thermydron',
        'epr-hydrothermal-vent',
        '2.400m – 2.800m',
        'Săn mồi quanh các cụm giun ống và chịu đựng nồng độ sunfua độc hại nhờ hệ enzyme khử độc chuyên biệt trong gan tụy.',
        TRUE
    ),

    -- ------------------------------------------------------------------------
    -- 6. MARIANA TRENCH: mariana-hadal-trench & mariana-challenger-deep-seafloor
    -- ------------------------------------------------------------------------
    (
        'mariana-snailfish',
        'mariana-hadal-trench',
        '6.198m – 8.076m',
        'Săn các loài giáp xác nhỏ dọc sườn rãnh Hadal với cơ thể mềm dẻo chứa hợp chất TMAO chống lại áp suất thủy tĩnh cực đại.',
        TRUE
    ),
    (
        'hirondellea-gigas',
        'mariana-hadal-trench',
        '6.500m – 8.500m',
        'Di chuyển thành đàn dọc sườn rãnh để thu gom xác sinh vật và mảnh vụn hữu cơ trôi xuống từ các tầng nước phía trên.',
        TRUE
    ),
    (
        'hirondellea-gigas',
        'mariana-challenger-deep-seafloor',
        '8.500m – 10.928m',
        'Phủ lớp gel nhôm hydroxit bảo vệ vỏ khỏi hòa tan ở đáy vực Challenger Deep và tiêu hóa mảnh thực vật chìm nhờ enzyme cellulase.',
        TRUE
    ),
    (
        'benthodytes-typica',
        'mariana-challenger-deep-seafloor',
        '8.500m – 9.500m',
        'Bò chậm rãi trên nền bùn mềm đáy vực để lọc ăn mùn hữu cơ lắng đọng trong bóng tối vĩnh cửu.',
        TRUE
    )
) AS link (
    species_slug,
    ecosystem_slug,
    local_depth_range_text,
    adaptation_notes,
    is_key_species
)
INNER JOIN explorer_marinespecies sp
    ON sp.slug = link.species_slug
INNER JOIN explorer_ecosystem eco
    ON eco.slug = link.ecosystem_slug
ON CONFLICT (species_id, ecosystem_id) DO NOTHING;

COMMIT;


-- ============================================================================
-- PHẦN 3: CÁC CÂU LỆNH SELECT KIỂM TRA DỮ LIỆU SAU KHI CHẠY
-- ============================================================================

-- 1. Kiểm tra danh sách toàn bộ loài trong hệ thống (gồm cả các loài vừa thêm)
SELECT
    sp.id,
    sp.slug,
    sp.vietnamese_name,
    sp.name,
    sp.scientific_name,
    sp.species_group,
    sp.min_depth_m,
    sp.max_depth_m,
    sp.conservation_status,
    sp.is_published,
    sp.is_verified
FROM explorer_marinespecies sp
ORDER BY sp.id;

-- 2. Kiểm tra địa điểm và hệ sinh thái của từng loài
SELECT
    loc.sort_order,
    loc.vietnamese_name AS location_vi,
    eco.vietnamese_name AS ecosystem_vi,
    eco.slug AS ecosystem_slug,
    sp.vietnamese_name AS species_vi,
    sp.scientific_name,
    se.local_depth_range_text,
    se.is_key_species
FROM explorer_speciesecosystem se
INNER JOIN explorer_marinespecies sp
    ON sp.id = se.species_id
INNER JOIN explorer_ecosystem eco
    ON eco.id = se.ecosystem_id
INNER JOIN explorer_oceanlocation loc
    ON loc.id = eco.location_id
ORDER BY loc.sort_order, eco.slug, se.is_key_species DESC, sp.vietnamese_name;

-- 3. Kiểm tra các loài liên kết với nhiều hệ sinh thái (>= 2 hệ sinh thái)
SELECT
    sp.slug,
    sp.vietnamese_name,
    sp.scientific_name,
    COUNT(se.ecosystem_id) AS ecosystem_count,
    STRING_AGG(eco.slug, ', ' ORDER BY eco.slug) AS linked_ecosystems
FROM explorer_marinespecies sp
INNER JOIN explorer_speciesecosystem se
    ON se.species_id = sp.id
INNER JOIN explorer_ecosystem eco
    ON eco.id = se.ecosystem_id
GROUP BY sp.id, sp.slug, sp.vietnamese_name, sp.scientific_name
HAVING COUNT(se.ecosystem_id) >= 2
ORDER BY ecosystem_count DESC, sp.vietnamese_name;

-- 4. Kiểm tra số lượng loài và số liên kết theo từng địa điểm đại dương
SELECT
    loc.sort_order,
    loc.slug AS location_slug,
    loc.vietnamese_name AS location_vi,
    COUNT(DISTINCT eco.id) AS total_ecosystems,
    COUNT(DISTINCT se.species_id) AS distinct_species_count,
    COUNT(se.id) AS total_species_ecosystem_links
FROM explorer_oceanlocation loc
LEFT JOIN explorer_ecosystem eco
    ON eco.location_id = loc.id
LEFT JOIN explorer_speciesecosystem se
    ON se.ecosystem_id = eco.id
GROUP BY loc.id, loc.sort_order, loc.slug, loc.vietnamese_name
ORDER BY loc.sort_order;

