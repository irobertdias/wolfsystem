#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/patch.cjs" "$APP" --check
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/test.cjs" "$PACOTE/documentos/flexivel.test.cjs"
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --apply
node "$PACOTE/patch.cjs" "$APP"
pm2 restart wolf-whatsapp
echo 'QR sequencial e documentos sem comparação de nome instalados. Uma única reinicialização.'
