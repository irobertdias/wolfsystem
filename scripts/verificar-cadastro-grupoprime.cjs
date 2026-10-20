// Duas chamadas sintéticas à IA configurada. Não envia WhatsApp nem grava cadastro.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:fluxo,error}=await db.from('fluxos').select('nos,ativo').eq('workspace_id','grupoprime').eq('id',27).single();
 if(error)throw Error('Não foi possível consultar a configuração');
 const d=fluxo.nos.find(n=>n.id==='prime_cadastro_ia')?.dados;
 assert.ok(d,'Etapa de cadastro ausente');
 const backend=fs.readFileSync((process.env.WOLF_BACKEND_PATH||'D:/GERAL/wolf-whatsapp')+'/src/routes/fluxos.js','utf8');
 const inicio=backend.indexOf('  const prompt = [',backend.indexOf('async function executarFluxoPorIA(')),finalizador='].join("\\n");',fim=backend.indexOf(finalizador,inicio);
 assert.ok(inicio>=0&&fim>inicio);
 const construir=new Function('dados','variaveis','campos','valoresAtuais','camposPendentesAtuais','validacoesDeterministicas','estadoAtual','substituirVariaveis',backend.slice(inicio,fim+finalizador.length)+'return prompt;');
 const vars={nome:'Pessoa Teste',cpf:'52998224725',nome_mae:'Mae Pessoa Teste',data_nascimento:'01/01/1990',endereco_completo:'Rua Teste 10, Centro, Goiânia GO',endereco_proposto:'Rua Teste 10, Centro, Goiânia GO',cep:'74480150',telefone1:'62999990001',telefone2:'6233330002',vencimento:'31',forma_pagamento:'CARTAO'};
 async function turno(entrada,estado,historico=[]){
  const pendentes=d.variaveis.filter(c=>c.obrigatoria&&!vars[c.nome]).map(c=>c.label);
  const prompt=construir(d,vars,d.variaveis,vars,pendentes,[],estado,s=>s.replace(/\{\{(\w+)\}\}/g,(_m,k)=>vars[k]||''));
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+d.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:d.modelo,messages:[{role:'system',content:prompt},...historico,{role:'user',content:entrada}],response_format:{type:'json_object'},max_tokens:700})});
  if(!r.ok)throw Error('Verificação IA retornou HTTP '+r.status);
  const body=await r.json();return JSON.parse(body.choices[0].message.content);
 }
 const pendente=await turno('Podemos continuar?',{});
 assert.match(pendente.mensagem,/e-?mail/i);
 assert.doesNotMatch(pendente.mensagem,/envie.*(?:RG|documento|comprovante)/i);
 vars.email='teste@example.com';
 const resumo='Confira os dados:\n\n'+d.variaveis.map(c=>c.label+': '+vars[c.nome]).join('\n')+'\n\nEstá tudo certo? Responda sim para confirmar ou informe o que deseja corrigir.';
 const correcao=await turno('O e-mail está errado. Corrija para corrigido@example.com.',{aguardando_confirmacao:true},[{role:'assistant',content:resumo}]);
 assert.equal(correcao.dados.email,'corrigido@example.com');assert.equal(correcao.cliente_confirmou,false);
 assert.doesNotMatch(correcao.mensagem,/envie.*(?:RG|documento|comprovante)/i);
 console.log(JSON.stringify({solicita_dado_faltante:true,corrige_email:true,exige_nova_confirmacao:true,sem_envio_whatsapp:true,ativo_preservado:fluxo.ativo}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
