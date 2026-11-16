import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { lerChaveCadastro, lerConfigLoja, type ChaveIA } from "../_ia-chave";

// Ajustes da loja → chave de IA do cadastro de produtos. A chave nunca volta
// inteira para o navegador: só o provedor e os 4 últimos caracteres.

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, request.nextUrl.searchParams.get("ws") || "");
    const c = await lerChaveCadastro(acesso.workspaceId);
    return NextResponse.json({ success: true, ia: c?.ia || null, final: c ? c.chave.slice(-4) : "" });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    if (!acesso.isSuperAdmin && !acesso.isDono && !acesso.isAdministrador) return NextResponse.json({ success: false, error: "Só o dono ou um administrador pode trocar a chave." }, { status: 403 });
    const chave = String(b.chave || "").trim();
    const remover = b.remover === true;
    if (!remover && chave.length < 20) return NextResponse.json({ success: false, error: "Chave inválida." }, { status: 400 });
    const ia: ChaveIA["ia"] = chave.startsWith("sk-ant-") ? "claude" : b.ia === "claude" ? "claude" : "gpt";
    const { existe, config } = await lerConfigLoja(acesso.workspaceId);
    const novo = { ...config };
    if (remover) delete novo.ia_cadastro; else novo.ia_cadastro = { ia, chave, atualizado_em: new Date().toISOString() };
    const { error } = existe
      ? await supabaseServer.from("fin_config").update({ config: novo }).eq("workspace_id", acesso.workspaceId)
      : await supabaseServer.from("fin_config").insert({ workspace_id: acesso.workspaceId, regime: "simples", config: novo });
    if (error) throw error;
    return NextResponse.json({ success: true, ia: remover ? null : ia, final: remover ? "" : chave.slice(-4) });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
