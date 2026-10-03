// The Country Observer: sayfa etkileşimleri. Çerçeve yok, her şey isteğe bağlı iyileştirme.
(() => {
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];
  const TABAN = document.body.dataset.taban || '';
  const azHareket = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sesli haber: aynı anda yalnızca bir kayıt çalsın.
  $$('audio').forEach(ses => {
    ses.addEventListener('play', () => $$('audio').forEach(diger => { if (diger !== ses) diger.pause(); }));
    ses.addEventListener('error', () => {
      const durum = $('.sesli-durum', ses.closest('.sesli-haber'));
      if (durum) durum.textContent = 'Ses kaydı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.';
    });
  });
  $$('[data-ses-hiz]').forEach(secim => secim.addEventListener('change', () => {
    const ses = $('audio', secim.closest('.sesli-haber'));
    if (ses) ses.playbackRate = Number(secim.value);
  }));

  // Tema
  const kok = document.documentElement;
  $$('[data-tema-dugme]').forEach(d => d.addEventListener('click', () => {
    const koyuMu = kok.dataset.tema ? kok.dataset.tema === 'koyu' : matchMedia('(prefers-color-scheme: dark)').matches;
    kok.dataset.tema = koyuMu ? 'acik' : 'koyu';
    try { localStorage.setItem('tema', kok.dataset.tema); } catch {}
  }));

  // Bugünün tarihi (sayfa önbellekten gelse de güncel kalsın)
  const bugun = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul' }).format(new Date());
  $$('[data-bugun]').forEach(e => { e.textContent = bugun; });

  // Göreli zaman: son 48 saat için "3 saat önce"
  const goreli = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
  $$('time[data-goreli]').forEach(t => {
    const fark = (Date.parse(t.dateTime) - Date.now()) / 1000;
    if (fark > 60 || fark < -172800) return;
    t.textContent = fark > -3600 ? goreli.format(Math.min(-1, Math.round(fark / 60)), 'minute') : goreli.format(Math.round(fark / 3600), 'hour');
  });

  // Pencereler
  $$('[data-ac]').forEach(d => d.addEventListener('click', () => {
    $$('dialog[open]').forEach(p => p.close());
    const p = document.getElementById(d.dataset.ac);
    p.showModal();
    if (p.id === 'arama') { aramaHazirla(); $('#arama-girdi').focus(); }
  }));
  $$('dialog').forEach(p => p.addEventListener('click', e => { if (e.target === p) p.close(); }));

  // Arama
  let dizin = null;
  const sonucAlani = $('.arama-sonuc');
  const normal = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  const kacis = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function aramaHazirla() {
    if (dizin) return;
    dizin = fetch(`${TABAN}/ara.json`).then(y => y.json()).then(l => {
      $('[data-arama-sayi]').textContent = `${l.length} haber`;
      return l.map(h => {
        const baslik = normal(h.b);
        const govde = normal(`${h.b} ${h.s} ${h.k} ${h.e}`);
        return { ...h, baslik, sozcukler: govde.split(/[^a-z0-9]+/).filter(Boolean) };
      });
    }).catch(() => { sonucAlani.innerHTML = '<p class="arama-bos">Arşiv şu anda yüklenemedi. Biraz sonra yeniden deneyin.</p>'; return []; });
  }
  $$('[data-arama-oneri]').forEach(d => d.addEventListener('click', () => { const g = $('#arama-girdi'); g.value = d.dataset.aramaOneri; g.dispatchEvent(new Event('input')); g.focus(); }));
  $('#arama-girdi')?.addEventListener('input', async e => {
    const deger = e.target.value;
    const sorgu = normal(deger.trim());
    if (sorgu.length < 2) { sonucAlani.innerHTML = '<p class="arama-bos">Bir başlık, kişi ya da konu yazın. Sonuçlar yazdıkça görünür.</p>'; return; }
    const kelimeler = sorgu.split(/\s+/);
    const liste = (await dizin).filter(h => kelimeler.every(k => h.sozcukler.some(x => x === k || k.length >= 7 && x.startsWith(k))))
      .sort((a, b) => kelimeler.filter(k => b.baslik.split(/[^a-z0-9]+/).includes(k)).length - kelimeler.filter(k => a.baslik.split(/[^a-z0-9]+/).includes(k)).length)
      .slice(0, 20);
    if (e.target.value !== deger) return;
    sonucAlani.innerHTML = liste.length
      ? liste.map(h => `<a class="sonuc" href="${h.u}">${h.g ? `<img src="${h.g}" alt="" loading="lazy">` : '<span class="gorsel-yok"></span>'}<span><span class="sonuc-kategori">${kacis(h.k)} · ${new Intl.DateTimeFormat('tr-TR', { day:'numeric',month:'short' }).format(new Date(h.t))}</span><span class="sonuc-baslik">${kacis(h.b)}</span></span></a>`).join('')
      : `<p class="arama-bos">“${kacis(e.target.value)}” için sonuç bulunamadı. Daha kısa ya da farklı bir kelime deneyin.</p>`;
  });
  $('.arama-form')?.addEventListener('submit', e => {
    const ilk = $('.sonuc', sonucAlani);
    if (ilk) { e.preventDefault(); location.href = ilk.href; }
  });

  // Arşiv soruları. Sunucu adresi tanımlanınca yanıtı güvenli uç nokta üretir;
  // o zamana kadar doğrulanabilir haber eşleşmelerini gösterir.
  const soruPanel = $('#soru-panel'), soruAc = $('[data-soru-ac]');
  const soruKapat = () => { soruPanel.hidden = true; soruAc.setAttribute('aria-expanded', 'false'); soruAc.focus(); };
  soruAc?.addEventListener('click', () => {
    soruPanel.hidden = !soruPanel.hidden;
    soruAc.setAttribute('aria-expanded', String(!soruPanel.hidden));
    if (!soruPanel.hidden) $('#soru-girdi').focus();
  });
  if (soruPanel && $('.alt-alan')) new IntersectionObserver(([g]) => {
    $('.soru-kutusu').classList.toggle('alt-gorunur', g.isIntersecting && soruPanel.hidden);
  }, { threshold: .1 }).observe($('.alt-alan'));
  $('[data-soru-kapat]')?.addEventListener('click', soruKapat);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && soruPanel && !soruPanel.hidden) soruKapat(); });
  function mesajEkle(metin, tur = 'yanit', baglar = []) {
    const kutu = document.createElement('div');
    kutu.className = `soru-mesaj ${tur}`;
    kutu.textContent = metin;
    for (const b of baglar) {
      if (!b.url?.startsWith(location.origin + TABAN + '/haber/')) continue;
      const a = document.createElement('a'); a.href = b.url; a.textContent = b.baslik; kutu.append(a);
    }
    $('.soru-mesajlar').append(kutu);
    kutu.scrollIntoView({ block: 'nearest', behavior: azHareket ? 'instant' : 'smooth' });
  }
  $('.soru-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const g = $('#soru-girdi'), dugme = $('.soru-form button');
    const soru = g.value.trim(); if (!soru || soru.length > 350) return;
    g.value = ''; dugme.disabled = true; mesajEkle(soru, 'kullanici');
    try {
      const adres = document.body.dataset.yardim;
      if (adres) {
        const y = await fetch(adres, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ soru, haber: document.body.dataset.haber || null }), signal: AbortSignal.timeout(16000) });
        const cevap = await y.json();
        if (!y.ok) throw new Error(cevap.hata || 'Yanıt alınamadı. Lütfen tekrar deneyin.');
        mesajEkle(cevap.yanit, 'yanit', cevap.baglar || []);
      } else {
        const liste = await (aramaHazirla(), dizin);
        const parcalar = normal(soru).split(/\W+/).filter(x => x.length > 2 && !['nedir','nasil','hangi','haber','hakkinda','ilgili','bugun','son'].includes(x));
        const haber = document.body.dataset.haber;
        const bulunan = liste.map(h => ({ ...h, puan: (haber && h.u.includes(`/haber/${haber}/`) ? 4 : 0) + parcalar.reduce((n, x) => n + (h.baslik.split(/[^a-z0-9]+/).includes(x) ? 3 : h.sozcukler.includes(x) ? 1 : 0), 0) })).filter(h => h.puan > 0).sort((a, b) => b.puan - a.puan).slice(0, 3);
        if (bulunan.length) mesajEkle('Arşivimizde bu konuyla ilişkili haberler var. Ayrıntı ve kaynaklar için haberleri açın:', 'yanit', bulunan.map(h => ({ baslik: h.b, url: new URL(h.u, location.origin).href })));
        else mesajEkle('Bu soruya dayanak oluşturacak bir haber bulamadım. Başlık, kişi veya konuyu başka sözcüklerle sorabilirsiniz.');
      }
    } catch (hata) { mesajEkle(hata.message || 'Yanıt alınamadı. Lütfen tekrar deneyin.'); }
    finally { dugme.disabled = false; g.focus(); }
  });

  // Kopyala
  $$('[data-kopyala]').forEach(d => d.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(d.dataset.kopyala); } catch { return; }
    const yazi = $('span', d);
    const eski = d.getAttribute('aria-label');
    if (yazi) { yazi.textContent = 'Kopyalandı'; setTimeout(() => { yazi.textContent = 'Kopyala'; }, 1800); }
    else { d.setAttribute('aria-label', 'Bağlantı kopyalandı'); d.style.color = 'var(--vurgu-metin)'; setTimeout(() => { d.setAttribute('aria-label', eski); d.style.color = ''; }, 1800); }
  }));

  // Yapışkan üst çubuk: üst alan görünmez olunca belirir
  const yapiskan = $('.yapiskan'), ustAlan = $('.ust-alan');
  if (yapiskan && ustAlan) new IntersectionObserver(([g]) => {
    const goster = !g.isIntersecting;
    yapiskan.classList.toggle('gorunur', goster);
    yapiskan.inert = !goster;
    yapiskan.setAttribute('aria-hidden', String(!goster));
    $$('a,button', yapiskan).forEach(e => e.tabIndex = goster ? 0 : -1);
  }).observe(ustAlan);

  // Manşet slaytı
  const manset = $('.manset');
  if (manset) {
    const slaytlar = $$('.manset-slayt', manset), resimler = $$('.manset-resim', manset), noktalar = $$('.nokta', manset);
    let sira = 0, zamanlayici;
    const goster = i => {
      sira = (i + slaytlar.length) % slaytlar.length;
      slaytlar.forEach((s, j) => { s.classList.toggle('aktif', j === sira); s.inert = j !== sira; });
      resimler.forEach((r, j) => r.classList.toggle('aktif', j === sira));
      noktalar.forEach((n, j) => { n.classList.toggle('aktif', j === sira); n.toggleAttribute('aria-current', j === sira); });
    };
    const baslat = () => { if (!azHareket) { clearInterval(zamanlayici); zamanlayici = setInterval(() => goster(sira + 1), 7000); } };
    const durdur = () => clearInterval(zamanlayici);
    noktalar.forEach((n, i) => n.addEventListener('click', () => { goster(i); baslat(); }));
    $('.manset-ileri', manset)?.addEventListener('click', () => { goster(sira + 1); baslat(); });
    const sol = $('.manset-sol', manset);
    sol.addEventListener('mouseenter', durdur); sol.addEventListener('mouseleave', baslat);
    sol.addEventListener('focusin', durdur); sol.addEventListener('focusout', baslat);
    document.addEventListener('visibilitychange', () => document.hidden ? durdur() : baslat());
    let dokunX = null;
    manset.addEventListener('touchstart', e => { dokunX = e.touches[0].clientX; }, { passive: true });
    manset.addEventListener('touchend', e => {
      if (dokunX === null) return;
      const fark = e.changedTouches[0].clientX - dokunX;
      if (Math.abs(fark) > 50) { goster(sira + (fark < 0 ? 1 : -1)); baslat(); }
      dokunX = null;
    });
    baslat();
  }

  // Yatay kaydırmalı alanlar
  $('.trend-ileri')?.addEventListener('click', () => {
    const l = $('.trend-liste');
    l.scrollBy({ left: l.scrollLeft + l.clientWidth >= l.scrollWidth - 4 ? -l.scrollWidth : l.clientWidth, behavior: azHareket ? 'instant' : 'smooth' });
  });
  // Sayfa geçişi: tıklanan haberin görseli yeni sayfadaki kapak görseline dönüşür
  if (document.startViewTransition !== undefined || 'onpagereveal' in window) {
    document.addEventListener('click', e => {
      const bag = e.target.closest('a[href*="/haber/"]');
      if (!bag || e.metaKey || e.ctrlKey) return;
      const resim = $('img', bag) || $('img', bag.closest('article, li') || bag);
      if (!resim || resim.classList.contains('kapak')) return;
      temizle();
      $$('.kapak').forEach(i => i.style.viewTransitionName = 'none');
      resim.style.viewTransitionName = 'kapak';
    });
    const temizle = () => $$('img[style*="view-transition-name"]').forEach(i => i.style.viewTransitionName = '');
    addEventListener('pageshow', temizle);
  }
})();
