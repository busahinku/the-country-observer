# The Country Observer

Türkiye odaklı, statik ve bağımlılıksız haber sitesi. `node derle.mjs` komutu `icerik/` klasöründeki haberlerden `yayin/` klasörüne hazır HTML üretir. `sh yayinla.sh` siteyi derleyip `gh-pages` dalına gönderir; GitHub Pages siteyi bu daldan yayınlar.

Adres: https://haber.busahin.com/

## Haber eklemek

`icerik/haberler/` altına dosya adı adres olacak şekilde bir `.md` dosyası ekleyin (örnek: `eylul-enflasyonu-aciklandi.md`):

```
---
baslik: Eylül enflasyonu açıklandı
spot: Bir iki cümlelik özet. Kartlarda ve paylaşım önizlemelerinde görünür.
kategori: ekonomi
yazar: Ekonomi Servisi
tarih: 2026-10-05T10:05:00+03:00
vitrin: manset
etiketler: ["Enflasyon","TÜİK"]
gorsel_sorgu: Istanbul Grand Bazaar
kaynaklar: [{"ad":"Anadolu Ajansı","url":"https://www.aa.com.tr/..."}]
---
İlk paragraf (ilk harfi büyük başlar).

## Ara başlık

> Öne çıkan alıntı

- Madde işaretli liste
```

- **kategori:** `gundem`, `politika`, `ekonomi`, `dunya`, `spor`, `teknoloji`, `kultur-sanat`, `yasam`, `saglik`, `analiz`
- **vitrin** (isteğe bağlı): `manset` (üstteki büyük slayt), `yan` (manşetin sağındaki kartlar), `haftanin` (Haftanın Haberi). Boş bırakılırsa en yeni haberler kullanılır.
- **gorsel_sorgu / gorsel_dosya:** Fotoğraf Wikimedia Commons'tan bulunur. `gorsel_dosya: File:Ad.jpg` ile belirli bir dosya seçilebilir. İsteğe bağlı `gorsel_aciklama` fotoğraf altı yazısıdır.

Ana sayfadaki bölümler eldeki haber sayısına göre kendiliğinden dolar. Bir kategoride en az 4 haber olduğunda o kategori ana sayfada ayrı bir satır olarak görünür.

## Komutlar

```bash
node araclar/gorsel-bul.mjs            # görseli olmayan haberlere fotoğraf bulur, WebP'ye çevirir (cwebp ve ffmpeg gerekir)
TABAN_YOL= node derle.mjs              # yerelde kök dizine derler
python3 -m http.server 4173 -d yayin   # yerel önizleme
node araclar/topla.mjs                 # Türk haber kaynaklarının RSS akışlarını çekip aynı olayı anlatan haberleri kümeler
node araclar/kaynak-oku.mjs 0 1 2      # seçilen kümelerdeki haberlerin tam metnini getirir
```

Yazı tipleri `statik/yazitipleri/` altında Türkçe karakterlere göre küçültülmüş hâlde durur. Bower ticari bir yazı tipidir (Radim Pesko); web kullanımı için lisansınızın uygun olduğundan emin olun.

## 3 Ekim 2026 arşivi ve sesli haberler

Gazete 100 haber içerir. Yeni 94 metin, kaynakları okunarak özgün biçimde hazırlanmış kısa haberler ve altı açıklayıcı analizden oluşur. Kaynakları her haberin altında görünür; tek kaynaklı metinler ayrıca belirtilir. Temsili fotoğraflar, olay fotoğrafı olarak sunulmaz. Haberlerin yayın tarihleri kaynakların tarihlerini temel alır.

100 haberin tamamında Türkçe sinirsel sesle üretilmiş MP3 kaydı vardır. Ses dosyaları `preload="none"` ile yalnızca dinleme başladığında indirilir. Dinleyici duraklatma, zaman çizelgesi ve hız seçimini destekler. Sesin yapay olarak üretildiği okura açıklanır.

Yeni veya değişen haberlerin sesini hazırlamak için:

```sh
python3 -m venv .onbellek/ses-ortami
.onbellek/ses-ortami/bin/pip install edge-tts
.onbellek/ses-ortami/bin/python araclar/seslendir.py
```

Üretim betiği değişmeyen kayıtları atlar, geçici dosyaya yazar ve başarısız kayıtları yeniden dener. Hazır ses dosyaları GitHub'da tutulur; okurun tarayıcı sesine veya bir API anahtarına ihtiyacı yoktur.

İsteğe bağlı GitHub Actions tarama tanımı `araclar/kaynak-taramasi.yml` içinde hazırdır. Etkinleştirildiğinde kaynakları altı saatte bir tarayıp `haber-adaylari` adlı inceleme çıktısı oluşturur. Mevcut GitHub oturumunda iş akışı yazma yetkisi olmadığı için bu tanım etkinleştirilmemiştir. Bu işlem, tek başına haber yazıp yayımlamaz. Kümeleme bir editoryal doğrulama değildir; aynı ajans metnini aktaran yayınlar bağımsız teyit sayılmaz. İsim, sayı, tarih ve olay eşleştirmesi kaynak metinlerinden incelenmeli; özgün haber ardından `icerik/haberler/` altına eklenmelidir.

## Alt alan adına geçiş

Yayın adresi `https://haber.busahin.com/`. GitHub Pages özel alanı ve HTTPS zorlaması etkin; Cloudflare'daki `haber` CNAME kaydı yalnızca DNS modunda `busahinku.github.io` hedefine gider.

Cloudflare'da gereken kayıt:

| Tür | Ad | Hedef | Proxy |
| --- | --- | --- | --- |
| CNAME | haber | busahinku.github.io | Yalnızca DNS |

GitHub Pages hedefi depo adını veya bir URL yolunu içermez.

Geçişi tamamlamak için:

```sh
sh yayinla.sh --alan-adi haber.busahin.com
```

Bu komut kalıcı `yayin-ayarlari.json` dosyasını günceller, kök dizinden çalışan siteyi derler, canonical/RSS/site haritası/paylaşım adreslerini aynı alan adına geçirir, `CNAME` dosyası oluşturur ve GitHub Pages ayarını günceller.

Kaynak: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

Stil ve etkileşim dosyaları tüm sayfalarda ortak ve içerik sürümüyle önbelleklenir. Yazı tipleri yereldir; fotoğraflar duyarlı boyutlarda WebP'dir. Üst menü ve alt alan sayfa geçişinin solma/yükselme animasyonuna katılmaz. Hareket azaltma tercihi desteklenir; büyük ilk harf destekleyen tarayıcılarda iki satıra yerleşir.

## Piyasa verileri ve soru kutusu

Ana sayfada ons altın, ons gümüş, dolar/TL ve avro/TL şeridi vardır. `piyasalar/` sayfasında metaller için son işlem fiyatı ile 1 gün, 1 hafta ve 1 ay grafikleri; döviz için günlük referans kuru ile haftalık ve aylık kapanış grafikleri görünür. Dövizin gün içi grafiği kaynaktaki ücretsiz akışta bulunmadığı için kapalıdır. Altın ve gümüş verisi Standard Bullion, döviz güncel referansları ExchangeRate-API, geçmiş döviz kapanışları Frankfurter üzerinden tarayıcıda alınır. Değerler kaynak saatleriyle birlikte gösterilir; fiyat akışı kesilirse uydurma değer basılmaz. Üçüncü taraf verilerin doğruluğu ve sürekliliği kaynaklara bağlıdır.

Soru kutusu, hizmete bağlanmadığında arşivde ilgili haberleri ve kaynak bağlantılarını bulur. OpenAI tabanlı yanıt için `araclar/yardim-worker.mjs` ve `araclar/wrangler.jsonc` içindeki Cloudflare Worker `https://yardim.busahin.com/` alanında çalışır. Bu uç nokta yayımlanmış haberlerden sabit bir arşiv çeker; ziyaretçi bir URL, sistem talimatı, araç veya bağlam gönderemez. İstek boyutu ve yanıt uzunluğu sınırlanır, ziyaretçi ve tüm site için hız sınırı uygulanır. Yanıt düz metindir ve kaynak haber bağlantıları ayrıca eklenir. Hiçbir istem enjeksiyonu savunması kusursuz değildir; modelin araç ve kod çalıştırma yetkisi bulunmaz.

Cloudflare hesabındaki `country-observer-yardim` Worker'ında OpenAI anahtarı yalnızca `OPENAI_API_KEY` gizlisi olarak kaydedilmiştir. Anahtar hiçbir HTML, JavaScript, GitHub dosyası veya `yayin-ayarlari.json` içine yazılmamalıdır. Worker `gpt-5-nano` ve saklamasız yanıt kullanır; bu modelin erişimi ve fiyatı OpenAI hesabının durumuna bağlıdır. Yeniden dağıtım komutları:

```sh
npx wrangler secret put OPENAI_API_KEY --config araclar/wrangler.jsonc
npx wrangler deploy --config araclar/wrangler.jsonc
```

Worker adresi `yayin-ayarlari.json` içindeki `yardim_adresi` alanında tutulur. Yeni dağıtımlarda `SITE_ORIGIN` ve `SITE_URL` değişkenleri `haber.busahin.com` değerini korumalıdır. Anahtar olmadan soru kutusu yalnızca arşiv araması yapar.

Ses kayıtları hâlihazırda ücretsiz Edge sinirsel sesinden üretilmiştir. Daha doğal Türkçe anlatım için açık lisanslı FreyaTTS denenebilir; 183 milyon parametreli yerel modelin tüm 100 haber için üretilmesi zaman ve yaklaşık gigabayt ölçeğinde model indirmesi gerektirir. ElevenLabs ücretsiz planı aylık 10 bin krediyle sınırlıdır ve ticari kullanım lisansı içermez. Google Cloud'un deneme kredisi bir seçenek olabilir ancak Cloud hesabı ve kimlik bilgileri gerekir.
