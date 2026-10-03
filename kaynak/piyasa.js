// Kaynağı ve güncellenme zamanı görünen piyasa verileri.
(() => {
  const sec = (s, k = document) => k.querySelector(s);
  const hepsi = (s, k = document) => [...k.querySelectorAll(s)];
  if (!sec('[data-piyasa-ozet]') && !sec('[data-piyasa-sec]')) return;
  const varliklar = {
    altin: { ad: 'Ons altın', kod: 'XAU', birim: 'USD / ons', metal: true },
    gumus: { ad: 'Ons gümüş', kod: 'XAG', birim: 'USD / ons', metal: true },
    dolar: { ad: 'Dolar / TL', kod: 'USD', birim: 'TL', metal: false },
    avro: { ad: 'Avro / TL', kod: 'EUR', birim: 'TL', metal: false },
  };
  const yaz = (s, d) => { const e = sec(s); if (e) e.textContent = d; };
  const sayi = (n, hane = 2) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: hane, maximumFractionDigits: hane }).format(n);
  const tarih = t => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(t));
  const tarihKisa = t => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(t));
  const sure = ms => AbortSignal.timeout(ms);
  const veri = {};
  let secili = ['altin', 'gumus', 'dolar', 'avro'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'altin';
  let aralik = '24h', sira = 0;

  async function ozetleriYukle() {
    const [m, d] = await Promise.allSettled([
      fetch('https://standardbullion.com/spot-prices.json', { signal: sure(9000) }).then(r => { if (!r.ok) throw Error(); return r.json(); }),
      fetch('https://open.er-api.com/v6/latest/USD', { signal: sure(9000) }).then(r => { if (!r.ok) throw Error(); return r.json(); }),
    ]);
    if (m.status === 'fulfilled') {
      const a = m.value;
      for (const [id, kod] of [['altin', 'XAU'], ['gumus', 'XAG']]) {
        const x = a.metals?.find(v => v.symbol === kod);
        if (x && Number.isFinite(x.ask)) veri[id] = { deger: x.ask, degisim: x.changeToday?.percent, acilis: x.open, alis: x.bid, hafta: x.changes?.['1w'], ay: x.changes?.['1m'], zaman: a.updated, kaynak: 'Standard Bullion' };
      }
    }
    if (d.status === 'fulfilled' && d.value.result === 'success') {
      const x = d.value;
      const z = new Date(x.time_last_update_unix * 1000).toISOString();
      if (Number.isFinite(x.rates?.TRY)) veri.dolar = { deger: x.rates.TRY, zaman: z, kaynak: 'ExchangeRate-API' };
      if (Number.isFinite(x.rates?.EUR) && veri.dolar) veri.avro = { deger: x.rates.TRY / x.rates.EUR, zaman: z, kaynak: 'ExchangeRate-API' };
    }
    hepsi('[data-piyasa-ozet]').forEach(e => {
      const id = e.dataset.piyasaOzet, x = veri[id];
      if (!x) { e.querySelector('strong').textContent = 'Veri yok'; return; }
      e.querySelector('strong').textContent = `${sayi(x.deger, id === 'altin' || id === 'gumus' ? 2 : 4)} ${id === 'altin' || id === 'gumus' ? '$' : '₺'}`;
      const alt = e.querySelector('.piyasa-ozet-alt');
      alt.textContent = x.degisim == null ? `Günlük referans · ${tarihKisa(x.zaman)}` : `${x.degisim > 0 ? '+' : ''}${sayi(x.degisim)}% · son işlem`;
      alt.classList.toggle('artis', x.degisim > 0);
      alt.classList.toggle('azalis', x.degisim < 0);
    });
    hepsi('[data-piyasa-zaman]').forEach(e => { e.textContent = 'Metaller: son işlem fiyatı · Döviz: günlük referans kuru'; });
    ayrinti();
  }

  function ciz(noktalar, birim) {
    const alan = sec('[data-piyasa-cizim]');
    if (!alan) return;
    if (noktalar.length < 2) { alan.innerHTML = '<p>Bu aralık için yeterli veri bulunamadı.</p>'; return; }
    const degerler = noktalar.map(x => x.price), dusuk = Math.min(...degerler), yuksek = Math.max(...degerler);
    const fark = Math.max(yuksek - dusuk, yuksek * .002);
    const k = (x, i) => `${(i / (noktalar.length - 1) * 1000).toFixed(2)},${(245 - (x.price - dusuk + fark * .12) / (fark * 1.24) * 245).toFixed(2)}`;
    const yol = noktalar.map(k).join(' ');
    const son = yol.split(' ').at(-1).split(',');
    alan.innerHTML = `<svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="65" x2="1000" y2="65"/><line x1="0" y1="130" x2="1000" y2="130"/><line x1="0" y1="195" x2="1000" y2="195"/><polyline points="${yol}"/><circle cx="${son[0]}" cy="${son[1]}" r="5"/></svg><span class="gizli">${tarihKisa(noktalar[0].t)} tarihinde ${sayi(noktalar[0].price)} ${birim}; ${tarihKisa(noktalar.at(-1).t)} tarihinde ${sayi(noktalar.at(-1).price)} ${birim}.</span>`;
    yaz('[data-piyasa-ilk]', tarihKisa(noktalar[0].t));
    yaz('[data-piyasa-son]', tarihKisa(noktalar.at(-1).t));
  }

  async function ayrinti() {
    if (!sec('[data-piyasa-sec]')) return;
    const anlikSira = ++sira, a = varliklar[secili], v = veri[secili];
    hepsi('[data-piyasa-sec]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.piyasaSec === secili)));
    if (!a.metal && aralik === '24h') aralik = '7d';
    hepsi('[data-piyasa-aralik]').forEach(b => { b.disabled = !a.metal && b.dataset.piyasaAralik === '24h'; b.setAttribute('aria-pressed', String(b.dataset.piyasaAralik === aralik)); });
    yaz('[data-piyasa-ad]', `${a.ad} · ${a.birim}`);
    yaz('[data-piyasa-deger]', v ? `${sayi(v.deger, a.metal ? 2 : 4)} ${a.metal ? '$' : '₺'}` : 'Veri bekleniyor');
    yaz('[data-piyasa-degisim]', v ? (v.degisim == null ? `Günlük referans · ${tarih(v.zaman)}` : `${v.degisim > 0 ? '+' : ''}${sayi(v.degisim)}% bugün · ${tarih(v.zaman)}`) : 'Kaynak yanıtı bekleniyor');
    yaz('[data-piyasa-acilis]', Number.isFinite(v?.acilis) ? sayi(v.acilis) : 'Açıklanmıyor');
    yaz('[data-piyasa-alis]', Number.isFinite(v?.alis) ? sayi(v.alis) : 'Açıklanmıyor');
    yaz('[data-piyasa-hafta]', Number.isFinite(v?.hafta) ? `${v.hafta > 0 ? '+' : ''}${sayi(v.hafta)}%` : '—');
    yaz('[data-piyasa-ay]', Number.isFinite(v?.ay) ? `${v.ay > 0 ? '+' : ''}${sayi(v.ay)}%` : '—');
    const alan = sec('[data-piyasa-cizim]');
    alan.innerHTML = '<p>Grafik yükleniyor…</p>';
    try {
      let noktalar;
      if (a.metal) {
        const y = await fetch(`https://standardbullion.com/api/v1/market/history?metal=${a.kod}&range=${aralik}`, { signal: sure(10000) });
        if (!y.ok) throw Error();
        noktalar = (await y.json()).points.filter(p => Number.isFinite(p.price));
      } else {
        const gun = aralik === '7d' ? 10 : 40;
        const bas = new Date(Date.now() - gun * 86400000).toISOString().slice(0, 10);
        const son = new Date().toISOString().slice(0, 10);
        const y = await fetch(`https://api.frankfurter.dev/v1/${bas}..${son}?base=USD&symbols=TRY,EUR`, { signal: sure(10000) });
        if (!y.ok) throw Error();
        const gecmis = (await y.json()).rates;
        noktalar = Object.entries(gecmis).map(([t, x]) => ({ t, price: secili === 'dolar' ? x.TRY : x.TRY / x.EUR })).filter(p => Number.isFinite(p.price));
      }
      if (anlikSira === sira) ciz(noktalar, a.birim);
    } catch { if (anlikSira === sira) alan.innerHTML = '<p>Geçmiş veriler şu anda alınamadı. Daha sonra yeniden deneyin.</p>'; }
  }
  hepsi('[data-piyasa-sec]').forEach(b => b.addEventListener('click', () => { secili = b.dataset.piyasaSec; location.hash = secili; ayrinti(); }));
  hepsi('[data-piyasa-aralik]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; aralik = b.dataset.piyasaAralik; ayrinti(); }));
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (varliklar[id] && id !== secili) { secili = id; ayrinti(); } });
  ozetleriYukle();
  setInterval(ozetleriYukle, 60000);
})();
