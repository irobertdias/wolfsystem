import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso, supabaseServer } from '../../_auth';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, request.nextUrl.searchParams.get('workspaceId') || '');
    exigirPermissao(acesso, 'configuracoes_workspace');
    if (acesso.workspaceId !== 'grupoprime') return NextResponse.json({ error: 'Painel disponível no piloto Grupo Prime.' }, { status: 403 });
    const pagina = Math.max(1, Math.min(10000, Number(request.nextUrl.searchParams.get('pagina')) || 1));
    const { data, error, count } = await supabaseServer.from('proposta')
      .select('id,nome,plano,valor_plano,operadora,status_venda,data_agendamento,periodo_instalacao,created_at,updated_at,dados_customizados', { count: 'exact' })
      .eq('workspace_id', acesso.workspaceId).not('dados_customizados->>bko_pendente', 'is', null)
      .order('id', { ascending: false }).range((pagina-1)*25, pagina*25-1);
    if (error) throw error;
    const ler = (v: unknown): Record<string, any> => { try { return typeof v === 'string' ? JSON.parse(v) : v || {}; } catch { return {}; } };
    const vendas = (data || []).map(p => {
      const c = ler(p.dados_customizados), u = c.universal_entrega;
      const entregas = u ? [u] : Object.entries(ler(c.bko_envio).destinatarios || {}).map(([numero, meta]) => ({ ...meta as object, numero, canal_id: ler(c.bko_envio).canal_id }));
      return { ...p, dados_customizados: undefined, estado_envio: c.bko_pendente, erro: c.bko_erro || '', referencia: c.bko_ref || '',
        entregas: entregas.map((e: any) => ({ numero: e.numero, canal_id: e.canal_id, concluido: !!e.concluido, partes: (e.partes || []).map((m: any) => ({ tipo: m.tipo, texto: m.texto || m.conteudo || '', nome: m.arquivo?.nome || m.nome || '', arquivo: m.arquivo?.url || '', estado: m.estado, id: m.id || '', ack: m.ack, em: m.enviado_em || m.confirmado_em || '' })) })),
        retornos: c.bko_retornos || [], acoes: c.universal_acoes || [] };
    });
    return NextResponse.json({ success: true, vendas, total: count, pagina });
  } catch (e) { const r = respostaErroAcesso(e); return NextResponse.json({ success: false, error: r.status === 500 ? 'Não foi possível consultar os envios.' : r.message }, { status: r.status }); }
}
