#!/bin/sh
# Derlenmiş gazeteyi GitHub Pages'e gönderir.
set -eu
cd "$(dirname "$0")"
if [ "${1:-}" = "--alan-adi" ]; then
  if [ -z "${2:-}" ]; then
    echo 'Kullanım: sh yayinla.sh --alan-adi haber.busahin.com' >&2
    exit 1
  fi
  node --input-type=module - "$2" <<'JS'
import { writeFile } from 'node:fs/promises';
const alan = process.argv[2];
if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(alan)) throw new Error('Geçerli bir alan adı girin.');
await writeFile('yayin-ayarlari.json', JSON.stringify({site_adresi:`https://${alan}`,taban_yol:'',ozel_alan_adi:alan}, null, 2)+'\n');
JS
fi
ADRES=$(git remote get-url origin)
node derle.mjs
GECICI=$(mktemp -d "${TMPDIR:-/tmp/}observer-yayin.XXXXXX")
trap 'rm -rf "$GECICI"' EXIT HUP INT TERM
cp -R yayin/. "$GECICI/"
ALAN=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("yayin-ayarlari.json","utf8")).ozel_alan_adi || "")')
if [ -n "$ALAN" ]; then
  gh api --method PUT repos/busahinku/the-country-observer/pages -f cname="$ALAN" >/dev/null
fi
YAYIN_ADRESI=$(node --input-type=module -e 'import fs from "node:fs"; const a=JSON.parse(fs.readFileSync("yayin-ayarlari.json","utf8"));console.log(a.site_adresi+a.taban_yol+"/")')
YAZAR=$(git config user.name || echo yayin)
EPOSTA=$(git config user.email || echo yayin@localhost)
cd "$GECICI"
git init -q -b gh-pages
git add -A
git -c user.name="$YAZAR" -c user.email="$EPOSTA" commit -qm "Yayın: $(date '+%Y-%m-%d %H:%M')"
git push -qf "$ADRES" gh-pages
echo "Yayın gönderildi: $YAYIN_ADRESI"
