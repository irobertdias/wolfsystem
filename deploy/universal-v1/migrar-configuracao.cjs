'use strict';
const fs = require('node:fs'), path = require('node:path');
const { PROMPT_TELECOM_NIO, conclusaoUniversalInicial } = require('./configuracao-universal.cjs');
async function main() {
    const root = fs.realpathSync(process.argv[2] || '/root/wolf-whatsapp');
    if (root !== '/root/wolf-whatsapp') throw Error('Raiz inválida');
    require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env'), quiet: true });
    const db = require(path.join(root, 'node_modules/@supabase/supabase-js')).createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: fluxo, error } = await db.from('fluxos').select('*').eq('workspace_id', 'grupoprime').eq('id', 29).single();
    if (error) throw error;
    const nicho = fluxo.nos.find(n => n.tipo === 'nicho_atendimento' && n.dados.nicho === 'telecom');
    if (!nicho) throw Error('Nicho telecom ausente; nenhuma configuração substituída');
    const backup = path.join(root, 'backups', 'universal-configuracao-' + Date.now() + '.json');
    fs.writeFileSync(backup, JSON.stringify(fluxo), { mode: 0o600 });
    const nos = fluxo.nos.map(n => n.id === nicho.id ? { ...n, dados: { ...n.dados, runtime: 'universal-v1', prompt: n.dados.prompt || PROMPT_TELECOM_NIO } } : n);
    let fim = nos.find(n => n.tipo === 'concluir_venda_universal');
    if (!fim) {
        fim = { id: 'universal_conclusao', tipo: 'concluir_venda_universal', x: nicho.x, y: nicho.y + 210, dados: conclusaoUniversalInicial(), saidas: [] };
        nos.push(fim);
    }
    const conexoes = [...fluxo.conexoes];
    const existentes = conexoes.filter(c => c.de === nicho.id && Number(c.saidaIndex) === 0);
    if (existentes.some(c => c.para !== fim.id)) throw Error('O nicho já possui outra saída; nenhuma conexão removida');
    if (!existentes.length) conexoes.push({ id: 'universal_nicho_conclusao', de: nicho.id, para: fim.id, saidaIndex: 0 });
    const salvo = await db.from('fluxos').update({ nos, conexoes }).eq('workspace_id', 'grupoprime').eq('id', 29)
        .eq('nos', JSON.stringify(fluxo.nos)).eq('conexoes', JSON.stringify(fluxo.conexoes)).select('id').maybeSingle();
    if (salvo.error) throw salvo.error;
    if (!salvo.data) throw Error('O fluxo foi editado durante a atualização; recarregue e tente novamente');
    console.log(JSON.stringify({ fluxoId: salvo.data.id, promptNoNicho: true, conclusao: fim.dados, ativoPreservado: fluxo.ativo, backup }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
