"""Haberlerin tamamını Türkçe sinirsel sesle okur; değişmeyen kayıtları yeniden üretmez.
Kurulum: python3 -m venv .onbellek/ses-ortami
.onbellek/ses-ortami/bin/pip install edge-tts
Çalıştırma: .onbellek/ses-ortami/bin/python araclar/seslendir.py
"""
import asyncio
import hashlib
import json
import re
from pathlib import Path
import edge_tts

SES = 'tr-TR-EmelNeural'
HEDEF = Path('statik/sesler')
KAYIT = Path('.onbellek/ses-kayitlari.json')

async def seslendir():
    HEDEF.mkdir(parents=True, exist_ok=True)
    kayitlar = json.loads(KAYIT.read_text()) if KAYIT.exists() else {}
    sira = asyncio.Semaphore(3)
    hatalar = []

    async def hazirla(dosya):
        belge = dosya.read_text()
        _, bilgi, govde = belge.split('---', 2)
        baslik = re.search(r'^baslik: (.+)$', bilgi, re.M).group(1)
        govde = re.sub(r'^## +', '', govde, flags=re.M)
        govde = re.sub(r'^[->] +', '', govde, flags=re.M)
        govde = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', govde).replace('*', '')
        metin = f'{baslik}.\n\n{govde.strip()}'
        ozet = hashlib.sha256((SES + metin + '-8%').encode()).hexdigest()
        hedef = HEDEF / f'{dosya.stem}.mp3'
        if kayitlar.get(dosya.stem) == ozet and hedef.exists():
            return
        async with sira:
            for deneme in range(3):
                gecici = hedef.with_suffix('.gecici.mp3')
                try:
                    await edge_tts.Communicate(metin, SES, rate='-8%').save(str(gecici))
                    if gecici.stat().st_size < 1000:
                        raise ValueError('Eksik ses kaydı')
                    gecici.replace(hedef)
                    kayitlar[dosya.stem] = ozet
                    KAYIT.write_text(json.dumps(kayitlar, ensure_ascii=False, indent=2))
                    print(f'Ses hazır: {dosya.stem}', flush=True)
                    return
                except Exception as hata:
                    gecici.unlink(missing_ok=True)
                    if deneme == 2:
                        hatalar.append(f'{dosya.stem}: {hata}')
                    else:
                        await asyncio.sleep(2 * (deneme + 1))

    await asyncio.gather(*(hazirla(dosya) for dosya in sorted(Path('icerik/haberler').glob('*.md'))))
    if hatalar:
        raise RuntimeError('\n'.join(hatalar))
    print(f'{len(list(HEDEF.glob("*.mp3")))} ses kaydı hazır.')

if __name__ == '__main__':
    asyncio.run(seslendir())
