import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso, supabaseServer } from "../../_auth";
import { SEM_CACHE, exigirRevisional } from "../_shared";

const n = (v: unknown, min: number, max: number, padrao: number) => {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : padrao;
};

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(body.workspace || ""));
    await exigirRevisional(acesso);
    if (!(acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador)) {
      return NextResponse.json({ success: false, error: "Só o administrador altera as configurações" }, { status: 403 });
    }
    const registro = {
      workspace_id: acesso.workspaceId,
      empresa_nome: String(body.empresa_nome || "").trim().slice(0, 160),
      empresa_cnpj: String(body.empresa_cnpj || "").trim().slice(0, 20),
      whatsapp_contato: String(body.whatsapp_contato || "").replace(/\D/g, "").slice(0, 15),
      validade_horas: Math.round(n(body.validade_horas, 1, 720, 24)),
      percentual_imovel: n(body.percentual_imovel, 0, 90, 35),
      percentual_veiculo: n(body.percentual_veiculo, 0, 90, 35),
      taxa_veiculo: n(body.taxa_veiculo, 0, 20, 1.5),
      metodo_veiculo: body.metodo_veiculo === "taxa" ? "taxa" : "percentual",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseServer.from("revisional_config").upsert(registro, { onConflict: "workspace_id" });
    if (error) throw error;
    return NextResponse.json({ success: true, config: registro }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
