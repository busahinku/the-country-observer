// The Country Observer: statik site derleyici. Bağımlılık yok.
// icerik/haberler/*.md + icerik/gorseller.json + kaynak/ -> yayin/
// Kullanım: node derle.mjs   (TABAN_YOL=/ ile yerel kök dizinde de derlenebilir)
import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';

const TABAN = (process.env.TABAN_YOL ?? '/the-country-observer').replace(/\/$/, '');
const SITE = process.env.SITE_ADRESI ?? 'https://busahin.com';
const CIKTI = process.env.CIKTI_DIZIN ?? 'yayin';
const ICERIK = process.env.ICERIK_DIZIN ?? 'icerik';
const SITE_ADI = 'The Country Observer';

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
    const kelime = govde.split(/\s+/).length;
    return {
      ...bilgi, id, govde,
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

function gorsel(h, { sizes = '(max-width: 640px) 100vw, 33vw', oncelikli = false, sinif = '' } = {}) {
  if (!h.gorsel) return `<div class="gorsel-yok ${sinif}" aria-hidden="true"><span>${kacis(h.kategoriAd)}</span></div>`;
  const yol = g => u(`/gorseller/${h.gorsel.id}-${g}.webp`);
  return `<img class="${sinif}" src="${yol(960)}" srcset="${yol(480)} 480w, ${yol(960)} 960w, ${yol(1600)} 1600w" sizes="${sizes}" alt="${kacis(h.gorsel_aciklama || h.baslik)}" style="background:${h.gorsel.renk}" ${oncelikli ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1600" height="${Math.round(1600 / (h.gorsel.oran || 1.5))}">`;
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

const bolumBasi = (baslik, bag) => `<div class="bolum-basi"><h2>${baslik}</h2>${bag ? `<a class="tumu" href="${u(bag)}">Tümünü gör ${ikon('arrow-right')}</a>` : ''}</div>`;

function ustAlan(koyu, aktif) {
  const nav = Object.entries(KATEGORILER).map(([k, ad]) =>
    `<li><a href="${u(`/kategori/${k}/`)}"${k === aktif ? ' aria-current="page"' : ''}>${ad}</a></li>`).join('');
  const kunyeEtiket = koyu ? 'h1' : 'p';
  return `<header class="ust-alan${koyu ? ' koyu' : ''}">
  <div class="kap ust-satir">
    <div class="ust-sol">
      <button class="ikon-dugme" data-ac="menu" aria-label="Menüyü aç">${ikon('list')}</button>
      <button class="ikon-dugme" data-ac="arama" aria-label="Haberlerde ara">${ikon('magnifying-glass')}</button>
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
  const nav = Object.entries(KATEGORILER).map(([k, ad]) =>
    `<li><a href="${u(`/kategori/${k}/`)}"${k === aktif ? ' aria-current="page"' : ''}>${ad}</a></li>`).join('');
  return `<div class="yapiskan" aria-hidden="true" inert>
  <div class="kap yapiskan-ic">
    <a class="yapiskan-logo" href="${u('/')}" tabindex="-1">The Country Observer</a>
    <nav><ul>${nav}</ul></nav>
    <button class="ikon-dugme" data-ac="arama" tabindex="-1" aria-label="Haberlerde ara">${ikon('magnifying-glass')}</button>
  </div>
</div>`;
}

const altAlan = () => `<footer class="alt-alan">
  <div class="kap alt-ic">
    <div class="alt-marka">
      <a class="logo" href="${u('/')}">The Country Observer</a>
      <p>Türkiye ve dünyadan haberler, birden fazla kaynağın karşılaştırılmasıyla derlenir. Her haberin sonunda yararlandığımız kaynakları açıkça listeleriz.</p>
    </div>
    <nav class="alt-nav" aria-label="Alt menü">
      <div><h2>Bölümler</h2><ul>${Object.entries(KATEGORILER).slice(0, 5).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}</a></li>`).join('')}</ul></div>
      <div><h2>Daha fazla</h2><ul>${Object.entries(KATEGORILER).slice(5).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}</a></li>`).join('')}</ul></div>
      <div><h2>Gazete</h2><ul><li><a href="${u('/hakkimizda/')}">Hakkımızda</a></li><li><a href="${u('/hakkimizda/#yayin-ilkeleri')}">Yayın ilkeleri</a></li><li><a href="${u('/rss.xml')}">RSS akışı</a></li></ul></div>
    </nav>
  </div>
  <div class="kap alt-son"><p>© ${new Date().getFullYear()} The Country Observer. Fotoğraflar, künyelerinde belirtilen açık lisanslarla kullanılmaktadır.</p></div>
</footer>`;

const pencereler = () => `<dialog class="pencere arama-pencere" id="arama" aria-label="Haberlerde ara">
  <form method="dialog" class="arama-form" role="search">
    <label class="gizli" for="arama-girdi">Aranacak kelime</label>
    ${ikon('magnifying-glass')}
    <input id="arama-girdi" type="search" placeholder="Haber, kişi ya da konu arayın" autocomplete="off" enterkeyhint="search">
    <button class="ikon-dugme" value="kapat" aria-label="Aramayı kapat">${ikon('x')}</button>
  </form>
  <div class="arama-sonuc" aria-live="polite"><p class="arama-bos">Aramak istediğiniz kelimeyi yazın. Örneğin: enflasyon, Merkez Bankası, milli takım.</p></div>
</dialog>
<dialog class="pencere menu-pencere" id="menu" aria-label="Menü">
  <div class="menu-ust"><span class="logo">The Country Observer</span><form method="dialog"><button class="ikon-dugme" aria-label="Menüyü kapat">${ikon('x')}</button></form></div>
  <nav aria-label="Tüm bölümler"><ul>${Object.entries(KATEGORILER).map(([k, ad]) => `<li><a href="${u(`/kategori/${k}/`)}">${ad}${ikon('caret-right')}</a></li>`).join('')}</ul></nav>
  <ul class="menu-alt"><li><a href="${u('/')}">Ana sayfa</a></li><li><a href="${u('/hakkimizda/')}">Hakkımızda</a></li><li><a href="${u('/rss.xml')}">RSS akışı</a></li></ul>
</dialog>
<dialog class="pencere abone-pencere" id="abone" aria-labelledby="abone-baslik">
  <form method="dialog"><button class="ikon-dugme kapat" aria-label="Kapat">${ikon('x')}</button></form>
  <h2 id="abone-baslik">Haberler size gelsin</h2>
  <p>Yeni haberlerimizi RSS akışımızla takip edebilirsiniz. Adresi kullandığınız haber okuyucusuna ekleyin ya da tek tıkla Feedly'de açın.</p>
  <div class="abone-adres"><input readonly value="${tamAdres('/rss.xml')}" aria-label="RSS adresi"><button class="dugme" data-kopyala="${tamAdres('/rss.xml')}">${ikon('copy')}<span>Kopyala</span></button></div>
  <a class="dugme dugme-dolu" href="https://feedly.com/i/subscription/feed/${encodeURIComponent(tamAdres('/rss.xml'))}" rel="noopener" target="_blank">Feedly'de takip et</a>
</dialog>`;

let CSS = '', SPRITE = '';

function sayfa({ baslik, aciklama, yol, icerik, koyu = false, aktif = '', gorselYolu, tur = 'website', jsonld, onYukle = '' }) {
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
<meta name="theme-color" content="#f7f7f5" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#111214" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${SITE_ADI}" href="${u('/rss.xml')}">
<link rel="preload" href="${u('/yazitipleri/inter.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${u('/yazitipleri/bower.woff2')}" as="font" type="font/woff2" crossorigin>
${onYukle}
<script>try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.tema=t}catch(e){}</script>
<style>${CSS.replaceAll('/*TABAN*/', TABAN)}</style>
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"${TABAN}/*"},{"not":{"href_matches":"${TABAN}/*.xml"}}]},"eagerness":"moderate"}]}</script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body data-taban="${TABAN}">
${SPRITE}
<a class="atla" href="#icerik">İçeriğe geç</a>
${yapiskanCubuk(aktif)}
${koyu ? '' : ustAlan(false, aktif)}
<main id="icerik">
${icerik}
</main>
${altAlan()}
${pencereler()}
<script src="${u('/site.js')}" defer></script>
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
        <button class="ikon-dugme manset-ileri" aria-label="Sonraki manşet">${ikon('caret-right')}</button>
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
  <button class="ikon-dugme trend-ileri" aria-label="Diğer gündem haberleri">${ikon('caret-right')}</button>
</section></div>`;

  const kartSatiri = (baslik, liste, bag) => `<section class="kap bolum">${bolumBasi(baslik, bag)}
  <div class="izgara-4">${liste.map(h => kart(h, '(max-width: 640px) 100px, (max-width: 1024px) 50vw, 25vw')).join('')}</div></section>`;
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
    icerik: mansetHtml + trendHtml + sonHtml + haftaninHtml + analizHtml + satirHtml,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_ADI, url: tamAdres('/'), inLanguage: 'tr-TR' },
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
    <nav class="yol" aria-label="Sayfa konumu"><a href="${u('/')}">Ana sayfa</a>${ikon('caret-right')}<a href="${u(`/kategori/${h.kategori}/`)}">${kacis(h.kategoriAd)}</a></nav>
    <h1 class="haber-baslik">${kacis(h.baslik)}</h1>
    <p class="haber-spot">${kacis(h.spot)}</p>
    <div class="haber-kunye">
      <p><strong>${kacis(h.yazar)}</strong><span><time datetime="${h.tarih.toISOString()}">${tarihBicim.format(h.tarih)}</time> · ${h.dakika} dk okuma</span></p>
      <div class="paylas" aria-label="Paylaş">
        <a class="ikon-dugme cerceveli" href="https://wa.me/?text=${metin}%20${paylas}" target="_blank" rel="noopener" aria-label="WhatsApp'ta paylaş">${ikon('whatsapp-logo')}</a>
        <a class="ikon-dugme cerceveli" href="https://x.com/intent/post?text=${metin}&url=${paylas}" target="_blank" rel="noopener" aria-label="X'te paylaş">${ikon('x-logo')}</a>
        <a class="ikon-dugme cerceveli" href="https://www.facebook.com/sharer/sharer.php?u=${paylas}" target="_blank" rel="noopener" aria-label="Facebook'ta paylaş">${ikon('facebook-logo')}</a>
        <button class="ikon-dugme cerceveli" data-kopyala="${tamAdres(`/haber/${h.id}/`)}" aria-label="Bağlantıyı kopyala">${ikon('link-simple')}</button>
      </div>
    </div>
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
      <p>Haberdeki bilgiler aşağıdaki kaynakların aktardıklarıyla karşılaştırılarak derlendi:</p>
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

function listeSayfasi({ baslik, liste, yol, aktif = '', aciklama }) {
  const [ilk, ...diger] = liste;
  const icerik = `<section class="kap kategori-bas">
  <h1>${baslik}</h1>
  <p>${liste.length} haber</p>
</section>
${ilk ? `<section class="kap bolum">
  <article class="haftanin belir">
    <a class="haftanin-gorsel" href="${ilk.url}">${gorsel(ilk, { sizes: '(max-width: 900px) 100vw, 50vw', oncelikli: true })}</a>
    <div class="haftanin-metin">${kunyeSatiri(ilk)}<h2><a href="${ilk.url}">${kacis(ilk.baslik)}</a></h2><p class="haftanin-spot">${kacis(ilk.spot)}</p>${altSatir(ilk)}</div>
  </article>
</section>` : '<p class="kap bos-durum">Bu bölümde henüz haber yok.</p>'}
${diger.length ? `<section class="kap bolum"><div class="izgara-4">${diger.map(h => kart(h, '(max-width: 640px) 100px, (max-width: 1024px) 50vw, 25vw')).join('')}</div></section>` : ''}`;
  return sayfa({ baslik, aciklama, yol, aktif, icerik });
}

const kategoriSayfasi = (k, haberler) => listeSayfasi({
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
  ['/', '/haberler/', '/hakkimizda/', ...Object.keys(KATEGORILER).map(k => `/kategori/${k}/`), ...haberler.map(h => `/haber/${h.id}/`)].map(y => `<url><loc>${tamAdres(y)}</loc></url>`).join('')}</urlset>`;

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
  CSS = kucult(await readFile('kaynak/stil.css', 'utf8'));
  for (const d of (await readdir('kaynak/ikonlar')).filter(d => d.endsWith('.svg'))) {
    const svg = await readFile(`kaynak/ikonlar/${d}`, 'utf8');
    ikonlar.set(d.slice(0, -4), `<symbol id="i-${d.slice(0, -4)}" viewBox="0 0 256 256">${svg.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</symbol>`);
  }
  SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[...ikonlar.values()].join('')}</svg>`;

  await rm(CIKTI, { recursive: true, force: true });
  await cp('statik', CIKTI, { recursive: true });
  await writeFile(`${CIKTI}/site.js`, await readFile('kaynak/site.js', 'utf8'));
  await writeFile(`${CIKTI}/.nojekyll`, '');

  await yaz('/', anaSayfa(haberler));
  await Promise.all(haberler.map(h => yaz(`/haber/${h.id}/`, haberSayfasi(h, haberler))));
  await Promise.all(Object.keys(KATEGORILER).map(k => yaz(`/kategori/${k}/`, kategoriSayfasi(k, haberler))));
  await yaz('/haberler/', listeSayfasi({ baslik: 'Son Haberler', liste: haberler, yol: '/haberler/', aciklama: 'Türkiye ve dünyadan en son haberler.' }));
  await yaz('/hakkimizda/', hakkimizda());
  await yaz('/404.html', bulunamadi());
  await yaz('/rss.xml', rss(haberler));
  await yaz('/sitemap.xml', siteHaritasi(haberler));
  await yaz('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${tamAdres('/sitemap.xml')}\n`);
  await yaz('/ara.json', JSON.stringify(haberler.map(h => ({
    b: h.baslik, s: h.spot, u: h.url, k: h.kategoriAd, t: h.tarih.toISOString(),
    g: h.gorsel ? u(`/gorseller/${h.gorsel.id}-480.webp`) : null, e: h.etiketler.join(' '),
  }))));
  console.log(`${haberler.length} haber, ${Object.keys(KATEGORILER).length} kategori derlendi (${Math.round(performance.now() - baslangic)} ms)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await derle();
