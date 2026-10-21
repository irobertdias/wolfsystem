import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso, supabaseServer } from '../../../_auth';
import { documentosDaSessaoGrupoPrime } from '../_documentos';
import { cpfValido, dataNascimentoISO } from '../../../../lib/recuperacao-cpf-grupoprime';
import { consultarVero } from '../../../../lib/vero';
import { conferirCadastroGrupoPrime } from '../../../../lib/cadastro-grupoprime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const responder = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const token = request.headers.get('x-wolf-documentos-token');
    if (token !== null) {
      const segredo = process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!segredo) throw Object.assign(new Error('Integração não configurada.'), { statusCode: 503 });
      const esperado = createHmac('sha256', segredo).update('wolf:documentos:grupoprime:vero:v1').digest('hex');
      if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) throw Object.assign(new Error('Credencial inválida.'), { statusCode: 401 });
    } else {
      const acesso = await autenticarWorkspace(request, 'grupoprime');
      exigirPermissao(acesso, 'configuracoes_workspace');
    }
    const raw = await request.text();
    if (raw.length > 1000) return responder({ success: false, error: 'Dados inválidos.' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return responder({ success: false, error: 'JSON inválido.' }, 400); }
    const { documentos, sessao, variaveis: vars } = await documentosDaSessaoGrupoPrime(supabaseServer, body?.numero, '', undefined, true);
    const contatosCobranca = conferirCadastroGrupoPrime(vars);
    const reprovacao = () => { throw Object.assign(new Error('Cadastro ou plano não conferem. Encaminhe ao BKO.'), { statusCode: 422 }); };
    if (!cpfValido(vars.cpf) || !dataNascimentoISO(vars.data_nascimento) || String(vars.nome || '').trim().length < 5 || String(vars.nome_mae || '').trim().length < 5 || !vars.endereco_completo || !vars.forma_pagamento) reprovacao();
    const consulta = await consultarVero(vars.cep);
    if (consulta.status !== 'pre_viavel_por_cidade' || !consulta.planos) reprovacao();
    const tipo = String(vars.tipo_pessoa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const publico = ['PF', 'CPF', 'PESSOA FISICA'].includes(tipo) ? 'PF' : ['PJ', 'CNPJ', 'PESSOA JURIDICA'].includes(tipo) ? 'PJ' : null;
    const plano = (publico ? consulta.planos : []).find(p => p.id === vars.plano_interesse);
    if (!plano) reprovacao();
    const forma = String(vars.forma_pagamento).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    if (!['CARTAO', 'BOLETO', 'PIX'].includes(forma)) reprovacao();
    const cartao = forma === 'CARTAO';
    return responder({ success: true, sessao_id: sessao.id, documentos,
      cadastro: { cpf: String(vars.cpf).replace(/\D/g, ''), nome: vars.nome, data_nascimento: dataNascimentoISO(vars.data_nascimento), nome_mae: vars.nome_mae,
        rg: vars.rg || '', cep: consulta.cep, cidade: consulta.cidade, estado: consulta.uf, endereco: vars.endereco_completo,
        plano: plano!.nome, valor_plano: cartao && plano!.mensalidade_cartao !== null ? plano!.mensalidade_cartao : plano!.mensalidade,
        operadora: 'Vero', ...contatosCobranca,
        forma_pagamento: { CARTAO: 'Cartão de Crédito', BOLETO: 'Boleto Bancário', PIX: 'PIX' }[contatosCobranca.forma_pagamento] },
    });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return responder({ success: false, error: status === 500 ? 'Não foi possível conferir os documentos. Encaminhe ao BKO.' : message }, status);
  }
}
