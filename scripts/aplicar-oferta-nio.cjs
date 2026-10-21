const {createClient}=require('@supabase/supabase-js'),{randomUUID}=require('node:crypto');
(async()=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:f,error}=await db.from('fluxos').select('nos').eq('id',27).eq('workspace_id','grupoprime').single();if(error)throw error;
 const n=f.nos.find(n=>n.id==='prime_vendedor'),i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar');
 if(!n||i<0||!n.dados.consultas?.some(c=>c.url.includes('/api/viabilidade/grupoprime?')))throw Error('Fluxo não é o Nio esperado');
 const versao=f.nos[i].dados.bko_versao;
 n.dados.perfil_vendedor='nio-v1';
 const regra='SEQUÊNCIA COMERCIAL NIO V3: O cliente que enviar CPF numérico está enviando um documento, nunca um endereço IP. Preserve o CPF para o cadastro. Não peça CPF numérico ou endereço antes de apresentar o catálogo e receber a escolha do plano. Mensagens espontâneas de endereço não são escolha de plano. Após CPF/PF ou CNPJ/PJ envie a lista completa, nunca apenas uma frase anunciando a lista. Nunca confirme ou avance sem plano válido escolhido pelo cliente.';
 if(!n.dados.prompt.includes('SEQUÊNCIA COMERCIAL NIO V3:'))n.dados.prompt=regra+'\n\n'+n.dados.prompt;
 f.nos[i].dados.bko_versao=randomUUID();
 let q=db.from('fluxos').update({nos:f.nos}).eq('id',27).eq('workspace_id','grupoprime');
 q=versao?q.eq(`nos->${i}->dados->>bko_versao`,versao):q.is(`nos->${i}->dados->>bko_versao`,null);
 const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Conflito: nenhuma configuração sobrescrita');
 console.log('NIO_OFERTA_CONFIG_OK: roteiro e identificação atualizados; canal, ativação e BKO preservados.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
