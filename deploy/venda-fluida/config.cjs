const{randomUUID}=require('node:crypto');
const POLITICA=`VENDEDORA NIO/VERO — FLUXO FLUIDO V1:
Atenda como uma vendedora: entenda a intenção, responda às dúvidas com os dados reais da oferta e facilite uma próxima ação. Sequência normal: CEP → consulta → mostrar planos disponíveis e preços → escolha → coleta → documentos → CRM → WhatsApp do BKO. Não condicione mostrar planos à pergunta CPF/CNPJ. No Nio identifique claramente as ofertas CPF e CNPJ; na Vero use a tabela retornada para o município.
Use o telefone real da conversa e os dados já informados para propor interpretações. Confirme a sugestão concreta antes de salvar; não invente dígitos, CPF, endereço ou nome. O nome de exibição do WhatsApp é uma sugestão de nome, nunca prova do nome do titular. CPF deve ser conferido pelo código; isso não significa aprovação cadastral da operadora.
Peça uma informação por vez, aproveitando respostas espontâneas. Se não souber, não tiver ou não conseguir corrigir, anote a pendência para o BKO e avance. Nunca repita indefinidamente a mesma exigência. O resumo precisa deixar claras as pendências, sem afirmar que dados ausentes foram validados.
Condução comercial: em dúvida, preço ou hesitação, entenda o motivo e ofereça uma alternativa real, uma vez, sem repetir catálogo ou formulário. “Está caro”, “vou pensar” ou “muito enrolado” não são comandos de reinício. Na primeira desistência ambígua, tente descobrir o motivo e ajudar; nunca reinicie o cadastro. Pedido claro de não receber mensagens, comando de encerrar ou recusa reiterada encerra a abordagem e cancela os lembretes.
Documentos: receba os anexos originais e siga. Nome, CEP, tipo de comprovante ou leitura automática inconclusiva não bloqueiam a venda; registre o que o BKO precisa conferir. Nunca diga que recebeu um arquivo que não foi armazenado. Quando algum anexo não estiver disponível, registre a ausência e siga com os recebidos. Não prometa aprovação ou instalação; o BKO fará a conferência. Venda registrada no CRM não significa mensagem de WhatsApp entregue; respeite a confirmação real do envio.`;
function configurar(f){
 if(f.workspace_id!=='grupoprime'||![27,28].includes(Number(f.id)))throw Error('Fluxo fora do escopo');const novo=JSON.parse(JSON.stringify(f)),vero=Number(f.id)===28;
 const get=id=>{const n=novo.nos.find(n=>n.id===id);if(!n)throw Error('Nó não encontrado: '+id);return n;};
 for(const n of novo.nos)if(n.tipo==='fluxo_ia'){
  n.dados.venda_fluida_v1=true;n.dados.limite_recusas=0;
  if(!String(n.dados.prompt).includes('FLUXO FLUIDO V1:'))n.dados.prompt=POLITICA+'\n\n'+n.dados.prompt;
 }
 const vendedor=get('prime_vendedor');vendedor.dados.variaveis=vendedor.dados.variaveis.map(c=>({...c,obrigatoria:c.nome==='tipo_pessoa'?false:c.obrigatoria}));
 const cadastro=get('prime_cadastro_ia');if(vero&&!cadastro.dados.variaveis.some(c=>c.nome==='tipo_pessoa'))cadastro.dados.variaveis.push({nome:'tipo_pessoa',tipo:'publico',label:'contratação em CPF ou CNPJ',obrigatoria:true});
 get('prime_cadastro_confirmado').dados.codigo=`setVariable('cadastro_encaminhavel','SIM');setVariable('cadastro_confirmado',JSON.stringify(Object.fromEntries(${JSON.stringify(cadastro.dados.variaveis.map(c=>c.nome))}.map(k=>[k,variaveis[k]||'']))));setVariable('venda_fluida_v1','SIM');return true;`;
 get('prime_cadastro_liberado').dados.variavel='cadastro_encaminhavel';
 const conferir=get('prime_documentos_conferir');conferir.dados.url=String(conferir.dados.url).replace(/\/validar-documentos(?:-vero)?$/,'/preparar-bko');conferir.dados.body=JSON.stringify({numero:'{{numero}}',operadora:vero?'Vero':'Nio'});
 get('prime_documentos_cadastro').dados.codigo=`const r=JSON.parse(variaveis.documentos_verificados||'{}');if(!r.success||!r.sessao_id)throw Error('Preparação do BKO não confirmada');for(const k of ['rg_frente','rg_verso','comprovante_endereco']){delete variaveis[k];delete variaveis[k+'_validado'];}for(const[k,v]of Object.entries(r.cadastro))setVariable(k,String(v??''));for(const[k,v]of Object.entries(r.documentos))setVariable(k,JSON.stringify(v));setVariable('sessao_origem_id',String(r.sessao_id));setVariable('bko_pendente','SIM');return true;`;
 const enviar=get('prime_documentos_enviar');enviar.dados.venda_fluida_v1=true;enviar.dados.etiqueta='PEDIDO ENCAMINHADO AO BKO';enviar.dados.mensagem_sucesso='Seu pedido foi registrado. A equipe vai conferir os dados e documentos e confirmar os próximos passos por aqui.';enviar.dados.bko_versao=randomUUID();
 // Recuperação mantém a mesma proposta e usa a nova preparação com pendências.
 const reversao=get('prime_reversao_atualizar');reversao.dados.url=String(reversao.dados.url).replace(/\/recuperar-cpf(?:-vero)?$/,'/preparar-bko');reversao.dados.headers=conferir.dados.headers;reversao.dados.body=JSON.stringify({numero:'{{numero}}',operadora:vero?'Vero':'Nio',proposta_id:'{{proposta_id}}'});reversao.dados.variavel_resposta='recuperacao_resposta';
 for(const e of novo.conexoes)if(e.de==='prime_reversao_documentos_ia'&&e.saidaIndex===0)e.para='prime_reversao_atualizar';
 return novo;
}
module.exports={configurar,POLITICA};
