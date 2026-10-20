// Recuperação única do perfil travado confirmado no diagnóstico; não apaga autenticação.
const fs=require('node:fs'),path=require('node:path');
const APP='/root/wolf-whatsapp',CANAL=154,WS='abcfinan';
function caminhos(raiz){
 const auth=path.resolve(raiz,'.wwebjs_auth'),perfil=path.resolve(auth,'session-canal_'+CANAL);
 if(path.dirname(perfil)!==auth||path.basename(perfil)!=='session-canal_154')throw Error('Perfil fora do escopo');
 if(fs.existsSync(perfil)&&fs.realpathSync(perfil)!==perfil)throw Error('Perfil usa link simbólico; recuperação interrompida');
 return{auth,perfil,backup:path.join(auth,'session-canal_154.backup-'+Date.now())};
}
async function main(){
 require(require.resolve('dotenv',{paths:[APP]})).config({path:path.join(APP,'.env'),quiet:true});
 const segredo=process.env.WOLF_INTERNAL_API_SECRET||process.env.WOLF_SIGNATURE_PROXY_SECRET||'';
 const porta=String(process.env.PORT||3001);if(!/^\d{2,5}$/.test(porta))throw Error('Porta inválida');
 const base='http://127.0.0.1:'+porta,headers={'Content-Type':'application/json','x-wolf-internal-secret':segredo};
 async function api(rota,body){const r=await fetch(base+rota,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j;}
 const rota='/qr-data?canalId='+CANAL+'&workspaceId='+WS;
 const atual=await api(rota);if(atual.status==='conectado'){console.log('Canal 154 já conectado; nada alterado.');return;}if(atual.qr){console.log('QR do canal 154 já disponível; abra Conexões. Nada alterado.');return;}
 const {perfil,backup,auth}=caminhos(APP);
 if(!fs.existsSync(perfil))throw Error('Perfil antigo não encontrado; nenhuma alteração feita');
 if(path.dirname(backup)!==auth||fs.existsSync(backup))throw Error('Destino de backup inválido');
 // O helper instalado verifica --user-data-dir EXATO no /proc antes de encerrar qualquer PID.
 await require(path.join(APP,'src/services/webjs-perfil.js')).liberarPerfilWebjs(CANAL);
 fs.renameSync(perfil,backup);
 console.log('Sessão antiga preservada em '+backup);
 const inicio=await api('/resetar',{canalId:CANAL,workspaceId:WS});
 if(inicio.success===false)throw Error(inicio.error||'Não iniciou novo login');
 console.log('Novo login iniciado somente no canal 154.');
 for(let i=0;i<24;i++){
  await new Promise(resolve=>setTimeout(resolve,5000));const s=await api(rota);
  if(s.qr){console.log('QR_154_GERADO: abra o QR do canal 154 no sistema e faça a leitura.');return;}
  if(s.status==='conectado'){console.log('CANAL_154_CONECTADO');return;}
  if(s.erro)throw Error(s.erro);
  if(i%3===0)console.log('Canal 154: '+s.status+'; aguardando QR...');
 }
 throw Error('Novo perfil não gerou QR em 120 segundos. Backup preservado; não repetir automaticamente.');
}
module.exports={caminhos};if(require.main===module)main().catch(e=>{console.error('RECUPERACAO_154: '+e.message);process.exitCode=1});
