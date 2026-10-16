// Mantém o mesmo fluxo e a chave existente; não ativa nem envia mensagens.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createHmac } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
function carregar(arquivo) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
  return exports;
}
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const helper = carregar('app/lib/recuperacao-cpf-grupoprime.ts');
  const vendedor = carregar('app/lib/vendedor-grupoprime.ts');
  const { data: fluxo, error } = await db.from('fluxos').select('id,nos,conexoes,ativo').eq('workspace_id', 'grupoprime').eq('id', 27).single();
  if (error) throw Error('Fluxo do Grupo Prime não encontrado');
  const principal = fluxo.nos.find(n => n.id === 'prime_vendedor');
  if (!principal?.dados?.apiKey) throw Error('Chave IA não configurada no vendedor');
  const origem = process.env.WOLF_GRUPOPRIME_APP_ORIGIN || 'https://app.wolfgyn.com.br';
  const segredo = process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw Error('Segredo da integração ausente');
  const token = createHmac('sha256', segredo).update('wolf:recuperacao-cpf:grupoprime:v1').digest('hex');
  const recuperacao = helper.blocosRecuperacaoGrupoPrime(origem, token, principal.dados.apiKey);
  const avisos = helper.blocosAvisosInstalacaoGrupoPrime();
  const automatizado = id => /^prime_(reversao|aviso)_/.test(id);
  const nos = fluxo.nos.filter(n => !automatizado(n.id)).map(n => n.id !== 'prime_vendedor' ? n : {
    ...n, dados: { ...n.dados, consultas: n.dados.consultas.map(c => c.id !== 'prime_viabilidade' ? c : {
      ...c, retorno_negativo_finalizar_atendimento: true, retorno_negativo_aplicar_etiqueta: true,
      retorno_negativo_nome_etiqueta: 'AGUARDANDO COBERTURA', retorno_negativo_mensagem: vendedor.MENSAGEM_SEM_DISPONIBILIDADE,
    }) },
  });
  nos.push(...recuperacao.nos, ...avisos.nos);
  const conexoes = fluxo.conexoes.filter(c => !automatizado(c.de) && !automatizado(c.para)).concat(recuperacao.conexoes, avisos.conexoes);
  console.log(JSON.stringify({ fluxo: fluxo.id, ativo: fluxo.ativo, blocos: nos.length, gatilhos: nos.filter(n => n.tipo === 'gatilho_crm').map(n => n.dados.valor), mensagem_recuperacao_literal: true, encerra_sem_disponibilidade: true }));
  if (!process.argv.includes('--apply')) return;
  const { data: config, error: erroConfig } = await db.from('proposta_campos_padrao_config').select('id,opcoes').eq('workspace_id', 'grupoprime').eq('campo_slug', 'status_venda').maybeSingle();
  if (erroConfig) throw erroConfig;
  const atuais = Array.isArray(config?.opcoes) ? config.opcoes : config?.opcoes ? JSON.parse(config.opcoes) : ['PENDENTE','AGUARDANDO AUDITORIA','CANCELADA','INSTALADA','GERADA','REPROVADA'];
  for (const status of ['CPF REPROVADO','AGUARDANDO INSTALAÇÃO','AGUARDANDO AUDITORIA','GERADA']) {
    if (!atuais.some(s => helper.normalizarStatus(s) === status)) atuais.push(status);
  }
  const opcoes = config?.id ? db.from('proposta_campos_padrao_config').update({ opcoes: atuais }).eq('id', config.id).eq('workspace_id', 'grupoprime')
    : db.from('proposta_campos_padrao_config').insert({ workspace_id: 'grupoprime', campo_slug: 'status_venda', opcoes: atuais, visivel: true, ordem: 52 });
  const { error: erroOpcoes } = await opcoes;
  if (erroOpcoes) throw erroOpcoes;
  const { error: erroSalvar } = await db.from('fluxos').update({ nos, conexoes, nome: vendedor.NOME_VENDEDOR_GRUPOPRIME,
    descricao: 'Vendas Nio PF/PJ por CEP e cidade; recuperação de CPF reprovado; avisos de instalação e biometria; encerramento sem cobertura.',
  }).eq('workspace_id', 'grupoprime').eq('id', fluxo.id);
  if (erroSalvar) throw erroSalvar;
  console.log(JSON.stringify({ salvo: true, fluxo: fluxo.id, ativo_preservado: fluxo.ativo }));
}
main().catch(error => { console.error(error.message || 'Falha na organização'); process.exitCode = 1; });
