#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
command -v node >/dev/null
command -v pm2 >/dev/null
node "$PACOTE/auditoria/composicao.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/test.cjs" "$PACOTE/ciclo.test.cjs" "$PACOTE/auditoria/test.cjs" "$PACOTE/prime/prime-cadastro/test.cjs" "$PACOTE/prime/prime-documentos/test.cjs" "$PACOTE/prime/prime-atendimento/test.cjs"
if ! node -e 'require(process.argv[1]).selecionar()' "$PACOTE/browser.cjs"; then
  if [[ "$(dpkg --print-architecture)" != amd64 ]]; then
    echo 'Arquitetura não suportada por este instalador de Chrome; código preservado.' >&2
    exit 1
  fi
  DEB="$(mktemp /tmp/wolf-chrome-XXXXXX.deb)"
  trap 'rm -f -- "$DEB"' EXIT
  curl --fail --location --proto '=https' --tlsv1.2 --retry 2 --max-time 240 \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o "$DEB"
  [[ "$(dpkg-deb -f "$DEB" Package)" == google-chrome-stable ]]
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$DEB"
fi
# Perfil temporário próprio: não abre nem apaga os logins dos canais.
node "$PACOTE/smoke.cjs" "$APP"
node "$PACOTE/auditoria/composicao.cjs" "$APP" --apply
pm2 restart wolf-whatsapp
echo 'Pacote aplicado. Confira o canal 154; a leitura real do QR ainda deve ser validada.'
pm2 logs wolf-whatsapp --lines 35 --nostream
