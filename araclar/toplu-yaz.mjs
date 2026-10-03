// Haftalık adaylardan toplu haber yazımı için yardımcı.
//   node araclar/toplu-yaz.mjs goster <baş> <adet>   adayları kısa biçimde listeler
//   node araclar/toplu-yaz.mjs yaz <dosya>           yazılan metinleri icerik/haberler/ altına kaydeder
// Yazım biçimi (her haber @ ile başlar):
//   @<aday no> [kategori]
//   B: başlık
//   S: spot
//   G: görsel arama sorgusu
//   <boş satır> paragraflar...
import { readFile, writeFile, readdir } from 'node:fs/promises';

const adaylar = JSON.parse(await readFile('.onbellek/hafta.json', 'utf8'));
const YAZAR = { gundem: 'Haber Merkezi', politika: 'Politika Servisi', ekonomi: 'Ekonomi Servisi', dunya: 'Dış Haberler Servisi', spor: 'Spor Servisi', teknoloji: 'Teknoloji Servisi', 'kultur-sanat': 'Kültür-Sanat Servisi', yasam: 'Yaşam Servisi', saglik: 'Sağlık Servisi', analiz: 'Analiz Masası' };
const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const kisalt = s => s.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, h => TR[h]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72).replace(/-[^-]*$/, '');
const tirnak = s => s.replace(/'/g, '’');

const [komut, a, b] = process.argv.slice(2);
if (komut === 'goster') {
  for (const h of adaylar.slice(+a, +a + +b)) {
    console.log(`\n@${h.n} ${h.kat} ${h.tarih.slice(5, 16)} ${h.kaynak}${h.ikinci ? ' + ' + h.ikinci.kaynak : ''}\n${h.baslik}\n${h.metin.slice(0, 950)}`);
  }
} else if (komut === 'yaz') {
  const metin = await readFile(a, 'utf8');
  const varolan = new Set((await readdir('icerik/haberler')).map(d => d.slice(0, -3)));
  let say = 0;
  for (const parca of metin.split(/^@/m).slice(1)) {
    const [ilk, ...satirlar] = parca.split('\n');
    const [no, katYeni] = ilk.trim().split(/\s+/);
    const h = adaylar.find(x => x.n === +no);
    if (!h) { console.log(`✗ aday yok: ${no}`); continue; }
    const alan = k => (satirlar.find(s => s.startsWith(`${k}: `)) || '').slice(k.length + 2).trim();
    const govde = satirlar.filter(s => !/^[BSG]: /.test(s)).join('\n').trim();
    const kategori = katYeni || h.kat;
    let id = kisalt(alan('B')) || `haber-${no}`;
    for (let i = 2; varolan.has(id); i++) id = `${kisalt(alan('B'))}-${i}`;
    varolan.add(id);
    const kaynaklar = [{ ad: h.kaynak, url: h.url }, ...(h.ikinci ? [{ ad: h.ikinci.kaynak, url: h.ikinci.url }] : [])];
    await writeFile(`icerik/haberler/${id}.md`, `---
baslik: ${tirnak(alan('B'))}
spot: ${tirnak(alan('S'))}
kategori: ${kategori}
yazar: ${YAZAR[kategori] || 'Haber Merkezi'}
tarih: ${new Date(h.tarih).toISOString()}
etiketler: []
gorsel_sorgu: ${alan('G')}
gorsel_aciklama: Arşiv fotoğrafı.
kaynaklar: ${JSON.stringify(kaynaklar)}
---
${tirnak(govde)}
`);
    say++;
  }
  console.log(`${say} haber yazıldı, toplam ${varolan.size}`);
}
