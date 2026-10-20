const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; }, Buffer, process });
  return exports;
}
const helper = load('app/lib/recuperacao-cpf-grupoprime.ts');
function cpf(base) { let v = base; for (let pos = 9; pos <= 10; pos++) { let soma = 0; for (let i = 0; i < pos; i++) soma += Number(v[i]) * (pos + 1 - i); v += String(((soma * 10) % 11) % 10); } return v; }
const anterior = cpf('123456789'), novo = cpf('234567890');
const body = () => ({ numero: '5511999999999', proposta_id: 42, cpf_reprovado: anterior, cpf_novo: novo, nome_novo_titular: 'Pessoa Nova', nascimento_novo_titular: '12/03/1990', nome_mae_novo_titular: 'Pessoa Mae', autorizacao_novo_titular: 'SIM' });
test('valida dígitos do CPF, diferença e autorização do novo titular', () => {
  assert.equal(helper.cpfValido(anterior), true); assert.equal(helper.cpfValido(novo), true);
  for (const cpf of ['00000000000','11111111111',`${novo.slice(0,-1)}${(Number(novo.at(-1))+1)%10}`]) assert.equal(helper.cpfValido(cpf), false);
  assert.throws(() => helper.validarRecuperacaoCpf({ ...body(), cpf_novo: anterior }), /diferente/);
  assert.throws(() => helper.validarRecuperacaoCpf({ ...body(), autorizacao_novo_titular: 'NÃO' }), /autorização/);
  assert.throws(() => helper.validarRecuperacaoCpf({ ...body(), nascimento_novo_titular: '31/02/1990' }), /nascimento/);
});
function api(overrides = {}) {
  const db = { row: { id: 42, workspace_id: 'grupoprime', cpf: anterior, nome: 'Pessoa Anterior', data_nascimento: '1980-01-01', nome_mae: 'Mae Anterior', rg: 'RG antigo', email: 'antigo@example.test', status_venda: 'CPF Reprovado', updated_at: '2026-10-16T10:00:00Z', dados_customizados: { manter: 'sim' }, plano: 'preservar' }, writes: 0, payload: null, ...overrides };
  db.from = table => {
    assert.equal(table, 'proposta'); let payload; const filtros = [];
    const q = { select() { return q; }, eq(k, v) { filtros.push([k,v]); return q; }, is(k,v) { filtros.push([k,v]); return q; },
      update(p) { payload=p; if (db.concorrencia) db.row.status_venda='INSTALADA'; return q; },
      async maybeSingle() {
        if (!db.row || !filtros.every(([k,v]) => db.row[k] === v)) return { data: null, error: null };
        if (payload) { db.payload = payload; db.row = { ...db.row, ...payload }; db.writes++; }
        return { data: { ...db.row }, error: null };
      },
    }; return q;
  };
  const mod = load('app/api/crm/grupoprime/recuperar-cpf/route.ts', {
    'node:crypto': require('node:crypto'),
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '../../../_auth': { supabaseServer: db, autenticarWorkspace: async (_, ws) => { assert.equal(ws, 'grupoprime'); return { workspaceId: ws }; }, exigirPermissao() {}, respostaErroAcesso: e => ({ status: e.statusCode || 500, message: e.message }) },
    '../../../../lib/recuperacao-cpf-grupoprime': helper,
    '../_documentos': { documentosDaSessaoGrupoPrime: async () => { if(db.docError) throw Object.assign(Error('Documentos pendentes'),{statusCode:422}); return {documentos:{rg_frente:[{url:'frente-privada'}],rg_verso:[{url:'verso-privado'}],comprovante_endereco:[{url:'comprovante-privado'}]}}; } },
  });
  return { db, post: data => mod.POST({ headers: new Headers(), text: async () => JSON.stringify(data) }), raw: mod.POST };
}
test('altera a mesma venda, guarda histórico e limpa documentos do titular anterior', async () => {
  const a = api(), r = await a.post(body());
  assert.equal(r.status, 200); assert.equal(a.db.writes, 1); assert.equal(a.db.row.id, 42);
  assert.equal(a.db.row.cpf, novo); assert.equal(a.db.row.status_venda, 'AGUARDANDO AUDITORIA');
  assert.equal(a.db.row.nome, 'Pessoa Nova'); assert.equal(a.db.row.data_nascimento, '1990-03-12');
  assert.equal(a.db.row.plano, 'preservar'); assert.equal(a.db.row.rg, null);
  assert.equal(a.db.row.dados_customizados.manter, 'sim');
  assert.equal(a.db.row.dados_customizados.recuperacao_cpf_historico[0].cpf_anterior, anterior);
  assert.equal(a.db.row.dados_customizados.recuperacao_cpf_historico[0].titular_anterior.nome, 'Pessoa Anterior');
  const retry = await a.post(body()); assert.equal(retry.status, 200); assert.equal(retry.body.ja_processado, true); assert.equal(a.db.writes, 1);
});
test('bloqueia outra conta, mudança do BKO e CPF anterior divergente', async () => {
  const outra = api(); outra.db.row.workspace_id = 'outro'; assert.equal((await outra.post(body())).status, 404); assert.equal(outra.db.writes,0);
  const alterada = api(); alterada.db.row.status_venda = 'INSTALADA'; assert.equal((await alterada.post(body())).status,409); assert.equal(alterada.db.writes,0);
  const cpfMudou = api(); cpfMudou.db.row.cpf = cpf('345678901'); assert.equal((await cpfMudou.post(body())).status,409); assert.equal(cpfMudou.db.writes,0);
  const concorrente = api({ concorrencia: true }); assert.equal((await concorrente.post(body())).status,409); assert.equal(concorrente.db.row.status_venda,'INSTALADA'); assert.equal(concorrente.db.writes,0);
});
test('novo CPF não volta para auditoria se os documentos estiverem pendentes',async()=>{
  const a=api({docError:true});const r=await a.post(body());assert.equal(r.status,422);assert.equal(a.db.writes,0);assert.equal(a.db.row.cpf,anterior);
});
test('token de leitura da viabilidade não autoriza alteração de titular', async () => {
  const old = process.env.WOLF_VIABILIDADE_SECRET; process.env.WOLF_VIABILIDADE_SECRET='teste';
  try { const token = require('node:crypto').createHmac('sha256','teste').update('wolf:viabilidade:grupoprime:v1').digest('hex');
    const a=api(); const r=await a.raw({headers:new Headers({'x-wolf-recuperacao-token':token}),text:async()=>JSON.stringify(body())});
    assert.equal(r.status,401); assert.equal(a.db.writes,0);
  } finally { if (old === undefined) delete process.env.WOLF_VIABILIDADE_SECRET; else process.env.WOLF_VIABILIDADE_SECRET=old; }
});
test('recuperação usa mensagem literal, CPF diferente e dados novos, sem reiniciar oferta', () => {
  const f=helper.blocosRecuperacaoGrupoPrime('https://teste','token','chave');
  assert.equal(f.nos.find(n=>n.id==='prime_reversao_enviada').tipo,'finalizar');
  assert.equal(f.conexoes.find(c=>c.de==='prime_reversao_atualizar'&&c.saidaIndex===1).para,'prime_reversao_pendencia');
  assert.equal(f.nos.find(n=>n.id==='prime_reversao_pendencia').tipo,'texto');
  const ia=f.nos.find(n=>n.tipo==='fluxo_ia');
  assert.equal(ia.dados.mensagem_inicial,helper.MENSAGEM_CPF_REPROVADO); assert.equal(ia.dados.mensagem_inicial_literal,true);
  assert.equal(ia.dados.variaveis.find(v=>v.nome==='cpf_novo').diferente_de,'cpf_reprovado');
  const snapshot=f.nos.find(n=>n.id==='prime_reversao_snapshot');
  const vars={cpf:anterior,cpf_novo:'resto de sessão anterior',nome_novo_titular:'nome antigo'};
  new Function('variaveis','setVariable',snapshot.dados.codigo)(vars,(k,v)=>{vars[k]=v;});
  assert.equal(vars.cpf_reprovado,anterior); assert.equal(vars.cpf_novo,undefined); assert.equal(vars.nome_novo_titular,undefined);
  Object.assign(vars,body(),{nome_novo_titular:'Pessoa "Nova"'});
  new Function('variaveis','setVariable',f.nos.find(n=>n.id==='prime_reversao_payload').dados.codigo)(vars,(k,v)=>{vars[k]=v;});
  assert.equal(JSON.parse(vars.recuperacao_payload).nome_novo_titular,'Pessoa "Nova"');
});
test('avisos exigem origem auditoria e preservam texto de biometria sem placeholders vazios', () => {
  const f=helper.blocosAvisosInstalacaoGrupoPrime();
  assert.deepEqual(Array.from(f.nos.filter(n=>n.tipo==='gatilho_crm'&&n.dados.campo==='status_venda'),n=>n.dados.valor),['AGUARDANDO INSTALAÇÃO','GERADA','APROVADA','SEM DISPONIBILIDADE']);
  assert.equal(f.nos.find(n=>n.tipo==='condicao').dados.valor,'AGUARDANDO AUDITORIA');
  assert.equal(f.nos.find(n=>n.tipo==='texto').dados.texto,helper.MENSAGEM_ANDAMENTO_INSTALACAO);
  const vars={data_agendamento:'2026-10-20',periodo_instalacao:'Manhã',nome:'Cliente'};
  const script=f.nos.find(n=>n.tipo==='script').dados.codigo;
  new Function('variaveis','setVariable',script)(vars,(k,v)=>{vars[k]=v;}); assert.equal(vars.data_agendamento,'20/10/2026');
  const vazio={}; new Function('variaveis','setVariable',script)(vazio,(k,v)=>{vazio[k]=v;}); assert.equal(vazio.data_agendamento,'A confirmar'); assert.equal(vazio.periodo_instalacao,'A confirmar');
});
test('falta de disponibilidade tem aviso e encerramento automático com etiqueta de retorno', () => {
  const f=load('app/lib/vendedor-grupoprime.ts').criarVendedorGrupoPrime('https://teste','token');
  const c=f.nos.find(n=>n.tipo==='fluxo_ia').dados.consultas[0];
  assert.equal(c.retorno_negativo_finalizar_atendimento,true); assert.equal(c.retorno_negativo_aplicar_etiqueta,true);
  assert.equal(c.retorno_negativo_nome_etiqueta,'AGUARDANDO COBERTURA'); assert.match(c.retorno_negativo_mensagem,/retornaremos o contato/);
});
