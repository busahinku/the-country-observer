# The Country Observer

Türkiye odaklı, statik ve bağımlılıksız haber sitesi. `node derle.mjs` komutu `icerik/` klasöründeki haberlerden `yayin/` klasörüne hazır HTML üretir. `sh yayinla.sh` siteyi derleyip `gh-pages` dalına gönderir; GitHub Pages siteyi bu daldan yayınlar.

Adres: https://busahin.com/the-country-observer/

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
