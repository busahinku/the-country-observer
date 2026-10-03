// Piyasa bandı (ana sayfa) ve etkileşimli grafik (piyasalar sayfası).
// Veri, Worker üzerinden önbellekli gelir; kaynak Yahoo Finance.
(() => {
  const API = (document.body.dataset.yardim || '').replace(/\/$/, '');
  if (!API) return;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];
  const DOGAL = { xu100: 'TRY', xu030: 'TRY', usdtry: 'TRY', eurtry: 'TRY', gbptry: 'TRY', 'gram-altin': 'TRY', 'ons-altin': 'USD', 'gram-gumus': 'TRY', 'ons-gumus': 'USD', brent: 'USD', bitcoin: 'USD', ethereum: 'USD', sp500: 'USD' };
  const KUR = new Set(['usdtry', 'eurtry', 'gbptry']);
  const ENDEKS = new Set(['xu100', 'xu030', 'sp500']);
  const azHareket = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ondalik = v => Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? (Math.abs(v) >= 10 ? 2 : 4) : 4;
  const sayi = (v, b = ondalik(v)) => v.toLocaleString('tr-TR', { minimumFractionDigits: b, maximumFractionDigits: b });
  const fiyat = (v, id, para) => {
    if (!Number.isFinite(v)) return '—';
    if (ENDEKS.has(id) && para === DOGAL[id]) return sayi(v);
    return para === 'USD' ? `$${sayi(v)}` : `${sayi(v)} ₺`;
  };
  const yuzde = (son, ilk) => Number.isFinite(son) && Number.isFinite(ilk) && ilk ? (son - ilk) / ilk * 100 : NaN;
  const farkYaz = (el, oran) => {
    el.classList.toggle('artis', oran >= 0);
    el.classList.toggle('azalis', oran < 0);
    el.textContent = Number.isFinite(oran) ? `%${sayi(Math.abs(oran), 2)}` : '';
  };
  const getir = async yol => {
    const y = await fetch(`${API}${yol}`, { signal: AbortSignal.timeout(12000) });
    if (!y.ok) throw new Error('veri yok');
    return y.json();
  };
  let ozetSozu;
  const ozet = () => ozetSozu ||= getir('/piyasa/ozet');

  // ---------- Ana sayfa bandı ----------
  const bant = $('[data-borsa-bandi]');
  if (bant) {
    ozet().then(liste => {
      for (const x of liste) {
        const el = $(`[data-borsa="${x.id}"]`, bant);
        if (!el) continue;
        if (x.hata || !Number.isFinite(x.fiyat)) { el.remove(); continue; }
        $('.borsa-deger', el).textContent = fiyat(x.fiyat, x.id, x.para);
        farkYaz($('.borsa-fark', el), yuzde(x.fiyat, x.onceki));
      }
      bant.classList.remove('yukleniyor');
      if (azHareket) return;
      const iz = $('.borsa-iz', bant);
      for (const el of [...iz.children]) {
        const kopya = el.cloneNode(true);
        kopya.setAttribute('aria-hidden', 'true');
        kopya.tabIndex = -1;
        iz.append(kopya);
      }
      iz.style.setProperty('--borsa-sure', `${Math.round(iz.scrollWidth / 2 / 38)}s`);
    }).catch(() => bant.remove());
  }

  // ---------- Piyasalar sayfası ----------
  const sayfa = $('.borsa-sayfa');
  if (!sayfa || !window.LightweightCharts) return;
  const LC = window.LightweightCharts;
  const ETIKET = { '1g': 'Bugün', '1h': 'Son 1 hafta', '1a': 'Son 1 ay', '3a': 'Son 3 ay', '1y': 'Son 1 yıl', '5y': 'Son 5 yıl' };
  const IST = 3 * 3600; // Türkiye saati sabit UTC+3
  const durum = { id: null, aralik: '1g', para: 'TRY', veri: null, istek: 0 };
  const el = {
    fiyat: $('[data-fiyat]', sayfa), fark: $('.borsa-fiyat-alt [data-fark]', sayfa), etiket: $('[data-etiket]', sayfa),
    ad: $('[data-ad]', sayfa), kimlik: $('[data-kimlik]', sayfa), grafik: $('[data-grafik]', sayfa), secim: $('.borsa-secim', sayfa),
    onceki: $('[data-onceki]', sayfa), gun: $('[data-gun]', sayfa), yil: $('[data-yil]', sayfa),
    aralik: $('[data-segment="Aralık"]', sayfa), para: $('[data-segment="Para birimi"]', sayfa),
  };
  const renk = ad => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
  const saydam = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const tarihYaz = (t, gunIci) => new Intl.DateTimeFormat('tr-TR', gunIci
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t * 1000));

  const grafik = LC.createChart(el.grafik, {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'transparent' }, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, attributionLogo: true },
    grid: { vertLines: { visible: false } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.06 } },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true,
      tickMarkFormatter: (t, tur) => new Intl.DateTimeFormat('tr-TR', tur >= 3 ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : tur === 0 ? { year: 'numeric', timeZone: 'UTC' } : tur === 1 ? { month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t * 1000)) },
    crosshair: { mode: LC.CrosshairMode.Magnet, horzLine: { visible: false, labelVisible: false }, vertLine: { width: 1, style: LC.LineStyle.Dashed, labelVisible: false } },
    handleScroll: false, handleScale: false,
    localization: { locale: 'tr-TR', priceFormatter: v => sayi(v) },
  });
  const seri = grafik.addSeries(LC.AreaSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 4, crosshairMarkerBorderWidth: 2 });
  const temaUygula = () => {
    const soluk = renk('--soluk'), cizgi = renk('--cizgi');
    grafik.applyOptions({ layout: { textColor: soluk }, grid: { horzLines: { color: cizgi } }, crosshair: { vertLine: { color: soluk } } });
    if (durum.veri) renkle();
  };
  new MutationObserver(temaUygula).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  const noktalar = () => durum.veri?.noktalar || [];
  const baslangic = () => durum.aralik === '1g' && Number.isFinite(durum.veri?.onceki) ? durum.veri.onceki : noktalar()[0]?.[1];
  function renkle() {
    const n = noktalar(), artis = (n.at(-1)?.[1] ?? 0) >= (baslangic() ?? 0);
    const r = renk(artis ? '--artis' : '--azalis');
    seri.applyOptions({ lineColor: r, topColor: saydam(r, .2), bottomColor: saydam(r, 0), crosshairMarkerBackgroundColor: r, crosshairMarkerBorderColor: renk('--zemin') });
    el.secim.style.setProperty('--secim-renk', r);
  }
  // Başlık: fiyat, değişim ve etiket. Gezinme ve ölçüm sırasında geçici olarak değişir.
  function baslik(deger, ilk, etiket) {
    const { id, para } = durum;
    el.fiyat.textContent = fiyat(deger, id, para);
    const fark = deger - ilk;
    farkYaz(el.fark, yuzde(deger, ilk));
    if (Number.isFinite(fark)) el.fark.textContent = `${fark >= 0 ? '+' : '−'}${sayi(Math.abs(fark))} (${el.fark.textContent})`;
    el.etiket.textContent = etiket;
  }
  const varsayilanBaslik = () => {
    const v = durum.veri;
    if (!v) return;
    const son = durum.aralik === '1g' ? v.fiyat : noktalar().at(-1)?.[1] ?? v.fiyat;
    const saat = durum.aralik === '1g' && v.zaman ? ` · ${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(v.zaman * 1000))}` : '';
    baslik(son, baslangic(), ETIKET[durum.aralik] + saat);
  };

  function segmentSec(seg, deger) {
    for (const b of $$('button', seg)) b.setAttribute('aria-pressed', String(b.dataset.deger === deger));
    const b = $('[aria-pressed="true"]', seg), imlec = $('.segment-imlec', seg);
    if (b && imlec) { imlec.style.width = `${b.offsetWidth}px`; imlec.style.transform = `translateX(${b.offsetLeft - 3}px)`; }
  }

  async function yukle() {
    const sira = ++durum.istek;
    el.grafik.classList.add('yukleniyor');
    olcuTemizle();
    try {
      const v = await getir(`/piyasa/grafik?id=${durum.id}&aralik=${durum.aralik}&para=${durum.para}`);
      if (sira !== durum.istek) return;
      durum.veri = v;
      $('.borsa-hata', el.grafik)?.remove();
      seri.setData(v.noktalar.map(([t, d]) => ({ time: t + IST, value: d })));
      grafik.timeScale().fitContent();
      grafik.applyOptions({ timeScale: { timeVisible: ['1g', '1h', '1a'].includes(durum.aralik) } });
      renkle();
      varsayilanBaslik();
      el.onceki.textContent = fiyat(v.onceki, v.id, v.para);
      el.gun.textContent = Number.isFinite(v.gunDusuk) ? `${fiyat(v.gunDusuk, v.id, v.para)} – ${fiyat(v.gunYuksek, v.id, v.para)}` : '—';
      el.yil.textContent = Number.isFinite(v.yilDusuk) ? `${fiyat(v.yilDusuk, v.id, v.para)} – ${fiyat(v.yilYuksek, v.id, v.para)}` : '—';
    } catch {
      if (sira !== durum.istek) return;
      seri.setData([]);
      if (!$('.borsa-hata', el.grafik)) el.grafik.insertAdjacentHTML('beforeend', '<p class="borsa-hata">Veri şu anda alınamadı. Biraz sonra yeniden deneyin.</p>');
    } finally { if (sira === durum.istek) el.grafik.classList.remove('yukleniyor'); }
  }

  function varlikSec(id, ilk = false) {
    if (!DOGAL[id]) id = 'xu100';
    durum.id = id;
    durum.para = DOGAL[id];
    for (const b of $$('[data-borsa-sec]', sayfa)) b.setAttribute('aria-selected', String(b.dataset.borsaSec === id));
    const satir = $(`[data-borsa-sec="${id}"]`, sayfa);
    el.kimlik.replaceChildren($('.borsa-ikon', satir).cloneNode(true), el.ad);
    el.ad.textContent = $('.borsa-satir-ad', satir).textContent;
    document.title = `${el.ad.textContent} | Piyasalar | The Country Observer`;
    el.para.hidden = KUR.has(id);
    segmentSec(el.para, durum.para);
    if (!ilk) history.replaceState(null, '', `#${id}`);
    satir.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: ilk || azHareket ? 'instant' : 'smooth' });
    yukle();
  }

  $$('[data-borsa-sec]', sayfa).forEach(b => b.addEventListener('click', () => varlikSec(b.dataset.borsaSec)));
  $$('button', el.aralik).forEach(b => b.addEventListener('click', () => { durum.aralik = b.dataset.deger; segmentSec(el.aralik, durum.aralik); yukle(); }));
  $$('button', el.para).forEach(b => b.addEventListener('click', () => { durum.para = b.dataset.deger; segmentSec(el.para, durum.para); yukle(); }));
  addEventListener('resize', () => { segmentSec(el.aralik, durum.aralik); segmentSec(el.para, durum.para); });

  // Fareyle gezinme: başlık, imlecin altındaki değeri ve aralığın başına göre değişimi gösterir.
  let olcum = null;
  grafik.subscribeCrosshairMove(p => {
    if (olcum) return;
    const d = p.time && p.seriesData.get(seri);
    if (!d) { varsayilanBaslik(); return; }
    baslik(d.value, baslangic(), tarihYaz(p.time, ['1g', '1h', '1a'].includes(durum.aralik)));
  });

  // Sürükleyerek ölçüm: iki nokta arasındaki değişim.
  const enYakin = x => {
    const n = noktalar();
    if (!n.length) return null;
    const t = grafik.timeScale().coordinateToTime(x);
    if (t == null) return x < 0 ? 0 : n.length - 1;
    let alt = 0, ust = n.length - 1;
    while (alt < ust) { const o = (alt + ust) >> 1; if (n[o][0] + IST < t) alt = o + 1; else ust = o; }
    return alt;
  };
  const xKonum = e => e.clientX - el.grafik.getBoundingClientRect().left;
  function olcuCiz(i, j) {
    const n = noktalar(), [a, b] = i <= j ? [i, j] : [j, i];
    const xa = grafik.timeScale().timeToCoordinate(n[a][0] + IST), xb = grafik.timeScale().timeToCoordinate(n[b][0] + IST);
    el.secim.hidden = a === b;
    el.secim.style.left = `${xa}px`;
    el.secim.style.width = `${Math.max(1, xb - xa)}px`;
    const gunIci = ['1g', '1h', '1a'].includes(durum.aralik);
    const r = renk(n[b][1] >= n[a][1] ? '--artis' : '--azalis');
    el.secim.style.setProperty('--secim-renk', r);
    baslik(n[b][1], n[a][1], `${tarihYaz(n[a][0] + IST, gunIci)} – ${tarihYaz(n[b][0] + IST, gunIci)}`);
  }
  function olcuTemizle() { olcum = null; el.secim.hidden = true; }
  el.grafik.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !noktalar().length) return;
    const i = enYakin(xKonum(e));
    if (i == null) return;
    olcum = { bas: i, son: i, tasindi: false };
    el.grafik.setPointerCapture(e.pointerId);
  });
  el.grafik.addEventListener('pointermove', e => {
    if (!olcum) return;
    const j = enYakin(xKonum(e));
    if (j == null || j === olcum.son) return;
    olcum.son = j; olcum.tasindi = true;
    olcuCiz(olcum.bas, j);
  });
  const birak = () => {
    if (!olcum) return;
    if (!olcum.tasindi) { olcuTemizle(); varsayilanBaslik(); return; }
    olcum.bitti = true;
  };
  el.grafik.addEventListener('pointerup', birak);
  el.grafik.addEventListener('pointercancel', () => { olcuTemizle(); varsayilanBaslik(); });
  el.grafik.addEventListener('pointerleave', () => { if (olcum?.bitti) { olcuTemizle(); varsayilanBaslik(); } });

  // Listedeki son değerler (bugünkü değişim)
  ozet().then(liste => {
    for (const x of liste) {
      const b = $(`[data-borsa-sec="${x.id}"]`, sayfa);
      if (!b || x.hata) continue;
      $('[data-deger]', b).textContent = fiyat(x.fiyat, x.id, x.para);
      farkYaz($('[data-fark]', b), yuzde(x.fiyat, x.onceki));
    }
  }).catch(() => {});

  temaUygula();
  segmentSec(el.aralik, durum.aralik);
  varlikSec(location.hash.slice(1), true);
})();
