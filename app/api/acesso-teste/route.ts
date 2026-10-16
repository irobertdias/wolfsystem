import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario, supabaseServer, respostaErroAcesso } from "../_auth";
import { lerTesteCliente, buscarTesteDoDono, testeEncerrado } from "../../lib/teste-cliente";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const acesso = await autenticarUsuario(req);
    let teste = lerTesteCliente(null);
    if (!acesso.isSuperAdmin) {
      const { data: proprio, error } = await supabaseServer.from("workspaces").select("owner_id").eq("owner_id", acesso.user.id).limit(1).maybeSingle();
      if (error) throw error;
      if (proprio) teste = lerTesteCliente(acesso.user.app_metadata);
      else {
        const { data: vinculo, error: erroVinculo } = await supabaseServer.from("usuarios_workspace").select("workspace_id").ilike("email", acesso.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (erroVinculo) throw erroVinculo;
        if (vinculo) {
          const { data: workspace, error: erroWs } = await supabaseServer.from("workspaces").select("owner_id").eq("username", vinculo.workspace_id).maybeSingle();
          if (erroWs) throw erroWs;
          teste = await buscarTesteDoDono(supabaseServer, workspace?.owner_id);
        }
      }
    }
    return NextResponse.json({ success: true, teste, encerrado: testeEncerrado(teste), agora: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const e = respostaErroAcesso(error); return NextResponse.json({ success: false, error: e.message }, { status: e.status }); }
}
