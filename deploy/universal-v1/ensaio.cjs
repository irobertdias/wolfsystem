'use strict';
// Ensaio em memória com API real. Nenhum CRM/WhatsApp é alterado.
const path = require('node:path'), fs = require('node:fs'), a = require('node:assert/strict');
const root = process.argv[2] || __dirname;
const { criarInterpretador } = require(path.join(root, 'interpretacao.cjs')), { planosDaCidade } = require(path.join(root, 'planos-grupoprime.cjs')), { avancar } = require(path.join(root, 'conversa.cjs')), { criarConsulta } = require(path.join(root, 'vtal.cjs'));
const i = criarInterpretador({ ...JSON.parse(fs.readFileSync(path.join(root, 'credencial.json'))), catalogo: planosDaCidade }), consulta = criarConsulta({ diretorio: path.join(root, 'indice-vtal') });
(async () => {
    let estado;
    const casos = [
        ['Oi', 'localidade'], ['Goiânia Goiás', 'cep'], ['74480150', 'complemento'], ['q4 lt09', 'tipo_pessoa'], ['CPF', 'plano'], ['110 pode ser esse', 'endereco'],
        ['Rua VM B quadra 4 lote 9, bairro Vila Mutirão I', 'nome'], ['Maria Exemplo', 'cpf'], ['52998224725', 'data_nascimento'], ['23 janeiro 2002', 'nome_mae'], ['Ana Exemplo', 'email'], ['maria@example.com', 'confirmar_endereco'], ['tudo certo', 'telefone1'], ['é esse mesmo aqui', 'vencimento'], ['20', 'forma_pagamento'], ['boleto', 'confirmacao'], ['tudo ok', 'documentos']
    ];
    for (const [entrada, esperado] of casos) {
        const r = await avancar({ estado, entrada, numero: '5562999998888', extrair: i.extrair, consultar: consulta, catalogo: planosDaCidade });
        estado = r.estado;
        console.log(JSON.stringify({ etapa: estado.etapa, esperado, ok: estado.etapa === esperado }));
        if (estado.etapa !== esperado) {
            console.log(JSON.stringify({ resposta: r.mensagem, campos: Object.keys(estado.dados) }));
            a.equal(estado.etapa, esperado);
        }
    }
    a.equal(estado.dados.telefone1, '5562999998888');
    a.equal(estado.plano.mensalidade, 110);
    console.log('ENSAIO_COMPLETO_OK');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
