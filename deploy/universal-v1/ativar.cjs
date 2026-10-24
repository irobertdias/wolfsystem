'use strict';
const fs = require('node:fs'), path = require('node:path');
(async () => {
    const root = fs.realpathSync(process.argv[2] || '/root/wolf-whatsapp');
    if (root !== '/root/wolf-whatsapp')
        throw Error('Raiz inválida');
    require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env'), quiet: true });
    const db = require(path.join(root, 'node_modules/@supabase/supabase-js')).createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const piloto = JSON.parse(fs.readFileSync(path.join(root, 'src/services/universal-v1/piloto.json')));
    const { data: cfg, error } = await db.from('fluxos').select('nos').eq('workspace_id', 'grupoprime').eq('id', 27).single();
    if (error)
        throw error;
    const bko = cfg.nos.find(n => n.id === 'prime_documentos_enviar')?.dados?.bko_configuracao;
    if (!bko?.ativo || !bko.contatos?.some(c => Number(c.canal_trafego_id) === piloto.canalId))
        throw Error('Configure a regra BKO por canal antes de ativar');
    const segredo = process.env.WOLF_INTERNAL_API_SECRET || process.env.WOLF_SIGNATURE_PROXY_SECRET;
    const r = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/universal/health`, { headers: { 'x-wolf-internal-secret': segredo } });
    const h = await r.json();
    if (!r.ok || !h.pronto)
        throw Error('Serviço não está pronto');
    const { data: c, error: ce } = await db.from('conexoes').select('id,status,modo,fluxo_id,workspace_id').eq('workspace_id', 'grupoprime').eq('id', piloto.canalId).single();
    if (ce)
        throw ce;
    if (c.status !== 'conectado')
        throw Error('Conecte o canal do piloto antes de ativar');
    if (c.modo !== 'nenhum' && String(c.fluxo_id) !== String(piloto.fluxoId))
        throw Error('O canal está executando outra automação; nenhuma configuração substituída');
    const f = await db.from('fluxos').update({ ativo: true }).eq('workspace_id', 'grupoprime').eq('id', piloto.fluxoId);
    if (f.error)
        throw f.error;
    const u = await db.from('conexoes').update({ modo: 'fluxo', fluxo_id: String(piloto.fluxoId) }).eq('workspace_id', 'grupoprime').eq('id', piloto.canalId).eq('modo', c.modo).select('id').single();
    if (u.error) {
        await db.from('fluxos').update({ ativo: false }).eq('workspace_id', 'grupoprime').eq('id', piloto.fluxoId);
        throw u.error;
    }
    console.log(JSON.stringify({ ativo: true, workspace: 'grupoprime', canalId: piloto.canalId, fluxoId: piloto.fluxoId, remetenteBko: bko.canal_id, destinoFinal: bko.contatos.find(c => Number(c.canal_trafego_id) === piloto.canalId).numero.slice(-4) }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
