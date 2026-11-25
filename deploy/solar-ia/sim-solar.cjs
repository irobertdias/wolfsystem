// Simula a Vendedora IA de energia solar sem WhatsApp (usa a API /api/solar/agente de verdade).
//   node sim-solar.cjs <workspace> "<mensagem>"  |  node sim-solar.cjs <workspace> --novo
//   IMG=/caminho/conta.jpg node sim-solar.cjs <workspace> ""   → manda a imagem como se fosse a foto da conta
require('dotenv').config({ path: '/root/wolf-whatsapp/.env', quiet: true });
const fs = require('fs');
const sb = require('/root/wolf-whatsapp/node_modules/@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const [ws, msg] = [process.argv[2] || 'demo', process.argv[3] ?? ''];
const EST = `/tmp/sim-solar-${ws}.json`;
(async () => {
  if (msg === '--novo') { fs.writeFileSync(EST, '{}'); return console.log('novo'); }
  const vars = fs.existsSync(EST) ? JSON.parse(fs.readFileSync(EST, 'utf8')) : {};
  const { data: f40 } = await sb.from('fluxos').select('nos').eq('id', 40).single();
  const apiKey = f40.nos.find((n) => n.tipo === 'assistente_universal').dados.apiKey;
  const f = { id: 0, nos: [
    { id: 'a', tipo: 'assistente_universal', dados: { nome: 'Luna', empresa: 'Sol Forte Energia', apiKey, modelo: 'gpt-4.1' } },
    { id: 'n', tipo: 'nicho_atendimento', dados: { integracao: 'solar_sistema' } },
    { id: 't', tipo: 'transferir', dados: { fila: 'VENDAS', mensagem: '{{handoff_mensagem}}' } }], conexoes: [{ de: 'a', para: 'n', saidaIndex: 0 }] };
  const ctx = { supabase: sb, AUDIOS_DIR: '/root/wolf-whatsapp/audios', verificarBloqueioManualBot: async () => ({}), salvarSessaoFluxo: async () => {}, sessoes: {} };
  const ARQ = '/root/wolf-whatsapp/src/services/solar-ia/atendimento.cjs'; delete require.cache[ARQ];
  const processar = require(ARQ)({ ctx, previous: null, log: (n, m) => console.log('   [log] ' + m) });
  let texto = msg;
  if (process.env.IMG) texto = `[imagem: ${process.env.IMG}] ${msg}`.trim();
  console.log('👤 ' + texto);
  const t0 = Date.now();
  const r = await processar(f, f.nos[1], vars, texto, null, async (t) => console.log('\n🤖 ' + String(t).replace(/\n/g, '\n   ') + '\n'), { workspaceId: ws, canalId: 0, numero: '5562900000041' });
  fs.writeFileSync(EST, JSON.stringify(vars));
  const s = JSON.parse(vars.__solar_ia || '{}');
  console.log(`   [${((Date.now() - t0) / 1000).toFixed(1)}s] retorno=${JSON.stringify(r)} conta=${JSON.stringify(s.conta || {})} proposta=${JSON.stringify(s.proposta || null)}${s.erro ? ' ERRO=' + s.erro : ''}`);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
