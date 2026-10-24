'use strict';
// Casos sintéticos: não cadastra vendas nem envia WhatsApp.
const a = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const root = process.argv[2] || __dirname;
const { criarInterpretador } = require(path.join(root, 'interpretacao.cjs')), { planosDaCidade } = require(path.join(root, 'planos-grupoprime.cjs')), { inicial } = require(path.join(root, 'conversa.cjs'));
const i = criarInterpretador({ ...JSON.parse(fs.readFileSync(path.join(root, 'credencial.json'))), catalogo: planosDaCidade });
(async () => {
    const s = inicial();
    s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150' };
    const casos = [
        { etapa: 'localidade', texto: 'Moro em Goiânia Goiás', verificar: r => { a.equal(r.dados.estado, 'GO'); a.match(r.dados.cidade, /Goi[aâ]nia/i); } },
        { etapa: 'complemento', texto: 'q2 lt01', verificar: r => { a.equal(Number(r.dados.quadra), 2); a.equal(Number(r.dados.lote), 1); } },
        { etapa: 'telefone1', texto: 'é esse mesmo aqui', verificar: r => a.equal(r.usar_whatsapp, true) },
        { etapa: 'confirmacao', texto: 'tudo ok', verificar: r => a.equal(r.confirmacao, true) },
        { etapa: 'confirmacao', texto: 'não, tá tudo certo', verificar: r => { a.equal(r.confirmacao, true); a.equal(r.encerrar, false); } },
        { etapa: 'plano', texto: '110 pode ser esse', verificar: r => a.equal(r.plano_id, 'pf-fibra-padrao') },
        { etapa: 'nome', texto: 'Maria Exemplo. CPF 52998224725. Nascimento 23 janeiro 2002', verificar: r => { a.ok(r.dados.nome); a.equal(r.dados.cpf.replace(/\D/g, ''), '52998224725'); a.ok(r.dados.data_nascimento); } },
    ];
    for (const c of casos) {
        s.etapa = c.etapa;
        s.dados.tipo_pessoa = 'PF';
        s.ofertas = planosDaCidade('GO', 'Goiânia').pessoa_fisica.map(p => p.id);
        const r = await i.extrair({ estado: s, texto: c.texto, numero: '5562999998888' });
        c.verificar(r);
        console.log(JSON.stringify({ caso: c.etapa, ok: true }));
    }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
