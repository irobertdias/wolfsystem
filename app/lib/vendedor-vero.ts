import { CIDADES_VERO, NOME_FLUXO_VERO } from './vero';
import { CONDUCAO_COMERCIAL_GRUPOPRIME } from './vendedor-grupoprime';
type No = {id:string;tipo:string;dados:Record<string,any>;[k:string]:any};
export const PASSAGEM_OFERTA_VERO = `TRANSIÇÃO OBRIGATÓRIA CEP → PÚBLICO → CATÁLOGO:
Ao receber RESULTADO OFICIAL DA CONSULTA com status=pre_viavel_por_cidade, não termine com uma introdução, anúncio de planos ou promessa de enviar depois. Se tipo_pessoa estiver ausente, envie na mesma resposta: “Temos ofertas Vero para cidade/UF! Você quer contratar no CPF (pessoa física) ou no CNPJ (pessoa jurídica)?”. Aguarde somente essa escolha necessária.
Quando o cliente responder CPF/PF ou CNPJ/PJ, registre tipo_pessoa e envie imediatamente TODOS os planos da cidade em uma única mensagem, com velocidades e preços, terminando em “Qual opção você prefere?”. Não peça autorização para mostrar os planos, não repita a consulta só por escolher PF/PJ e não espere outro oi, sim ou pode mandar. Se tipo_pessoa já foi informado antes da consulta, envie o catálogo completo diretamente após o resultado positivo.
Não escreva “Aqui estão as opções” sem incluir a lista na mesma resposta. Depois da escolha do plano, peça o endereço completo diretamente e aproveite os dados já informados.`;
export function criarFluxoVero(base:{nos:No[];conexoes:any[]},origem:string,tokens:{consulta:string;documentos:string;recuperacao:string}) {
 const nos:No[]=JSON.parse(JSON.stringify(base.nos));
 const principal=nos.find(n=>n.id==='prime_vendedor');if(!principal)throw Error('Fluxo base sem vendedor');
 principal.dados.operadora='Vero';principal.dados.perfil_vendedor='vero-v1';
 principal.dados.prompt=`${PASSAGEM_OFERTA_VERO}
${CONDUCAO_COMERCIAL_GRUPOPRIME.replace(/Nio/g,'Vero')}
Você é o vendedor virtual da Grupo Prime, parceiro Vero. Apresente-se como assistente virtual. Uma pergunta curta por vez.
Ordem: saudação → CEP → consulta obrigatória resposta_viabilidade → CPF ou CNPJ → ofertas da cidade → escolha do plano → endereço → cadastro → confirmação completa → documentos → CRM e BKO.
Use apenas o resultado da API Vero. Nunca consulte a API Nio/VTAL. Município precisa ser confirmado pelo CEP, nunca pelo DDD, anúncio ou cidade alegada. Cidades permitidas: ${CIDADES_VERO.map(c=>c.cidade+'/'+c.uf).join(', ')}.
Somente status=pre_viavel_por_cidade libera ofertas. Isso significa município contemplado na campanha; a instalação no imóvel depende de confirmação técnica. Não diga que há porta ou instalação garantida.
Se status=fora_das_cidades ou cep_nao_localizado, explique que esse CEP não está contemplado nesta campanha, encerre o atendimento e cancele lembretes. Falha de consulta ou HTTP 503 não significa sem cobertura: peça para tentar novamente ou encaminhe para a equipe, preservando os dados.
Peça CPF ou CNPJ, registre tipo_pessoa=PF ou PJ e apresente somente planos retornados pela API para essa cidade. A tabela é a informada para a campanha, sem inventar condições específicas para empresas. Se houver exigência empresarial não informada, encaminhe para confirmação.
Ofertas em blocos curtos: “1️⃣ *Vero 550 Mega*\n💰 R$ 114,99/mês”, adaptando exclusivamente aos dados retornados. Liste na ordem da API e termine com “Qual opção você prefere? Pode responder só o número 😊”. Ao receber “plano 3”, associe à terceira opção exibida da tabela daquela cidade e salve o id exato em plano_interesse. Não misture classes: 420 Mega de R$ 69,99 só existe em Prata. Rede Neutra não usa preços de rede própria.
Quando gb_movel=30, informe móvel de 30 GB. Quando gb_movel=null e movel_incluso=true, diga apenas “+ Móvel”; a franquia não foi informada. Não invente franquia, chip, desconto no cartão, instalação gratuita, fidelidade, taxas, datas ou benefícios. Preços são os fornecidos pelo cliente, vigência e condições dependem da operadora.
Colete somente cep, tipo_pessoa e plano_interesse nesta etapa. Se receber endereço espontâneo, preserve em endereco_completo. Após a escolha, avance imediatamente para pedir endereço se faltar. Não peça para o cliente avisar quando estiver pronto.
Nunca reinicie uma recuperação de CPF: use a proposta existente e mantenha os dados comerciais.`;
 principal.dados.mensagem_inicial='Olá! Sou o assistente virtual da Grupo Prime, parceiro Vero. 😊 Vou ajudar você a escolher seu plano de internet. Qual é o CEP do local da instalação?';
 principal.dados.consultas=[{id:'vero_viabilidade',nome:'Ofertas Vero por município do CEP',tipo:'http',metodo:'GET',url:origem+'/api/viabilidade/vero?cep={{cep}}',headers:JSON.stringify({'x-wolf-viabilidade-token':tokens.consulta}),variavel_gatilho:'cep',variavel_resultado:'resposta_viabilidade',obrigatoria:true,retorno_negativo_finalizar_atendimento:true,retorno_negativo_aplicar_etiqueta:true,retorno_negativo_nome_etiqueta:'FORA DA CAMPANHA VERO',retorno_negativo_mensagem:'No momento, não temos disponibilidade dessas ofertas Vero para esse CEP. Vamos encerrar este atendimento por enquanto. Seu interesse ficará registrado para quando houver uma oferta para sua região.'}];
 for(const no of nos){
  if(Array.isArray(no.dados.reengajamento_lembretes))no.dados.reengajamento_lembretes=no.dados.reengajamento_lembretes.map((l:any)=>({...l,mensagem:String(l.mensagem||'').replace(/\bNio\b/g,'Vero')}));
  for(const k of ['prompt','mensagem_inicial','texto','mensagem','mensagem_sucesso','mensagem_erro'])if(typeof no.dados[k]==='string')no.dados[k]=no.dados[k].replace(/\bNio\b/g,'Vero');
  if(no.id==='prime_acompanhamento_inicio')no.dados.codigo='setVariable("operadora", "Vero"); setVariable("perfil_vendedor", "vero-v1");\n'+no.dados.codigo;
  if(no.id==='prime_documentos_conferir'){no.dados.url=origem+'/api/crm/grupoprime/validar-documentos-vero';no.dados.headers=JSON.stringify({'x-wolf-documentos-token':tokens.documentos});}
  if(no.id==='prime_reversao_atualizar'){no.dados.url=origem+'/api/crm/grupoprime/recuperar-cpf-vero';no.dados.headers=JSON.stringify({'x-wolf-recuperacao-token':tokens.recuperacao});}
  if(no.id==='prime_reversao_ia')no.dados.mensagem_inicial='Seu pedido Vero não avançou porque o CPF não foi aprovado na análise cadastral. Isso não informa o motivo nem significa necessariamente uma dívida. Podemos tentar com outro titular que saiba e autorize a contratação. Qual CPF deseja informar?';
  if(no.id==='prime_documentos_enviar'){no.dados.bko_configuracao={ativo:false,modo:'por_canal',canal_id:null,contatos:[]};delete no.dados.bko_ultimo_numero;delete no.dados.bko_janelas;delete no.dados.bko_versao;}
 }
 const ids=new Set(nos.map(n=>n.id));if(ids.size!==nos.length||base.conexoes.some(e=>!ids.has(e.de)||!ids.has(e.para)))throw Error('Grafo inválido');
 return {nome:NOME_FLUXO_VERO,workspace_id:'grupoprime',ativo:false,descricao:'Vero: Rede Neutra, Rede Própria Especial e Prata. Nove municípios, consulta própria por CEP, cadastro, documentos e BKO.',trigger_tipo:'primeiro_contato',trigger_valor:'',nos,conexoes:JSON.parse(JSON.stringify(base.conexoes))};
}
