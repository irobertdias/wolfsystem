import { NextRequest, NextResponse } from "next/server";
import { autenticarContratos, respostaErroContratos, supabaseContratos } from "../_auth";

export const dynamic = "force-dynamic";

function somenteDigitos(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarContratos(
      request,
      request.nextUrl.searchParams.get("workspaceId") || ""
    );
    const { data: empresa, error } = await supabaseContratos
      .from("assinatura_wolf_empresas")
      .select("*")
      .eq("workspace_id", acesso.workspaceId)
      .maybeSingle();
    if (error) throw error;
    let representantes: any[] = [];
    if (empresa) {
      const consulta = await supabaseContratos
        .from("assinatura_wolf_representantes")
        .select("*")
        .eq("workspace_id", acesso.workspaceId)
        .eq("empresa_id", empresa.id)
        .eq("ativo", true)
        .order("padrao", { ascending: false })
        .order("nome", { ascending: true });
      if (consulta.error) throw consulta.error;
      representantes = consulta.data || [];
    }
    return NextResponse.json({ success: true, empresa, representantes });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const acesso = await autenticarContratos(request, String(body.workspaceId || ""));
    const empresaBody = body.empresa || {};
    const razaoSocial = String(empresaBody.razao_social || "").trim();
    const cnpj = somenteDigitos(empresaBody.cnpj);
    const endereco = String(empresaBody.endereco_completo || "").trim();
    const email = String(empresaBody.email || "").trim();
    if (razaoSocial.length < 3 || cnpj.length !== 14 || endereco.length < 10) {
      return NextResponse.json(
        { success: false, error: "Informe razão social, CNPJ válido e endereço completo" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "E-mail da empresa inválido" }, { status: 400 });
    }
    const agora = new Date().toISOString();
    const { data: empresa, error } = await supabaseContratos
      .from("assinatura_wolf_empresas")
      .upsert({
        workspace_id: acesso.workspaceId,
        razao_social: razaoSocial,
        nome_fantasia: String(empresaBody.nome_fantasia || "").trim() || null,
        cnpj,
        endereco_completo: endereco,
        email,
        telefone: somenteDigitos(empresaBody.telefone) || null,
        ativa: true,
        updated_at: agora,
      }, { onConflict: "workspace_id" })
      .select("*")
      .single();
    if (error) throw error;

    const representantes = Array.isArray(body.representantes) ? body.representantes : [];
    if (!representantes.length) {
      return NextResponse.json({ success: false, error: "Cadastre ao menos um representante" }, { status: 400 });
    }
    await supabaseContratos
      .from("assinatura_wolf_representantes")
      .update({ ativo: false, padrao: false, updated_at: agora })
      .eq("workspace_id", acesso.workspaceId)
      .eq("empresa_id", empresa.id);

    const salvos = [];
    for (let index = 0; index < representantes.length; index += 1) {
      const item = representantes[index] || {};
      const nome = String(item.nome || "").trim();
      const cpf = somenteDigitos(item.cpf);
      const cargo = String(item.cargo || "").trim();
      const repEmail = String(item.email || "").trim();
      const numero = somenteDigitos(item.numero);
      if (nome.length < 3 || cpf.length !== 11 || cargo.length < 2 || numero.length < 10 || !emailValido(repEmail)) {
        return NextResponse.json(
          { success: false, error: `Revise os dados do representante ${index + 1}` },
          { status: 400 }
        );
      }
      const registro = {
        ...(item.id ? { id: String(item.id) } : {}),
        empresa_id: empresa.id,
        workspace_id: acesso.workspaceId,
        nome,
        cpf,
        cargo,
        email: repEmail,
        numero,
        ativo: true,
        padrao: index === 0 ? true : item.padrao === true,
        updated_at: agora,
      };
      const { data, error: repError } = await supabaseContratos
        .from("assinatura_wolf_representantes")
        .upsert(registro)
        .select("*")
        .single();
      if (repError) throw repError;
      salvos.push(data);
    }
    return NextResponse.json({ success: true, empresa, representantes: salvos });
  } catch (error) {
    const falha = respostaErroContratos(error);
    return NextResponse.json({ success: false, error: falha.message }, { status: falha.status });
  }
}

function emailValido(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
