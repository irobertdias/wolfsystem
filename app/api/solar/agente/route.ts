import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { supabaseServer, segredoInternoWolf } from "../../_auth";
import { calcularSolar, resumoSolarTexto, brl, kwpTxt, anosTxt, etapaSolar, HSP_UF, TELHADOS, type EntradaSolar } from "../../../lib/solar";
import { lerConfigSolar, vendedorIALiberado, dadosSolar, atualizarSolar, avisarEmpresaSolar, linkSolar, so } from "../_solar";

// ═══════════════════════════════════════════════════════════════════════
// Ferramentas da Vendedora IA de energia solar (integração "solar_sistema").
// Chamado só pelo serviço do WhatsApp (servidor → servidor, x-wolf-internal-secret).
// A IA nunca inventa preço nem geração: tudo sai de calcularSolar com a
// configuração do workspace (kit, tabela R$/Wp, tarifa, financiamento).
//
// POST { workspaceId, acao, ... }
//   config            {}                         → empresa, kit, garantias, pagamento, regras
//   simular           { consumo_kwh?, conta_valor?, tarifa?, uf, cidade?, ligacao?, telhado?, aumento_pct? }
//   enviar_proposta   { cliente:{nome, telefone, cidade?, uf?, email?}, ...simular, novo? } → link
//   aceitar           { proposta_id, telefone, pagamento, prazo?, nome?, cpf?, endereco? }
//   recusar           { proposta_id, telefone, motivo }
//   visita            { proposta_id?, telefone, data?, endereco?, obs? }
//   status            { telefone }
// ═══════════════════════════════════════════════════════════════════════

export const maxDuration = 60;

function autorizado(request: NextRequest) {
  const enviado = request.headers.get("x-wolf-internal-secret") || "";
  let certo = ""; try { certo = segredoInternoWolf(); } catch { return false; }
  const a = Buffer.from(enviado), b = Buffer.from(certo);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

const novoToken = () => randomBytes(36).toString("base64url");
const fones = (t: any) => { const d = so(t).replace(/^0+/, ""); return [...new Set([d, d.startsWith("55") ? d.slice(2) : "55" + d])].filter((x) => x.length >= 10); };

function entradaDe(b: any): EntradaSolar {
  const uf = String(b.uf || "").trim().toUpperCase().slice(0, 2);
  return {
    consumo_kwh: Number(b.consumo_kwh) || undefined, conta_valor: Number(b.conta_valor) || undefined, tarifa: Number(b.tarifa) || undefined,
    uf: HSP_UF[uf] ? uf : undefined, cidade: b.cidade ? String(b.cidade).slice(0, 80) : undefined,
    ligacao: ["mono", "bi", "tri"].includes(b.ligacao) ? b.ligacao : undefined,
    telhado: TELHADOS.some((t) => t.key === b.telhado) ? b.telhado : undefined,
    aumento_pct: Number(b.aumento_pct) || undefined,
  };
}

function resumoIA(r: ReturnType<typeof calcularSolar>) {
  return {
    potencia: kwpTxt(r.kwp), paineis: r.paineis, painel_w: r.painel_w, inversor: r.inversor, geracao_kwh_mes: r.geracao_kwh,
    consumo_considerado_kwh: r.consumo_kwh, area_m2: r.area_m2, uf: r.uf, sol_h_dia: r.hsp, tarifa: brl(r.tarifa),
    conta_hoje: brl(r.conta_antes), conta_depois: brl(r.conta_depois), economia_mes: brl(r.economia_mes), economia_ano: brl(r.economia_ano), economia_25_anos: brl(r.economia_25),
    investimento: brl(r.preco), retorno: anosTxt(r.payback_anos),
    financiamento: r.parcelas.map((p) => `${p.meses}x de ${brl(p.valor)}`), entrada: r.entrada ? brl(r.entrada) : null,
    cartao: r.cartao ? `${r.cartao.meses}x de ${brl(r.cartao.valor)}` : null,
    itens: r.itens, texto_whatsapp: resumoSolarTexto(r),
  };
}

async function propostasDoCliente(ws: string, telefone: string) {
  const lista = fones(telefone);
  if (!lista.length) return [];
  const { data } = await supabaseServer.from("proposta").select("id,created_at,nome,telefone1,status_venda,valor_plano,dados_customizados")
    .eq("workspace_id", ws).in("telefone1", lista).order("created_at", { ascending: false }).limit(10);
  return ((data as any[]) || []).filter((p) => p.dados_customizados?.solar);
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  try {
    const b = await request.json().catch(() => ({}));
    const ws = String(b.workspaceId || b.workspace_id || "").trim();
    if (!ws) return NextResponse.json({ ok: false, erro: "workspaceId obrigatório" }, { status: 400 });
    if (!(await vendedorIALiberado(ws))) return NextResponse.json({ ok: false, erro: "Módulo Vendedor IA não liberado para este workspace" }, { status: 403 });
    const { cfg } = await lerConfigSolar(ws);
    const origem = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const acao = String(b.acao || "");

    if (acao === "config") {
      return NextResponse.json({
        ok: true, empresa: cfg.empresa, kit: { modulo: `${cfg.painel_marca} ${cfg.painel_w} W`, inversor: `${cfg.inversor_marca} (${cfg.inversor_tipo === "micro" ? "microinversor" : "inversor string"})` },
        garantias: { modulo: cfg.painel_garantia, inversor: cfg.inversor_garantia, instalacao: cfg.instalacao_garantia }, prazo_instalacao: cfg.prazo_instalacao,
        formas_pagamento: cfg.formas_pagamento, financiamento: { juros_am: cfg.taxa_financiamento, prazos: cfg.prazos_financiamento, entrada_pct: cfg.entrada_pct }, cartao_vezes: cfg.parcelas_cartao,
        tarifa_padrao: cfg.tarifa_padrao, uf_padrao: cfg.uf_padrao, condicoes: cfg.observacoes, validade_minutos: cfg.validade_minutos, instrucoes: cfg.instrucoes_ia,
        telhados: TELHADOS.map((t) => t.key),
      });
    }

    if (acao === "simular") {
      const e = entradaDe(b);
      if (!e.consumo_kwh && !e.conta_valor) return NextResponse.json({ ok: false, erro: "Preciso do consumo médio em kWh ou do valor médio da conta de luz." });
      const r = calcularSolar(e, cfg);
      return NextResponse.json({ ok: true, ...resumoIA(r) });
    }

    if (acao === "enviar_proposta") {
      const e = entradaDe(b);
      if (!e.consumo_kwh && !e.conta_valor) return NextResponse.json({ ok: false, erro: "Preciso do consumo médio em kWh ou do valor médio da conta de luz." });
      const c = b.cliente || {};
      const tel = fones(c.telefone)[0] || so(c.telefone);
      if (!tel) return NextResponse.json({ ok: false, erro: "telefone do cliente obrigatório" });
      const r = calcularSolar({ ...e, uf: e.uf || String(c.uf || "").toUpperCase() || undefined }, cfg);
      const validade_ate = new Date(Date.now() + Math.max(1, cfg.validade_minutos) * 60000).toISOString();
      const agora = new Date().toISOString();
      // Uma proposta aberta por cliente: atualiza a mesma (mesmo número e link), salvo se pedir outra.
      const abertas = (await propostasDoCliente(ws, tel)).filter((p) => ["LEAD", "PROPOSTA ENVIADA"].includes(p.status_venda || "LEAD") && !p.dados_customizados.solar.aceite);
      const existente = b.novo === true ? null : abertas[0];
      const campos: any = {
        nome: String(c.nome || existente?.nome || "Cliente WhatsApp").slice(0, 120), telefone1: tel,
        cidade: c.cidade || e.cidade || null, estado: (c.uf || r.uf || "").toUpperCase() || null, email: c.email || null,
        plano: `${String(r.kwp).replace(".", ",")} kWp`, operadora: cfg.painel_marca, valor_plano: r.preco, status_venda: "PROPOSTA ENVIADA", updated_at: agora,
      };
      let id: number, numero: string, token: string;
      if (existente) {
        const d = dadosSolar(existente);
        token = d.token || novoToken(); numero = d.numero || `SOL-${existente.id}`;
        const solar = { ...d, numero, entrada: e, resultado: r, token, validade_ate, enviada_em: d.enviada_em || agora, canal: d.canal || "whatsapp_ia",
          historico: [...(d.historico || []), { em: agora, etapa: "PROPOSTA ENVIADA", nota: `Proposta atualizada pela Vendedora IA: ${kwpTxt(r.kwp)}, ${brl(r.preco)}`, por: "ia_solar" }] };
        const { error } = await supabaseServer.from("proposta").update({ ...campos, dados_customizados: { ...existente.dados_customizados, solar } }).eq("id", existente.id);
        if (error) throw error;
        id = existente.id;
      } else {
        token = novoToken(); numero = `SOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const solar = { numero, entrada: e, resultado: r, token, validade_ate, enviada_em: agora, canal: "whatsapp_ia",
          historico: [{ em: agora, etapa: "PROPOSTA ENVIADA", nota: `Proposta criada pela Vendedora IA no WhatsApp: ${kwpTxt(r.kwp)}, ${brl(r.preco)}`, por: "ia_solar" }] };
        const { data, error } = await supabaseServer.from("proposta").insert([{ ...campos, workspace_id: ws, data_proposta: agora.slice(0, 10), vendedor: "Vendedora IA", dados_customizados: { solar, criado_por: "ia_solar" } }]).select("id").single();
        if (error) throw error;
        id = (data as any).id;
        await avisarEmpresaSolar(ws, id, "nova");
      }
      return NextResponse.json({ ok: true, proposta_id: id, numero, link: linkSolar(token, origem), valida_ate: new Date(validade_ate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), atualizada: !!existente, ...resumoIA(r) });
    }

    // As ações abaixo só mexem em propostas do próprio telefone do cliente.
    const minhas = await propostasDoCliente(ws, b.telefone);
    const alvo = (id: any) => minhas.find((p) => p.id === Number(id)) || null;

    if (acao === "aceitar") {
      const p = alvo(b.proposta_id) || minhas.find((x) => ["LEAD", "PROPOSTA ENVIADA"].includes(x.status_venda || ""));
      if (!p) return NextResponse.json({ ok: false, erro: "proposta deste cliente não encontrada (envie a proposta antes)" });
      const pagamento = String(b.pagamento || cfg.formas_pagamento[0] || "").slice(0, 80);
      const prazo = Math.round(Number(b.prazo) || 0) || null;
      const endereco = String(b.endereco || "").slice(0, 200);
      await atualizarSolar(p.id, `Cliente aprovou no WhatsApp (${pagamento}${prazo ? ` em ${prazo}x` : ""})`,
        () => ({ aceite: { em: new Date().toISOString(), pagamento, prazo, por: "whatsapp_ia", nome: String(b.nome || "").slice(0, 120), cpf: String(b.cpf || "").slice(0, 20), endereco } }),
        "ACEITA", { ...(endereco ? { endereco } : {}), ...(b.nome ? { nome: String(b.nome).slice(0, 120) } : {}), ...(b.cpf ? { cpf: String(b.cpf).slice(0, 20) } : {}), __por: "ia_solar" });
      const av = await avisarEmpresaSolar(ws, p.id, "aceite");
      return NextResponse.json({ ok: true, proposta_id: p.id, numero: dadosSolar(p).numero, empresa_avisada: av.ok, proximo_passo: "A equipe vai entrar em contato para agendar a visita técnica gratuita, conferir o telhado e o padrão de energia, e fechar o contrato." });
    }

    if (acao === "recusar") {
      const p = alvo(b.proposta_id);
      if (!p) return NextResponse.json({ ok: false, erro: "proposta deste cliente não encontrada" });
      const motivo = String(b.motivo || "não informado").slice(0, 300);
      await atualizarSolar(p.id, `Cliente recusou no WhatsApp: ${motivo}`, () => ({ recusa: { em: new Date().toISOString(), motivo, por: "whatsapp_ia" } }), "PERDIDA", { __por: "ia_solar" });
      await avisarEmpresaSolar(ws, p.id, "recusa", `Motivo: ${motivo}`);
      return NextResponse.json({ ok: true });
    }

    if (acao === "visita") {
      const p = alvo(b.proposta_id) || minhas[0];
      if (!p) return NextResponse.json({ ok: false, erro: "envie a proposta antes de pedir a visita" });
      const data = String(b.data || "").slice(0, 60), endereco = String(b.endereco || "").slice(0, 200), obs = String(b.obs || "").slice(0, 300);
      await atualizarSolar(p.id, `Visita técnica pedida no WhatsApp${data ? ` (${data})` : ""}`, () => ({ visita: { pedida_em: new Date().toISOString(), data, endereco, obs } }),
        ["LEAD", "PROPOSTA ENVIADA", "ACEITA"].includes(p.status_venda || "") ? "VISITA TECNICA" : undefined, { ...(endereco ? { endereco } : {}), __por: "ia_solar" });
      const av = await avisarEmpresaSolar(ws, p.id, "visita", [data && `Data sugerida: ${data}`, endereco && `Endereço: ${endereco}`, obs].filter(Boolean).join("\n"));
      return NextResponse.json({ ok: true, empresa_avisada: av.ok, aviso: "Diga ao cliente que a equipe confirma o dia e o horário com ele." });
    }

    if (acao === "status") {
      return NextResponse.json({ ok: true, propostas: minhas.slice(0, 5).map((p) => { const d = dadosSolar(p); return {
        proposta_id: p.id, numero: d.numero, etapa: etapaSolar(p.status_venda).label, valor: brl(Number(p.valor_plano) || 0),
        potencia: d.resultado ? kwpTxt(d.resultado.kwp) : "", link: d.token ? linkSolar(d.token, origem) : null,
        link_valido: d.validade_ate ? new Date(d.validade_ate).getTime() > Date.now() : false, aceita: !!d.aceite, visita: d.visita?.data || null,
      }; }) });
    }

    return NextResponse.json({ ok: false, erro: "ação desconhecida" }, { status: 400 });
  } catch (e: any) {
    console.error("[solar/agente]", e?.message || e);
    return NextResponse.json({ ok: false, erro: "Erro no sistema: " + String(e?.message || e).slice(0, 160) }, { status: 500 });
  }
}
