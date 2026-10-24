const { test } = require('node:test'), a = require('node:assert/strict');
const { criarInterpretador } = require('./interpretacao.cjs');
test('o prompt editado no nicho é enviado como instrução ao interpretador', async () => {
    let enviada;
    const i = criarInterpretador({ apiKey: 'TESTE', catalogo: () => ({}), fetcher: async (_url, init) => {
        enviada = JSON.parse(init.body);
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ dados: [], plano_id: '', confirmacao: false, usar_whatsapp: false, sem_comprovante: false, encerrar: false, objecao: false, pergunta: false, resposta_contextual: '' }) } }] }) };
    } });
    await i.extrair({ estado: { etapa: 'localidade', dados: {}, historico: [] }, texto: 'Olá', numero: '5562999998888', config: { promptNicho: 'PROMPT_CUSTOMIZADO_DO_NICHO: acolha e pergunte a cidade.' } });
    a.ok(enviada.messages[0].content.includes('PROMPT_CUSTOMIZADO_DO_NICHO: acolha e pergunte a cidade.'));
});
