#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/instalar-flexivel.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/flexivel.test.cjs"
node "$PACOTE/instalar-flexivel.cjs" "$APP" --apply
pm2 restart wolf-whatsapp
echo 'Captura documental atualizada. Não remove sessões, documentos ou configurações.'
