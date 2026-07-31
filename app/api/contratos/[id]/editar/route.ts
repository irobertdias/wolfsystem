import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, exigirFranquiaContratos, exigirPermissaoContratos, respostaErroContratos, supabaseContratos } from "../../_auth";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://api.wolfgyn.com.br";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const acesso = await autenticarContratos(request, String(body.workspaceId || ""));
    exigirPermissaoContratos(acesso, "contratos_editar");
    await exigirFranquiaContratos(acesso);
    const { id } = await context.params;
    const propostaId = body.proposta_id ? Number(body.proposta_id) : null;
    if (propostaId) {
      const { data: proposta } = await supabaseContratos.from("proposta").select("id")
        .eq("id", propostaId).eq("workspace_id", acesso.workspaceId).maybeSingle();
      if (!proposta) return NextResponse.json({ success: false, error: "Cliente do CRM não pertence a este workspace" }, { status: 400 });
    }
    const pdfBase64 = String(body.pdf_base64 || "");
    if (pdfBase64.length > 4_200_000) return NextResponse.json({ success: false, error: "PDF maior que 3 MB" }, { status: 413 });
    const payload = {
      workspace_id: acesso.workspaceId, canal_id: Number(body.canal_id), numero: String(body.numero || ""),
      nome_signatario: String(body.nome_signatario || ""), cpf: String(body.cpf || ""),
      email_signatario: String(body.email_signatario || ""), titulo: String(body.titulo || "Contrato"),
      conteudo: String(body.conteudo || ""), pdf_base64: pdfBase64, mensagem: String(body.mensagem || ""),
      expira_horas: Number(body.expira_horas || 48), exigir_localizacao: body.exigir_localizacao === true,
      proposta_id: propostaId, representante_id: String(body.representante_id || ""), criado_por: acesso.email,
    };
    const rota = body.modo_assinatura === "envelope_v1"
      ? `/assinaturas-wolf/envelopes/admin/${encodeURIComponent(id)}/editar`
      : `/assinaturas-wolf/admin/${encodeURIComponent(id)}/editar`;
    const response = await fetch(`${BACKEND}${rota}`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Wolf-Signature-Proxy": process.env.WOLF_SIGNATURE_PROXY_SECRET || "" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ success: false, error: "Resposta inválida do backend" }));
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}