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
    dizin = fetch(`${TABAN}/ara.json`).then(y => y.json()).then(l => l.map(h => ({ ...h, n: normal(`${h.b} ${h.s} ${h.k} ${h.e}`) })));
  }
  $('#arama-girdi')?.addEventListener('input', async e => {
    const deger = e.target.value;
    const sorgu = normal(deger.trim());
    if (sorgu.length < 2) { sonucAlani.innerHTML = '<p class="arama-bos">Aramak istediğiniz kelimeyi yazın. Örneğin: enflasyon, Merkez Bankası, milli takım.</p>'; return; }
    const kelimeler = sorgu.split(/\s+/);
    const liste = (await dizin).filter(h => kelimeler.every(k => h.n.includes(k))).slice(0, 20);
    if (e.target.value !== deger) return;
    sonucAlani.innerHTML = liste.length
      ? liste.map(h => `<a class="sonuc" href="${h.u}">${h.g ? `<img src="${h.g}" alt="" loading="lazy">` : '<span class="gorsel-yok"></span>'}<span><span class="sonuc-kategori">${kacis(h.k)}</span><span class="sonuc-baslik">${kacis(h.b)}</span></span></a>`).join('')
      : `<p class="arama-bos">“${kacis(e.target.value)}” için sonuç bulunamadı. Daha kısa ya da farklı bir kelime deneyin.</p>`;
  });
  $('.arama-form')?.addEventListener('submit', e => {
    const ilk = $('.sonuc', sonucAlani);
    if (ilk) { e.preventDefault(); location.href = ilk.href; }
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
