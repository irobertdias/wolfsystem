'use strict';
const ORDEM='ORDEM COMERCIAL V3: CEP → disponibilidade → CPF ou CNPJ → ofertas do público → plano → endereço completo → nome → CPF → nascimento → e-mail → confirmar endereço → contato → vencimento → boleto ou débito em conta → preferência de instalação → resumo com emojis → confirmação → RG frente → RG verso → comprovante ou observação de ausência → CRM → WhatsApp.';
function configurarComercial(f){
 if(f.workspace_id!=='grupoprime'||![27,28].includes(Number(f.id)))throw Error('Fluxo fora do escopo');
 const r=JSON.parse(JSON.stringify(f));
 for(const n of r.nos.filter(n=>n.tipo==='fluxo_ia')){
  const d=n.dados;
  const etapa=/documento/.test(n.id)?'os documentos que você tiver para o pedido':/cadastro|reversao_ia/.test(n.id)?'os dados que faltam para o pedido':/endereco/.test(n.id)?'o endereço da instalação':'a escolha do seu plano';
  const mensagens=[
   `Podemos continuar com ${etapa}? Estou por aqui para ajudar.`,
   `Ficou alguma dúvida sobre ${etapa}? Pode me contar.`,
   'Se alguma informação estiver difícil de encontrar, me avise. Vamos aproveitar o que você já enviou.',
   'O que falta para seguirmos: esclarecer alguma condição ou ajudar com o cadastro?',
   'Se a dúvida for sobre valores, posso explicar as opções disponíveis para você.',
   'Não precisa começar tudo de novo. Podemos retomar do ponto em que paramos.',
   `Você ainda tem interesse em seguir com o pedido? Posso ajudar com ${etapa}.`,
   'Se agora não for um bom momento, diga um horário melhor para conversarmos.',
   'Estou fazendo nosso penúltimo contato sem retorno. Quer continuar ou prefere encerrar por enquanto?',
   'Como não tive retorno, vou encerrar este atendimento por enquanto. Se precisar, é só chamar.'
  ];
  const anteriores=Array.isArray(d.reengajamento_lembretes)?d.reengajamento_lembretes:[];
  const intervalo=Number(anteriores.at(-1)?.minutos)||20;
  d.reengajamento_ativo=true;d.reengajamento_lembretes=mensagens.map((mensagem,i)=>({minutos:Number(anteriores[i]?.minutos)||intervalo,mensagem}));
  d.reengajamento_finalizar_automatico=true;d.reengajamento_finalizar_apos_minutos=1;
  d.publico_apos_plano_v1=false;d.roteiro_vendas_v3=true;
 }
 const n=r.nos.find(n=>n.id==='prime_vendedor');if(!n)throw Error('Vendedor ausente');
 const politica=ORDEM+'\nVocê é a vendedora virtual da Grupo Prime, parceira '+(Number(f.id)===28?'Vero':'Nio')+'. Responda à intenção real do cliente, com uma pergunta por vez. Mostre somente o catálogo oficial do público escolhido, nunca CPF e CNPJ misturados. Explique que as ofertas e condições podem variar entre pessoa física e empresa. Não peça CPF, endereço ou documentos antes de escolher o plano. Cidade e UF vêm da consulta do CEP; não peça novamente se já estiverem confirmadas. Não invente preços, benefícios, descontos, aprovação ou data de instalação.\nObjeções sobre preço, anúncio ou outro plano exigem uma resposta ao motivo, não o reenvio automático do catálogo. Explique quando uma oferta não estiver disponível na cidade/público, compare apenas vantagens reais dos planos disponíveis e proponha uma alternativa pertinente. Não despreze a propaganda: pode haver condições, região ou vigência diferentes que precisam ser conferidas. Recupere hesitação sem reiniciar o cadastro nem apagar dados. Pedido explícito para encerrar ou parar mensagens deve ser respeitado.\nColete apenas o campo pendente da etapa atual. Aceite datas em qualquer formato reconhecível e normalize. Confira dígitos do CPF sem loop de cobrança; dúvida ou dado não resolvido vira observação para o BKO. Contatos repetidos são permitidos. Pagamento: boleto ou débito em conta. Horário é preferência, sujeita à agenda. Depois do resumo com emojis e confirmação, peça os documentos um por vez. Na frente do RG só confira se é o lado com a foto; não compare nome, CPF ou número do RG extraídos da imagem. Qualquer comprovante em imagem ou PDF serve, inclusive de terceiros. Sem comprovante, registre Cliente não tem comprovante de endereço e continue para CRM e WhatsApp. Nunca diga que salvou um arquivo ou enviou uma venda sem retorno real do sistema.';
 n.dados.prompt=politica;
 n.dados.variaveis=n.dados.variaveis.map(v=>({...v,obrigatoria:['cep','tipo_pessoa','plano_interesse'].includes(v.nome)}));
 const cadastro=r.nos.find(n=>n.id==='prime_cadastro_ia');
 if(cadastro){cadastro.dados.prompt=politica+'\nEtapa atual: cadastro. Siga a ordem definida sem pedir nome da mãe. Aproveite o endereço já recebido. Não peça documentos antes do resumo e da confirmação.';cadastro.dados.roteiro_vendas_v3=true;cadastro.dados.variaveis=[['nome','nome','Nome completo'],['cpf','cpf','CPF do titular ou representante legal'],['data_nascimento','data','Data de nascimento'],['email','email','E-mail'],['endereco_confirmado','texto','Confirmação do endereço recebido'],['telefone1','telefone','Telefone de contato'],['vencimento','texto','Vencimento da fatura'],['forma_pagamento','texto','Boleto ou débito em conta'],['periodo_instalacao','texto','Preferência de horário de instalação']].map(([nome,tipo,label])=>({nome,tipo,label,obrigatoria:true}));}
 const end=r.nos.find(n=>n.id==='prime_endereco_ia');if(end){end.dados.prompt=politica+'\nEtapa atual: receber o endereço completo. Aproveite a cidade e UF confirmadas pelo CEP. Depois avise que começará o cadastro.';end.dados.roteiro_vendas_v3=true;}
 const preparar=r.nos.find(n=>n.id==='prime_cadastro_preparar');if(preparar)preparar.dados.codigo="delete variaveis.cadastro_confirmado;delete variaveis.cadastro_encaminhavel;delete variaveis.endereco_confirmado;setVariable('endereco_completo',variaveis.endereco_completo||variaveis.endereco_proposto||'');setVariable('endereco_proposto',variaveis.endereco_completo||variaveis.endereco_proposto||'');return true;";
 const confirmado=r.nos.find(n=>n.id==='prime_cadastro_confirmado');if(confirmado&&cadastro)confirmado.dados.codigo="setVariable('cadastro_encaminhavel','SIM');setVariable('cadastro_confirmado',JSON.stringify(Object.fromEntries("+JSON.stringify(cadastro.dados.variaveis.map(v=>v.nome))+".map(k=>[k,variaveis[k]||'']))));setVariable('venda_fluida_v1','SIM');return true;";
 const documentosCadastro=r.nos.find(n=>n.id==='prime_documentos_cadastro');if(documentosCadastro&&!documentosCadastro.dados.codigo.includes('preferencia_instalacao'))documentosCadastro.dados.codigo="if(variaveis.roteiro_vendas_v3==='SIM'){setVariable('preferencia_instalacao',variaveis.periodo_instalacao||'');delete variaveis.periodo_instalacao;}"+documentosCadastro.dados.codigo;
 for(const doc of r.nos.filter(n=>['prime_documentos_ia','prime_reversao_documentos_ia'].includes(n.id))){doc.dados.prompt=politica+'\nEtapa atual: documentos. Frente do RG é o lado com o retrato da pessoa; verso é o outro lado. Se vierem invertidos, salve no lado reconhecido e peça só o que falta. Sem comprovante, registre a ausência e continue.';for(const regra of doc.dados.arquivos_salvar_regras||[])if(regra.variavel==='rg_frente')regra.descricao='Frente da identidade: lado com o retrato/foto da pessoa. Não comparar nome nem exigir leitura de CPF ou número do RG.';}
 if(!n.dados.variaveis.some(v=>v.nome==='cidade'))n.dados.variaveis.push({nome:'cidade',tipo:'texto',label:'Cidade confirmada entre as candidatas do CEP',obrigatoria:false});
 const consulta=n.dados.consultas?.find(c=>c.id==='prime_viabilidade');
 if(Number(f.id)===27&&consulta&&!n.dados.consultas.some(c=>c.id==='prime_viabilidade_cidade'))n.dados.consultas.push({...consulta,id:'prime_viabilidade_cidade',nome:'Disponibilidade na cidade confirmada',variavel_gatilho:'cidade',obrigatoria:false,url:consulta.url+(consulta.url.includes('?')?'&':'?')+'cidade={{cidade}}'});
 return r;
}
module.exports={configurarComercial,ORDEM};
