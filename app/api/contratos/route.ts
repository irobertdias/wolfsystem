import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, respostaErroContratos, supabaseContratos } from "./_auth";

export const dynamic = "force-dynamic";

const CAMPOS = [
  "id", "canal_id", "numero", "fluxo_id", "origem", "proposta_id", "criado_por", "status", "modo_assinatura", "nome_signatario", "cpf_ultimos4",
  "email_signatario", "contrato_nome", "contrato_hash_original", "contrato_hash_assinado",
  "biometria_status", "otp_confirmado_em", "consentimento_versao", "assinatura_em",
  "ip_assinatura", "latitude", "longitude", "auditoria_hmac", "expira_em", "concluida_em", "created_at"
].join(",");

async function contar(workspaceId: string, configurar?: (query: any) => any) {
  let query: any = supabaseContratos.from("assinatura_wolf_sessoes")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .neq("status", "excluida");
  if (configurar) query = configurar(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const acesso = await autenticarContratos(request, params.get("workspaceId") || "");
    const pagina = Math.max(1, Number(params.get("pagina") || 1));
    const limite = Math.max(10, Math.min(100, Number(params.get("limite") || 25)));
    const status = String(params.get("status") || "todos");
    const busca = String(params.get("busca") || "").replace(/[,%()]/g, " ").trim().slice(0, 80);
    const inicio = (pagina - 1) * limite;
    const agora = new Date().toISOString();

    let query: any = supabaseContratos.from("assinatura_wolf_sessoes")
      .select(CAMPOS, { count: "exact" })
      .eq("workspace_id", acesso.workspaceId)
      .neq("status", "excluida")
      .order("created_at", { ascending: false })
      .range(inicio, inicio + limite - 1);

    if (status === "assinados") query = query.eq("status", "concluida");
    if (status === "pendentes") query = query.eq("status", "pendente").gt("expira_em", agora);
    if (status === "expirados") query = query.or(`status.eq.expirada,and(status.eq.pendente,expira_em.lte.${agora})`);
    if (status === "problemas") query = query.in("status", ["recusada", "revogada", "erro"]);
    if (busca) {
      query = query.or(`nome_signatario.ilike.%${busca}%,contrato_nome.ilike.%${busca}%,numero.ilike.%${busca}%`);
    }

    const [lista, total, assinados, pendentes, expiradosMarcados, expiradosPorData, problemas] = await Promise.all([
      query,
      contar(acesso.workspaceId),
      contar(acesso.workspaceId, q => q.eq("status", "concluida")),
      contar(acesso.workspaceId, q => q.eq("status", "pendente").gt("expira_em", agora)),
      contar(acesso.workspaceId, q => q.eq("status", "expirada")),
      contar(acesso.workspaceId, q => q.eq("status", "pendente").lte("expira_em", agora)),
      contar(acesso.workspaceId, q => q.in("status", ["recusada", "revogada", "erro"])),
    ]);

    if (lista.error) throw lista.error;
const idsEnvelope = (lista.data || [])
      .filter((item: any) => item.modo_assinatura === "envelope_v1")
      .map((item: any) => item.id);
    let signatariosPorSessao: Record<string, any[]> = {};
    if (idsEnvelope.length) {
      const { data: signatarios, error: signatariosError } = await supabaseContratos
        .from("assinatura_wolf_signatarios")
        .select("sessao_id,papel,ordem,nome,status,assinatura_em")
        .in("sessao_id", idsEnvelope)
        .order("ordem", { ascending: true });
      if (signatariosError) throw signatariosError;
      signatariosPorSessao = (signatarios || []).reduce((acc: Record<string, any[]>, item: any) => {
        (acc[item.sessao_id] ||= []).push(item);
        return acc;
      }, {});
    }
    const contratos = (lista.data || []).map((item: any) => ({
      ...item,
      status: item.status === "pendente" && Date.parse(item.expira_em) <= Date.now() ? "expirada" : item.status,
      signatarios: signatariosPorSessao[item.id] || [],
    }));

    return NextResponse.json({
      success: true,
      workspaceId: acesso.workspaceId,
      resumo: {
        total,
        assinados,
        pendentes,
        expirados: expiradosMarcados + expiradosPorData,
        problemas,
      },
      contratos,
      paginacao: {
        pagina,
        limite,
        total: lista.count || 0,
        paginas: Math.max(1, Math.ceil((lista.count || 0) / limite)),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}