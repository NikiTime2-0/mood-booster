#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p cloudflare/assets
cp index.html app.js texte.js style.css doll.js doll.css cat.js cat.css penguin.png apple-touch-icon.png knit-firetruck.png knit-police.png knit-bee.png knit-cat.png fluffy-cat.png cloudflare/assets/
cp server/admin.html server/admin.js cloudflare/assets/
