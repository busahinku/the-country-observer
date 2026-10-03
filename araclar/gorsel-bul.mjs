// Haberler için açık lisanslı fotoğraf bulur (Wikimedia Commons, yedek: Openverse),
// 480/960/1600 px WebP olarak statik/gorseller/ altına yazar, künyeyi icerik/gorseller.json'a ekler.
// Ön bilgi alanları: `gorsel_dosya: File:Ad.jpg` (kesin dosya) ya da `gorsel_sorgu: anahtar kelimeler`.
// Kullanım: node araclar/gorsel-bul.mjs [haber-id ...]   (--yenile: var olanı da değiştir)
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { onBilgiCoz } from '../derle.mjs';

const UA = 'TheCountryObserver/1.0 (https://github.com/busahinku/the-country-observer)';
const KUNYE = 'icerik/gorseller.json';
const HEDEF = 'statik/gorseller';
const ACIK_LISANS = /^(cc[ -]?by|cc0|public domain|pd|by|by-sa|cc-by|cc-by-sa|cc0|pdm)/i;
const temiz = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commonsAra(sorgu, kesinDosya) {
  const p = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1600',
    ...(kesinDosya ? { titles: kesinDosya } : { generator: 'search', gsrsearch: `filetype:bitmap ${sorgu}`, gsrnamespace: '6', gsrlimit: '20' }),
  });
  const j = await (await fetch(`https://commons.wikimedia.org/w/api.php?${p}`, { headers: { 'user-agent': UA } })).json();
  const sayfalar = Object.values(j.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const s of sayfalar) {
    const i = s.imageinfo?.[0];
    if (!i) continue;
    const m = i.extmetadata || {};
    const oran = i.width / i.height;
    const lisans = temiz(m.LicenseShortName?.value);
    if (!kesinDosya && (i.mime !== 'image/jpeg' || i.width < 1200 || oran < 1.2 || oran > 2.4 || !ACIK_LISANS.test(lisans))) continue;
    return { url: i.thumburl || i.url, yazar: temiz(m.Artist?.value).slice(0, 80) || 'Bilinmiyor', lisans, kaynak: i.descriptionurl, platform: 'Wikimedia Commons' };
  }
  return null;
}

async function openverseAra(sorgu) {
  const p = new URLSearchParams({ q: sorgu, license_type: 'commercial', size: 'large', aspect_ratio: 'wide', page_size: '10' });
  const j = await (await fetch(`https://api.openverse.org/v1/images/?${p}`, { headers: { 'user-agent': UA } })).json();
  const r = (j.results || []).find(r => r.width >= 1200 && /jpe?g/i.test(r.filetype || r.url));
  return r && { url: r.url, yazar: (r.creator || 'Bilinmiyor').slice(0, 80), lisans: `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim(), kaynak: r.foreign_landing_url, platform: r.source === 'flickr' ? 'Flickr' : 'Openverse' };
}

function isle(id, girdi) {
  for (const g of [480, 960, 1600]) execFileSync('cwebp', ['-quiet', '-q', g === 480 ? '70' : '72', '-resize', String(g), '0', '-metadata', 'none', girdi, '-o', `${HEDEF}/${id}-${g}.webp`]);
  // Görsel yüklenene kadar gösterilecek ortalama renk
  const piksel = execFileSync('ffmpeg', ['-v', 'quiet', '-i', girdi, '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const boyut = execFileSync('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', girdi]).toString().trim().split(',').map(Number);
  return { renk: '#' + [...piksel.subarray(0, 3)].map(b => b.toString(16).padStart(2, '0')).join(''), oran: +(boyut[0] / boyut[1]).toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const yenile = process.argv.includes('--yenile');
  const secili = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const kunye = JSON.parse(await readFile(KUNYE, 'utf8').catch(() => '{}'));
  await mkdir(HEDEF, { recursive: true });
  const dosyalar = (await readdir('icerik/haberler')).filter(d => d.endsWith('.md'));
  for (const d of dosyalar) {
    const id = d.slice(0, -3);
    if (secili.length && !secili.includes(id)) continue;
    if (kunye[id] && !yenile) continue;
    const { bilgi } = onBilgiCoz(await readFile(`icerik/haberler/${d}`, 'utf8'));
    const sorgu = bilgi.gorsel_sorgu || bilgi.baslik;
    try {
      const bulunan = (bilgi.gorsel_dosya && await commonsAra(null, bilgi.gorsel_dosya)) || await commonsAra(sorgu) || await openverseAra(sorgu);
      if (!bulunan) { console.log(`✗ ${id}: görsel bulunamadı (${sorgu})`); continue; }
      const gecici = `.onbellek/${id}.jpg`;
      await mkdir('.onbellek', { recursive: true });
      await writeFile(gecici, Buffer.from(await (await fetch(bulunan.url, { headers: { 'user-agent': UA } })).arrayBuffer()));
      const { url, ...bilgiler } = bulunan;
      kunye[id] = { ...bilgiler, ...isle(id, gecici) };
      await rm(gecici);
      await writeFile(KUNYE, JSON.stringify(kunye, null, 1));
      console.log(`✓ ${id}: ${bulunan.kaynak}`);
    } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
  }
}
