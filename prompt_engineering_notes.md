'''
# Gamebook Görsel Üretim İyileştirme Notları

**Sorun:** Üretilen görsellerde karakter tutarlılığı sağlanamıyor. Bir sahnede olması gereken karakter sayısı veya karakterlerin görünümü (saç rengi, kıyafet vb.) sayfadan sayfaya değişiyor.

**Kök Neden:** Görsel üretim prompt'ları, her panel için yeterince spesifik ve kısıtlayıcı değil. Model, her seferinde yeni bir görsel oluşturduğu için karakterlerin ve sahnenin tutarlılığını koruyamıyor.

## Çözüm Stratejisi

Karakter ve stil tutarlılığını sağlamak için "prompt mühendisliği" tekniklerini kullanarak daha detaylı ve yapılandırılmış prompt'lar oluşturmamız gerekiyor. Temel strateji, her kitap için **global bir stil kilidi** ve her karakter için **detaylı bir görünüm kartı** oluşturmaktır.

### 1. Global Stil Kilidi (Global Style Lock)

Her kitap için, tüm görsellerde geçerli olacak sabit bir stil prompt'u tanımlanmalıdır. Bu, görsel dünyanın tutarlı kalmasını sağlar.

**Örnek Global Stil Prompt'u:**

```
--style raw --ar 4:3

**comic book art style**, vibrant colors, clean line art, dynamic action poses, cinematic lighting, detailed backgrounds, consistent character design. The scene is set in a [GENRE] world. Use a color palette dominated by [COLOR_1], [COLOR_2], and [COLOR_3].
```

- `[GENRE]`: Kitabın türü (örn: "mysterious jungle", "ancient temple").
- `[COLOR_1]`, `[COLOR_2]`, `[COLOR_3]`: Sahnenin genel atmosferini belirleyen ana renkler.

### 2. Karakter Kartları (Character Cards)

Her bir karakter için, görsel özelliklerini net bir şekilde tanımlayan bir "kart" oluşturulmalıdır. Bu kart, karakterin geçtiği her panelin prompt'una dahil edilecektir.

**Örnek Karakter Kartı Formatı:**

```
**Character: [CHARACTER_NAME]**
- **Appearance:** [AGE] years old, [GENDER], [HAIR_STYLE] [HAIR_COLOR] hair, [EYE_COLOR] eyes, [SKIN_TONE] skin.
- **Clothing:** Wearing a [CLOTHING_DESCRIPTION].
- **Role:** [ROLE_IN_STORY] (e.g., protagonist, brave explorer, wise mentor).
- **Unique Feature:** [ANY_DISTINGUISHING_MARK] (e.g., a scar on the left cheek, a glowing amulet).
```

**Örnek Doldurulmuş Kart (Tunga):**

```
**Character: Tunga**
- **Appearance:** 22 years old, male, short brown hair, brown eyes, fair skin.
- **Clothing:** Wearing a red hooded sweatshirt, blue jeans, and brown boots.
- **Role:** The brave and curious leader of the group.
- **Unique Feature:** Carries an ancient, glowing compass.
```

### 3. Panel Bazında Prompt Oluşturma

Her bir panel için prompt oluşturulurken aşağıdaki yapı birleştirilmelidir:

`[Global Stil Prompt'u] + [İlgili Karakter Kartları] + [Panelin Anlatımı (Narration)] + [Sahne Detayları]`

**Örnek Panel Prompt'u:**

```
--style raw --ar 4:3

**comic book art style**, vibrant colors, clean line art, dynamic action poses, cinematic lighting, detailed backgrounds, consistent character design. The scene is set in a mysterious jungle. Use a color palette dominated by deep greens, earthy browns, and glowing blues.

**Characters in scene: Tunga, Elif, Can, Lara (4 people total).**

**Character: Tunga**
- **Appearance:** 22 years old, male, short brown hair, brown eyes, fair skin.
- **Clothing:** Wearing a red hooded sweatshirt, blue jeans, and brown boots.
- **Role:** The brave and curious leader of the group.
- **Unique Feature:** Carries an ancient, glowing compass.

**Character: Elif**
- **Appearance:** 21 years old, female, long wavy dark hair, green eyes, olive skin.
- **Clothing:** Wearing a green jacket, black pants, and hiking boots.
- **Role:** The knowledgeable historian of the group.
- **Unique Feature:** Always carries a leather-bound journal.

**[...Can ve Lara için de benzer kartlar...]**

**Scene Description:**
The four explorers (Tunga, Elif, Can, Lara) are standing together in a dense jungle, looking towards a mysterious, glowing waterfall. Tunga is in the front, holding his glowing compass. Elif is next to him, looking at the waterfall with a thoughtful expression. The mood is one of wonder and anticipation. Ensure exactly 4 characters are visible.
```

### Uygulama Adımları

1.  **Veritabanı/Backend Değişikliği:** `books` tablosuna `global_style_prompt` adında bir alan eklenmelidir. `characters` tablosundaki mevcut alanlar (appearance, voice, role) daha detaylı ve yapılandırılmış bir şekilde kullanılmalıdır.
2.  **Prompt Oluşturma Mantığı:** Görsel üreten backend servisinde, yukarıdaki yapıyı kullanarak prompt'ları dinamik olarak birleştiren bir fonksiyon yazılmalıdır.
3.  **Karakter Sayısı Vurgusu:** Prompt'un içinde `**Characters in scene: ... (X people total).**` ve `Ensure exactly X characters are visible.` gibi ifadelerle karakter sayısını net bir şekilde belirtmek, modelin doğru sayıda karakter çizmesine yardımcı olacaktır.

Bu yapı, hem stilistik tutarlılığı hem de karakterlerin görsel devamlılığını sağlayarak Gamebook deneyimini önemli ölçüde iyileştirecektir.
''''
