// Haber toplayıcı: Türk haber kaynaklarının RSS akışlarını çeker, aynı olayı
// anlatan haberleri kümeler ve birden çok kaynağın doğruladığı olayları sıralar.
// Çıktı: .onbellek/kumeler.json
// Kullanım: node araclar/topla.mjs [--saat 48]
import { mkdir, writeFile } from 'node:fs/promises';

export const KAYNAKLAR = [
  ['Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=guncel'],
  ['Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi'],
  ['Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=dunya'],
  ['Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=spor'],
  ['BBC Türkçe', 'https://feeds.bbci.co.uk/turkce/rss.xml'],
  ['DW Türkçe', 'https://rss.dw.com/xml/rss-tur-all'],
  ['Euronews Türkçe', 'https://tr.euronews.com/rss'],
  ['Independent Türkçe', 'https://www.indyturk.com/rss.xml'],
  ['TRT Haber', 'https://www.trthaber.com/manset_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/gundem_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/ekonomi_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/dunya_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/spor_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/bilim_teknoloji_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/kultur_sanat_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/saglik_articles.rss'],
  ['TRT Haber', 'https://www.trthaber.com/yasam_articles.rss'],
  ['Hürriyet', 'https://www.hurriyet.com.tr/rss/gundem'],
  ['Hürriyet', 'https://www.hurriyet.com.tr/rss/ekonomi'],
  ['Hürriyet', 'https://www.hurriyet.com.tr/rss/dunya'],
  ['Hürriyet', 'https://www.hurriyet.com.tr/rss/spor'],
  ['NTV', 'https://www.ntv.com.tr/gundem.rss'],
  ['NTV', 'https://www.ntv.com.tr/ekonomi.rss'],
  ['NTV', 'https://www.ntv.com.tr/dunya.rss'],
  ['NTV', 'https://www.ntv.com.tr/teknoloji.rss'],
  ['NTV', 'https://www.ntv.com.tr/saglik.rss'],
  ['NTV', 'https://www.ntv.com.tr/yasam.rss'],
  ['Habertürk', 'https://www.haberturk.com/rss'],
  ['Habertürk', 'https://www.haberturk.com/rss/ekonomi.xml'],
  ['Habertürk', 'https://www.haberturk.com/rss/spor.xml'],
  ['CNN Türk', 'https://www.cnnturk.com/feed/rss/all/news'],
  ['Sözcü', 'https://www.sozcu.com.tr/feeds-rss-category-sozcu'],
  ['Sözcü', 'https://www.sozcu.com.tr/feeds-rss-category-ekonomi'],
  ['Cumhuriyet', 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml'],
  ['Milliyet', 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml'],
  ['Sabah', 'https://www.sabah.com.tr/rss/anasayfa.xml'],
  ['Yeni Şafak', 'https://www.yenisafak.com/rss?xml=gundem'],
  ['Karar', 'https://www.karar.com/rss'],
  ['BirGün', 'https://www.birgun.net/rss/home'],
  ['Evrensel', 'https://www.evrensel.net/rss/haber.xml'],
  ['Halk TV', 'https://halktv.com.tr/service/rss.php'],
  ['Gazete Duvar', 'https://www.gazeteduvar.com.tr/export/rss'],
  ['Bloomberg HT', 'https://www.bloomberght.com/rss'],
  ['Dünya', 'https://www.dunya.com/rss'],
  ['Ekonomim', 'https://www.ekonomim.com/export/rss'],
  ['Fotomaç', 'https://www.fotomac.com.tr/rss/anasayfa.xml'],
  ['Webtekno', 'https://www.webtekno.com/rss.xml'],
  ['DonanımHaber', 'https://www.donanimhaber.com/rss/tum/'],
];

const TARAYICI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';

const DURAK = new Set(('ve ile bir bu şu o da de ki mi mı mu mü için gibi kadar daha en çok son sonra önce olan oldu olarak ' +
  'yeni ilk iki üç her tüm ne nasıl neden nerede hangi değil var yok ise ama fakat veya ya hem bile göre karşı ' +
  'açıklama açıkladı dedi duyurdu flaş sondakika dakika canlı haber haberi video foto galeri işte belli oldu').split(' '));

export const metinTemizle = s => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(uuml|Uuml|ouml|Ouml|ccedil|Ccedil|rsquo|lsquo|ldquo|rdquo|hellip|ndash|mdash|acirc|icirc|ucirc);/g, (_, a) => ({ uuml: 'ü', Uuml: 'Ü', ouml: 'ö', Ouml: 'Ö', ccedil: 'ç', Ccedil: 'Ç', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '-', mdash: '-', acirc: 'â', icirc: 'î', ucirc: 'û' })[a])
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, ' ').trim();

const etiket = (xml, ad) => {
  const m = xml.match(new RegExp(`<${ad}[^>]*>([\\s\\S]*?)</${ad}>`, 'i'));
  return m ? m[1] : '';
};

export function akisCoz(xml, kaynak) {
  const ogeler = [];
  for (const [, govde] of xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)) {
    const link = metinTemizle(etiket(govde, 'link')) || (govde.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const tarihMetni = metinTemizle(etiket(govde, 'pubDate') || etiket(govde, 'published') || etiket(govde, 'updated') || etiket(govde, 'dc:date'));
    let tarih = new Date(tarihMetni);
    // Bazı akışlar yerel saati GMT diye yazıyor; gelecekteki tarihleri Türkiye saatine çek.
    if (tarih > Date.now() + 6e5) tarih = new Date(tarih - 3 * 3600e3);
    ogeler.push({
      kaynak,
      baslik: metinTemizle(etiket(govde, 'title')),
      ozet: metinTemizle(etiket(govde, 'description') || etiket(govde, 'summary') || etiket(govde, 'content')).slice(0, 600),
      link: link.trim(),
      tarih: isNaN(tarih) ? null : tarih.toISOString(),
    });
  }
  return ogeler.filter(o => o.baslik && o.link);
}

// Türkçe eklemeli bir dil: ilk 5 harf kaba ama işe yarar bir kök verir.
export const kokler = metin => new Set(
  metin.toLocaleLowerCase('tr').replace(/['’`]/g, ' ').replace(/[^a-zçğıöşü0-9 ]/g, ' ').split(/\s+/)
    .filter(k => k.length > 2 && !DURAK.has(k)).map(k => k.slice(0, 5))
);

const benzerlik = (a, b) => {
  let ortak = 0;
  for (const k of a) if (b.has(k)) ortak++;
  return ortak < 2 ? 0 : 2 * ortak / (a.size + b.size);
};

// ponytail: açgözlü O(n·k) kümeleme, birkaç bin haber için yeterli; daha fazlasında MinHash'e geçilir.
export function kumele(ogeler) {
  const kumeler = [];
  for (const o of ogeler) {
    o._k = kokler(o.baslik);
    let enIyi = null, puan = 0;
    for (const k of kumeler) {
      const sayilar = s => new Set(s.match(/\b\d+\b/g) || []);
      const adaySayilar = sayilar(o.baslik), temsilciSayilar = sayilar(k.ogeler[0].baslik);
      if (adaySayilar.size && temsilciSayilar.size && ![...adaySayilar].some(n => temsilciSayilar.has(n))) continue;
      const p = benzerlik(o._k, k.kokler);
      if (p > puan) { puan = p; enIyi = k; }
    }
    if (enIyi && puan >= 0.67) {
      enIyi.ogeler.push(o);
      // Temsilci başlık sabit kalır; zincirleme büyüme farklı olayları birleştirmesin.
    } else kumeler.push({ kokler: new Set(o._k), ogeler: [o] });
  }
  return kumeler.map(k => {
    const kaynaklar = [...new Set(k.ogeler.map(o => o.kaynak))];
    const tarihler = k.ogeler.map(o => o.tarih).filter(Boolean).sort();
    return { kaynakSayisi: kaynaklar.length, kaynaklar, ilk: tarihler[0], son: tarihler.at(-1), ogeler: k.ogeler.map(({ _k, ...o }) => o) };
  }).sort((a, b) => b.kaynakSayisi - a.kaynakSayisi || (b.son || '').localeCompare(a.son || ''));
}

export async function topla(saat = 48) {
  const sinir = Date.now() - saat * 3600e3;
  const sonuclar = await Promise.allSettled(KAYNAKLAR.map(async ([ad, url]) => {
    const yanit = await fetch(url, { headers: { 'user-agent': TARAYICI }, signal: AbortSignal.timeout(15000) });
    if (!yanit.ok) throw new Error(`${ad}: HTTP ${yanit.status}`);
    return akisCoz(await yanit.text(), ad);
  }));
  const gorulen = new Set();
  const ogeler = sonuclar.flatMap(s => s.status === 'fulfilled' ? s.value : [])
    .filter(o => (!o.tarih || Date.parse(o.tarih) >= sinir) && !gorulen.has(o.link) && gorulen.add(o.link));
  return { ogeSayisi: ogeler.length, kumeler: kumele(ogeler) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const saat = +(process.argv[process.argv.indexOf('--saat') + 1] || 48) || 48;
  const { ogeSayisi, kumeler } = await topla(saat);
  await mkdir('.onbellek', { recursive: true });
  await writeFile('.onbellek/kumeler.json', JSON.stringify(kumeler, null, 1));
  const cok = kumeler.filter(k => k.kaynakSayisi >= 2);
  console.log(`${ogeSayisi} haber, ${kumeler.length} küme, ${cok.length} çok kaynaklı küme`);
}
