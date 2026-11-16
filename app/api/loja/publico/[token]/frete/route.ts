import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../../_auth";
import { calcularFrete } from "../../../_frete";
import { modulosLoja, lojaComModulos } from "../../../_modulos";

// Frete do link público: o cliente informa o CEP e vê as opções (SEDEX/PAC ou taxa fixa).
// Itens e preços vêm do banco (nunca do navegador).
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const { data } = await supabaseServer.from("proposta").select("workspace_id,dados_customizados").eq("dados_customizados->pedido->>link_token", token).limit(1).maybeSingle();
    if (!data) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 });
    const { data: cfg } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", (data as any).workspace_id).maybeSingle();
    const { liberado } = await modulosLoja((data as any).workspace_id);
    const r = await calcularFrete(lojaComModulos((cfg as any)?.config?.loja || {}, liberado), request.nextUrl.searchParams.get("cep") || "", (data as any).dados_customizados?.pedido?.itens || []);
    return NextResponse.json({ success: true, ...r }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Não foi possível calcular o frete agora" }, { status: 502 });
  }
}
