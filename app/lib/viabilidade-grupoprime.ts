import base from './data/viabilidade-grupoprime.json';
import { normalizarCidade, planosDaCidade } from './planos-grupoprime';

type Local = { uf: string; cidade: string; enderecos: number; enderecos_comercializaveis: number; disponibilidade_nao_informada: number };
let indice: Map<string, Local[]> | undefined;
let cepsPlanilha: Set<string> | undefined;
function obterIndice() {
  if (indice) return indice;
  indice = new Map();
  cepsPlanilha = new Set(base.ceps_planilha.split('\n'));
  for (const local of base.cidades) {
    for (const linha of local.ceps.split('\n')) {
      const [cep, total, disponiveis, desconhecidos] = linha.split(',');
      const lista = indice.get(cep) || [];
      lista.push({ uf: local.uf, cidade: local.cidade, enderecos: Number(total), enderecos_comercializaveis: Number(disponiveis), disponibilidade_nao_informada: Number(desconhecidos) });
      indice.set(cep, lista);
    }
  }
  return indice;
}

export function normalizarCep(valor: unknown) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (!/^\d{5}-?\d{3}$/.test(texto)) return null;
  const cep = texto.replace('-', '');
  // Marcadores encontrados nos CSVs não representam um endereço consultável.
  return cep === '00000000' || cep === '99999999' ? null : cep;
}

export function consultarViabilidade(entrada: unknown, cidade = '', uf = '') {
  const cep = normalizarCep(entrada);
  if (!cep) throw Object.assign(new Error('Informe o CEP com oito dígitos, com ou sem hífen.'), { statusCode: 400 });
  const locais = obterIndice().get(cep) || [];
  const candidatos = locais.filter(local => (!cidade || normalizarCidade(local.cidade) === normalizarCidade(cidade)) && (!uf || local.uf === uf.toUpperCase()));
  const local = candidatos.length === 1 ? candidatos[0] : null;
  const status = !locais.length ? (cepsPlanilha!.has(cep) ? 'cidade_nao_identificada' : 'nao_localizado')
    : !candidatos.length ? 'cidade_divergente' : candidatos.length > 1 ? 'cidade_ambigua'
    : local!.enderecos_comercializaveis > 0 ? 'pre_viavel' : local!.disponibilidade_nao_informada > 0 ? 'disponibilidade_nao_informada' : 'sem_disponibilidade_na_base';
  return {
    workspace_id: 'grupoprime', cep, status, confirmacao_tecnica_necessaria: true,
    origem: base.fonte, candidatos: candidatos.length ? candidatos : locais,
    cidade: local?.cidade || null, uf: local?.uf || null,
    planos: status === 'pre_viavel' && local ? planosDaCidade(local.uf, local.cidade) : null,
    mensagem: status === 'pre_viavel' ? 'CEP com endereços comercializáveis na base histórica. Pergunte se a contratação será no CPF ou CNPJ, explicando que as ofertas podem diferir. Após a resposta, apresente somente os planos desse público. Depois da escolha, colete o endereço completo aproveitando cidade e UF do CEP; a confirmação técnica do imóvel continua necessária.'
      : status === 'sem_disponibilidade_na_base' ? 'Sem disponibilidade comercial registrada nesta base histórica. Encaminhe para atualização técnica, sem afirmar indisponibilidade atual definitiva.'
      : status === 'nao_localizado' ? 'No momento, não temos disponibilidade registrada para esse CEP na base fornecida.'
      : 'Consulta inconclusiva. Confirme CEP, cidade e UF; se necessário encaminhe para a equipe. Não apresente preços antes de identificar a cidade.',
  };
}
