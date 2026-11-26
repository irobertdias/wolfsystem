import { supabaseServer } from "../_auth";
import { enviarWhatsappLoja } from "../loja/_avisos";
import { configSolar, brl, kwpTxt, etapaSolar, type ConfigSolar, type DadosSolar } from "../../lib/solar";

// Peças do nicho solar usadas no servidor: configuração, proposta pública e avisos.

export const ORIGEM = (process.env.NEXT_PUBLIC_APP_URL || "https://app.wolfgyn.com.br").replace(/\/+$/, "");
export const so = (v: any) => String(v || "").replace(/\D/g, "");
export const tokenValido = (t: string) => /^[A-Za-z0-9_-]{40,64}$/.test(t);
export const linkSolar = (token: string, origem = ORIGEM) => `${origem}/solar/${token}`;

export async function lerConfigSolar(ws: string): Promise<{ cfg: ConfigSolar; nomeWs: string }> {
  const [{ data: c }, { data: w }] = await Promise.all([
    supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
    supabaseServer.from("workspaces").select("nome").eq("username", ws).maybeSingle(),
  ]);
  const cfg = configSolar((c as any)?.config?.solar);
  const nomeWs = (w as any)?.nome || "";
  if (!cfg.empresa.nome) cfg.empresa = { ...cfg.empresa, nome: nomeWs };
  return { cfg, nomeWs };
}

/** O módulo Vendedor IA está liberado para o dono do workspace? (campo `ia` do cadastro) */
export async function vendedorIALiberado(ws: string) {
  const { data: w } = await supabaseServer.from("workspaces").select("owner_email,ia").eq("username", ws).maybeSingle();
  if (!w) return false;
  if (String((w as any).owner_email || "").toLowerCase() === "robert.dias@live.com") return true;
  const { data: cad } = await supabaseServer.from("cadastros").select("ia").ilike("email", (w as any).owner_email || "").maybeSingle();
  const ia = String((cad as any)?.ia || "").toLowerCase();
  return !!ia && !["nao", "não", "false", "0"].includes(ia);
}

export const dadosSolar = (p: any): DadosSolar => (p?.dados_customizados?.solar || {}) as DadosSolar;

/** Mescla campos em dados_customizados.solar e anota no histórico. */
export async function atualizarSolar(id: number, nota: string, mudar: (d: DadosSolar) => Partial<DadosSolar>, etapa?: string, extra: Record<string, any> = {}) {
  const { data: atual } = await supabaseServer.from("proposta").select("dados_customizados,status_venda").eq("id", id).maybeSingle();
  const dd = dadosSolar(atual);
  const novo: DadosSolar = { ...dd, ...mudar(dd), historico: [...(dd.historico || []), { em: new Date().toISOString(), etapa, nota, por: extra.__por || "cliente" }] };
  delete (extra as any).__por;
  const { error } = await supabaseServer.from("proposta").update({
    ...extra, ...(etapa ? { status_venda: etapa } : {}),
    dados_customizados: { ...((atual as any)?.dados_customizados || {}), solar: novo }, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
  return novo;
}

/** Avisa a empresa no WhatsApp (config.solar.dono_whatsapp). Uma vez por situação e proposta. */
export async function avisarEmpresaSolar(ws: string, propostaId: number, situacao: "aceite" | "visita" | "recusa" | "nova", detalhe = "") {
  try {
    const [{ data: p }, { cfg }] = await Promise.all([
      supabaseServer.from("proposta").select("id,nome,telefone1,cidade,estado,endereco,valor_plano,status_venda,dados_customizados").eq("workspace_id", ws).eq("id", propostaId).maybeSingle(),
      lerConfigSolar(ws),
    ]);
    if (!p) return { ok: false, motivo: "proposta não encontrada" };
    const dono = so(cfg.dono_whatsapp);
    if (dono.length < 10) return { ok: false, motivo: "sem WhatsApp de avisos nos ajustes" };
    const d = dadosSolar(p), r = d.resultado, x: any = p;
    if (d.dono_avisado?.[situacao]) return { ok: true, motivo: "já avisado" };
    const cabeca = {
      aceite: `✅ *PROPOSTA SOLAR ACEITA — ${d.numero || x.id}*`,
      visita: `📅 *PEDIDO DE VISITA TÉCNICA — ${d.numero || x.id}*`,
      recusa: `❌ *Proposta solar recusada — ${d.numero || x.id}*`,
      nova: `☀️ *Nova proposta solar — ${d.numero || x.id}*`,
    }[situacao];
    const texto = [
      cabeca,
      `👤 ${x.nome || "-"}${x.telefone1 ? ` · ${x.telefone1}` : ""}${x.cidade ? `\n📍 ${[x.endereco, x.cidade, x.estado].filter(Boolean).join(", ")}` : ""}`,
      r ? `${kwpTxt(r.kwp)} · ${r.paineis} painéis · ${r.consumo_kwh} kWh/mês\nEconomia ${brl(r.economia_mes)}/mês · *${brl(Number(x.valor_plano) || r.preco)}*` : "",
      d.aceite?.pagamento ? `Pagamento: ${d.aceite.pagamento}${d.aceite.prazo ? ` em ${d.aceite.prazo}x` : ""}` : "",
      detalhe,
      d.canal === "whatsapp_ia" ? "Atendido pela Vendedora IA no WhatsApp." : "",
      `Etapa: ${etapaSolar(x.status_venda).label}`,
      d.token ? linkSolar(d.token) : "",
    ].filter(Boolean).join("\n\n");
    const r2 = await enviarWhatsappLoja(ws, dono, texto, cfg.canal_id);
    if (r2.ok) await atualizarSolar(propostaId, `Empresa avisada no WhatsApp (${situacao})`, (dd) => ({ dono_avisado: { ...(dd.dono_avisado || {}), [situacao]: new Date().toISOString() } }), undefined, { __por: "sistema" });
    return r2;
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e).slice(0, 160) };
  }
}

/** Dados da proposta que podem ir para a página pública (sem nada interno). */
export function propostaPublica(p: any, cfg: ConfigSolar) {
  const d = dadosSolar(p);
  const vencida = !!d.validade_ate && new Date(d.validade_ate).getTime() < Date.now();
  const status = d.aceite ? "aceita" : d.recusa ? "recusada" : vencida ? "expirada" : p.status_venda === "PERDIDA" ? "recusada" : "aberta";
  return {
    numero: d.numero || String(p.id),
    data: p.data_proposta || p.created_at,
    validade_ate: d.validade_ate || null,
    status,
    cliente: { nome: p.nome || "", cidade: p.cidade || "", estado: p.estado || "", endereco: p.endereco || "" },
    resultado: d.resultado || null,
    entrada: { telhado: d.entrada?.telhado || "", ligacao: d.entrada?.ligacao || "", tarifa: d.entrada?.tarifa || null },
    observacoes: d.observacoes || "",
    empresa: cfg.empresa,
    kit: {
      painel_marca: cfg.painel_marca, painel_garantia: cfg.painel_garantia, inversor_marca: cfg.inversor_marca, inversor_garantia: cfg.inversor_garantia,
      instalacao_garantia: cfg.instalacao_garantia, prazo_instalacao: cfg.prazo_instalacao, estrutura_garantia: cfg.estrutura_garantia,
      painel_area_m2: cfg.painel_area_m2,
    },
    condicoes: cfg.observacoes,
    formas_pagamento: cfg.formas_pagamento,
    taxa_financiamento: cfg.taxa_financiamento,
    reajuste_aa: cfg.reajuste_aa,
    degradacao_aa: cfg.degradacao_aa,
    validade_minutos: cfg.validade_minutos,
    distribuidora: cfg.distribuidora || "",
    aceite: d.aceite ? { em: d.aceite.em, pagamento: d.aceite.pagamento || "", prazo: d.aceite.prazo || null } : null,
    recusa: d.recusa ? { em: d.recusa.em, motivo: d.recusa.motivo } : null,
    visita: d.visita ? { data: d.visita.data || "" } : null,
  };
}
