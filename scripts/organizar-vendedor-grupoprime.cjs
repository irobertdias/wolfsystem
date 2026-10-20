// Mantém o mesmo fluxo e a chave existente; não ativa nem envia mensagens.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createHmac, randomUUID } = require('node:crypto');
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
  const anexos = carregar('app/lib/documentos-grupoprime.ts');
  const cadastro = carregar('app/lib/cadastro-grupoprime.ts');
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
  const tokenDocumentos = createHmac('sha256', segredo).update('wolf:documentos:grupoprime:v1').digest('hex');
  const documentos = anexos.blocosDocumentosGrupoPrime(origem, tokenDocumentos, principal.dados.apiKey);
  const bkoAnterior = fluxo.nos.find(n=>n.id==='prime_documentos_enviar')?.dados;
  const envioBko = documentos.nos.find(n=>n.id==='prime_documentos_enviar');
  envioBko.dados.bko_configuracao = bkoAnterior?.bko_configuracao || {ativo:false,canal_id:null,contatos:[]};
  envioBko.dados.bko_ultimo_numero = bkoAnterior?.bko_ultimo_numero || null;
  envioBko.dados.bko_janelas = bkoAnterior?.bko_janelas || {};
  envioBko.dados.bko_versao = randomUUID();
  const roteiroPrincipal = vendedor.criarVendedorGrupoPrime(origem, '').nos.find(n => n.id === 'prime_vendedor').dados;
  const dadosCadastrais = cadastro.blocosCadastroGrupoPrime(principal.dados.apiKey);
  const automatizado = id => /^prime_(reversao|aviso|documentos|endereco|acompanhamento|cadastro)_/.test(id);
  const nos = fluxo.nos.filter(n => !automatizado(n.id)).map(n => n.id !== 'prime_vendedor' ? n : {
    ...n, dados: { ...n.dados, prompt: roteiroPrincipal.prompt, variaveis: roteiroPrincipal.variaveis,
      mensagem_inicial: roteiroPrincipal.mensagem_inicial, mensagem_inicial_literal: true,
      ...vendedor.lembretesGrupoPrime(), consultas: n.dados.consultas.map(c => c.id !== 'prime_viabilidade' ? c : {
      ...c, retorno_negativo_finalizar_atendimento: true, retorno_negativo_aplicar_etiqueta: true,
      retorno_negativo_nome_etiqueta: 'AGUARDANDO COBERTURA', retorno_negativo_mensagem: vendedor.MENSAGEM_SEM_DISPONIBILIDADE,
    }) },
  });
  nos.push(...recuperacao.nos, ...avisos.nos, ...documentos.nos, ...dadosCadastrais.nos, vendedor.etapaEnderecoGrupoPrime(principal.dados.apiKey), vendedor.inicioAcompanhamentoGrupoPrime());
  for (const no of nos) {
    if (no.tipo === 'fluxo_ia') Object.assign(no.dados, vendedor.lembretesGrupoPrime());
    if (no.id === 'prime_vendedor') no.y = 540;
    if (no.id === 'prime_documentos_entrada') no.y = 780;
    else if (no.id.startsWith('prime_documentos_')) no.y += 1380;
    if (no.id === 'prime_humano') { no.y = 3460; no.dados.mensagem = 'Vou encaminhar seu atendimento à equipe Grupo Prime para conferir as pendências e ajudar a concluir o pedido.'; }
    if (['prime_reversao_payload','prime_reversao_atualizar','prime_reversao_limpar_etiqueta','prime_reversao_coletado','prime_reversao_enviada','prime_reversao_humano'].includes(no.id)) no.y += 440;
  }
  const conexoes = fluxo.conexoes.filter(c => !automatizado(c.de) && !automatizado(c.para) && !(['prime_vendedor', 'prime_inicio'].includes(c.de) && c.saidaIndex === 0))
    .concat([{ id: 'prime_inicio_acompanhamento', de: 'prime_inicio', saidaIndex: 0, para: 'prime_acompanhamento_inicio' },
      { id: 'prime_inicio_ia', de: 'prime_acompanhamento_inicio', saidaIndex: 0, para: 'prime_vendedor' },
      { id: 'prime_saida_0', de: 'prime_vendedor', saidaIndex: 0, para: 'prime_documentos_entrada' }], recuperacao.conexoes, avisos.conexoes).map(c => {
    if (c.de === 'prime_reversao_ia' && c.saidaIndex === 0) return { ...c, para: 'prime_reversao_documentos_preparar' };
    return c;
  }).concat(documentos.conexoes.map(c => c.de === 'prime_documentos_entrada' && c.saidaIndex === 0 ? { ...c, para: 'prime_endereco_ia' } : c), dadosCadastrais.conexoes,
    [0, 1, 2, 3].map(saidaIndex => ({ id: `prime_endereco_saida_${saidaIndex}`, de: 'prime_endereco_ia', saidaIndex, para: saidaIndex === 0 ? 'prime_cadastro_preparar' : 'prime_humano' })));
  console.log(JSON.stringify({ fluxo: fluxo.id, ativo: fluxo.ativo, blocos: nos.length, gatilhos: nos.filter(n => n.tipo === 'gatilho_crm').map(n => n.dados.valor), documentos_obrigatorios: anexos.REGRAS_DOCUMENTOS_GRUPOPRIME.map(r=>r.nome), encerra_sem_disponibilidade: true }));
  if (!process.argv.includes('--apply')) return;
  const { data: config, error: erroConfig } = await db.from('proposta_campos_padrao_config').select('id,opcoes').eq('workspace_id', 'grupoprime').eq('campo_slug', 'status_venda').maybeSingle();
  if (erroConfig) throw erroConfig;
  const atuais = Array.isArray(config?.opcoes) ? config.opcoes : config?.opcoes ? JSON.parse(config.opcoes) : ['PENDENTE','AGUARDANDO AUDITORIA','CANCELADA','INSTALADA','GERADA','REPROVADA'];
  for (const status of ['CPF REPROVADO','AGUARDANDO INSTALAÇÃO','AGUARDANDO AUDITORIA','GERADA','APROVADA','SEM DISPONIBILIDADE']) {
    if (!atuais.some(s => helper.normalizarStatus(s) === status)) atuais.push(status);
  }
  const opcoes = config?.id ? db.from('proposta_campos_padrao_config').update({ opcoes: atuais }).eq('id', config.id).eq('workspace_id', 'grupoprime')
    : db.from('proposta_campos_padrao_config').insert({ workspace_id: 'grupoprime', campo_slug: 'status_venda', opcoes: atuais, visivel: true, ordem: 52 });
  const { error: erroOpcoes } = await opcoes;
  if (erroOpcoes) throw erroOpcoes;
  const ordensCadastro = { nome: 10, cpf: 11, data_nascimento: 13, nome_mae: 14, email: 15, cep: 20, endereco: 23, telefone1: 30, telefone2: 31, vencimento: 42, forma_pagamento: 43 };
  for (const campo of cadastro.CAMPOS_CADASTRO_GRUPOPRIME) {
    const slug = campo.nome === 'endereco_completo' ? 'endereco' : campo.nome;
    const { data: existente, error: erroCampo } = await db.from('proposta_campos_padrao_config').select('id').eq('workspace_id','grupoprime').eq('campo_slug',slug).maybeSingle();
    if (erroCampo) throw erroCampo;
    const payload = { obrigatorio: true, visivel: true,
      ...(slug === 'telefone1' ? { label_custom: 'Contato WhatsApp' } : slug === 'telefone2' ? { label_custom: 'Contato para ligação normal' } : {}),
      ...(slug === 'vencimento' ? { opcoes: Array.from({length:31},(_,i)=>String(i+1)) } : {}),
      ...(slug === 'forma_pagamento' ? { opcoes: ['Boleto Bancário','PIX','Cartão de Crédito'] } : {}),
    };
    const query = existente ? db.from('proposta_campos_padrao_config').update(payload).eq('workspace_id','grupoprime').eq('id',existente.id)
      : db.from('proposta_campos_padrao_config').insert({ ...payload, workspace_id:'grupoprime', campo_slug:slug, ordem:ordensCadastro[slug] });
    const { error: erroPadrao } = await query;
    if (erroPadrao) throw erroPadrao;
  }
  for (const [ordem, regra] of anexos.REGRAS_DOCUMENTOS_GRUPOPRIME.entries()) {
    const { data: campo, error: erroCampo } = await db.from('proposta_campos_customizados').select('id').eq('workspace_id','grupoprime').eq('slug',regra.variavel).maybeSingle();
    if (erroCampo) throw erroCampo;
    const payload = { label: regra.nome, tipo: 'arquivo', obrigatorio: true, ativo: true, ordem: 900 + ordem, placeholder: 'Documento privado obrigatório para auditoria do BKO' };
    const gravacao = campo ? db.from('proposta_campos_customizados').update(payload).eq('workspace_id','grupoprime').eq('id',campo.id)
      : db.from('proposta_campos_customizados').insert({ ...payload, workspace_id: 'grupoprime', slug: regra.variavel });
    const { error: erroGravacao } = await gravacao;
    if (erroGravacao) throw erroGravacao;
  }
  let gravarFluxo = db.from('fluxos').update({ nos, conexoes, nome: vendedor.NOME_VENDEDOR_GRUPOPRIME,
    descricao: 'Planos por CEP; cadastro completo, correções e confirmação antes dos documentos; RG frente/verso e comprovante no CRM para auditoria; recuperação CPF e avisos BKO.',
  }).eq('workspace_id', 'grupoprime').eq('id', fluxo.id);
  const indiceBko=fluxo.nos.findIndex(n=>n.id==='prime_documentos_enviar');
  if(indiceBko>=0)gravarFluxo=bkoAnterior?.bko_versao?gravarFluxo.eq(`nos->${indiceBko}->dados->>bko_versao`,bkoAnterior.bko_versao):gravarFluxo.is(`nos->${indiceBko}->dados->>bko_versao`,null);
  const {data:fluxoSalvo,error:erroSalvar}=await gravarFluxo.select('id').maybeSingle();
  if (erroSalvar) throw erroSalvar;
  if (!fluxoSalvo) throw Error('O fluxo foi alterado durante a organização. Reexecute sem sobrescrever as alterações recentes.');
  console.log(JSON.stringify({ salvo: true, fluxo: fluxo.id, ativo_preservado: fluxo.ativo }));
}
main().catch(error => { console.error(error.message || 'Falha na organização'); process.exitCode = 1; });
