import { supabaseServer } from "../_auth";
import { enviarWhatsappLoja } from "../loja/_avisos";
import { configSolar, origemSolar, brl, kwpTxt, etapaSolar, type ConfigSolar, type DadosSolar } from "../../lib/solar";

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

/** WhatsApps de aviso da empresa (config.solar.dono_whatsapp aceita vários, separados por vírgula). */
export const numerosAviso = (v: any) => [...new Set(String(v || "").split(/[,;/\n]+/).map((x) => so(x)).filter((x) => x.length >= 10).map((x) => (x.startsWith("55") ? x : "55" + x)))];

/** Avisa a empresa no WhatsApp: status, cliente, preço e link. Uma vez por situação
 *  e proposta ("atualizada" avisa sempre que a proposta muda). */
export async function avisarEmpresaSolar(ws: string, propostaId: number, situacao: "aceite" | "visita" | "recusa" | "nova" | "atualizada", detalhe = "") {
  try {
    const [{ data: p }, { cfg }] = await Promise.all([
      supabaseServer.from("proposta").select("id,nome,telefone1,cidade,estado,endereco,valor_plano,status_venda,dados_customizados").eq("workspace_id", ws).eq("id", propostaId).maybeSingle(),
      lerConfigSolar(ws),
    ]);
    if (!p) return { ok: false, motivo: "proposta não encontrada" };
    const donos = numerosAviso(cfg.dono_whatsapp);
    if (!donos.length) return { ok: false, motivo: "sem WhatsApp de avisos nos ajustes" };
    const d = dadosSolar(p), r = d.resultado, x: any = p;
    if (situacao !== "atualizada" && d.dono_avisado?.[situacao]) return { ok: true, motivo: "já avisado" };
    const num = d.numero || x.id;
    const cabeca = {
      aceite: d.aceite?.analise_credito
        ? `🏦 *FINANCIAMENTO PARA ANÁLISE — ${num}*\nStatus: *cliente aceitou e escolheu financiamento* (falta a análise de crédito; o atendimento foi passado para a equipe)`
        : `✅ *PROPOSTA ACEITA — ${num}*\nStatus: *ACEITA pelo cliente* (o atendimento foi passado para a equipe)`,
      visita: `📅 *PEDIDO DE VISITA TÉCNICA — ${num}*\nStatus: *visita técnica pedida*`,
      recusa: `❌ *Proposta recusada — ${num}*\nStatus: *recusada*`,
      nova: `☀️ *PROPOSTA ENVIADA — ${num}*\nStatus: *enviada ao cliente*`,
      atualizada: `🔄 *PROPOSTA ATUALIZADA E REENVIADA — ${num}*\nStatus: *enviada ao cliente*`,
    }[situacao];
    const preco = Number(x.valor_plano) || r?.preco || 0;
    const texto = [
      cabeca,
      `👤 Cliente: *${x.nome || "-"}*${x.telefone1 ? `\n📱 ${x.telefone1}` : ""}${x.cidade ? `\n📍 ${[x.endereco, x.cidade, x.estado].filter(Boolean).join(", ")}` : ""}`,
      `💰 Preço: *${brl(preco)}*${r?.preco_de && r.preco_de > preco ? ` (de ${brl(r.preco_de)})` : ""}`,
      r ? `☀️ ${kwpTxt(r.kwp)} · ${r.paineis} placas · ${r.consumo_kwh} kWh/mês\nEconomia de ${brl(r.economia_mes)}/mês` : "",
      d.aceite?.pagamento ? `💳 Pagamento: ${d.aceite.pagamento}${d.aceite.prazo ? ` em ${d.aceite.prazo}x` : ""}` : "",
      detalhe,
      d.canal === "whatsapp_ia" ? "🤖 Atendido pela Ana (Vendedora IA) no WhatsApp." : "",
      d.token ? `🔗 Proposta: ${linkSolar(d.token, origemSolar(ws, ORIGEM))}` : "",
    ].filter(Boolean).join("\n\n");
    let ok = false, motivo = "";
    for (const dono of donos) {
      const r2 = await enviarWhatsappLoja(ws, dono, texto, cfg.canal_id);
      if (r2.ok) ok = true; else motivo = (r2 as any).motivo || (r2 as any).erro || "falha no envio";
    }
    if (ok && situacao !== "atualizada") await atualizarSolar(propostaId, `Empresa avisada no WhatsApp (${situacao})`, (dd) => ({ dono_avisado: { ...(dd.dono_avisado || {}), [situacao]: new Date().toISOString() } }), undefined, { __por: "sistema" });
    return ok ? { ok: true } : { ok: false, motivo };
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
    // Equipamento gravado na proposta (linha escolhida); propostas antigas usam o dos ajustes.
    kit: {
      painel_marca: d.resultado?.equip?.painel_marca || cfg.painel_marca, painel_garantia: d.resultado?.equip?.painel_garantia || cfg.painel_garantia,
      inversor_marca: d.resultado?.equip?.inversor_marca || cfg.inversor_marca, inversor_garantia: d.resultado?.equip?.inversor_garantia || cfg.inversor_garantia,
      instalacao_garantia: cfg.instalacao_garantia, prazo_instalacao: cfg.prazo_instalacao, estrutura_garantia: cfg.estrutura_garantia,
      painel_area_m2: d.resultado?.equip?.painel_area_m2 || cfg.painel_area_m2,
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
