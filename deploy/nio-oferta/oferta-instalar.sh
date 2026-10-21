#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/oferta-patch.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/oferta.test.cjs"
node "$PACOTE/oferta-patch.cjs" "$APP" --apply
pm2 restart wolf-whatsapp
echo 'Nio: consulta positiva pergunta CPF/CNPJ; resposta envia catálogo completo; escolha avança ao endereço.'
