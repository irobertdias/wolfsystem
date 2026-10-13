import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, exigirPermissaoContratos, respostaErroContratos, supabaseContratos } from "../_auth";
import { validarCadastroEmpresa, type RepresentanteEmpresa } from "../../../lib/contratos-empresas";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarContratos(request, request.nextUrl.searchParams.get("workspaceId") || "");
    const { data, error } = await supabaseContratos.from("assinatura_wolf_empresas").select("*")
      .eq("workspace_id", acesso.workspaceId).eq("ativa", true).order("created_at", { ascending: true }).order("id");
    if (error) throw error;
    const rows = data || [];
    let representantes: RepresentanteEmpresa[] = [];
    if (rows.length) {
      const reps = await supabaseContratos.from("assinatura_wolf_representantes").select("*")
        .eq("workspace_id", acesso.workspaceId).in("empresa_id", rows.map(e => e.id)).eq("ativo", true)
        .order("padrao", { ascending: false }).order("nome");
      if (reps.error) throw reps.error;
      representantes = reps.data || [];
    }
    const empresas = rows.map(empresa => ({ ...empresa, representantes: representantes.filter(r => r.empresa_id === empresa.id) }));
    const id = request.nextUrl.searchParams.get("empresaId");
    const selecionada = id ? empresas.find(e => e.id === id) : empresas[0];
    if (id && !selecionada) return NextResponse.json({ success: false, error: "Empresa não encontrada neste workspace" }, { status: 404 });
    return NextResponse.json({ success: true, empresas, empresa: selecionada || null, representantes: selecionada?.representantes || [] });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const acesso = await autenticarContratos(request, String(body.workspaceId || ""));
    exigirPermissaoContratos(acesso, "contratos_configurar");
    const empresa = body.empresa || {};
    const representantes = Array.isArray(body.representantes) ? body.representantes : [];
    validarCadastroEmpresa(empresa, representantes);
    const { data, error } = await supabaseContratos.rpc("assinatura_wolf_salvar_empresa", {
      p_workspace_id: acesso.workspaceId, p_empresa_id: empresa.id || null,
      p_empresa: empresa, p_representantes: representantes,
    });
    if (error) {
      if (error.code === "23505") throw Object.assign(new Error("Já existe uma empresa com esse CNPJ neste workspace"), { statusCode: 400 });
      if (["P0001", "22P02"].includes(error.code)) throw Object.assign(new Error(error.message), { statusCode: 400 });
      throw error;
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}
