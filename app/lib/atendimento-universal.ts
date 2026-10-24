export const PERFIS_UNIVERSAIS = {
  telecom: { nome: 'Telecom', objetivo: 'Consultar cobertura e oferecer os planos disponíveis para o endereço.', campos: ['CEP', 'Endereço de instalação', 'Tipo de contratação', 'Plano escolhido'], documentos: ['Identidade', 'Comprovante de endereço'], acoes: ['Consultar cobertura', 'Consultar catálogo', 'Registrar pedido'] },
  servicos: { nome: 'Serviços', objetivo: 'Entender a necessidade, explicar o escopo e preparar um orçamento.', campos: ['Serviço desejado', 'Local', 'Prazo desejado'], documentos: ['Anexos do serviço'], acoes: ['Consultar serviços', 'Preparar orçamento'] },
  roupas: { nome: 'Roupas e varejo', objetivo: 'Ajudar a escolher produtos conforme preferência e estoque real.', campos: ['Produto', 'Tamanho', 'Cor', 'Quantidade', 'Entrega ou retirada'], documentos: [], acoes: ['Consultar estoque', 'Consultar frete', 'Registrar pedido'] },
  correspondente: { nome: 'Correspondente bancário', objetivo: 'Identificar a demanda e encaminhar uma proposta para análise da instituição.', campos: ['Produto financeiro', 'Nome', 'CPF', 'Contato'], documentos: ['Identidade', 'Comprovantes solicitados pela instituição'], acoes: ['Consultar produtos', 'Solicitar simulação', 'Encaminhar proposta'] },
  prestamista: { nome: 'Seguro prestamista', objetivo: 'Esclarecer a solicitação e reunir os dados da apólice para análise.', campos: ['Tipo de solicitação', 'Instituição', 'Número da apólice', 'Titular'], documentos: ['Apólice', 'Identidade', 'Documentos da solicitação'], acoes: ['Consultar solicitação', 'Encaminhar para análise'] },
  consignado: { nome: 'Crédito consignado', objetivo: 'Entender a modalidade desejada e apresentar somente simulações retornadas pela instituição.', campos: ['Modalidade', 'Convênio', 'Nome', 'CPF', 'Contato'], documentos: ['Identidade', 'Comprovante de benefício ou renda'], acoes: ['Consultar elegibilidade', 'Solicitar simulação', 'Encaminhar proposta'] },
  barbearia: { nome: 'Barbearia', objetivo: 'Ajudar a escolher o serviço e um horário disponível.', campos: ['Serviço', 'Profissional preferido', 'Data', 'Horário', 'Nome', 'Contato'], documentos: [], acoes: ['Consultar serviços', 'Consultar agenda', 'Reservar horário'] },
} as const;
export type NichoUniversal = keyof typeof PERFIS_UNIVERSAIS;
export function perfilUniversal(valor: unknown) {
  return typeof valor === 'string' && Object.hasOwn(PERFIS_UNIVERSAIS, valor) ? PERFIS_UNIVERSAIS[valor as NichoUniversal] : null;
}
export function assistenteUniversalInicial() {
  return { versao: 1, nome: '', empresa: '', papel: 'vendas', tom: 'acolhedor', apresentacao: '', regras: '', documentos: { receber: true, leitura: 'extrair_sem_rejeitar', inconclusivo: 'conferencia_humana' }, confirmarAntesDeExecutar: true };
}
export function nichoUniversalInicial() { return { versao: 1, nicho: '', objetivo: '', campos: [], fontes: '', regras: '' }; }
export function configurarNicho(valor: string) {
  const perfil = perfilUniversal(valor);
  return { ...nichoUniversalInicial(), nicho: perfil ? valor : '', objetivo: perfil?.objetivo || '', campos: perfil ? [...perfil.campos] : [] };
}
export function validarEstruturaUniversal(nos: {id:string;tipo:string;dados:Record<string,any>}[], arestas:{de:string;para:string;saidaIndex:number}[]) {
  const problemas:string[]=[];
  for (const no of nos.filter(n=>n.tipo==='assistente_universal')) {
    const destinos=arestas.filter(a=>a.de===no.id&&a.saidaIndex===0).map(a=>nos.find(n=>n.id===a.para));
    if(destinos.length!==1||destinos[0]?.tipo!=='nicho_atendimento')problemas.push('Conecte o assistente a um único bloco Nicho de atendimento.');
    else if(!perfilUniversal(destinos[0].dados.nicho))problemas.push('Escolha um nicho válido para o assistente.');
    if(!String(no.dados.nome||'').trim()||!String(no.dados.empresa||'').trim())problemas.push('Informe o nome do assistente e a empresa.');
  }
  for(const no of nos.filter(n=>n.tipo==='nicho_atendimento'))if(!arestas.some(a=>a.para===no.id&&nos.some(n=>n.id===a.de&&n.tipo==='assistente_universal')))problemas.push('O bloco Nicho de atendimento precisa receber a conexão de um assistente.');
  return [...new Set(problemas)];
}

export function universalExecutavel(nos: {id:string;tipo:string;dados:Record<string,any>}[], arestas:{de:string;para:string;saidaIndex:number}[], workspace: string | null) {
  const assistentes=nos.filter(n=>n.tipo==='assistente_universal');
  return workspace==='grupoprime' && assistentes.length===1 && assistentes[0].dados.runtime==='universal-v1'
    && validarEstruturaUniversal(nos,arestas).length===0
    && nos.filter(n=>n.tipo==='nicho_atendimento').length===1
    && nos.find(n=>n.tipo==='nicho_atendimento')?.dados.nicho==='telecom';
}
