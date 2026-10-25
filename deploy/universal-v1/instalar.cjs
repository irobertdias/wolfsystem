'use strict';
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { PROMPT_TELECOM_NIO, conclusaoUniversalInicial } = require('./configuracao-universal.cjs');
async function main() {
    const root = fs.realpathSync(process.argv[2] || '/root/wolf-whatsapp');
    if (root !== '/root/wolf-whatsapp')
        throw Error('Use a raiz explícita /root/wolf-whatsapp');
    require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env'), quiet: true });
    const db = require(path.join(root, 'node_modules/@supabase/supabase-js')).createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const backup = path.join(root, 'backups', 'universal-v1-' + Date.now());
    fs.mkdirSync(backup, { mode: 0o700 });
    const { data: canal, error: ec } = await db.from('conexoes').select('*').eq('workspace_id', 'grupoprime').eq('id', 164).single();
    if (ec)
        throw ec;
    const { data: fluxos, error: ef } = await db.from('fluxos').select('*').eq('workspace_id', 'grupoprime');
    if (ef)
        throw ef;
    fs.writeFileSync(path.join(backup, 'banco.json'), JSON.stringify({ canal, fluxos }), { mode: 0o600 });
    fs.copyFileSync(path.join(root, 'index.js'), path.join(backup, 'index.js'));
    const destino = path.join(root, 'src/services/universal-v1');
    if (!destino.startsWith(root + '/src/services/'))
        throw Error('Destino inseguro');
    if (fs.existsSync(destino))
        fs.cpSync(destino, path.join(backup, 'universal-v1'), { recursive: true });
    fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
    for (const f of ['vtal.cjs', 'conversa.cjs', 'documentos.cjs', 'pos-venda.cjs', 'interpretacao.cjs', 'runtime.cjs','alternativa-nio-bko.cjs','entrega-resposta.cjs','etiquetas-vendas.cjs','disponibilidade-retentativa.cjs','finalizar-conversa.cjs','objecao-documentos.cjs','retencao-venda.cjs','inviaveis-inativos.cjs','entradas-sem-resposta.cjs','normalizacao-entrada.cjs','agendamento-contato.cjs','lembretes-universais.cjs', 'planos-grupoprime.cjs', 'configuracao-universal.cjs', 'universal.test.cjs', 'entrega.test.cjs', 'configuracao.test.cjs', 'avaliar-ia.cjs', 'ensaio.cjs', 'pos-venda.test.cjs']) {
        execFileSync(process.execPath, ['--check', path.join(__dirname, f)]);
        fs.copyFileSync(path.join(__dirname, f), path.join(destino, f));
    }
    fs.cpSync(path.join(__dirname, 'indice-vtal'), path.join(destino, 'indice-vtal'), { recursive: true });
    if (!fs.existsSync(path.join(destino, 'credencial.json'))) {
        let key = process.env.OPENAI_API_KEY, model = 'gpt-4o-mini';
        if (!key) {
            for (const file of fs.readdirSync(path.join(root, 'backups')).filter(n => /^venda-fluida-config-\d+\.json$/.test(n)).sort().reverse()) {
                const b = JSON.parse(fs.readFileSync(path.join(root, 'backups', file)));
                const no = b.find(f => f.id === 27)?.nos.find(n => n.dados?.apiKey);
                if (no) {
                    key = no.dados.apiKey;
                    model = no.dados.modelo || no.dados.model || model;
                    break;
                }
            }
        }
        if (!key)
            throw Error('Configure a chave da IA no servidor antes de instalar');
        fs.writeFileSync(path.join(destino, 'credencial.json'), JSON.stringify({ apiKey: key, model }), { mode: 0o600 });
    }
    let index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    const linha = 'require("./src/services/universal-v1/runtime.cjs")(ctx);';
    if (!index.includes(linha)) {
        const ancora = 'require("./src/services/bko-vero.js")(ctx);';
        if (!index.includes(ancora))
            throw Error('Inicializador inesperado: instalação interrompida');
        index = index.replace(ancora, ancora + '\n' + linha);
        fs.writeFileSync(path.join(root, 'index.js'), index);
    }
    execFileSync(process.execPath, ['--check', path.join(root, 'index.js')]);
    let fluxo = fluxos.find(f => f.nos?.some(n => n.tipo === 'assistente_universal' && n.dados?.runtime === 'universal-v1'));
    if (!fluxo) {
        const payload = { workspace_id: 'grupoprime', nome: 'Grupo Prime · Nio · Universal V1', descricao: 'Piloto: cidade/UF, consulta exata VTAL, ofertas PF/PJ, cadastro, confirmação, documentos e envio automático ao BKO.', ativo: false, trigger_tipo: 'primeiro_contato', trigger_valor: '', nos: [{ id: 'universal_inicio', tipo: 'inicio', x: 150, y: 100, dados: { mensagem: '' }, saidas: ['Próximo'] }, { id: 'universal_assistente', tipo: 'assistente_universal', x: 150, y: 270, dados: { versao: 1, runtime: 'universal-v1', nome: 'a assistente virtual de vendas', empresa: 'Grupo Prime', papel: 'vendas', tom: 'acolhedor', confirmarAntesDeExecutar: true }, saidas: ['Configurar nicho'] }, { id: 'universal_nicho', tipo: 'nicho_atendimento', x: 150, y: 480, dados: { versao: 1, nicho: 'telecom', integracao: 'vtal', objetivo: 'Vender planos Nio por endereço confirmado na base VTAL', campos: ['cidade', 'estado', 'cep', 'endereco', 'tipo_pessoa', 'plano', 'nome', 'cpf', 'data_nascimento', 'nome_mae', 'email', 'telefone1', 'vencimento', 'forma_pagamento'], fontes: 'VTAL: https://vtal.wolfgyn.com.br/api/cep · Índice local de ruas · Tabela Nio por cidade/UF · BKO configurado no sistema' }, saidas: ['Atendimento configurado'] }], conexoes: [{ id: 'u1', de: 'universal_inicio', para: 'universal_assistente', saidaIndex: 0 }, { id: 'u2', de: 'universal_assistente', para: 'universal_nicho', saidaIndex: 0 }] };
        payload.nos.find(n => n.tipo === 'nicho_atendimento').dados.prompt = PROMPT_TELECOM_NIO;
        payload.nos.push({ id: 'universal_conclusao', tipo: 'concluir_venda_universal', x: 150, y: 690, dados: conclusaoUniversalInicial(), saidas: [] });
        payload.conexoes.push({ id: 'universal_nicho_conclusao', de: 'universal_nicho', para: 'universal_conclusao', saidaIndex: 0 });
        const r = await db.from('fluxos').insert(payload).select('*').single();
        if (r.error)
            throw r.error;
        fluxo = r.data;
    }
    fs.writeFileSync(path.join(destino, 'piloto.json'), JSON.stringify({ workspace: 'grupoprime', fluxoId: fluxo.id, canalId: 164, backup }), { mode: 0o600 });
    console.log(JSON.stringify({ instalado: true, fluxoId: fluxo.id, ativo: fluxo.ativo, backup, canalId: 164 }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
