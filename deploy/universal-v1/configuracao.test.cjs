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

test('confirmação do WhatsApp não inventa telefone ou dia da fatura a partir do histórico',async()=>{
 const i=criarInterpretador({apiKey:'TESTE',catalogo:()=>({}),fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({dados:[{campo:'vencimento',valor:'20',trecho:'esse mesmo'},{campo:'telefone1',valor:'5562999998888',trecho:'esse mesmo'}]})}}]})})});
 const r=await i.extrair({estado:{etapa:'telefone1',dados:{},historico:[]},texto:'é esse mesmo aqui',numero:'5562999998888'});
 a.equal(r.dados.vencimento,undefined);a.equal(r.dados.telefone1,undefined);a.equal(r.usar_whatsapp,true);
});
