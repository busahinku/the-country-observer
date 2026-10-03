#!/bin/sh
# Siteyi derler ve yayin/ klasörünü gh-pages dalına gönderir (GitHub Pages bu daldan yayınlar).
set -e
cd "$(dirname "$0")"
ADRES=$(git remote get-url origin)
node derle.mjs
cd yayin
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name || echo yayin)" -c user.email="$(git -C .. config user.email || echo yayin@localhost)" commit -qm "Yayın: $(date '+%Y-%m-%d %H:%M')"
git push -qf "$ADRES" gh-pages
rm -rf .git
echo "Yayınlandı: https://busahinku.github.io/the-country-observer/"
