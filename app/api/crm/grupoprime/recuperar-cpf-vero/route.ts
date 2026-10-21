import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso, supabaseServer } from '../../../_auth';
import { normalizarCpf, normalizarStatus, validarRecuperacaoCpf } from '../../../../lib/recuperacao-cpf-grupoprime';
import { documentosDaSessaoGrupoPrime } from '../_documentos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function autenticar(request: NextRequest) {
  const token = request.headers.get('x-wolf-recuperacao-token');
  if (token !== null) {
    const segredo = process.env.WOLF_VIABILIDADE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!segredo) throw Object.assign(new Error('Recuperação não configurada.'), { statusCode: 503 });
    const esperado = createHmac('sha256', segredo).update('wolf:recuperacao-cpf:grupoprime:vero:v1').digest('hex');
    if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) throw Object.assign(new Error('Credencial inválida.'), { statusCode: 401 });
    return;
  }
  const acesso = await autenticarWorkspace(request, 'grupoprime');
  exigirPermissao(acesso, 'configuracoes_workspace');
}
const resposta = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: NextRequest) {
  try {
    await autenticar(request);
    const raw = await request.text();
    if (raw.length > 8000) return resposta({ success: false, error: 'Requisição muito grande.' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return resposta({ success: false, error: 'JSON inválido.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return resposta({ success: false, error: 'Dados inválidos.' }, 400);
    const dados = validarRecuperacaoCpf(body);
    const { data: venda, error: erroBusca } = await supabaseServer.from('proposta')
      .select('id,cpf,nome,data_nascimento,nome_mae,rg,email,operadora,status_venda,dados_customizados,updated_at')
      .eq('workspace_id', 'grupoprime').eq('id', dados.propostaId).maybeSingle();
    if (erroBusca) throw erroBusca;
    if (!venda || venda.operadora !== 'Vero') return resposta({ success: false, error: 'Venda não encontrada.' }, 404);
    const custom = venda.dados_customizados || {};
    const historico = Array.isArray(custom.recuperacao_cpf_historico) ? custom.recuperacao_cpf_historico : [];
    const ultima = historico[historico.length - 1];
    if (normalizarStatus(venda.status_venda) === 'AGUARDANDO AUDITORIA' && normalizarCpf(venda.cpf) === dados.cpf && ultima?.cpf_anterior === dados.anterior && ultima?.cpf_novo === dados.cpf) {
      return resposta({ success: true, proposta_id: venda.id, status_venda: venda.status_venda, ja_processado: true });
    }
    if (normalizarStatus(venda.status_venda) !== 'CPF REPROVADO' || normalizarCpf(venda.cpf) !== dados.anterior) {
      return resposta({ success: false, error: 'A venda foi alterada pelo BKO. Encaminhe à equipe para conferência.' }, 409);
    }
    const { documentos } = await documentosDaSessaoGrupoPrime(supabaseServer, body.numero, dados.cpf, dados.propostaId, true);
    const agora = new Date().toISOString();
    const entrada = { registrado_em: agora, cpf_anterior: normalizarCpf(venda.cpf), cpf_novo: dados.cpf,
      titular_anterior: { nome: venda.nome, data_nascimento: venda.data_nascimento, nome_mae: venda.nome_mae, rg: venda.rg, email: venda.email },
      documentos_anteriores: Object.fromEntries(['rg_frente','rg_verso','comprovante_endereco'].map(k => [k, custom[k] || null])),
      autorizacao_novo_titular: true, origem: 'recuperacao_ia_bko' };
    // Histórico e novos dados são gravados juntos; a comparação protege alterações concorrentes do BKO.
    let update = supabaseServer.from('proposta').update({ cpf: dados.cpf, nome: dados.nome,
      data_nascimento: dados.nascimento, nome_mae: dados.mae, rg: null, email: venda.email,
      status_venda: 'AGUARDANDO AUDITORIA', updated_at: agora,
      dados_customizados: { ...custom, ...Object.fromEntries(Object.entries(documentos).map(([k, v]) => [k, JSON.stringify(v)])),
        cpf: dados.cpf, nome: dados.nome, data_nascimento: dados.nascimento, nome_mae: dados.mae, rg: '', email: venda.email || '',
        bko_pendente: 'SIM', bko_envio: null, bko_ref: null, bko_reply_ids: [], bko_erro: '',
        recuperacao_cpf_historico: [...historico, {...entrada,bko_referencia_anterior:custom.bko_ref||null}] },
    }).eq('workspace_id', 'grupoprime').eq('id', venda.id).eq('status_venda', venda.status_venda).eq('cpf', venda.cpf);
    update = venda.updated_at ? update.eq('updated_at', venda.updated_at) : update.is('updated_at', null);
    const { data: atualizada, error: erroUpdate } = await update.select('id,status_venda').maybeSingle();
    if (erroUpdate) throw erroUpdate;
    if (!atualizada) return resposta({ success: false, error: 'A venda mudou durante a atualização. Encaminhe à equipe.' }, 409);
    return resposta({ success: true, proposta_id: atualizada.id, status_venda: atualizada.status_venda });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return resposta({ success: false, error: status === 500 ? 'Não foi possível reenviar a venda para auditoria.' : message }, status);
  }
}
