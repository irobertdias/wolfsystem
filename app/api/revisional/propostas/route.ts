import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso, supabaseServer, type AcessoWolf } from "../../_auth";
import {
  calcularImovel, calcularVeiculo, normalizarImovel, normalizarVeiculo, validarDados,
  type TipoRevisional,
} from "../../../lib/revisional";
import { SEM_CACHE, exigirRevisional, lerConfig, linkPublico, novoNumero, novoToken, statusEfetivo } from "../_shared";

function veTodas(acesso: AcessoWolf) {
  return acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.revisional_todas === true;
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, request.nextUrl.searchParams.get("workspace") || "");
    await exigirRevisional(acesso);
    let query = supabaseServer
      .from("revisional_propostas")
      .select("id,numero,token,tipo,status,cliente_nome,cliente_documento,cliente_telefone,consultor_nome,consultor_email,resultado,dados,expira_em,visualizada_em,visualizacoes,respondida_em,motivo_recusa,created_at")
      .eq("workspace_id", acesso.workspaceId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!veTodas(acesso)) query = query.eq("consultor_email", acesso.email);
    const { data, error } = await query;
    if (error) throw error;
    const config = await lerConfig(acesso.workspaceId);
    const propostas = (data || []).map((p) => ({
      ...p,
      status: statusEfetivo(p),
      link: linkPublico(request, p.token),
    }));
    return NextResponse.json({
      success: true,
      propostas,
      config,
      podeConfigurar: acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador,
      usuario: { email: acesso.email, nome: String(acesso.user.user_metadata?.nome || acesso.user.user_metadata?.full_name || "") },
    }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(body.workspace || ""));
    await exigirRevisional(acesso);

    const tipo: TipoRevisional = body.tipo === "veiculo" ? "veiculo" : "imovel";
    const clienteNome = String(body.cliente_nome || "").trim().slice(0, 160);
    const clienteDoc = String(body.cliente_documento || "").replace(/\D/g, "").slice(0, 14);
    const clienteTel = String(body.cliente_telefone || "").replace(/\D/g, "").slice(0, 15);
    const consultorNome = String(body.consultor_nome || "").trim().slice(0, 120)
      || String(acesso.user.user_metadata?.nome || acesso.email.split("@")[0]);

    const dados = tipo === "imovel" ? normalizarImovel(body.dados || {}) : normalizarVeiculo(body.dados || {});
    const erros = validarDados(tipo, dados);
    if (!clienteNome) erros.unshift("Informe o nome do cliente");
    if (clienteDoc && clienteDoc.length !== 11 && clienteDoc.length !== 14) erros.push("CPF/CNPJ inválido");
    if (erros.length) return NextResponse.json({ success: false, error: erros.join(". ") }, { status: 400 });

    const resultado = tipo === "imovel"
      ? calcularImovel(dados as ReturnType<typeof normalizarImovel>)
      : calcularVeiculo(dados as ReturnType<typeof normalizarVeiculo>);

    const config = await lerConfig(acesso.workspaceId);
    const horas = Math.min(720, Math.max(1, Number(body.validade_horas) || config.validade_horas));
    const token = novoToken();
    const { data, error } = await supabaseServer.from("revisional_propostas").insert({
      workspace_id: acesso.workspaceId,
      numero: novoNumero(),
      token,
      tipo,
      cliente_nome: clienteNome,
      cliente_documento: clienteDoc,
      cliente_telefone: clienteTel,
      consultor_nome: consultorNome,
      consultor_email: acesso.email,
      dados,
      resultado,
      empresa: { nome: config.empresa_nome, cnpj: config.empresa_cnpj, whatsapp: config.whatsapp_contato },
      expira_em: new Date(Date.now() + horas * 3600_000).toISOString(),
    }).select("id,numero,token,expira_em").single();
    if (error) throw error;

    return NextResponse.json({ success: true, proposta: { ...data, link: linkPublico(request, token) } }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
