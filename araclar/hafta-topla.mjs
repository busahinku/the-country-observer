// Son 7 günün haberlerini AA ve TRT Haber site haritalarından toplar, aynı olayı anlatanları
// ve sitede zaten olanları ayıklar, her adayın metnini indirir. Çıktı: .onbellek/hafta.json
// Kullanım: node araclar/hafta-topla.mjs [--gun 7]
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { kokler, metinTemizle } from './topla.mjs';
import { metinCek } from './kaynak-oku.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const gun = +(process.argv[process.argv.indexOf('--gun') + 1] || 7) || 7;
const sinir = Date.now() - gun * 864e5;
const getir = async u => (await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text();

// AA URL bölümü -> sitedeki kategori
const AA_KAT = { gundem: 'gundem', turkiye: 'gundem', politika: 'politika', ekonomi: 'ekonomi', dunya: 'dunya', spor: 'spor', 'bilim-teknoloji': 'teknoloji', kultur: 'kultur-sanat', 'kultur-sanat': 'kultur-sanat', saglik: 'saglik', yasam: 'yasam', egitim: 'yasam', cevre: 'yasam' };
const TRT_KAT = { gundem: 'gundem', turkiye: 'gundem', ekonomi: 'ekonomi', dunya: 'dunya', spor: 'spor', 'bilim-teknoloji': 'teknoloji', 'kultur-sanat': 'kultur-sanat', saglik: 'saglik', yasam: 'yasam', egitim: 'yasam', politika: 'politika' };
const ELE = /canlı|günün özeti|programı|maç sonuçları|puan durumu|hava durumu|namaz vakit|burç|şans oyun|loto|sözcük|bulmaca|fotoğraf|galeri|video/i;

async function aa() {
  const xml = await getir('https://www.aa.com.tr/tr/SiteMap/News');
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<news:publication_date>([^<]+)<\/news:publication_date>[\s\S]*?<news:title><!\[CDATA\[([\s\S]*?)\]\]><\/news:title>/g)]
    .map(([, url, tarih, baslik]) => ({ kaynak: 'Anadolu Ajansı', url, tarih, baslik: baslik.replace(/:\s*$/, '').trim(), kat: AA_KAT[url.split('/')[4]] }));
}
async function trt() {
  const ay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const aylar = [...new Set([ay(new Date()), ay(new Date(sinir))])];
  const listeler = await Promise.all(aylar.map(a => getir(`https://www.trthaber.com/sitemaps/news-${a}.xml`)));
  return listeler.flatMap(xml => [...xml.matchAll(/<loc><!\[CDATA\[([^\]]+)\]\]><\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>/g)])
    .map(([, url, tarih]) => {
      const p = url.split('/');
      const baslik = p.at(-1).replace(/-\d+\.html$/, '').replace(/-/g, ' ');
      return { kaynak: 'TRT Haber', url, tarih, baslik, kat: TRT_KAT[p[4]], slug: true };
    });
}

const benzer = (a, b) => { let o = 0; for (const k of a) if (b.has(k)) o++; return o >= 3 && o / Math.min(a.size, b.size) >= 0.5; };

const mevcut = await Promise.all((await readdir('icerik/haberler')).map(async d => {
  const t = await readFile(`icerik/haberler/${d}`, 'utf8');
  return kokler(`${(t.match(/^baslik: (.*)$/m) || [])[1]} ${(t.match(/^spot: (.*)$/m) || [])[1]}`);
}));
const ham = [...await aa(), ...await trt()]
  .filter(h => h.kat && Date.parse(h.tarih) >= sinir && !ELE.test(h.baslik) && !/\/(foto|video|galeri)/.test(h.url));

// AA önce gelir; aynı olayın TRT kaydı ikinci kaynak olarak eklenir.
const adaylar = [];
for (const h of ham) {
  const k = kokler(h.baslik);
  if (k.size < 3 || mevcut.some(m => benzer(k, m))) continue;
  const es = adaylar.find(a => benzer(k, a._k));
  if (es) { if (!es.ikinci && es.kaynak !== h.kaynak) es.ikinci = { kaynak: h.kaynak, url: h.url }; continue; }
  adaylar.push({ ...h, _k: k });
}
console.log(`${ham.length} kayıt, ${adaylar.length} tekil aday (sitede olanlar ve tekrarlar ayıklandı)`);

// Metinleri 8'erli gruplar hâlinde indir
for (let i = 0; i < adaylar.length; i += 8) {
  await Promise.all(adaylar.slice(i, i + 8).map(async a => {
    try {
      a.metin = await metinCek(a.url, 1400);
      if (a.slug) a.baslik = metinTemizle((await getir(a.url)).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || a.baslik);
    } catch { a.metin = ''; }
  }));
  process.stdout.write(`\r${Math.min(i + 8, adaylar.length)}/${adaylar.length}`);
}
const sonuc = adaylar.filter(a => a.metin.length > 300).map(({ _k, slug, ...a }, n) => ({ n, ...a }));
await mkdir('.onbellek', { recursive: true });
await writeFile('.onbellek/hafta.json', JSON.stringify(sonuc, null, 1));
console.log(`\n${sonuc.length} aday metniyle kaydedildi`);
