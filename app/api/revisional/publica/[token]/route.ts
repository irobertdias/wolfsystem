import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../_auth";
import { mascararDocumento } from "../../../../lib/revisional";
import { SEM_CACHE, lerConfig, statusEfetivo, tokenValido, type MarcaRevisional } from "../../_shared";
import { linhaCrmDaProposta } from "../../../../lib/revisional-contrato";

// Página pública do cliente: sem login, o token do link é a credencial.

async function buscar(token: string) {
  const { data, error } = await supabaseServer
    .from("revisional_propostas")
    .select("id,workspace_id,numero,tipo,status,cliente_nome,cliente_documento,cliente_telefone,consultor_nome,dados,resultado,empresa,expira_em,visualizada_em,respondida_em,created_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Nome e marca atuais do escritório (vale também para propostas já enviadas).
async function identidade(workspaceId: string, empresa: any): Promise<{ empresa: any; marca: MarcaRevisional }> {
  try {
    const cfg = await lerConfig(workspaceId);
    return {
      empresa: { ...(empresa || {}), ...(cfg.empresa_nome ? { nome: cfg.empresa_nome } : {}), ...(cfg.empresa_cnpj ? { cnpj: cfg.empresa_cnpj } : {}), ...(cfg.whatsapp_contato ? { whatsapp: cfg.whatsapp_contato } : {}) },
      marca: cfg.marca || {},
    };
  } catch { return { empresa, marca: {} }; }
}

function publico(p: NonNullable<Awaited<ReturnType<typeof buscar>>>) {
  return {
    numero: p.numero,
    tipo: p.tipo,
    status: statusEfetivo(p),
    cliente_nome: p.cliente_nome,
    cliente_documento: mascararDocumento(p.cliente_documento),
    consultor_nome: p.consultor_nome,
    dados: p.dados,
    resultado: p.resultado,
    empresa: p.empresa,
    expira_em: p.expira_em,
    respondida_em: p.respondida_em,
    criada_em: p.created_at,
    agora: new Date().toISOString(),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const p = await buscar(token);
    if (!p) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    if (p.status === "cancelada") {
      return NextResponse.json({ success: false, error: "Esta proposta foi cancelada" }, { status: 410 });
    }
    // registra a visualização (contador simples)
    const agora = new Date().toISOString();
    const { data: atual } = await supabaseServer
      .from("revisional_propostas").select("visualizacoes").eq("id", p.id).maybeSingle();
    await supabaseServer.from("revisional_propostas").update({
      visualizacoes: Number(atual?.visualizacoes || 0) + 1,
      ...(p.visualizada_em ? {} : { visualizada_em: agora }),
      ...(p.status === "enviada" && statusEfetivo(p) === "enviada" ? { status: "visualizada" } : {}),
    }).eq("id", p.id);
    if (p.status === "enviada" && statusEfetivo(p) === "enviada") p.status = "visualizada";
    const id = await identidade(p.workspace_id, p.empresa);
    return NextResponse.json({ success: true, proposta: { ...publico(p), empresa: id.empresa, marca: id.marca } }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}

// POST { acao: "aceitar" | "recusar", motivo? }
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const body = await request.json().catch(() => ({}));
    const acao = body.acao === "aceitar" ? "aceita" : body.acao === "recusar" ? "recusada" : "";
    if (!acao) return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
    const p = await buscar(token);
    if (!p) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    const status = statusEfetivo(p);
    if (status === "expirada") return NextResponse.json({ success: false, error: "O prazo desta proposta expirou" }, { status: 410 });
    if (status !== "enviada" && status !== "visualizada") {
      return NextResponse.json({ success: false, error: "Esta proposta já foi respondida" }, { status: 409 });
    }
    const agora = new Date().toISOString();
    // a condição de status no update evita resposta dupla em cliques simultâneos
    const { data: atualizada, error } = await supabaseServer.from("revisional_propostas").update({
      status: acao,
      respondida_em: agora,
      resposta_ip: (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64),
      resposta_user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
      motivo_recusa: acao === "recusada" ? String(body.motivo || "").trim().slice(0, 500) || null : null,
      updated_at: agora,
    }).eq("id", p.id).in("status", ["enviada", "visualizada"]).gt("expira_em", agora).select("id");
    if (error) throw error;
    if (!atualizada?.length) return NextResponse.json({ success: false, error: "Esta proposta não pode mais ser respondida" }, { status: 409 });

    // Aceite: o cliente já entra no CRM financeiro (etapa Documentação) para o
    // vendedor gerar o contrato. Falha aqui não desfaz o aceite.
    if (acao === "aceita") {
      try {
        const { data: crm, error: erroCrm } = await supabaseServer.from("proposta")
          .insert([linhaCrmDaProposta(p as any, p.workspace_id)]).select("id").single();
        if (erroCrm) throw erroCrm;
        await supabaseServer.from("revisional_propostas")
          .update({ dados: { ...(p.dados || {}), crm_proposta_id: crm.id } }).eq("id", p.id);
      } catch (e: any) {
        console.error("[revisional/aceite] cliente não criado no CRM:", e?.message || e);
      }
    }
    return NextResponse.json({ success: true, status: acao, respondida_em: agora }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}
