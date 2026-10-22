'use strict';
const ORDEM='ORDEM COMERCIAL V2: CEP → consulta de disponibilidade → planos disponíveis → escolha do plano → perguntar CPF ou CNPJ → endereço e cadastro → documentos → CRM → WhatsApp do BKO.';
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
  d.publico_apos_plano_v1=true;
 }
 const n=r.nos.find(n=>n.id==='prime_vendedor');if(!n)throw Error('Vendedor ausente');
 n.dados.prompt=ORDEM+`\nVocê é a vendedora virtual da Grupo Prime, parceira ${Number(f.id)===28?'Vero':'Nio'}. Converse em português, com uma pergunta por vez. Use somente dados e preços da consulta oficial. Nunca invente cobertura, descontos, instalação ou aprovação cadastral.
Após o CEP, consulte resposta_viabilidade. Quando houver disponibilidade, mostre os planos imediatamente, com nome, velocidade e preço reais. Identifique CPF/CNPJ nas ofertas quando houver tabelas diferentes. Não exija que o cliente defina CPF/CNPJ antes de ver ou escolher um plano. Depois da escolha, pergunte: A contratação será no CPF ou no CNPJ? Só depois prossiga ao endereço e dados pessoais. Se o público informado exigir outra tabela, mostre os planos corretos e confirme uma nova escolha com o cliente; nunca altere o preço silenciosamente.
Se a consulta apontar cidade_ambigua, peça apenas qual das cidades candidatas corresponde ao endereço. Registre em cidade o nome canônico da cidade confirmada entre as candidatas e faça a consulta prime_viabilidade_cidade, usando o mesmo CEP. Não invente preços nem avance para CPF/CNPJ enquanto a cidade não estiver resolvida. Ao obter disponibilidade, mostre os planos na mesma interação.
Aproveite dados espontâneos sem pedir novamente; isso não muda a ordem da conversa. Responda dúvidas e objeções com alternativas reais, sem repetir a mesma pergunta. Pedido claro de encerramento ou de parar mensagens deve ser respeitado. Nome de exibição e DDD não comprovam identidade ou endereço. Nunca escolha um plano pelo cliente. Não considere agradecimento um dado incorreto. Não transfira apenas por hesitação.
tipo_pessoa aceita PF ou PJ. plano_interesse deve corresponder a um ID exato do catálogo. Não peça o número do documento antes da escolha do plano e da definição CPF/CNPJ. A venda só está registrada após confirmação real do CRM; envio e entrega de WhatsApp são estados distintos.`;
 n.dados.variaveis=n.dados.variaveis.map(v=>({...v,obrigatoria:v.nome==='tipo_pessoa'?false:v.obrigatoria}));
 if(!n.dados.variaveis.some(v=>v.nome==='cidade'))n.dados.variaveis.push({nome:'cidade',tipo:'texto',label:'Cidade confirmada entre as candidatas do CEP',obrigatoria:false});
 const consulta=n.dados.consultas?.find(c=>c.id==='prime_viabilidade');
 if(Number(f.id)===27&&consulta&&!n.dados.consultas.some(c=>c.id==='prime_viabilidade_cidade'))n.dados.consultas.push({...consulta,id:'prime_viabilidade_cidade',nome:'Disponibilidade na cidade confirmada',variavel_gatilho:'cidade',obrigatoria:false,url:consulta.url+(consulta.url.includes('?')?'&':'?')+'cidade={{cidade}}'});
 return r;
}
module.exports={configurarComercial,ORDEM};
