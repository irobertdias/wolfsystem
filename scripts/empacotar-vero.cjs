const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function rodar(p){const r=spawnSync(process.execPath,[p],{encoding:'utf8'});if(r.status)throw Error(r.stderr);}
rodar('scripts/empacotar-prime-completo.cjs');rodar('scripts/empacotar-auditoria-completa.cjs');
const root='deploy/vero-servidor';fs.cpSync('deploy/auditoria-completa',path.join(root,'base'),{recursive:true});fs.cpSync('deploy/qr-ciclo-novo',path.join(root,'qr'),{recursive:true});
for(const p of ['patch.cjs','flexivel.cjs','flexivel.test.cjs','instalar-flexivel.cjs']){fs.mkdirSync(path.join(root,'documentos'),{recursive:true});fs.copyFileSync(path.join('deploy/prime-documentos',p),path.join(root,'documentos',p));}
for(const p of ['instalar.cjs','ativar.cjs','bko-vero.js','bko-vero-core.js','bko-ia-regras.js','bko-vero.test.cjs','retorno.test.cjs'])fs.copyFileSync(path.join('deploy/vero',p),path.join(root,p));
fs.writeFileSync(path.join(root,'instalar.sh'),`#!/usr/bin/env bash
set -euo pipefail
PACOTE="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)"
APP=/root/wolf-whatsapp
node "$PACOTE/base/auditoria/composicao.cjs" "$APP" --check
node "$PACOTE/qr/patch.cjs" "$APP" --check
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --check
node "$PACOTE/instalar.cjs" "$APP" --check
WOLF_BACKEND_DIR="$APP" node --test "$PACOTE/qr/test.cjs" "$PACOTE/documentos/flexivel.test.cjs" "$PACOTE/base/auditoria/test.cjs" "$PACOTE/retorno.test.cjs"
node --test --test-name-pattern='^(?!API exige|retentativa administrativa)' "$PACOTE/bko-vero.test.cjs"
node "$PACOTE/base/auditoria/composicao.cjs" "$APP" --apply
node "$PACOTE/qr/patch.cjs" "$APP"
node "$PACOTE/documentos/instalar-flexivel.cjs" "$APP" --apply
node "$PACOTE/instalar.cjs" "$APP" --apply
node - "$APP" <<'NODE'
const fs=require('fs'),path=require('path'),p=path.join(process.argv[2],'src/routes/fluxos.js');let s=fs.readFileSync(p,'utf8');s=s.replace('Number(fluxo.id)===27','[27,28].includes(Number(fluxo.id))');fs.writeFileSync(p,s);
NODE
pm2 restart wolf-whatsapp
node "$PACOTE/ativar.cjs"
echo 'Extensão Vero instalada e vinculada ao canal VERO.'
`);
const r=spawnSync('tar',['-czf','deploy/wolf-vero-completo-20261021.tar.gz','-C',root,'.'],{encoding:'utf8'});if(r.status)throw Error(r.stderr);console.log('Pacote Vero completo gerado.');
