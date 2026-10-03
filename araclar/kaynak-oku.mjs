// Bir kümedeki haberlerin tam metnini kaynak sitelerden çeker.
// Kullanım: node araclar/kaynak-oku.mjs <küme no> [küme no...]  (--uzunluk 2500)
import { readFile } from 'node:fs/promises';
import { metinTemizle } from './topla.mjs';

const TARAYICI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const GURULTU = /abone ol|gündemi bbc|iletişime geçiniz|okur temsilcimize|emeğin sesi|güç ver|tüm hakları|çerez|copyright|google news|whatsapp kanal|reklam|bizi takip|haberin devamı|ilginizi çekebilir|e-bülten|uygulamamızı indir|yorum yap/i;
// Tam metni en düzgün veren kaynaklar öne alınır.
const TERCIH = ['Anadolu Ajansı', 'BBC Türkçe', 'DW Türkçe', 'TRT Haber', 'Euronews Türkçe', 'Hürriyet', 'NTV', 'Habertürk', 'Bloomberg HT', 'Cumhuriyet', 'Karar', 'Evrensel'];

export async function metinCek(url, uzunluk = 2500) {
  const yanit = await fetch(url, { headers: { 'user-agent': TARAYICI }, signal: AbortSignal.timeout(15000) });
  if (!yanit.ok) throw new Error(`Kaynak yanıtı: ${yanit.status}`);
  const html = await yanit.text();
  const govde = html.replace(/<(script|style|nav|header|footer|aside|form|figure)\b[\s\S]*?<\/\1>/gi, ' ');
  const paragraflar = [...govde.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => metinTemizle(m[1])).filter(p => p.length > 50 && !GURULTU.test(p));
  return [...new Set(paragraflar)].join('\n').slice(0, uzunluk);
}

export const kaynakSirala = ogeler => [...ogeler].sort((a, b) =>
  ((TERCIH.indexOf(a.kaynak) + 1) || 99) - ((TERCIH.indexOf(b.kaynak) + 1) || 99));

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2);
  const ui = arg.indexOf('--uzunluk');
  const uzunluk = ui >= 0 ? +arg.splice(ui, 2)[1] : 2500;
  const kumeler = JSON.parse(await readFile('.onbellek/kumeler.json', 'utf8'));
  for (const no of arg) {
    const k = kumeler[+no];
    console.log(`\n######## KÜME ${no} (${k.kaynakSayisi} kaynak, ${k.ilk} / ${k.son})`);
    for (const o of k.ogeler) console.log(`- [${o.kaynak}] ${o.baslik} | ${o.tarih} | ${o.link}\n  ${o.ozet.slice(0, 220)}`);
    const tekil = [...new Map(kaynakSirala(k.ogeler).map(o => [o.kaynak, o])).values()].slice(0, 3);
    const tumKaynaklar = [...new Map(kaynakSirala(k.ogeler).map(o => [o.kaynak, o])).values()].slice(0, 5);
    console.log('kaynaklar: ' + JSON.stringify(tumKaynaklar.map(o => ({ ad: o.kaynak, url: o.link.replace(/[?&](utm_[^&]+|at_medium=[^&]+|at_campaign=[^&]+)/g, '') }))));
    for (const o of tekil) {
      try { console.log(`\n=== ${o.kaynak}: ${o.baslik}\n${await metinCek(o.link, uzunluk)}`); }
      catch (e) { console.log(`\n=== ${o.kaynak}: alınamadı (${e.message})`); }
    }
  }
}
