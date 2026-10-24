'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp'),WS='grupoprime',CANAL=165;
if(root!=='/root/wolf-whatsapp')throw Error('Raiz inesperada.');
require(root+'/node_modules/dotenv').config({path:root+'/.env',quiet:true});
const db=require(root+'/node_modules/@supabase/supabase-js').createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY);
async function obter(t,q){const r=await q(db.from(t));if(r.error)throw r.error;return r.data;}
async function main(){
 const canal=await obter('conexoes',q=>q.select('*').eq('workspace_id',WS).eq('id',CANAL).single());
 if(canal.tipo!=='webjs'||canal.status!=='conectado'||canal.fila!=='VENDAS VERO')throw Error('Canal Hélio/fila VERO precisa estar conectado.');
 const def=JSON.parse(fs.readFileSync(path.join(__dirname,'definicao-vero.json'),'utf8'));
 let fluxo=await obter('fluxos',q=>q.select('*').eq('workspace_id',WS).eq('nome',def.nome).maybeSingle());
 if(canal.modo!=='nenhum'&&String(canal.fluxo_id)!==String(fluxo?.id))throw Error('Hélio está com outra automação. Nenhuma substituição realizada.');
 if(process.argv.includes('--ativar')){
  if(!fluxo)throw Error('Crie e teste o fluxo antes de ativar.');
  const cfg=await require(root+'/src/services/universal-v1/modelo-vendas.cjs').configuracao(db,WS);
  if(!['Vero','Nio'].every(op=>cfg.contatos.some(c=>Number(c.canal_trafego_id)===CANAL&&c.operadora===op)))throw Error('Confira os destinos de Vero e Nio.');
  const r=await db.from('fluxos').update({ativo:true}).eq('workspace_id',WS).eq('id',fluxo.id);if(r.error)throw r.error;
  const resp=await fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/configurar-ia',{method:'POST',headers:{'Content-Type':'application/json','x-wolf-internal-secret':process.env.WOLF_INTERNAL_API_SECRET||process.env.WOLF_SIGNATURE_PROXY_SECRET||''},body:JSON.stringify({workspaceId:WS,canalId:CANAL,modo:'fluxo',fluxoId:fluxo.id,fila:'VENDAS VERO',ia:canal.ia,apiKey:canal.api_key,prompt:canal.prompt,modulos:canal.modulos,iaCrmAtivo:canal.ia_crm_ativo,iaCrmMapeamento:canal.ia_crm_mapeamento,iaCrmCamposObrigatorios:canal.ia_crm_campos_obrigatorios,iaAgrupamentoMs:canal.ia_agrupamento_ms})});
  const j=await resp.json();if(!resp.ok||!j.success){await db.from('fluxos').update({ativo:fluxo.ativo}).eq('workspace_id',WS).eq('id',fluxo.id);throw Error('Falha ao vincular o canal.');}
  const confirmado=await obter('conexoes',q=>q.select('id,modo,fluxo_id,fila').eq('workspace_id',WS).eq('id',CANAL).single());if(confirmado.modo!=='fluxo'||String(confirmado.fluxo_id)!==String(fluxo.id))throw Error('Vínculo não confirmado.');
  console.log(JSON.stringify({ativo:true,fluxoId:fluxo.id,canalId:CANAL,fila:confirmado.fila}));return;
 }
 const nomeCfg='__wolf_configuracao_vendas__',anterior=await obter('fluxos',q=>q.select('*').eq('workspace_id',WS).eq('nome',nomeCfg).maybeSingle());
 const legados=await obter('fluxos',q=>q.select('*').eq('workspace_id',WS).in('id',[27,28]));
 const bko=id=>legados.find(f=>f.id===id)?.nos.find(n=>n.dados?.bko_configuracao)?.dados.bko_configuracao;
 const nio=bko(27),vero=bko(28),n=nio?.contatos.find(c=>Number(c.canal_trafego_id)===164),v=vero?.contatos.find(c=>Number(c.canal_trafego_id)===CANAL);
 if(!n||!v)throw Error('BKO Nio/VERO anterior não encontrado.');
 const backup=root+'/backups/configuracao-vero-universal-'+Date.now()+'.json';fs.writeFileSync(backup,JSON.stringify({canal,fluxo,anterior,legados}),{mode:0o600});
 const cfg=structuredClone(anterior?.nos?.[0]?.dados?.bko_configuracao||nio);
 cfg.modo='por_canal';cfg.ativo=true;cfg.contatos=[...cfg.contatos.filter(c=>Number(c.canal_trafego_id)!==CANAL),{...v,operadora:'Vero',canal_envio_id:vero.canal_id},{...n,canal_trafego_id:CANAL,fila_nome:'VENDAS VERO',operadora:'Nio',canal_envio_id:nio.canal_id}];
 if(cfg.contatos.length>5)throw Error('Limite de regras BKO excedido; nenhuma regra removida.');
 const nos=[{id:'bko_workspace',tipo:'configuracao_vendas',dados:{versao:randomUUID(),bko_configuracao:cfg}}];
 const r=anterior?await db.from('fluxos').update({nos}).eq('workspace_id',WS).eq('id',anterior.id).eq('nos',JSON.stringify(anterior.nos)).select('id').single():await db.from('fluxos').insert({workspace_id:WS,nome:nomeCfg,ativo:false,trigger_tipo:'configuracao_vendas',nos,conexoes:[]}).select('id').single();if(r.error)throw r.error;
 if(!fluxo)fluxo=await obter('fluxos',q=>q.insert(def).select('*').single());
 console.log(JSON.stringify({criado:true,ativo:fluxo.ativo,fluxoId:fluxo.id,canalId:CANAL,backup,destinos:cfg.contatos.map(c=>({canal:c.canal_trafego_id,operadora:c.operadora||'geral',final:c.numero.slice(-4),remetente:c.canal_envio_id||cfg.canal_id}))}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
