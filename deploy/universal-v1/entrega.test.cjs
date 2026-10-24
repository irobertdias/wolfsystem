const { test } = require('node:test'), a = require('node:assert/strict');
const carregar = require('./runtime.cjs');
function banco() {
    let seq = 0;
    const tabelas = { atendimentos:[],etiquetas:[],atendimento_etiquetas:[], fluxos: [{ id: 27, workspace_id: 'grupoprime', nos: [{ id: 'prime_documentos_enviar', dados: { bko_configuracao: { ativo: true, canal_id: 164, modo: 'por_canal', contatos: [{ canal_trafego_id: 164, numero: '5562981072373' }] } } }] }], proposta: [] };
    return { tabelas, storage: { from: () => ({ download: async () => ({ data: new Blob(['arquivo']) }) }) }, from(nome) {
            let filtros = [], modo = 'select', payload;
            const q = { select() { return q; }, order(){return q;}, eq(k, v) { filtros.push([k, v]); return q; }, limit() { return q; }, insert(p) { modo = 'insert'; payload = p; return q; }, update(p) { modo = 'update'; payload = p; return q; }, single() { return executar(true); }, maybeSingle() { return executar(true); }, then(r, j) { return executar(false).then(r, j); } };
            async function executar(single) { let rows = (tabelas[nome] || []).filter(r => filtros.every(([k, v]) => k.includes('->>') ? r[k.split('->>')[0]]?.[k.split('->>')[1]] === v : r[k] === v)); if (modo === 'insert') {
                const r = { ...structuredClone(payload), id: ++seq, updated_at: 'v' + seq };
                tabelas[nome].push(r);
                rows = [r];
            } if (modo === 'update') {
                rows.forEach(r => Object.assign(r, structuredClone(payload)));
            } return { data: structuredClone(single ? rows[0] || null : rows), error: null }; }
            return q;
        } };
}
function preparar({ falharRecibo = false } = {}) {
    const db = banco(), envios = [], recibos = new Map();
    const ctx = { supabase: db, executarFluxo: async () => false, app: { get() { } }, sessoes: { 164: { status: 'conectado', client: { getMessageById: async (id) => recibos.get(id), getNumberId: async () => ({ _serialized: 'destino' }), getChatById: async () => ({ fetchMessages: async () => [] }) } } }, getConfigCanal: async () => ({ workspaceId: 'grupoprime', tipo: 'webjs', canalId: 164 }), MessageMedia: class {
            constructor(tipo, data, nome) { Object.assign(this, { tipo, data, nome }); }
        } };
    carregar(ctx, { teste: true, credencial: { apiKey: 'TESTE' }, interprete: {}, enviarBko: async (client, n, conteudo, opcoes) => { const id = 'id-' + (envios.length + 1); envios.push({ n, conteudo, opcoes }); recibos.set(id, { ack: falharRecibo ? 0 : 1 }); return { id: { _serialized: id }, ack: falharRecibo ? 0 : 1 }; }, confirmarBko: async () => { if (falharRecibo)
            throw Error('Recibo pendente'); } });
    return { ctx, db, envios, recibos };
}

test('arquivos recebidos juntos são lidos com a próxima pendência e persistidos individualmente',async()=>{
    const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-doc-batch-'));
    const {ctx,db}=preparar();ctx.universalTeste.parar();
    const pendencias=[],salvos=[];
    ctx.AUDIOS_DIR=dir;db.storage.from=()=>({upload:async()=>({error:null})});
    for(const nome of ['frente.jpg','verso.jpg','conta.pdf'])fs.writeFileSync(path.join(dir,nome),'fixture');
    carregar(ctx,{teste:true,credencial:{apiKey:'TESTE',documentosOpenai:true},interprete:{lerDocumento:async({pendente})=>{pendencias.push(pendente);return {categorias:[],leitura:'inconclusiva'}}}});
    try {
        const s=require('./conversa.cjs').inicial();s.etapa='documentos';
        await ctx.universalTeste.anexar('[img:frente.jpg]\n[img:verso.jpg]\n[file:conta.pdf]',s,164,'5562999998888',async()=>salvos.push(s.anexos.length));
        a.deepEqual(pendencias,['rg_frente','rg_verso','comprovante_endereco']);a.deepEqual(salvos,[1,2,3]);
        await ctx.universalTeste.anexar('[img:frente.jpg]',s,164,'5562999998888');a.equal(s.anexos.length,3);a.equal(pendencias.length,3);
    }finally{ctx.universalTeste.parar();if(path.dirname(dir)===fs.realpathSync(os.tmpdir())&&path.basename(dir).startsWith('wolf-doc-batch-'))fs.rmSync(dir,{recursive:true});}
});
function estado() { return { inicio: '2026-10-24T00:00:00Z', dados: { nome: 'Cliente Exemplo', cpf: '52998224725', data_nascimento: '23/01/2002', nome_mae: 'Mãe Exemplo', email: 'teste@example.com', telefone1: '5562999998888', endereco: 'Rua Exemplo 12', cidade: 'Goiânia', estado: 'GO', cep: '74480150', bairro: 'Centro', vencimento: '20', forma_pagamento: 'Boleto', tipo_pessoa: 'PF' }, plano: { id: 'pf-fibra-padrao', nome: 'Nio Fibra', mensalidade: 110, velocidade_mbps: 600 }, consulta: { status: 'disponivel_na_base' }, pendencias: [], documentos: { rg_frente: [{ path: 'grupoprime/cliente/rg', nome: 'rg.jpg', tipo: 'image/jpeg' }], rg_verso: [{ path: 'grupoprime/cliente/rg', nome: 'rg.jpg', tipo: 'image/jpeg' }], comprovante_endereco: [{ path: 'grupoprime/cliente/conta', nome: 'conta.pdf', tipo: 'application/pdf' }] } }; }
test('cadastro real do motor aplica etiqueta com pedido retornado pelo CRM sem duplicar em retry',async()=>{
 const {ctx,db}=preparar();db.tabelas.atendimentos.push({id:70,workspace_id:'grupoprime',canal_id:164,numero:'5562999998888'});
 try{const id=await ctx.universalTeste.registrar({id:29},164,'5562999998888',estado());
 a.equal(db.tabelas.etiquetas[0].nome,'VENDA REALIZADA '+id);a.equal(db.tabelas.atendimento_etiquetas[0].atendimento_id,70);
 const repetido=await ctx.universalTeste.registrar({id:29},164,'5562999998888',estado());a.equal(repetido,id);a.equal(db.tabelas.proposta.length,1);a.equal(db.tabelas.atendimento_etiquetas.length,1);
 }finally{ctx.universalTeste.parar()}
});
test('mesmo canal de leads encaminha Vero e alternativa Nio aos respectivos BKOs e remetentes',async()=>{
 const {ctx,db,envios}=preparar();try{
  const cfg=db.tabelas.fluxos[0].nos[0].dados.bko_configuracao;
  cfg.contatos.push({canal_trafego_id:165,operadora:'Vero',numero:'5562998000082',canal_envio_id:165},{canal_trafego_id:165,operadora:'Nio',numero:'5562981072373',canal_envio_id:164});ctx.sessoes['165']=ctx.sessoes['164'];
  for(const [i,operadora]of ['Vero','Nio'].entries()){
   const s=estado();s.dados.operadora=operadora;const id=await ctx.universalTeste.registrar({id:30},165,'556299999880'+i,s);await ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta.find(p=>p.id===id)));
   const p=db.tabelas.proposta.find(p=>p.id===id);a.equal(p.operadora,operadora);a.equal(p.dados_customizados.universal_entrega.numero,operadora==='Vero'?'5562998000082':'5562981072373');a.equal(p.dados_customizados.universal_entrega.canal_id,operadora==='Vero'?165:164);
  }a.equal(envios.length,6);
 }finally{ctx.universalTeste.parar();}
});

test('desmarcar WhatsApp mantém a venda no CRM e impede a entrega', async () => {
    const { ctx, db, envios } = preparar();
    try {
        await ctx.universalTeste.registrar({ id: 29 }, 164, '5562999998888', estado(), { crm: true, whatsapp: false });
        a.equal(db.tabelas.proposta.length, 1);
        a.equal(db.tabelas.proposta[0].dados_customizados.bko_pendente, 'DESATIVADO');
        await ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta[0]));
        a.equal(envios.length, 0);
    } finally { ctx.universalTeste.parar(); }
});

test('desmarcar CRM impede uma inserção acidental', async () => {
    const { ctx, db } = preparar();
    try {
        await a.rejects(() => ctx.universalTeste.registrar({ id: 29 }, 164, '5562999998888', estado(), { crm: false, whatsapp: false }), /desativado/);
        a.equal(db.tabelas.proposta.length, 0);
    } finally { ctx.universalTeste.parar(); }
});
test('cadastro repetido usa a mesma venda; RG aberto não duplica anexo no WhatsApp', async () => { const { ctx, db, envios } = preparar(); try {
    const s = estado(), id = await ctx.universalTeste.registrar({ id: 29 }, 164, '5562999998888', s);
    a.equal(await ctx.universalTeste.registrar({ id: 29 }, 164, '5562999998888', s), id);
    a.equal(db.tabelas.proposta.length, 1);
    a.equal(db.tabelas.proposta[0].dados_customizados.bko_pendente, 'SIM');
    await ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta[0]));
    a.equal(envios.length, 3);
    a.ok(envios.every(e => e.n === '5562981072373'));
    a.equal(db.tabelas.proposta[0].dados_customizados.bko_pendente, 'ENVIADO');
    await ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta[0]));
    a.equal(envios.length, 3);
}
finally {
    ctx.universalTeste.parar();
} });
test('recibo pendente não vira enviado e não provoca reenvio cego', async () => { const { ctx, db, envios } = preparar({ falharRecibo: true }); try {
    await ctx.universalTeste.registrar({ id: 29 }, 164, '5562999998888', estado());
    await a.rejects(() => ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta[0])), /Recibo pendente/);
    a.notEqual(db.tabelas.proposta[0].dados_customizados.bko_pendente, 'ENVIADO');
    await a.rejects(() => ctx.universalTeste.entregar(structuredClone(db.tabelas.proposta[0])), /Aguardando confirma/);
    a.equal(envios.length, 1);
}
finally {
    ctx.universalTeste.parar();
} });
