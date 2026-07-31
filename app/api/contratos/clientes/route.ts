import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, respostaErroContratos, supabaseContratos } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspaceSolicitado = request.nextUrl.searchParams.get("workspaceId") || "";
    const acesso = await autenticarContratos(request, workspaceSolicitado);
    const busca = String(request.nextUrl.searchParams.get("busca") || "").replace(/[,%()]/g, " ").trim().slice(0, 80);
    let query: any = supabaseContratos.from("proposta")
      .select("id,nome,cpf,email,telefone1,telefone2,telefone3,endereco,cep,cidade,estado,created_at")
      .eq("workspace_id", acesso.workspaceId)
      .order("created_at", { ascending: false }).limit(1000);
    if (busca) query = query.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%,email.ilike.%${busca}%,telefone1.ilike.%${busca}%`);
    const [propostas, conexoes] = await Promise.all([
      query,
      supabaseContratos.from("conexoes").select("id,nome,tipo,status,numero")
        .eq("workspace_id", acesso.workspaceId).order("nome", { ascending: true }),
    ]);
    if (propostas.error) throw propostas.error;
    if (conexoes.error) throw conexoes.error;
    const vistos = new Set<string>();
    const clientes = (propostas.data || []).filter((item: any) => {
      const chave = String(item.cpf || item.telefone1 || item.email || item.id).replace(/\W/g, "").toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave); return true;
    }).slice(0, 250);
    return NextResponse.json({ success: true, workspaceId: acesso.workspaceId, clientes, conexoes: conexoes.data || [] },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}