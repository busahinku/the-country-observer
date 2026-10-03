// The Country Observer: sayfa etkileşimleri. Çerçeve yok, her şey isteğe bağlı iyileştirme.
(() => {
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];
  const TABAN = document.body.dataset.taban || '';
  const azHareket = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sesli haber: oynat, dalgada gezin, hızı değiştir.
  $$('[data-ses]').forEach(kap => {
    const ses = $('audio', kap), oynat = $('.ses-oynat', kap), dalga = $('.ses-dalga', kap), hiz = $('.ses-hiz', kap);
    const cubuklar = $$('span', dalga), hizlar = [1, 1.25, 1.5, 2, .75];
    const oran = () => Number.isFinite(ses.duration) && ses.duration > 0 ? ses.currentTime / ses.duration : 0;
    const boya = (o, onizleme = -1) => {
      const simdi = Math.floor(o * cubuklar.length);
      cubuklar.forEach((c, i) => {
        c.classList.toggle('gecti', i < simdi);
        c.classList.toggle('simdi', i === simdi && o > 0);
        c.classList.toggle('on', onizleme >= 0 && i >= simdi && i < onizleme);
      });
      dalga.setAttribute('aria-valuenow', String(Math.round(o * 100)));
    };
    const konum = e => { const r = dalga.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    const git = o => { if (Number.isFinite(ses.duration)) { ses.currentTime = o * ses.duration; boya(o); } else { ses.dataset.bekleyen = o; ses.play().catch(() => {}); } };
    oynat.addEventListener('click', () => ses.paused ? ses.play().catch(() => {}) : ses.pause());
    dalga.addEventListener('pointerdown', e => { dalga.setPointerCapture(e.pointerId); git(konum(e)); });
    dalga.addEventListener('pointermove', e => e.buttons ? git(konum(e)) : boya(oran(), Math.ceil(konum(e) * cubuklar.length)));
    dalga.addEventListener('pointerleave', () => boya(oran()));
    dalga.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !Number.isFinite(ses.duration)) return;
      e.preventDefault();
      ses.currentTime = Math.max(0, Math.min(ses.duration, ses.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
    });
    hiz.addEventListener('click', () => {
      ses.playbackRate = hizlar[(hizlar.indexOf(ses.playbackRate) + 1) % hizlar.length];
      hiz.textContent = `${String(ses.playbackRate).replace('.', ',')}×`;
    });
    ses.addEventListener('loadedmetadata', () => { if (ses.dataset.bekleyen) { ses.currentTime = +ses.dataset.bekleyen * ses.duration; delete ses.dataset.bekleyen; } });
    ses.addEventListener('timeupdate', () => boya(oran()));
    ses.addEventListener('play', () => { $$('audio').forEach(d => d !== ses && d.pause()); kap.classList.add('caliyor'); oynat.setAttribute('aria-label', 'Duraklat'); });
    ses.addEventListener('pause', () => { kap.classList.remove('caliyor'); oynat.setAttribute('aria-label', 'Haberi dinle'); });
    ses.addEventListener('ended', () => boya(0));
  });

  // Tema
  const kok = document.documentElement;
  $$('[data-tema-dugme]').forEach(d => d.addEventListener('click', () => {
    const koyuMu = kok.dataset.tema === 'koyu';
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
    if (p.id === 'arama') { aramaHazirla(); $('#arama-girdi').focus(); if (!$('#arama-girdi').value) dizin.then(sonYaz); }
  }));
  $$('dialog').forEach(p => p.addEventListener('click', e => { if (e.target === p) p.close(); }));

  // Arama
  let dizin = null;
  const sonucAlani = $('.arama-sonuc');
  const normal = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  const kacis = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const satirHtml = h => `<a class="sonuc" href="${h.u}">${h.g ? `<img src="${h.g}" alt="" loading="lazy">` : '<span class="gorsel-yok"></span>'}<span><span class="sonuc-kategori">${kacis(h.k)} · ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(h.t))}</span><span class="sonuc-baslik">${kacis(h.b)}</span></span></a>`;
  const sonYaz = liste => { sonucAlani.innerHTML = liste.length ? `<p class="arama-baslik">Son haberler</p>${liste.slice(0, 6).map(satirHtml).join('')}` : ''; };
  function aramaHazirla() {
    if (dizin) return;
    dizin = fetch(`${TABAN}/ara.json`).then(y => y.json()).then(l => {
      return l.map(h => {
        const baslik = normal(h.b);
        const govde = normal(`${h.b} ${h.s} ${h.k} ${h.e}`);
        return { ...h, baslik, sozcukler: govde.split(/[^a-z0-9]+/).filter(Boolean) };
      });
    }).catch(() => { sonucAlani.innerHTML = '<p class="arama-bos">Arşiv şu anda yüklenemedi. Biraz sonra yeniden deneyin.</p>'; return []; });
  }
  $('#arama-girdi')?.addEventListener('input', async e => {
    const deger = e.target.value;
    const sorgu = normal(deger.trim());
    if (sorgu.length < 2) { sonYaz(await dizin); return; }
    const kelimeler = sorgu.split(/\s+/);
    const liste = (await dizin).filter(h => kelimeler.every(k => h.sozcukler.some(x => x === k || k.length >= 7 && x.startsWith(k))))
      .sort((a, b) => kelimeler.filter(k => b.baslik.split(/[^a-z0-9]+/).includes(k)).length - kelimeler.filter(k => a.baslik.split(/[^a-z0-9]+/).includes(k)).length)
      .slice(0, 20);
    if (e.target.value !== deger) return;
    sonucAlani.innerHTML = liste.length ? liste.map(satirHtml).join('')
      : `<p class="arama-bos">“${kacis(e.target.value)}” için sonuç bulunamadı.</p>`;
  });
  $('.arama-form')?.addEventListener('submit', e => {
    const ilk = $('.sonuc', sonucAlani);
    if (ilk) { e.preventDefault(); location.href = ilk.href; }
  });

  // Soru çubuğu: yazıp gönderince yüzey yukarı doğru açılır, yanıt akarak gelir.
  const soru = $('[data-soru]');
  if (soru) {
    const girdi = $('#soru-girdi', soru), gonder = $('.soru-gonder', soru), mesajlar = $('.soru-mesajlar', soru);
    const adres = document.body.dataset.yardim;
    let mesgul = false;
    const ac = () => { if (mesajlar.childElementCount) soru.classList.add('acik'); };
    const kapat = () => soru.classList.remove('acik');
    const asagi = () => { mesajlar.scrollTop = mesajlar.scrollHeight; };
    girdi.addEventListener('input', () => { gonder.disabled = mesgul || girdi.value.trim().length < 3; });
    girdi.addEventListener('focus', ac);
    $('.soru-kapat', soru).addEventListener('click', kapat);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && soru.classList.contains('acik')) { kapat(); girdi.blur(); } });
    document.addEventListener('pointerdown', e => { if (!soru.contains(e.target)) kapat(); });

    const balon = (sinif, metin = '') => {
      const d = document.createElement('div');
      d.className = `soru-mesaj ${sinif}`;
      d.textContent = metin;
      mesajlar.append(d);
      return d;
    };
    const kaynakEkle = (kutu, liste) => {
      const izinli = liste.filter(k => typeof k.url === 'string' && /^https:\/\/[^/]+\/haber\/[a-z0-9-]+\/$/.test(k.url));
      if (!izinli.length) return;
      const alan = document.createElement('div');
      alan.className = 'soru-kaynaklar';
      for (const k of izinli) {
        const a = document.createElement('a');
        a.href = new URL(k.url).pathname.replace(/^/, TABAN);
        a.innerHTML = '<svg class="ikon" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>';
        const s = document.createElement('span'); s.textContent = k.baslik; a.prepend(s);
        alan.append(a);
      }
      kutu.append(alan);
    };

    // Gelen metni karakter karakter yazar; akış hızlansa da göz yormaz.
    function yazici(kutu) {
      let kuyruk = '', bitti = false, coz;
      const son = new Promise(r => { coz = r; });
      const metin = document.createTextNode('');
      kutu.replaceChildren(metin);
      const adim = () => {
        if (kuyruk) {
          const al = Math.max(1, Math.ceil(kuyruk.length / 12));
          metin.data += kuyruk.slice(0, al); kuyruk = kuyruk.slice(al);
          asagi();
        }
        if (kuyruk || !bitti) requestAnimationFrame(adim); else coz();
      };
      requestAnimationFrame(adim);
      return { ekle: t => { kuyruk += azHareket ? '' : t; if (azHareket) metin.data += t; }, bitir: () => { bitti = true; return son; } };
    }

    $('.soru-cubuk', soru).addEventListener('submit', async e => {
      e.preventDefault();
      const metin = girdi.value.trim();
      if (mesgul || metin.length < 3 || !adres) return;
      mesgul = true; gonder.disabled = true; girdi.value = '';
      balon('kullanici', metin);
      const kutu = balon('yanit');
      kutu.innerHTML = '<span class="soru-yaziyor" aria-label="Yanıt hazırlanıyor"><i></i><i></i><i></i></span>';
      soru.classList.add('acik');
      asagi();
      let kaynaklar = [];
      try {
        const y = await fetch(adres.replace(/\/$/, '') + '/sor', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ soru: metin, haber: document.body.dataset.haber || null }),
          signal: AbortSignal.timeout(30000),
        });
        if (!y.ok || !y.headers.get('content-type')?.includes('event-stream')) {
          const j = await y.json().catch(() => ({}));
          throw new Error(j.hata || 'Yanıt alınamadı. Biraz sonra yeniden deneyin.');
        }
        const okuyucu = y.body.getReader(), cozucu = new TextDecoder();
        const yaz = yazici(kutu);
        let tampon = '', olay = 'message', kesildi = false;
        for (;;) {
          const { value, done } = await okuyucu.read();
          if (done) break;
          tampon += cozucu.decode(value, { stream: true });
          const parcalar = tampon.split('\n\n');
          tampon = parcalar.pop();
          for (const p of parcalar) {
            olay = /^event: (.+)$/m.exec(p)?.[1] || 'message';
            const veri = /^data: (.*)$/m.exec(p)?.[1];
            if (veri == null) continue;
            if (olay === 'kaynak') kaynaklar = JSON.parse(veri);
            else if (olay === 'kes') kesildi = true;
            else if (olay === 'message') yaz.ekle(JSON.parse(veri));
          }
        }
        await yaz.bitir();
        if (kesildi) kutu.textContent = 'Yalnızca gazetemizdeki haberler hakkında yardımcı olabilirim.';
        else if (!kutu.textContent.trim()) kutu.textContent = 'Bu soruya haberlerimizde bir yanıt bulamadım.';
        else kaynakEkle(kutu, kaynaklar);
      } catch (hata) {
        kutu.classList.add('hata');
        kutu.textContent = hata.name === 'TimeoutError' ? 'Yanıt gecikti. Biraz sonra yeniden deneyin.' : hata.message;
      } finally {
        mesgul = false; asagi();
        gonder.disabled = girdi.value.trim().length < 3;
      }
    });
  }

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
  // Akış: bölüm, etiket, kayıt ve kelimeye göre süzme; özet, kaydet, paylaş.
  const akis = $('.akis'), duzen = $('.akis-duzen');
  if (akis) {
    const gonderiler = $$('.gonderi', akis), bos = $('.akis-bos', akis), kayitSayi = $('[data-kayit-sayi]');
    const sekme = $('.akis-sekme', akis), sekmeIc = $('.akis-sekme-ic', akis), imlec = $('.akis-sekme-imlec', akis);
    const durum = { sekme: '', konu: '', kelimeler: [] };
    const metin = new Map(gonderiler.map(g => [g, normal(`${$('.gonderi-baslik', g).textContent} ${$('.gonderi-spot', g).textContent}`)]));
    const ozetler = new Map();
    let kayitli;
    try { kayitli = new Set(JSON.parse(localStorage.getItem('kaydedilenler')) || []); } catch { kayitli = new Set(); }
    const svg = (ad, sinif = 'ikon') => `<svg class="${sinif}" aria-hidden="true"><use href="#i-${ad}"/></svg>`;
    const arac = `<div class="gonderi-arac"><button type="button" class="gonderi-ozet-dugme" aria-expanded="false">Özet${svg('chevron-down')}</button><button type="button" class="ikon-dugme" data-kaydet aria-pressed="false" aria-label="Kaydet">${svg('bookmark', 'ikon bos')}${svg('bookmark-dolu', 'ikon dolu')}</button><button type="button" class="ikon-dugme" data-paylas aria-label="Paylaş">${svg('share', 'ikon paylas')}${svg('check', 'ikon tamam')}</button></div>`;
    gonderiler.forEach(g => {
      $('.gonderi-govde', g).insertAdjacentHTML('beforeend', arac);
      if (kayitli.has(g.dataset.id)) $('[data-kaydet]', g).setAttribute('aria-pressed', 'true');
    });
    const sayiYaz = () => { if (kayitSayi) kayitSayi.textContent = kayitli.size || ''; };
    sayiYaz();

    const imlecKoy = () => {
      const b = $('[aria-pressed="true"]', sekmeIc);
      imlec.style.width = `${b.offsetWidth - 20}px`;
      imlec.style.transform = `translateX(${b.offsetLeft + 10}px)`;
    };
    imlecKoy();
    document.fonts?.ready.then(imlecKoy);
    addEventListener('resize', imlecKoy);

    const suz = gecis => {
      const uygula = () => {
        let sayi = 0;
        gonderiler.forEach(g => {
          const gor = (!durum.sekme || (durum.sekme === 'kaydedilen' ? kayitli.has(g.dataset.id) : g.dataset.kat === durum.sekme))
            && (!durum.konu || g.dataset.konu.split(' ').includes(durum.konu))
            && durum.kelimeler.every(k => metin.get(g).includes(k));
          g.hidden = !gor;
          sayi += gor;
        });
        bos.hidden = sayi > 0;
        bos.textContent = durum.sekme === 'kaydedilen' && !kayitli.size ? 'Kaydettiğiniz haberler burada görünür.' : 'Bu seçime uyan haber yok.';
        // Sekmeler yapışık durumdaysa akışın başına dön
        const ust = scrollY + sekme.previousElementSibling.getBoundingClientRect().bottom;
        if (scrollY > ust) scrollTo({ top: ust, behavior: 'instant' });
      };
      if (gecis && !azHareket && document.startViewTransition) document.startViewTransition(uygula);
      else uygula();
    };

    const ozetGetir = g => {
      if (!ozetler.has(g)) ozetler.set(g, fetch(`${TABAN}/yardim/${g.dataset.id}.json`)
        .then(y => y.ok ? y.json() : Promise.reject())
        .then(v => v.govde.split(/\n\s*\n/).filter(p => !/^(##|>|- )/.test(p.trim())).slice(0, 3)
          .map(p => `<p>${kacis(p.replace(/\*\*?|\[|\]\([^)]*\)/g, '').trim())}</p>`).join(''))
        .catch(() => { ozetler.delete(g); return '<p>Özet yüklenemedi.</p>'; }));
      return ozetler.get(g);
    };
    async function ozetAc(g, d) {
      if (!$('.gonderi-ozet', g)) {
        const id = `ozet-${g.dataset.id}`, metinHtml = await ozetGetir(g);
        $('.gonderi-govde', g).insertAdjacentHTML('beforeend', `<div class="gonderi-ozet" id="${id}" inert><div class="gonderi-ozet-ic"><div class="gonderi-ozet-metin">${metinHtml}</div>${g.dataset.kaynak ? `<p class="gonderi-kaynak">Kaynak: ${kacis(g.dataset.kaynak)}</p>` : ''}<a class="gonderi-devam" href="${$('.gonderi-baslik a', g).getAttribute('href')}">Haberin tamamı${svg('arrow-right')}</a></div></div>`);
        d.setAttribute('aria-controls', id);
        void $('.gonderi-ozet', g).offsetHeight;
      }
      const ac = d.getAttribute('aria-expanded') !== 'true';
      d.setAttribute('aria-expanded', String(ac));
      g.classList.toggle('acik', ac);
      $('.gonderi-ozet', g).inert = !ac;
    }

    akis.addEventListener('pointerover', e => { const d = e.target.closest('.gonderi-ozet-dugme'); if (d) ozetGetir(d.closest('.gonderi')); });
    duzen.addEventListener('click', async e => {
      const d = e.target.closest('button');
      if (!d) return;
      const g = d.closest('.gonderi');
      if (d.dataset.sekme !== undefined) {
        durum.sekme = d.dataset.sekme;
        $$('[data-sekme]', akis).forEach(b => b.setAttribute('aria-pressed', String(b === d)));
        imlecKoy();
        sekmeIc.scrollTo({ left: d.offsetLeft - (sekmeIc.clientWidth - d.offsetWidth) / 2, behavior: azHareket ? 'instant' : 'smooth' });
        suz(true);
      } else if (d.dataset.konuSec) {
        durum.konu = durum.konu === d.dataset.konuSec ? '' : d.dataset.konuSec;
        $$('[data-konu-sec]', duzen).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.konuSec === durum.konu)));
        suz(true);
      } else if (d.dataset.sekmeGit) {
        $(`[data-sekme="${d.dataset.sekmeGit}"]`, akis).click();
      } else if (d.hasAttribute('data-asistan')) {
        $('#soru-girdi')?.focus();
      } else if (d.classList.contains('gonderi-ozet-dugme')) {
        ozetAc(g, d);
      } else if (d.hasAttribute('data-kaydet')) {
        const id = g.dataset.id, kaydet = !kayitli.has(id);
        kaydet ? kayitli.add(id) : kayitli.delete(id);
        try { localStorage.setItem('kaydedilenler', JSON.stringify([...kayitli])); } catch {}
        d.setAttribute('aria-pressed', String(kaydet));
        sayiYaz();
        if (durum.sekme === 'kaydedilen') suz(false);
      } else if (d.hasAttribute('data-paylas')) {
        const bag = $('.gonderi-baslik a', g);
        if (navigator.share) { navigator.share({ title: bag.textContent, url: bag.href }).catch(() => {}); return; }
        try { await navigator.clipboard.writeText(bag.href); } catch { return; }
        d.classList.add('kopyalandi');
        d.setAttribute('aria-label', 'Bağlantı kopyalandı');
        setTimeout(() => { d.classList.remove('kopyalandi'); d.setAttribute('aria-label', 'Paylaş'); }, 1800);
      }
    });
    $('[data-akis-ara]')?.addEventListener('input', e => {
      durum.kelimeler = normal(e.target.value).split(/\s+/).filter(Boolean);
      suz(false);
    });
  }

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
