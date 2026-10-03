// The Country Observer: statik site derleyici. Bağımlılık yok.
// icerik/haberler/*.md + icerik/gorseller.json + kaynak/ -> yayin/
// Kullanım: node derle.mjs   (TABAN_YOL=/ ile yerel kök dizinde de derlenebilir)
import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const YAYIN_AYARLARI = JSON.parse(await readFile('yayin-ayarlari.json', 'utf8').catch(() => '{}'));
const TABAN = (process.env.TABAN_YOL ?? YAYIN_AYARLARI.taban_yol ?? '/the-country-observer').replace(/\/$/, '');
const SITE = process.env.SITE_ADRESI ?? YAYIN_AYARLARI.site_adresi ?? 'https://busahin.com';
const OZEL_ALAN = process.env.OZEL_ALAN_ADI ?? YAYIN_AYARLARI.ozel_alan_adi ?? '';
const CIKTI = process.env.CIKTI_DIZIN ?? 'yayin';
const ICERIK = process.env.ICERIK_DIZIN ?? 'icerik';
const SITE_ADI = 'The Country Observer';
const YARDIM_ADRESI = process.env.YARDIM_ADRESI ?? YAYIN_AYARLARI.yardim_adresi ?? '';

export const KATEGORILER = {
  gundem: 'Gündem', politika: 'Politika', ekonomi: 'Ekonomi', dunya: 'Dünya', spor: 'Spor',
  teknoloji: 'Teknoloji', 'kultur-sanat': 'Kültür-Sanat', yasam: 'Yaşam', saglik: 'Sağlık', analiz: 'Analiz',
};

const u = yol => `${TABAN}${yol}`;
const tamAdres = yol => `${SITE}${u(yol)}`;
const kacis = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- İçerik okuma ----------

// Basit ön bilgi: `anahtar: değer` satırları; [ ya da { ile başlayan değerler JSON'dur.
export function onBilgiCoz(metin) {
  const m = metin.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('ön bilgi bloğu yok');
  const bilgi = {};
  for (const satir of m[1].split('\n')) {
    const i = satir.indexOf(':');
    if (i < 1) continue;
    const anahtar = satir.slice(0, i).trim(), deger = satir.slice(i + 1).trim();
    bilgi[anahtar] = /^[[{]/.test(deger) ? JSON.parse(deger) : deger;
  }
  return { bilgi, govde: m[2].trim() };
}

const satirIci = s => kacis(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');

export function govdeHtml(md) {
  return md.split(/\n\s*\n/).map(blok => {
    blok = blok.trim();
    if (blok.startsWith('## ')) return `<h2>${satirIci(blok.slice(3))}</h2>`;
    if (blok.startsWith('> ')) return `<blockquote><p>${satirIci(blok.replace(/^> ?/gm, ''))}</p></blockquote>`;
    if (/^- /.test(blok)) return `<ul>${blok.split('\n').map(s => `<li>${satirIci(s.replace(/^- /, ''))}</li>`).join('')}</ul>`;
    return `<p>${satirIci(blok.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

const tarihBicim = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const kisaTarih = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
const gunBicim = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul' });

async function haberleriOku() {
  const kunye = JSON.parse(await readFile(`${ICERIK}/gorseller.json`, 'utf8').catch(() => '{}'));
  const dosyalar = (await readdir(`${ICERIK}/haberler`)).filter(d => d.endsWith('.md'));
  const haberler = await Promise.all(dosyalar.map(async d => {
    const id = d.slice(0, -3);
    const { bilgi, govde } = onBilgiCoz(await readFile(`${ICERIK}/haberler/${d}`, 'utf8'));
    if (!KATEGORILER[bilgi.kategori]) throw new Error(`${id}: bilinmeyen kategori "${bilgi.kategori}"`);
    for (const alan of ['baslik', 'spot', 'tarih']) if (!bilgi[alan]) throw new Error(`${id}: "${alan}" eksik`);
    const sesVar = await readFile(`statik/sesler/${id}.mp3`).then(() => true).catch(() => false);
    const kelime = govde.split(/\s+/).length;
    return {
      ...bilgi, id, govde, sesVar,
      tarih: new Date(bilgi.tarih),
      etiketler: bilgi.etiketler || [],
      kaynaklar: bilgi.kaynaklar || [],
      kategoriAd: KATEGORILER[bilgi.kategori],
      yazar: bilgi.yazar || 'Haber Merkezi',
      dakika: Math.max(1, Math.round(kelime / 200)),
      giris: govde.split(/\n\s*\n/).filter(b => !/^(##|>|- )/.test(b.trim())).slice(0, 2).join(' ').replace(/\*\*?|\[|\]\([^)]*\)/g, '').trim() || bilgi.spot,
      gorsel: kunye[id] ? { id, ...kunye[id] } : null,
      url: u(`/haber/${id}/`),
    };
  }));
  return haberler.sort((a, b) => b.tarih - a.tarih);
}

// ---------- Parçalar ----------

const ikonlar = new Map();
const ikon = (ad, sinif = 'ikon') => `<svg class="${sinif}" aria-hidden="true"><use href="#i-${ad}"/></svg>`;

function gorsel(h, { sizes = '(max-width: 640px) 100vw, 33vw', oncelikli = false, sinif = '', alt } = {}) {
  if (!h.gorsel) return `<div class="gorsel-yok ${sinif}" aria-hidden="true"><span>${kacis(h.kategoriAd)}</span></div>`;
  const yol = g => u(`/gorseller/${h.gorsel.id}-${g}.webp`);
  return `<img class="${sinif}" src="${yol(960)}" srcset="${yol(480)} 480w, ${yol(960)} 960w, ${yol(1600)} 1600w" sizes="${sizes}" alt="${kacis(alt ?? (h.gorsel_aciklama ? `${h.baslik}. ${h.gorsel_aciklama}` : h.baslik))}" style="background:${h.gorsel.renk}" ${oncelikli ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1600" height="${Math.round(1600 / (h.gorsel.oran || 1.5))}">`;
}

const zaman = (h, sinif = '') => `<time class="${sinif}" datetime="${h.tarih.toISOString()}" data-goreli>${kisaTarih.format(h.tarih)}</time>`;
const etiket = h => `<a class="rozet" href="${u(`/kategori/${h.kategori}/`)}">${kacis(h.kategoriAd)}</a>`;
const kunyeSatiri = h => `<p class="kunye"><span>${kacis(h.yazar)}</span> · ${zaman(h)}</p>`;
const altSatir = h => `<div class="kart-alt">${etiket(h)}<span class="sure">${h.dakika} dk okuma</span></div>`;

const kart = (h, sizes) => `<article class="kart belir">
  <a class="kart-gorsel" href="${h.url}">${gorsel(h, { sizes })}</a>
  ${kunyeSatiri(h)}
  <h3 class="kart-baslik"><a href="${h.url}">${kacis(h.baslik)}</a></h3>
  <p class="kart-spot">${kacis(h.spot)}</p>
  ${altSatir(h)}
</article>`;

// Piyasa bandı ve piyasalar sayfası için varlıklar: [kimlik, ad, ikon]
const BORSA = [
  ['xu100', 'BIST 100', 'bayrak:tr'], ['xu030', 'BIST 30', 'bayrak:tr'],
  ['usdtry', 'Dolar', 'bayrak:us'], ['eurtry', 'Euro', 'bayrak:eu'], ['gbptry', 'Sterlin', 'bayrak:gb'],
  ['gram-altin', 'Gram altın', 'altin'], ['ons-altin', 'Ons altın', 'altin'],
  ['gram-gumus', 'Gram gümüş', 'gumus'], ['ons-gumus', 'Ons gümüş', 'gumus'],
  ['brent', 'Brent petrol', 'petrol'], ['bitcoin', 'Bitcoin', 'btc'], ['ethereum', 'Ethereum', 'eth'], ['sp500', 'S&P 500', 'bayrak:us'],
];
const borsaIkon = tur => tur.startsWith('bayrak:') ? `<span class="borsa-ikon"><img src="${u(`/bayraklar/${tur.slice(7)}.svg`)}" alt="" width="22" height="22"></span>`
  : tur === 'altin' ? '<span class="borsa-ikon altin" aria-hidden="true">Au</span>'
  : tur === 'gumus' ? '<span class="borsa-ikon gumus" aria-hidden="true">Ag</span>'
  : `<span class="borsa-ikon ${tur}">${ikon({ petrol: 'droplet', btc: 'marka-bitcoin', eth: 'marka-ethereum' }[tur])}</span>`;

const bolumBasi = (baslik, bag) => `<div class="bolum-basi"><h2>${baslik}</h2>${bag ? `<a class="tumu" href="${u(bag)}">Tümünü gör ${ikon('arrow-right')}</a>` : ''}</div>`;

const navOgeleri = aktif => [['akis', 'Akış', '/akis/'], ...Object.entries(KATEGORILER).map(([k, ad]) => [k, ad, `/kategori/${k}/`])]
  .map(([k, ad, yol]) => `<li><a href="${u(yol)}"${k === aktif ? ' aria-current="page"' : ''}${k === 'akis' ? ' class="nav-akis"' : ''}>${ad}</a></li>`).join('');

function ustAlan(koyu, aktif) {
  const nav = navOgeleri(aktif);
  const kunyeEtiket = koyu ? 'h1' : 'p';
  return `<header class="ust-alan${koyu ? ' koyu' : ''}">
  <div class="kap ust-satir">
    <div class="ust-sol">
      <button class="ikon-dugme" data-ac="menu" aria-label="Menüyü aç">${ikon('menu')}</button>
      <button class="ikon-dugme" data-ac="arama" aria-label="Haberlerde ara">${ikon('search')}</button>
    </div>
    <a class="baslik-logo" href="${u('/')}">
      <${kunyeEtiket} class="logo">The Country Observer</${kunyeEtiket}>
      <span class="logo-alt">Türkiye'nin bağımsız haber gazetesi <span aria-hidden="true">|</span> <span data-bugun>${gunBicim.format(new Date())}</span></span>
    </a>
    <div class="ust-sag">
      <button class="ikon-dugme" data-tema-dugme aria-label="Koyu ve açık tema arasında geçiş yap">${ikon('moon', 'ikon ay')}${ikon('sun', 'ikon gunes')}</button>
      <button class="abone-dugme" data-ac="abone">Abone ol</button>
    </div>
  </div>
  <nav class="kap ana-nav" aria-label="Kategoriler"><ul>${nav}</ul></nav>
</header>`;
}

function yapiskanCubuk(aktif) {
  const nav = navOgeleri(aktif);
  return `<div class="yapiskan" aria-hidden="true" inert>
  <div class="kap yapiskan-ic">
    <a class="yapiskan-logo" href="${u('/')}" tabindex="-1">The Country Observer</a>
    <nav><ul>${nav}</ul></nav>
    <button class="ikon-dugme" data-ac="arama" tabindex="-1" aria-label="Haberlerde ara">${ikon('search')}</button>
  </div>
</div>`;
}

const altAlan = () => `<footer class="alt-alan">
  <div class="kap alt-ic">
    <div class="alt-marka">
      <a class="logo" href="${u('/')}">The Country Observer</a>
      <p>Türkiye ve dünyadan gelişmeleri, kaynaklarını göstererek ve açıklamalarla iddiaları ayırarak aktarıyoruz. Haberlerin sonunda yararlandığımız kaynakları açıkça listeleriz.</p>
    </div>
    <nav class="alt-nav" aria-label="Alt menü">
      <div><h2>Bölümler</h2><ul>${Object.entries(KATEGORILER).slice(0, 5).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}</a></li>`).join('')}</ul></div>
      <div><h2>Daha fazla</h2><ul>${Object.entries(KATEGORILER).slice(5).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}</a></li>`).join('')}</ul></div>
      <div><h2>Gazete</h2><ul><li><a href="${u('/akis/')}">Akış</a></li><li><a href="${u('/piyasalar/')}">Piyasalar</a></li><li><a href="${u('/hakkimizda/')}">Hakkımızda</a></li><li><a href="${u('/hakkimizda/#yayin-ilkeleri')}">Yayın ilkeleri</a></li><li><a href="${u('/rss.xml')}">RSS akışı</a></li></ul></div>
    </nav>
  </div>
  <div class="kap alt-son"><p>© ${new Date().getFullYear()} The Country Observer. Fotoğraflar, künyelerinde belirtilen açık lisanslarla kullanılmaktadır.</p></div>
</footer>`;

const pencereler = () => `<dialog class="pencere arama-pencere" id="arama" aria-label="Haberlerde ara">
  <form method="dialog" class="arama-form" role="search">
    <label class="gizli" for="arama-girdi">Aranacak kelime</label>
    ${ikon('search')}
    <input id="arama-girdi" type="search" placeholder="Haber, kişi ya da konu arayın" autocomplete="off" enterkeyhint="search">
    <button class="ikon-dugme" value="kapat" aria-label="Aramayı kapat">${ikon('x')}</button>
  </form>
  <div class="arama-sonuc" aria-live="polite"></div>
</dialog>
<dialog class="pencere menu-pencere" id="menu" aria-label="Menü">
  <div class="menu-ust"><span class="logo">The Country Observer</span><form method="dialog"><button class="ikon-dugme" aria-label="Menüyü kapat">${ikon('x')}</button></form></div>
  <nav aria-label="Tüm bölümler"><ul>${Object.entries(KATEGORILER).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}${ikon('chevron-right')}</a></li>`).join('')}</ul></nav>
  <ul class="menu-alt"><li><a href="${u('/')}">Ana sayfa</a></li><li><a href="${u('/akis/')}">Akış</a></li><li><a href="${u('/hakkimizda/')}">Hakkımızda</a></li><li><a href="${u('/rss.xml')}">RSS akışı</a></li></ul>
</dialog>
<dialog class="pencere abone-pencere" id="abone" aria-labelledby="abone-baslik">
  <form method="dialog"><button class="ikon-dugme kapat" aria-label="Kapat">${ikon('x')}</button></form>
  <h2 id="abone-baslik">Haberler size gelsin</h2>
  <p>Yeni haberlerimizi RSS akışımızla takip edebilirsiniz. Adresi kullandığınız haber okuyucusuna ekleyin ya da tek tıkla Feedly'de açın.</p>
  <div class="abone-adres"><input readonly value="${tamAdres('/rss.xml')}" aria-label="RSS adresi"><button class="dugme" data-kopyala="${tamAdres('/rss.xml')}">${ikon('copy')}<span>Kopyala</span></button></div>
  <a class="dugme dugme-dolu" href="https://feedly.com/i/subscription/feed/${encodeURIComponent(tamAdres('/rss.xml'))}" rel="noopener" target="_blank">Feedly'de takip et</a>
</dialog>`;

let CSS = '', SPRITE = '', VARLIK_SURUM = '', SES_DALGALARI = {};

// Ses kayıtlarının gerçek genlik dalgası (80 çubuk). ffmpeg ile bir kez hesaplanır, icerik/ses-dalgalari.json'da saklanır.
async function sesDalgalariniHazirla(haberler) {
  const dosya = `${ICERIK}/ses-dalgalari.json`;
  const onbellek = JSON.parse(await readFile(dosya, 'utf8').catch(() => '{}'));
  let degisti = false;
  for (const h of haberler.filter(h => h.sesVar)) {
    const yol = `statik/sesler/${h.id}.mp3`, boyut = statSync(yol).size;
    if (onbellek[h.id]?.boyut === boyut && onbellek[h.id].s === 3) continue;
    try {
      const ham = execFileSync('ffmpeg', ['-v', 'quiet', '-i', yol, '-ac', '1', '-ar', '2000', '-f', 's16le', '-'], { maxBuffer: 64 * 1024 * 1024 });
      const ornek = new Int16Array(ham.buffer, ham.byteOffset, Math.floor(ham.length / 2)), adet = 80, parca = Math.floor(ornek.length / adet), pencere = 240;
      // Her dilimin ortasındaki kısa pencere: hece ve duraklamalar dalgada görünür.
      const rms = Array.from({ length: adet }, (_, i) => {
        const orta = i * parca + (parca >> 1); let t = 0;
        for (let j = orta - pencere / 2; j < orta + pencere / 2; j++) t += (ornek[j] || 0) ** 2;
        return Math.sqrt(t / pencere);
      });
      const enBuyuk = Math.max(...rms) || 1;
      onbellek[h.id] = { boyut, s: 3, dalga: rms.map(v => +Math.max(.12, (v / enBuyuk) ** .75).toFixed(2)) };
      degisti = true;
    } catch { /* ffmpeg yoksa dalga düz çizilir */ }
  }
  if (degisti) await writeFile(dosya, JSON.stringify(onbellek));
  SES_DALGALARI = Object.fromEntries(Object.entries(onbellek).map(([id, v]) => [id, v.dalga]));
}

function sayfa({ baslik, aciklama, yol, icerik, koyu = false, aktif = '', gorselYolu, tur = 'website', jsonld, onYukle = '', yapiskan = true }) {
  const tamBaslik = baslik ? `${baslik} | ${SITE_ADI}` : `${SITE_ADI} | Türkiye'nin bağımsız haber gazetesi`;
  const og = tamAdres(gorselYolu || '/favicon.svg');
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${kacis(tamBaslik)}</title>
<meta name="description" content="${kacis(aciklama)}">
<link rel="canonical" href="${tamAdres(yol)}">
<meta property="og:type" content="${tur}"><meta property="og:site_name" content="${SITE_ADI}"><meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacis(baslik || SITE_ADI)}"><meta property="og:description" content="${kacis(aciklama)}">
<meta property="og:url" content="${tamAdres(yol)}"><meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f7f7f5">
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${SITE_ADI}" href="${u('/rss.xml')}">
<link rel="preload" href="${u('/yazitipleri/inter.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${u('/yazitipleri/bower.woff2')}" as="font" type="font/woff2" crossorigin>
${onYukle}
<script>try{document.documentElement.dataset.tema=localStorage.getItem('tema')==='koyu'?'koyu':'acik'}catch(e){document.documentElement.dataset.tema='acik'}</script>
<link rel="stylesheet" href="${u(`/stil.css?v=${VARLIK_SURUM}`)}">
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"${TABAN}/*"},{"not":{"href_matches":"${TABAN}/*.xml"}}]},"eagerness":"moderate"}]}</script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body data-taban="${TABAN}" data-yardim="${kacis(YARDIM_ADRESI)}" data-haber="${yol.startsWith('/haber/') ? kacis(yol.split('/')[2]) : ''}">
${SPRITE}
<a class="atla" href="#icerik">İçeriğe geç</a>
${yapiskan ? yapiskanCubuk(aktif) : ''}
${koyu ? '' : ustAlan(false, aktif)}
<main id="icerik">
${icerik}
</main>
${altAlan()}
<div class="soru" data-soru>
  <div class="soru-yuzey">
    <div class="soru-akis"><div class="soru-akis-ic">
      <button class="soru-kapat" type="button" aria-label="Yanıtları gizle">${ikon('x')}</button>
      <div class="soru-mesajlar" role="log" aria-live="polite"></div>
    </div></div>
    <form class="soru-cubuk"><label class="gizli" for="soru-girdi">Haberlerle ilgili soru sorun</label><input id="soru-girdi" name="soru" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="${yol.startsWith('/haber/') ? 'Bu haberle ilgili bir soru sorun' : 'Gündemle ilgili bir soru sorun'}"><button class="soru-gonder" type="submit" aria-label="Gönder" disabled>${ikon('arrow-up')}</button></form>
  </div>
</div>
${pencereler()}
<script src="${u(`/site.js?v=${VARLIK_SURUM}`)}" defer></script>
${yol === '/' || yol === '/piyasalar/' ? `<script src="${u(`/piyasa.js?v=${VARLIK_SURUM}`)}" defer></script>` : ''}
</body>
</html>`;
}

// ---------- Sayfalar ----------

function anaSayfa(haberler) {
  const kullanilan = new Set();
  // yedek: kullanılmamış haber yetmezse (site henüz az haberliyken) bölüm daha önce kullanılan haberlerle dolar.
  const al = (filtre, adet, yedek = false) => {
    const secilen = haberler.filter(h => !kullanilan.has(h.id) && filtre(h)).slice(0, adet);
    if (yedek && secilen.length < adet) secilen.push(...haberler.filter(h => filtre(h) && !secilen.includes(h)).slice(0, adet - secilen.length));
    secilen.forEach(h => kullanilan.add(h.id));
    return secilen;
  };
  const gorselli = h => h.gorsel;
  const mansetAdet = haberler.length >= 20 ? 5 : 3;
  const manset = [...al(h => h.vitrin === 'manset' && gorselli(h), mansetAdet)];
  manset.push(...al(gorselli, mansetAdet - manset.length));
  const yan = [...al(h => h.vitrin === 'yan', 2)];
  yan.push(...al(gorselli, 2 - yan.length));
  const haftanin = al(h => h.vitrin === 'haftanin', 1)[0] || al(gorselli, 1)[0];
  // Analiz bölümü tasarımın parçası; analiz haberi yetmezse diğer haberlerle dolar.
  const analiz = al(h => h.kategori === 'analiz', 6);
  analiz.push(...al(h => gorselli(h) && !analiz.includes(h), 6 - analiz.length, true));
  const son = al(gorselli, 4, true);
  const trend = al(gorselli, 6, true);
  // Tasarımdaki 4'lü kart satırı, en az 4 haberi olan her kategori için tekrarlanır.
  const satirlar = ['gundem', 'politika', 'ekonomi', 'dunya', 'spor', 'teknoloji', 'kultur-sanat', 'yasam', 'saglik']
    .map(k => [k, haberler.filter(h => !kullanilan.has(h.id) && h.kategori === k).length >= 4 ? al(h => h.kategori === k, 4) : []])
    .filter(([, l]) => l.length);

  const ilk = manset[0];
  const yol = g => u(`/gorseller/${ilk.gorsel.id}-${g}.webp`);
  const onYukle = `<link rel="preload" as="image" imagesrcset="${yol(960)} 960w, ${yol(1600)} 1600w" imagesizes="100vw" fetchpriority="high">`;

  const mansetHtml = `<section class="manset" aria-roledescription="carousel" aria-label="Manşet haberleri">
  <div class="manset-arka" aria-hidden="true">${manset.map((h, i) => `<div class="manset-resim${i ? '' : ' aktif'}">${gorsel(h, { sizes: '100vw', oncelikli: i === 0 })}</div>`).join('')}</div>
  ${ustAlan(true, '')}
  <div class="kap manset-icerik">
    <div class="manset-sol">
      ${manset.map((h, i) => `<article class="manset-slayt${i ? '' : ' aktif'}" aria-roledescription="slide" aria-label="${i + 1} / ${manset.length}"${i ? ' inert' : ''}>
        <p class="manset-ust">${kacis(h.kategoriAd)} <span aria-hidden="true">·</span> ${zaman(h)}</p>
        <h2 class="manset-baslik"><a href="${h.url}">${kacis(h.baslik)}</a></h2>
        <a class="dugme-oku" href="${h.url}"><span class="oku-ikon">${ikon('arrow-up-right')}</span>Devamını oku</a>
      </article>`).join('')}
      <div class="manset-kontrol">
        <div class="noktalar">${manset.map((h, i) => `<button class="nokta${i ? '' : ' aktif'}" aria-label="${i + 1}. manşet"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>
        <button class="ikon-dugme manset-ileri" aria-label="Sonraki manşet">${ikon('chevron-right')}</button>
      </div>
    </div>
    <aside class="manset-yan" aria-label="Öne çıkanlar">
      ${yan.map(h => `<a class="yan-kart" href="${h.url}">${gorsel(h, { sizes: '120px' })}<span><span class="yan-ust">${kisaTarih.format(h.tarih)} · ${kacis(h.kategoriAd)}</span><span class="yan-baslik">${kacis(h.baslik)}</span></span></a>`).join('')}
    </aside>
  </div>
</section>`;

  const trendHtml = trend.length < 3 ? '' : `<div class="kap"><section class="trend" aria-label="Gündemdekiler">
  <h2 class="trend-etiket">Gündemde</h2>
  <ul class="trend-liste">${trend.map(h => `<li><a href="${h.url}">${gorsel(h, { sizes: '64px' })}<span>${kacis(h.baslik)}</span></a></li>`).join('')}</ul>
  <button class="ikon-dugme trend-ileri" aria-label="Diğer gündem haberleri">${ikon('chevron-right')}</button>
</section></div>`;

  const kartSatiri = (baslik, liste, bag) => `<section class="kap bolum">${bolumBasi(baslik, bag)}
  <div class="izgara-4">${liste.map(h => kart(h, '(max-width: 640px) 100px, (max-width: 1024px) 50vw, 25vw')).join('')}</div></section>`;
  const borsaBandi = `<section class="kap borsa-bandi yukleniyor" aria-label="Piyasalar" data-borsa-bandi>
    <div class="borsa-iz">${BORSA.map(([id, ad, tur]) => `<a class="borsa-oge" href="${u(`/piyasalar/#${id}`)}" data-borsa="${id}">${borsaIkon(tur)}<span class="borsa-ad">${kacis(ad)}</span><span class="borsa-deger">0.000,00</span><span class="borsa-fark"></span></a>`).join('')}</div>
  </section>`;
  const sonHtml = son.length ? kartSatiri('Son Haberler', son, '/haberler/') : '';

  const haftaninHtml = haftanin ? `<section class="kap bolum">${bolumBasi('Haftanın Haberi')}
  <article class="haftanin belir">
    <a class="haftanin-gorsel" href="${haftanin.url}">${gorsel(haftanin, { sizes: '(max-width: 900px) 100vw, 50vw' })}</a>
    <div class="haftanin-metin">
      ${kunyeSatiri(haftanin)}
      <h3><a href="${haftanin.url}">${kacis(haftanin.baslik)}</a></h3>
      <p class="haftanin-spot">${kacis(haftanin.giris)}</p>
      ${altSatir(haftanin)}
    </div>
  </article></section>` : '';

  const [aSol, aOrta, ...aListe] = analiz;
  const analizHtml = aOrta ? `<section class="kap bolum">${bolumBasi('Analiz', '/kategori/analiz/')}
  <div class="analiz">
    ${kart(aSol, '(max-width: 900px) 100vw, 25vw')}
    <article class="analiz-buyuk belir">
      <a href="${aOrta.url}" class="analiz-buyuk-bag">
        ${gorsel(aOrta, { sizes: '(max-width: 900px) 100vw, 50vw' })}
        <span class="analiz-buyuk-metin">
          <span class="kunye"><span>${kacis(aOrta.yazar)}</span> · ${zaman(aOrta)}</span>
          <span class="analiz-buyuk-baslik">${kacis(aOrta.baslik)}</span>
          <span class="analiz-buyuk-spot">${kacis(aOrta.spot)}</span>
          <span class="analiz-buyuk-alt">${kacis(aOrta.kategoriAd)} | ${aOrta.dakika} dk okuma</span>
        </span>
      </a>
    </article>
    <ul class="analiz-liste">${aListe.map(h => `<li class="belir"><a href="${h.url}">${kacis(h.baslik)}</a>${kunyeSatiri(h)}</li>`).join('')}</ul>
  </div></section>` : '';

  const satirHtml = satirlar.map(([k, l]) => kartSatiri(KATEGORILER[k], l, `/kategori/${k}/`)).join('');

  return sayfa({
    yol: '/', koyu: true, onYukle, gorselYolu: `/gorseller/${ilk.gorsel.id}-1600.webp`,
    aciklama: "Türkiye ve dünyadan son dakika gelişmeleri, ekonomi, politika, spor ve kültür haberleri. Birden fazla kaynaktan doğrulanmış, sade ve ayrıntılı haberler.",
    icerik: mansetHtml + trendHtml + borsaBandi + sonHtml + haftaninHtml + analizHtml + satirHtml,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_ADI, url: tamAdres('/'), inLanguage: 'tr-TR' },
  });
}

function piyasalarSayfasi() {
  const segment = (ad, veri, secili) => `<div class="segment" role="group" aria-label="${ad}" data-segment="${ad}">${veri.map(([k, yazi]) => `<button type="button" data-deger="${k}" aria-pressed="${k === secili}">${yazi}</button>`).join('')}<span class="segment-imlec" aria-hidden="true"></span></div>`;
  return sayfa({
    baslik: 'Piyasalar', yol: '/piyasalar/',
    aciklama: 'BIST 100, BIST 30, dolar, euro, sterlin, gram ve ons altın, gümüş, Brent petrol ve kripto paralarda son durum ve etkileşimli grafikler.',
    onYukle: `<script src="${u(`/lightweight-charts.js?v=${VARLIK_SURUM}`)}" defer></script>`,
    icerik: `<section class="kap borsa-sayfa">
  <div class="borsa-duzen">
    <ul class="borsa-liste" role="listbox" aria-label="Piyasalar">${BORSA.map(([id, ad, tur], i) => `<li><button class="borsa-satir" type="button" role="option" aria-selected="${i === 0}" data-borsa-sec="${id}">${borsaIkon(tur)}<span class="borsa-satir-ad">${kacis(ad)}</span><span class="borsa-satir-sag"><b data-deger>—</b><span class="borsa-fark" data-fark></span></span></button></li>`).join('')}</ul>
    <div class="borsa-ana">
      <div class="borsa-bas">
        <div class="borsa-fiyat">
          <div class="borsa-kimlik" data-kimlik>${borsaIkon(BORSA[0][2])}<h1 data-ad>${BORSA[0][1]}</h1></div>
          <strong data-fiyat>—</strong>
          <div class="borsa-fiyat-alt"><span class="borsa-fark" data-fark></span><span data-etiket></span></div>
        </div>
        <div class="borsa-arac">
          ${segment('Aralık', [['1g', '1G'], ['1h', '1H'], ['1a', '1A'], ['3a', '3A'], ['1y', '1Y'], ['5y', '5Y']], '1g')}
          ${segment('Para birimi', [['TRY', '₺'], ['USD', '$']], 'TRY')}
        </div>
      </div>
      <div class="borsa-grafik yukleniyor" data-grafik><div class="borsa-secim" hidden></div></div>
      <dl class="borsa-olcu"><div><dt>Önceki kapanış</dt><dd data-onceki>—</dd></div><div><dt>Gün aralığı</dt><dd data-gun>—</dd></div><div><dt>52 hafta aralığı</dt><dd data-yil>—</dd></div></dl>
      <p class="borsa-not">Kaynak: Yahoo Finance. Borsa İstanbul verileri 15 dakika gecikmelidir. İki tarih arasındaki değişimi görmek için grafikte sürükleyin.</p>
    </div>
  </div>
</section>`,
  });
}

function haberSayfasi(h, haberler) {
  const ilgili = haberler.filter(x => x.id !== h.id && x.kategori === h.kategori).slice(0, 4);
  if (ilgili.length < 4) ilgili.push(...haberler.filter(x => x.id !== h.id && !ilgili.includes(x)).slice(0, 4 - ilgili.length));
  const g = h.gorsel;
  const paylas = encodeURIComponent(tamAdres(`/haber/${h.id}/`));
  const metin = encodeURIComponent(h.baslik);
  const icerik = `<div class="ilerleme" aria-hidden="true"></div>
<article class="haber">
  <header class="kap haber-bas">
    <nav class="yol" aria-label="Sayfa konumu"><a href="${u('/')}">Ana sayfa</a>${ikon('chevron-right')}<a href="${u(`/kategori/${h.kategori}/`)}">${kacis(h.kategoriAd)}</a></nav>
    <h1 class="haber-baslik">${kacis(h.baslik)}</h1>
    <p class="haber-spot">${kacis(h.spot)}</p>
    <div class="haber-kunye">
      <p><strong>${kacis(h.yazar)}</strong><span><time datetime="${h.tarih.toISOString()}">${tarihBicim.format(h.tarih)}</time> · ${h.dakika} dk okuma</span></p>
      <div class="paylas" aria-label="Paylaş">
        <a class="ikon-dugme cerceveli" href="https://wa.me/?text=${metin}%20${paylas}" target="_blank" rel="noopener" aria-label="WhatsApp'ta paylaş">${ikon('marka-whatsapp')}</a>
        <a class="ikon-dugme cerceveli" href="https://x.com/intent/post?text=${metin}&url=${paylas}" target="_blank" rel="noopener" aria-label="X'te paylaş">${ikon('marka-x')}</a>
        <a class="ikon-dugme cerceveli" href="https://www.facebook.com/sharer/sharer.php?u=${paylas}" target="_blank" rel="noopener" aria-label="Facebook'ta paylaş">${ikon('marka-facebook')}</a>
        <button class="ikon-dugme cerceveli" data-kopyala="${tamAdres(`/haber/${h.id}/`)}" aria-label="Bağlantıyı kopyala">${ikon('link')}</button>
      </div>
    </div>
    ${h.sesVar ? `<div class="ses" data-ses>
      <button class="ses-oynat" type="button" aria-label="Haberi dinle">${ikon('play', 'ikon ikon-oynat')}${ikon('pause', 'ikon ikon-duraklat')}</button>
      <div class="ses-dalga" role="slider" tabindex="0" aria-label="Ses kaydında konum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${(SES_DALGALARI[h.id] || Array(80).fill(.45)).map(v => `<span style="height:${Math.max(4, Math.round(v * 36))}px"></span>`).join('')}</div>
      <button class="ses-hiz" type="button" aria-label="Oynatma hızı">1×</button>
      <audio preload="none" src="${u(`/sesler/${h.id}.mp3`)}"></audio>
    </div>` : ''}
  </header>
  ${g ? `<figure class="kap haber-gorsel">
    ${gorsel(h, { sizes: '(max-width: 1100px) 100vw, 1100px', oncelikli: true, sinif: 'kapak' })}
    <figcaption>${h.gorsel_aciklama ? `${kacis(h.gorsel_aciklama)} ` : ''}<span>Fotoğraf: <a href="${kacis(g.kaynak)}" rel="noopener">${kacis(g.yazar)}</a> / ${kacis(g.platform)} (${kacis(g.lisans)})</span></figcaption>
  </figure>` : ''}
  <div class="kap haber-govde">
    <div class="metin">${govdeHtml(h.govde)}</div>
    ${h.etiketler.length ? `<ul class="etiketler" aria-label="Etiketler">${h.etiketler.map(e => `<li>${kacis(e)}</li>`).join('')}</ul>` : ''}
    ${h.kaynaklar.length ? `<aside class="kaynaklar">
      <h2>Bu haber nasıl hazırlandı?</h2>
      <p>${h.kaynaklar.length === 1 ? 'Bu haber aşağıdaki kaynağın yayımladığı bilgilere dayanıyor. Kaynak metnine bağlantıdan ulaşabilirsiniz.' : h.bicim === 'kisa' ? 'Bu kısa haber, aşağıdaki kaynakların yayımladığı bilgilerden özgün biçimde özetlendi. Ayrıntılı kaynak haberlerine bağlantılardan ulaşabilirsiniz.' : 'Haberdeki bilgiler aşağıdaki kaynakların aktardıklarıyla karşılaştırılarak derlendi:'}</p>
      <ul>${h.kaynaklar.map(k => `<li><a href="${kacis(k.url)}" rel="noopener nofollow" target="_blank">${kacis(k.ad)}${ikon('arrow-up-right')}</a></li>`).join('')}</ul>
    </aside>` : ''}
  </div>
</article>
<section class="kap bolum ilgili">${bolumBasi(`${h.kategoriAd} bölümünden`, `/kategori/${h.kategori}/`)}
  <div class="izgara-4">${ilgili.map(x => kart(x, '(max-width: 640px) 100px, (max-width: 1024px) 50vw, 25vw')).join('')}</div>
</section>`;
  return sayfa({
    baslik: h.baslik, aciklama: h.spot, yol: `/haber/${h.id}/`, aktif: h.kategori, tur: 'article', icerik,
    gorselYolu: g ? `/gorseller/${g.id}-1600.webp` : null,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'NewsArticle', headline: h.baslik, description: h.spot,
      datePublished: h.tarih.toISOString(), dateModified: h.tarih.toISOString(), inLanguage: 'tr-TR',
      image: g ? [tamAdres(`/gorseller/${g.id}-1600.webp`)] : undefined, articleSection: h.kategoriAd,
      author: { '@type': 'Organization', name: h.yazar }, publisher: { '@type': 'Organization', name: SITE_ADI },
      mainEntityOfPage: tamAdres(`/haber/${h.id}/`),
    },
  });
}

// Liste sayfaları 31 haberlik sayfalara bölünür: /kategori/x/, /kategori/x/sayfa/2/ ...
const SAYFA_BOYU = 31;
function listeSayfalari({ baslik, liste, yol, aktif = '', aciklama }) {
  const toplam = Math.max(1, Math.ceil(liste.length / SAYFA_BOYU));
  const adres = n => n === 1 ? yol : `${yol}sayfa/${n}/`;
  return Array.from({ length: toplam }, (_, i) => {
    const n = i + 1, parca = liste.slice(i * SAYFA_BOYU, n * SAYFA_BOYU);
    const [ilk, ...diger] = n === 1 ? parca : [null, ...parca];
    const numaralar = Array.from({ length: toplam }, (_, j) => j + 1).filter(j => j === 1 || j === toplam || Math.abs(j - n) <= 2);
    const gezinme = toplam < 2 ? '' : `<nav class="kap sayfalama" aria-label="Sayfalar">
  ${n > 1 ? `<a class="sayfa-ok" href="${u(adres(n - 1))}" rel="prev" aria-label="Önceki sayfa">${ikon('chevron-left')}</a>` : '<span class="sayfa-ok" aria-hidden="true"></span>'}
  <ol>${numaralar.map((j, k) => `${k && j - numaralar[k - 1] > 1 ? '<li class="sayfa-bosluk">…</li>' : ''}<li>${j === n ? `<span aria-current="page">${j}</span>` : `<a href="${u(adres(j))}">${j}</a>`}</li>`).join('')}</ol>
  ${n < toplam ? `<a class="sayfa-ok" href="${u(adres(n + 1))}" rel="next" aria-label="Sonraki sayfa">${ikon('chevron-right')}</a>` : '<span class="sayfa-ok" aria-hidden="true"></span>'}
</nav>`;
    const icerik = `<section class="kap kategori-bas">
  <h1>${baslik}</h1>
  <p>${liste.length} haber${toplam > 1 ? ` · Sayfa ${n}/${toplam}` : ''}</p>
</section>
${ilk ? `<section class="kap bolum">
  <article class="haftanin belir">
    <a class="haftanin-gorsel" href="${ilk.url}">${gorsel(ilk, { sizes: '(max-width: 900px) 100vw, 50vw', oncelikli: true })}</a>
    <div class="haftanin-metin">${kunyeSatiri(ilk)}<h2><a href="${ilk.url}">${kacis(ilk.baslik)}</a></h2><p class="haftanin-spot">${kacis(ilk.giris)}</p>${altSatir(ilk)}</div>
  </article>
</section>` : n === 1 ? '<p class="kap bos-durum">Bu bölümde henüz haber yok.</p>' : ''}
${diger.length ? `<section class="kap bolum"><div class="izgara-4">${diger.map(h => kart(h, '(max-width: 640px) 100px, (max-width: 1024px) 50vw, 25vw')).join('')}</div></section>` : ''}
${gezinme}`;
    return [adres(n), sayfa({ baslik: n === 1 ? baslik : `${baslik} (Sayfa ${n})`, aciklama, yol: adres(n), aktif, icerik })];
  });
}

const kategoriSayfalari = (k, haberler) => listeSayfalari({
  baslik: KATEGORILER[k], liste: haberler.filter(h => h.kategori === k), yol: `/kategori/${k}/`, aktif: k,
  aciklama: `${KATEGORILER[k]} haberleri: Türkiye ve dünyadan en son ${KATEGORILER[k].toLocaleLowerCase('tr')} gelişmeleri.`,
});

const hakkimizda = () => sayfa({
  baslik: 'Hakkımızda', yol: '/hakkimizda/', aciklama: 'The Country Observer kimdir, haberler nasıl hazırlanır?',
  icerik: `<article class="haber"><header class="kap haber-bas"><h1 class="haber-baslik">Hakkımızda</h1>
  <p class="haber-spot">The Country Observer, Türkiye ve dünyadan önemli gelişmeleri sade bir dille, ayrıntısıyla ve kaynağını göstererek aktaran bağımsız bir haber sitesidir.</p></header>
  <div class="kap haber-govde"><div class="metin">
  <p>Gün içinde yüzlerce haber yayımlanıyor; aynı olay farklı sitelerde farklı ayrıntılarla, bazen de birbiriyle çelişen bilgilerle okura ulaşıyor. Biz işe buradan başlıyoruz. Ulusal ve uluslararası yayın kuruluşlarının aktardıklarını yan yana koyuyor, birden fazla kaynağın doğruladığı bilgileri öne çıkarıyor ve okurun tek bir metinde olayın bütününü görebilmesini hedefliyoruz.</p>
  <h2 id="yayin-ilkeleri">Yayın ilkelerimiz</h2>
  <ul><li>Her haberin sonunda yararlandığımız kaynakları bağlantılarıyla birlikte listeleriz.</li><li>Tek bir kaynağa dayanan, doğrulanamayan iddiaları kesin bilgi gibi sunmayız; iddia olduğunu açıkça belirtiriz.</li><li>Alıntıları, söyleyen kişinin adıyla ve bağlamından koparmadan aktarırız.</li><li>Başlıklarda okuru yanıltacak abartıya yer vermeyiz.</li><li>Fotoğrafları yalnızca açık lisanslı arşivlerden alır, çekenin adını ve lisansını belirtiriz.</li></ul>
  <h2>Haberler nasıl hazırlanıyor?</h2>
  <p>Anadolu Ajansı, TRT Haber, BBC Türkçe, DW Türkçe, Euronews Türkçe, Hürriyet, NTV, Habertürk, Cumhuriyet, Bloomberg HT ve daha pek çok yayın kuruluşunun yayımladığı haberleri düzenli olarak tarıyoruz. Aynı olayı anlatan haberleri bir araya getiriyor, birden çok kaynağın aktardığı gelişmeleri seçiyor ve bu kaynakları karşılaştırarak özgün bir metin hazırlıyoruz.</p>
  <p>Bir haberde hata gördüğünüzde, ilgili haberin kaynaklar bölümündeki bağlantılardan özgün metinlere ulaşabilirsiniz. Düzeltmeler, haberin güncellenmesiyle yayına yansır.</p>
  </div></div></article>`,
});

const bulunamadi = () => sayfa({
  baslik: 'Sayfa bulunamadı', yol: '/404.html', aciklama: 'Aradığınız sayfa bulunamadı.',
  icerik: `<section class="kap bos-sayfa"><p class="bos-kod">404</p><h1>Aradığınız sayfa bulunamadı</h1><p>Bağlantı değişmiş ya da haber yayından kaldırılmış olabilir. Ana sayfaya dönebilir ya da aramayı kullanabilirsiniz.</p><p class="bos-dugmeler"><a class="dugme dugme-dolu" href="${u('/')}">Ana sayfaya dön</a><button class="dugme" data-ac="arama">Haberlerde ara</button></p></section>`,
});

function rss(haberler) {
  const ogeler = haberler.slice(0, 50).map(h => `<item><title>${kacis(h.baslik)}</title><link>${tamAdres(`/haber/${h.id}/`)}</link><guid>${tamAdres(`/haber/${h.id}/`)}</guid><pubDate>${h.tarih.toUTCString()}</pubDate><category>${kacis(h.kategoriAd)}</category><description>${kacis(h.spot)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_ADI}</title><link>${tamAdres('/')}</link><description>Türkiye'nin bağımsız haber gazetesi</description><language>tr</language>${ogeler}</channel></rss>`;
}

const siteHaritasi = haberler => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
  ['/', '/akis/', '/haberler/', '/piyasalar/', '/hakkimizda/', ...Object.keys(KATEGORILER).map(k => `/kategori/${k}/`), ...haberler.map(h => `/haber/${h.id}/`)].map(y => `<url><loc>${tamAdres(y)}</loc></url>`).join('')}</urlset>`;


// ---------- Akış ----------

const KAT_IKON = { gundem: 'newspaper', politika: 'landmark', ekonomi: 'trending-up', dunya: 'globe', spor: 'trophy', teknoloji: 'cpu', 'kultur-sanat': 'palette', yasam: 'leaf', saglik: 'heart-pulse', analiz: 'pen-line' };
const saatBicim = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const gunAdi = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'Europe/Istanbul' });
const gunAnahtari = d => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const sade = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

// Konu daireleri için başlık ve spottaki özel adlar. Cümle başındaki kelime yalnızca ek almışsa
// ("Gazze'de") ya da büyük harfle yazılmışsa ("NATO") sayılır.
// ponytail: büyük harf sezgisi; yanlış eşleşme artarsa haberlere elle `etiketler` girilmeli.
const GENEL = new Set(['turkiye', 'turk', 'turkiyenin', 'cumhurbaskani', 'bakan', 'bakani', 'baskani', 'baskan', 'genel', 'milli', 'ulusal', 'dunya', 'son', 'yeni', 'bakanligi', 'mudurlugu', 'universitesi', 'ilk', 'dr', 'prof', 'doc', 'avrupa', 'kupasi', 'ligi', 'sampiyonasi', 'merkezi', 'baskanligi', 'kurulu', 'kurul', 'muduru', 'mudur', 'bati', 'dogu', 'kuzey', 'guney', 'guneydogu',
  'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik']);
function ozelAdlar(metin) {
  const adlar = new Map();
  for (const cumle of metin.split(/[.!?;]\s+/)) {
    cumle.split(/\s+/).forEach((ham, i) => {
      const kelime = ham.split(/[’']/)[0].replace(/[^\p{L}\p{N}-]/gu, '');
      const buyuk = kelime.length > 1 && kelime === kelime.toLocaleUpperCase('tr');
      if (kelime.length < 2 || !/^\p{Lu}/u.test(kelime) || (kelime.length < 3 && !buyuk)) return;
      if (i === 0 && !buyuk && !/[’']/.test(ham) && !ham.endsWith(':')) return;
      const anahtar = sade(kelime);
      if (!GENEL.has(anahtar)) adlar.set(anahtar, kelime);
    });
  }
  return adlar;
}

function akisSayfasi(haberler) {
  const say = new Map(), adi = new Map(), adlar = new Map();
  for (const h of haberler) {
    adlar.set(h, ozelAdlar(`${h.baslik}. ${h.spot}`));
    for (const [k, ad] of adlar.get(h)) { say.set(k, (say.get(k) || 0) + 1); adi.set(k, ad); }
  }
  const konular = [...say].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  const resimli = new Set();
  const konuHtml = konular.map(k => {
    const adaylar = haberler.filter(h => h.gorsel && adlar.get(h).has(k));
    const h = adaylar.find(x => !resimli.has(x.id)) || adaylar[0];
    if (h) resimli.add(h.id);
    return `<li><button type="button" class="konu" data-konu-sec="${k}" aria-pressed="false"><span class="konu-halka">${h ? `<img src="${u(`/gorseller/${h.gorsel.id}-480.webp`)}" alt="" width="58" height="58" decoding="async" style="background:${h.gorsel.renk}">` : ''}</span><span class="konu-ad">${kacis(adi.get(k))}</span></button></li>`;
  }).join('');

  const gunler = [];
  for (const h of haberler) {
    const g = gunAnahtari(h.tarih);
    if (gunler.at(-1)?.g !== g) gunler.push({ g, liste: [] });
    gunler.at(-1).liste.push(h);
  }
  const enCok = Math.max(...gunler.map(g => g.liste.length));
  const sekmeler = [['', 'Tümü'], ...Object.entries(KATEGORILER).filter(([k]) => haberler.some(h => h.kategori === k)), ['kaydedilen', 'Kaydedilenler']];

  // Kaydet, paylaş ve özet düğmeleri JS olmadan işe yaramadığı için site.js tarafından eklenir.
  const gonderi = h => `<article class="gonderi belir" data-id="${h.id}" data-kat="${h.kategori}" data-konu="${konular.filter(k => adlar.get(h).has(k)).join(' ')}" data-kaynak="${kacis(h.kaynaklar.map(k => k.ad).join(', '))}">
<span class="gonderi-avatar" aria-hidden="true">${ikon(KAT_IKON[h.kategori])}</span>
<div class="gonderi-govde">
<p class="gonderi-ust"><a href="${u(`/kategori/${h.kategori}/`)}">${kacis(h.yazar)}</a><span aria-hidden="true">·</span><time datetime="${h.tarih.toISOString()}" title="${tarihBicim.format(h.tarih)}">${saatBicim.format(h.tarih)}</time></p>
<h3 class="gonderi-baslik"><a href="${h.url}">${kacis(h.baslik)}</a></h3>
<p class="gonderi-spot">${kacis(h.spot)}</p>
${h.gorsel ? `<div class="gonderi-gorsel">${gorsel(h, { sizes: '(max-width: 640px) 100vw, 540px', alt: '' })}</div>` : ''}
</div>
</article>`;

  const icerik = `<div class="kap akis-duzen">
  <section class="akis" aria-labelledby="akis-baslik">
    <header class="akis-bas"><h1 id="akis-baslik">Akış</h1><p>${haberler.length} haber</p></header>
    ${konular.length ? `<ul class="konu-liste" aria-label="Konular">${konuHtml}</ul>` : ''}
    <div class="akis-sekme" role="group" aria-label="Bölüme göre süz"><div class="akis-sekme-ic">${sekmeler.map(([k, ad], i) => `<button type="button" data-sekme="${k}" aria-pressed="${i === 0}">${k === 'kaydedilen' ? ikon('bookmark') : ''}${ad}</button>`).join('')}<span class="akis-sekme-imlec" aria-hidden="true"></span></div></div>
    ${gunler.map(({ g, liste }) => `<section class="akis-gun" id="gun-${g}" data-gun="${g}" aria-label="${gunAdi.format(liste[0].tarih)}">
    <h2 class="akis-gun-bas"><span data-gun-ad="${g}"></span><time datetime="${g}">${gunAdi.format(liste[0].tarih)}</time></h2>
    ${liste.map(gonderi).join('')}
    </section>`).join('')}
    <p class="akis-bos" hidden></p>
  </section>
  <aside class="akis-ray" aria-label="Akışta gezin">
    <label class="akis-ara">${ikon('search')}<span class="gizli">Akışta ara</span><input type="search" placeholder="Akışta ara" autocomplete="off" enterkeyhint="search" data-akis-ara></label>
    <nav class="ray-kutu" aria-label="Günler"><h2>Günler</h2><ol class="gun-liste">${gunler.map(({ g, liste }) => `<li><a href="#gun-${g}" data-gun-bag="${g}"><span><span data-gun-ad="${g}"></span>${gunAdi.format(liste[0].tarih)}</span><b>${liste.length}</b><i style="--oran:${(liste.length / enCok).toFixed(3)}"></i></a></li>`).join('')}</ol></nav>
  </aside>
</div>`;
  return sayfa({
    baslik: 'Akış', yol: '/akis/', aktif: 'akis', icerik, yapiskan: false,
    aciklama: 'Son günlerin haberleri tek akışta, en yenisi üstte. Bölüme, konuya ve güne göre süzün.',
  });
}

// ---------- Derleme ----------

async function yaz(yol, icerik) {
  const dosya = `${CIKTI}${yol.endsWith('/') ? `${yol}index.html` : yol}`;
  await mkdir(dosya.slice(0, dosya.lastIndexOf('/')), { recursive: true });
  await writeFile(dosya, icerik);
}

const kucult = css => css.replace(/\/\*(?!TABAN)[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/:\s+/g, ':').replace(/;}/g, '}').trim();

async function derle() {
  const baslangic = performance.now();
  const haberler = await haberleriOku();
  await sesDalgalariniHazirla(haberler);
  CSS = kucult(await readFile('kaynak/stil.css', 'utf8'));
  const BETIK = await readFile('kaynak/site.js', 'utf8');
  const PIYASA_BETIGI = await readFile('kaynak/piyasa.js', 'utf8');
  VARLIK_SURUM = createHash('sha256').update(CSS + BETIK + PIYASA_BETIGI).digest('hex').slice(0, 12);
  // Lucide (çizgi) ve Simple Icons (dolgu marka) ikonları tek bir SVG sprite'ta toplanır.
  const ic = svg => svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '').trim();
  for (const d of (await readdir('kaynak/ikonlar')).filter(d => d.endsWith('.svg'))) {
    ikonlar.set(d.slice(0, -4), `<symbol id="i-${d.slice(0, -4)}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ic(await readFile(`kaynak/ikonlar/${d}`, 'utf8'))}</g></symbol>`);
  }
  for (const d of (await readdir('kaynak/ikonlar/marka')).filter(d => d.endsWith('.svg'))) {
    ikonlar.set(`marka-${d.slice(0, -4)}`, `<symbol id="i-marka-${d.slice(0, -4)}" viewBox="0 0 24 24"><g fill="currentColor">${ic(await readFile(`kaynak/ikonlar/marka/${d}`, 'utf8'))}</g></symbol>`);
  }
  SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[...ikonlar.values()].join('')}</svg>`;

  await rm(CIKTI, { recursive: true, force: true });
  await cp('statik', CIKTI, { recursive: true });
  await writeFile(`${CIKTI}/site.js`, BETIK);
  await writeFile(`${CIKTI}/piyasa.js`, PIYASA_BETIGI);
  await writeFile(`${CIKTI}/stil.css`, CSS.replaceAll('/*TABAN*/', TABAN));
  await writeFile(`${CIKTI}/.nojekyll`, '');
  if (OZEL_ALAN) await writeFile(`${CIKTI}/CNAME`, `${OZEL_ALAN}\n`);

  await yaz('/', anaSayfa(haberler));
  await Promise.all(haberler.map(h => yaz(`/haber/${h.id}/`, haberSayfasi(h, haberler))));
  const listeler = [...Object.keys(KATEGORILER).flatMap(k => kategoriSayfalari(k, haberler)),
    ...listeSayfalari({ baslik: 'Son Haberler', liste: haberler, yol: '/haberler/', aciklama: 'Türkiye ve dünyadan en son haberler.' })];
  await Promise.all(listeler.map(([yol, html]) => yaz(yol, html)));
  await yaz('/piyasalar/', piyasalarSayfasi());
  await yaz('/akis/', akisSayfasi(haberler));
  await yaz('/hakkimizda/', hakkimizda());
  await yaz('/404.html', bulunamadi());
  await yaz('/rss.xml', rss(haberler));
  await yaz('/sitemap.xml', siteHaritasi(haberler));
  await yaz('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${tamAdres('/sitemap.xml')}\n`);
  await yaz('/ara.json', JSON.stringify(haberler.map(h => ({
    b: h.baslik, s: h.spot, u: h.url, k: h.kategoriAd, t: h.tarih.toISOString(),
    g: h.gorsel ? u(`/gorseller/${h.gorsel.id}-480.webp`) : null, e: h.etiketler.join(' '),
  }))));
  // Soru Worker'ı için: küçük, önceden normalize edilmiş dizin ve haber başına metin dosyası.
  const duz = t => t.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const kokler = t => [...new Set(duz(t).split(/[^\p{L}\p{N}]+/u).filter(x => x.length > 3).map(x => x.slice(0, 6)))].join(' ');
  await yaz('/yardim-dizin.json', JSON.stringify({
    son: haberler.slice(0, 12).map(h => ({ b: h.baslik, s: h.spot })),
    d: haberler.map(h => [h.id, kokler(`${h.baslik} ${h.spot}`), kokler(h.govde.slice(0, 500))]),
  }));
  await Promise.all(haberler.map(h => yaz(`/yardim/${h.id}.json`, JSON.stringify({ baslik: h.baslik, spot: h.spot, govde: h.govde.slice(0, 3500) }))));
  console.log(`${haberler.length} haber, ${Object.keys(KATEGORILER).length} kategori derlendi (${Math.round(performance.now() - baslangic)} ms)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await derle();
