const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const id=Number(process.argv[2]),proposta=Number(process.argv[3]);if(!Number.isSafeInteger(id)||!Number.isSafeInteger(proposta))throw Error('Sessão/venda inválida');
 const d=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:s,error}=await d.from('fluxo_sessoes').select('*').eq('workspace_id','grupoprime').eq('id',id).single();if(error)throw error;
 const{data:v}=await d.from('proposta').select('*').eq('workspace_id','grupoprime').eq('id',proposta).single();
 if(!v||v.status_venda!=='CPF REPROVADO'||s.status!=='ativo'||String(v.canal_id)!==String(s.canal_id)||String(s.variaveis.proposta_id)!==String(v.id))throw Error('Sessão não corresponde ao pedido reprovado');
 if(!['prime_vendedor','prime_cadastro_ia','prime_endereco_ia'].includes(s.no_atual))throw Error('Atendimento já está em outra etapa');
 const vars={...s.variaveis};if(vars.cpf_novo&&vars.cpf_novo!==v.cpf)throw Error('Existe novo CPF coletado: preservado para revisão');
 const{data:f}=await d.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',27).single();const no=f.nos.find(n=>n.id==='prime_reversao_ia');if(!no)throw Error('Etapa de recuperação ausente');
 const novos=['cpf_novo','nome_novo_titular','nascimento_novo_titular','nome_mae_novo_titular','autorizacao_novo_titular','recuperacao_payload','recuperacao_resposta'];
 vars.recuperacao_retomada_auditoria=JSON.stringify({em:new Date().toISOString(),etapa_anterior:s.no_atual,campos_anteriores:Object.fromEntries(novos.filter(k=>vars[k]!=null).map(k=>[k,vars[k]])),motivo:'Resposta ao retorno BKO entrou na venda inicial indevidamente'});
 for(const k of novos)delete vars[k];for(const k of ['cpf','nome','nome_mae','data_nascimento'])vars[k]=String(v[k]||'');vars.cpf_reprovado=v.cpf;
 delete vars.__fluxo_ia_prime_reversao_documentos_ia;
 vars.__fluxo_ia_prime_reversao_ia=JSON.stringify({mensagem_inicial_enviada:true,aguardando_confirmacao:false,valores_coletados:{},historico:[{role:'assistant',content:no.dados.mensagem_inicial}]});
 const r=await d.from('fluxo_sessoes').update({variaveis:vars,no_atual:no.id,aguardando_input:true,tipo_input_aguardado:'fluxo_ia',updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',id).eq('updated_at',s.updated_at).select('id');if(r.error||!r.data.length)throw Error(r.error?.message||'Sessão mudou; nada sobrescrito');
 console.log('Etapa de recuperação restaurada sem enviar nova mensagem nem alterar a venda.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
