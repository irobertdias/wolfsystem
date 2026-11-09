import { randomBytes, randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { autenticarUsuario, respostaErroAcesso, supabaseServer } from "../_auth";
import { ITENS_PADRAO, PAGAMENTO_PADRAO } from "../../lib/orcamento";

// Orçamentos comerciais do Wolf System — somente o super admin.

const SEM_CACHE = { "Cache-Control": "no-store" };

async function exigirSuperAdmin(request: NextRequest) {
  const id = await autenticarUsuario(request);
  if (!id.isSuperAdmin) throw Object.assign(new Error("Somente o administrador Wolf"), { statusCode: 403 });
  return id;
}

function link(request: NextRequest, token: string) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "app.wolfgyn.com.br";
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = host.startsWith("rev.") ? host.replace(/^rev\./, "app.") : host;
  return `${proto}://${base}/orcamento/${token}`;
}

export async function GET(request: NextRequest) {
  try {
    await exigirSuperAdmin(request);
    const { data, error } = await supabaseServer
      .from("wolf_orcamentos").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    const agora = Date.now();
    const orcamentos = (data || []).map((o) => ({
      ...o,
      status: (o.status === "enviado" || o.status === "visualizado") && new Date(o.expira_em).getTime() <= agora ? "expirado" : o.status,
      link: link(request, o.token),
    }));
    return NextResponse.json({ success: true, orcamentos }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const id = await exigirSuperAdmin(request);
    const b = await request.json().catch(() => ({}));
    const cliente = String(b.cliente_nome || "").trim().slice(0, 160);
    const mensalidade = Number(b.mensalidade);
    const configuracao = Number(b.configuracao);
    const usuarios = Math.min(500, Math.max(1, Math.round(Number(b.usuarios_incluidos) || 10)));
    const horas = Math.min(720, Math.max(1, Math.round(Number(b.validade_horas) || 24)));
    if (!cliente) return NextResponse.json({ success: false, error: "Informe o nome do cliente" }, { status: 400 });
    if (!(mensalidade >= 0) || !(configuracao >= 0)) return NextResponse.json({ success: false, error: "Valores inválidos" }, { status: 400 });

    const h = randomUUID().replace(/-/g, "").toUpperCase();
    const hoje = new Date();
    const numero = `ORC-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}-${h.slice(0, 4)}`;
    const token = randomBytes(32).toString("base64url");
    const { data, error } = await supabaseServer.from("wolf_orcamentos").insert({
      numero,
      token,
      cliente_nome: cliente,
      cliente_telefone: String(b.cliente_telefone || "").replace(/\D/g, "").slice(0, 15),
      itens: Array.isArray(b.itens) && b.itens.length ? b.itens : ITENS_PADRAO,
      usuarios_incluidos: usuarios,
      mensalidade,
      configuracao,
      pagamento: { ...PAGAMENTO_PADRAO, ...(b.pagamento || {}) },
      expira_em: new Date(Date.now() + horas * 3600_000).toISOString(),
      criado_por: id.email,
    }).select("id,numero,token,expira_em").single();
    if (error) throw error;
    return NextResponse.json({ success: true, orcamento: { ...data, link: link(request, data.token) } }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// PATCH { id, acao: "cancelar" | "renovar", horas? }
export async function PATCH(request: NextRequest) {
  try {
    await exigirSuperAdmin(request);
    const b = await request.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(b.id || ""))) return NextResponse.json({ success: false, error: "Orçamento inválido" }, { status: 400 });
    let update: Record<string, unknown>;
    if (b.acao === "cancelar") update = { status: "cancelado" };
    else if (b.acao === "renovar") update = { status: "enviado", expira_em: new Date(Date.now() + Math.min(720, Math.max(1, Number(b.horas) || 24)) * 3600_000).toISOString() };
    else return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
    const { error } = await supabaseServer.from("wolf_orcamentos")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", b.id).not("status", "in", "(aceito,recusado)");
    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
