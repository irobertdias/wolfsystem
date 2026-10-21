// Ativação autorizada: exclusivamente VERO/162, fila VENDAS VERO, fluxo 28.
const path=require('node:path');const APP='/root/wolf-whatsapp';
require(require.resolve('dotenv',{paths:[APP]})).config({path:path.join(APP,'.env'),quiet:true});
const {createClient}=require(require.resolve('@supabase/supabase-js',{paths:[APP]}));
(async()=>{
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
 const base='http://127.0.0.1:'+String(process.env.PORT||3001);const segredo=process.env.WOLF_INTERNAL_API_SECRET||process.env.WOLF_SIGNATURE_PROXY_SECRET;
 const headers={'Content-Type':'application/json','x-wolf-internal-secret':segredo||''};
 let pronto=false;for(let i=0;i<20;i++){try{const r=await fetch(base+'/bko/health',{headers,signal:AbortSignal.timeout(2000)});const j=await r.json();if(j.vero_fluxo===28){pronto=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!pronto)throw Error('Backend Vero não confirmou inicialização; canal preservado.');
 const {data:f,error}=await db.from('fluxos').select('id,nos,ativo').eq('workspace_id','grupoprime').eq('id',28).single();if(error)throw error;
 const vendedor=f.nos.find(n=>n.id==='prime_vendedor');if(vendedor?.dados?.perfil_vendedor!=='vero-v1')throw Error('Fluxo 28 não corresponde ao vendedor Vero');
 const consulta=vendedor.dados.consultas?.find(c=>c.id==='vero_viabilidade');const url=new URL(consulta.url.replace('{{cep}}','74480150'));if(url.origin!=='https://app.wolfgyn.com.br'||url.pathname!=='/api/viabilidade/vero')throw Error('API Vero inesperada');
 const api=await fetch(url,{headers:JSON.parse(consulta.headers),signal:AbortSignal.timeout(15000)});const resultado=await api.json();if(!api.ok||resultado.operadora!=='Vero'||resultado.status!=='pre_viavel_por_cidade'||resultado.planos?.[0]?.mensalidade!==114.99)throw Error('API Vero ainda não está publicada ou não confirmou tabela; canal preservado. Execute novamente após a publicação.');
 const {data:c,error:ec}=await db.from('conexoes').select('*').eq('workspace_id','grupoprime').eq('id',162).single();if(ec)throw ec;if(String(c.nome).trim().toUpperCase()!=='VERO'||(c.fluxo_id&&Number(c.fluxo_id)!==28))throw Error('Canal 162 foi alterado; ativação interrompida.');
 const {data:fila,error:ef}=await db.from('filas').select('id').eq('workspace_id','grupoprime').eq('nome','VENDAS VERO').single();if(ef||!fila)throw Error('Fila VENDAS VERO não encontrada');
 const config=f.nos.find(n=>n.id==='prime_documentos_enviar')?.dados?.bko_configuracao;
 if(!config?.ativo||!config.contatos?.some(x=>Number(x.canal_trafego_id)===162&&x.fila_nome==='VENDAS VERO'))throw Error('Configuração BKO Vero ausente');
 const {error:ea}=await db.from('fluxos').update({ativo:true}).eq('workspace_id','grupoprime').eq('id',28);if(ea)throw ea;
 const body={workspaceId:'grupoprime',canalId:162,modo:'fluxo',fluxoId:28,fila:'VENDAS VERO',ia:c.ia,apiKey:c.api_key||'',prompt:c.prompt||'',iaCrmAtivo:c.ia_crm_ativo,iaCrmMapeamento:c.ia_crm_mapeamento,iaCrmCamposObrigatorios:c.ia_crm_campos_obrigatorios,iaAgrupamentoMs:c.ia_agrupamento_ms};
 const r=await fetch(base+'/configurar-ia',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Não foi possível vincular canal Vero.');
 const {data:verificado,error:ev}=await db.from('conexoes').select('modo,fluxo_id,fila').eq('workspace_id','grupoprime').eq('id',162).single();if(ev||verificado.modo!=='fluxo'||Number(verificado.fluxo_id)!==28||verificado.fila!=='VENDAS VERO')throw Error('Vínculo Vero não confirmado');
 console.log('VERO_ATIVO: canal 162; fila VENDAS VERO; fluxo 28. Nenhuma alteração no canal Nio.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
