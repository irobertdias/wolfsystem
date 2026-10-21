const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root='deploy/qr-documentos';fs.cpSync('deploy/qr-ciclo-novo',root,{recursive:true});fs.mkdirSync(path.join(root,'documentos'),{recursive:true});
for(const p of ['patch.cjs','flexivel.cjs','flexivel.test.cjs','instalar-flexivel.cjs'])fs.copyFileSync(path.join('deploy/prime-documentos',p),path.join(root,'documentos',p));
fs.writeFileSync(path.join(root,'instalar.sh'),`#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/patch.cjs" "$APP" --check
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/test.cjs" "$PACOTE/documentos/flexivel.test.cjs"
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --apply
node "$PACOTE/patch.cjs" "$APP"
pm2 restart wolf-whatsapp
echo 'QR sequencial e documentos sem comparação de nome instalados. Uma única reinicialização.'
`);
const r=spawnSync('tar',['-czf','deploy/wolf-qr-documentos-20261020.tar.gz','-C',root,'.'],{encoding:'utf8'});if(r.status)throw Error(r.stderr);console.log('Pacote QR + documentos gerado.');
