#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/patch.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/test.cjs"
node "$PACOTE/patch.cjs" "$APP"
pm2 restart wolf-whatsapp
echo 'QR sequencial instalado: encerra e libera o perfil antes do novo navegador.'
