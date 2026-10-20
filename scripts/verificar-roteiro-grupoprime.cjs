// Verificação manual: usa a chave já configurada, sem enviar WhatsApp ou gravar vendas.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: fluxo, error } = await db.from('fluxos').select('nos,conexoes,ativo').eq('workspace_id', 'grupoprime').eq('id', 27).single();
  if (error) throw Error('Não foi possível ler o vendedor configurado');
  const backendRoot = process.env.WOLF_BACKEND_PATH || 'D:/GERAL/wolf-whatsapp';
  assert.ok(require(`${backendRoot}/src/shared/fluxo-validator.js`).validateFlowForActivation(fluxo).ok);
  const dados = fluxo.nos.find(n => n.id === 'prime_vendedor').dados;
  const token = createHmac('sha256', process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY).update('wolf:viabilidade:grupoprime:v1').digest('hex');
  const resposta = await fetch('https://app.wolfgyn.com.br/api/viabilidade/grupoprime?cep=74480150', { headers: { 'x-wolf-viabilidade-token': token } });
  assert.equal(resposta.status, 200);
  const consulta = await resposta.json();
  assert.equal(consulta.status, 'pre_viavel');
  // Mesmas instruções adicionais do motor, sem executar conexões ou enviar mensagens.
  const backend = fs.readFileSync(`${backendRoot}/src/routes/fluxos.js`, 'utf8');
  const inicio = backend.indexOf('  const prompt = [', backend.indexOf('async function executarFluxoPorIA('));
  const finalizador = '].join("\\n");';
  const fim = backend.indexOf(finalizador, inicio);
  assert.ok(inicio >= 0 && fim > inicio);
  const construir = new Function('dados', 'variaveis', 'campos', 'valoresAtuais', 'camposPendentesAtuais', 'validacoesDeterministicas', 'estadoAtual', 'substituirVariaveis', backend.slice(inicio, fim + finalizador.length) + ' return prompt;');
  const campos = dados.variaveis;
  const estado = { contexto_consultas: { [dados.consultas[0].nome]: { entrada: '74480150', sucesso: true, resultado: JSON.stringify(consulta) } } };
  const prompt = construir(dados, { cep: '74480150' }, campos, { cep: '74480150' }, campos.filter(c => c.nome !== 'cep').map(c => c.label), [], estado, s => s);
  const messages = [{ role: 'system', content: prompt }, { role: 'assistant', content: dados.mensagem_inicial }, { role: 'user', content: '74480150' },
    { role: 'assistant', content: JSON.stringify({ mensagem: 'Vou consultar os planos para esse CEP.', dados: { cep: '74480150' } }) },
    { role: 'user', content: 'RESULTADO OFICIAL DA CONSULTA (fato soberano, nao contradiga): ' + JSON.stringify(consulta) + '. Continue o atendimento sem expor detalhes tecnicos.' }];
  async function turno() {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + dados.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: dados.modelo, messages, response_format: { type: 'json_object' }, max_tokens: 700 }) });
    if (!r.ok) throw Error('Verificação da IA retornou HTTP ' + r.status);
    const body = await r.json();
    return body.choices[0].message.content;
  }
  const bruto = await turno();
  const oferta = JSON.parse(bruto);
  for (const plano of [...consulta.planos.pessoa_fisica, ...consulta.planos.pessoa_juridica]) {
    assert.ok(oferta.mensagem.includes(String(plano.mensalidade)), 'Mensagem não apresentou todas as mensalidades');
    assert.ok(oferta.mensagem.includes(plano.nome), 'Mensagem não apresentou todos os planos');
  }
  assert.match(oferta.mensagem, /600/);
  assert.match(oferta.mensagem, /700/);
  assert.match(oferta.mensagem, /CNPJ|jur[ií]dica/i);
  assert.doesNotMatch(oferta.mensagem, /informe.*endere[çc]o|seu nome|pretende usar/i);
  messages.push({ role: 'assistant', content: bruto }, { role: 'user', content: 'Quero o Nio Fibra 600 mega para CPF' });
  const escolha = JSON.parse(await turno());
  assert.equal(escolha.dados.plano_interesse, 'pf-fibra-padrao');
  assert.equal(escolha.dados.tipo_pessoa, 'PF');
  console.log(JSON.stringify({ consulta_producao: 200, planos_apos_consulta: true, escolha_correta: true, fluxo_ativo: fluxo.ativo }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
