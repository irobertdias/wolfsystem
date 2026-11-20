"use client";
import { useState } from "react";
import AjudaCampo from "../../components/AjudaCampo";
import { supabase } from "../../lib/supabase";
import { GRUPOS_NICHO, NICHOS_VENDEDORA, coletaDoNicho, problemasVendedora } from "../../lib/vendedora-ia";

type Props = { dados: Record<string, any>; onChange: (d: Record<string, any>) => void };
const input = { width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, boxSizing: "border-box" as const, background: "#fff" };
const caixa = { display: "grid", gap: 10, padding: 14, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" } as const;
const titulo = (n: number, t: string, sub?: string) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <span style={{ flex: "none", width: 24, height: 24, borderRadius: 999, background: "#0F766E", color: "#fff", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center" }}>{n}</span>
    <div><strong style={{ fontSize: 13, color: "#0f172a" }}>{t}</strong>{sub && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{sub}</div>}</div>
  </div>
);
const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

export default function VendedoraIAConfig({ dados: d, onChange: u }: Props) {
  const [teste, setTeste] = useState<{ carregando?: boolean; ok?: boolean; texto?: string; itens?: any[] }>({});
  const problemas = problemasVendedora(d);
  const coleta: any[] = d.coleta || [];
  const catalogo: any[] = d.catalogo || [];
  const fonte = d.catalogo_fonte || "manual";

  const campo = (rot: string, k: string, opt: { multi?: boolean; ph?: string; ajuda?: string; ex?: string; rows?: number } = {}) => (
    <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#334155" }}>
      <span>{rot} {opt.ajuda && <AjudaCampo texto={opt.ajuda} exemplo={opt.ex} />}</span>
      {opt.multi ? <textarea style={{ ...input, lineHeight: 1.5 }} rows={opt.rows || 4} placeholder={opt.ph} value={d[k] || ""} onChange={(e) => u({ [k]: e.target.value })} />
        : <input style={input} placeholder={opt.ph} value={d[k] || ""} onChange={(e) => u({ [k]: e.target.value })} />}
    </label>
  );

  async function testarCatalogo() {
    setTeste({ carregando: true });
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/vendedora-ia/testar-catalogo", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ fonte, url: fonte === "planilha" ? d.planilha_url : d.api_url, headers: d.api_headers }) })
      .then((x) => x.json()).catch(() => ({ ok: false, erro: "sem conexão" }));
    setTeste(r.ok ? { ok: true, texto: `${r.total} itens encontrados.`, itens: r.itens } : { ok: false, texto: r.erro });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ padding: 12, borderRadius: 12, background: "linear-gradient(135deg,#ecfdf5,#f0fdfa)", border: "1px solid #a7f3d0", fontSize: 12, lineHeight: 1.6 }}>
        <strong>✨ Vendedora IA</strong> — atende, tira dúvidas, mostra o catálogo, coleta os dados, fecha o pedido e avisa você. Fala português, inglês e espanhol. Configure os passos abaixo e salve: não precisa de mais nada.
      </div>
      {problemas.length > 0 && <div style={{ padding: 10, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 12, color: "#9a3412" }}>{problemas.map((p) => <div key={p}>• {p}</div>)}</div>}

      <section style={caixa}>
        {titulo(1, "Ramo do negócio", "Preenche o objetivo, os dados a coletar e as dicas de venda do ramo.")}
        <select style={input} value={d.nicho || ""} onChange={(e) => {
          const id = e.target.value, n = NICHOS_VENDEDORA[id];
          if (!n) return u({ nicho: "" });
          const trocar = !coleta.length || confirm("Trocar o ramo substitui os dados a coletar pelos sugeridos. Continuar?");
          u({ nicho: id, nicho_nome: n.nome, objetivo: n.objetivo, dicas: n.dicas, ...(trocar ? { coleta: coletaDoNicho(id) } : {}) });
        }}>
          <option value="">Escolha o ramo…</option>
          {GRUPOS_NICHO.map((g) => <optgroup key={g} label={g}>{Object.entries(NICHOS_VENDEDORA).filter(([, n]) => n.grupo === g).map(([id, n]) => <option key={id} value={id}>{n.nome}</option>)}</optgroup>)}
        </select>
        {d.nicho && campo("Objetivo da vendedora", "objetivo", { multi: true, rows: 2 })}
      </section>

      <section style={caixa}>
        {titulo(2, "Sobre a empresa", "O que a vendedora precisa saber para responder sem inventar.")}
        {campo("Informações da empresa", "empresa_info", { multi: true, rows: 5, ph: "Endereço, horário de funcionamento, cidades atendidas, prazo e taxa de entrega, garantia, trocas, diferenciais…", ajuda: "Escreva como explicaria a um vendedor novo. A IA usa só o que estiver aqui e no catálogo." })}
        {campo("Perguntas frequentes", "faq", { multi: true, rows: 4, ph: "P: Vocês entregam no sábado?\nR: Sim, até as 14h.\n\nP: Parcela no cartão?\nR: Em até 3x sem juros." })}
      </section>

      <section style={caixa}>
        {titulo(3, "Catálogo de produtos ou serviços", "De onde a vendedora tira nomes, preços, fotos e links.")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([["manual", "✍️ Digitar aqui"], ["planilha", "📊 Planilha do Google"], ["api", "🔌 API / sistema"], ["nenhum", "Sem catálogo (só orçamento)"]] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => { u({ catalogo_fonte: k }); setTeste({}); }} style={{ padding: "7px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: fonte === k ? "2px solid #0F766E" : "1px solid #cbd5e1", background: fonte === k ? "#ecfdf5" : "#fff", color: fonte === k ? "#065f46" : "#334155" }}>{t}</button>
          ))}
        </div>
        {fonte === "manual" && <>
          {catalogo.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6, padding: 10, background: "#f8fafc", borderRadius: 9 }}>
              {(["nome", "preco", "descricao", "link", "imagem", "estoque"] as const).map((k) => (
                <input key={k} style={{ ...input, gridColumn: k === "descricao" ? "1 / -1" : undefined }} placeholder={{ nome: "Nome do produto/serviço", preco: "Preço (ex.: 89,90)", descricao: "Descrição, tamanhos, benefícios…", link: "Link de pagamento/compra (opcional)", imagem: "Link da foto (opcional)", estoque: "Estoque (opcional)" }[k]}
                  value={p[k] ?? ""} onChange={(e) => u({ catalogo: catalogo.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />
              ))}
              <button type="button" style={{ gridColumn: "1 / -1", justifySelf: "start", fontSize: 11.5, color: "#b91c1c", background: "none", border: 0, cursor: "pointer" }} onClick={() => u({ catalogo: catalogo.filter((_, j) => j !== i) })}>Remover item</button>
            </div>
          ))}
          <button type="button" onClick={() => u({ catalogo: [...catalogo, { nome: "", preco: "", descricao: "", link: "", imagem: "", estoque: "" }] })} style={{ ...input, cursor: "pointer", fontWeight: 700, color: "#0F766E" }}>+ Adicionar item</button>
        </>}
        {fonte === "planilha" && <>
          {campo("Link da planilha do Google", "planilha_url", { ph: "https://docs.google.com/spreadsheets/d/…", ajuda: "Na planilha: Compartilhar → Qualquer pessoa com o link → Leitor. Primeira linha com os títulos das colunas: nome, preco, descricao, link, imagem, estoque, categoria (só nome é obrigatória). Mudou a planilha? A IA lê de novo em até 3 minutos.", ex: "nome | preco | descricao | imagem\nCamiseta preta | 59,90 | Algodão, P ao GG | https://…/foto.jpg" })}
        </>}
        {fonte === "api" && <>
          {campo("URL que devolve o catálogo em JSON", "api_url", { ph: "https://seusistema.com/api/produtos", ajuda: "GET que devolve uma lista de itens (ou {produtos: [...]}) com nome, preco, descricao, link, imagem, estoque." })}
          {campo("Cabeçalhos (opcional, um por linha)", "api_headers", { multi: true, rows: 2, ph: "Authorization: Bearer SEU_TOKEN" })}
        </>}
        {(fonte === "planilha" || fonte === "api") && <>
          <button type="button" onClick={testarCatalogo} disabled={teste.carregando} style={{ ...input, cursor: "pointer", fontWeight: 700, color: "#0F766E" }}>{teste.carregando ? "Lendo…" : "🔎 Testar leitura do catálogo"}</button>
          {teste.texto && <div style={{ fontSize: 12, padding: 10, borderRadius: 8, background: teste.ok ? "#ecfdf5" : "#fef2f2", color: teste.ok ? "#065f46" : "#991b1b" }}>
            {teste.ok ? "✅ " : "❌ "}{teste.texto}
            {teste.itens?.slice(0, 5).map((p: any, i: number) => <div key={i} style={{ color: "#334155" }}>• {p.nome}{p.preco != null ? ` — R$ ${Number(p.preco).toFixed(2).replace(".", ",")}` : ""}</div>)}
          </div>}
        </>}
      </section>

      <section style={caixa}>
        {titulo(4, "Dados a coletar para fechar", "A vendedora pede um de cada vez e aproveita o que o cliente já falou. Ficam disponíveis como {{variavel}} nos outros blocos.")}
        {coleta.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 6, alignItems: "center" }}>
            <input style={input} placeholder="O que coletar (ex.: Endereço de entrega)" value={c.rotulo || ""} onChange={(e) => u({ coleta: coleta.map((x, j) => (j === i ? { ...x, rotulo: e.target.value, variavel: x.variavel && x.variavel !== slug(x.rotulo || "") ? x.variavel : slug(e.target.value) } : x)) })} />
            <select style={input} value={c.tipo || "texto"} onChange={(e) => u({ coleta: coleta.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)) })}>{["texto", "cpf", "email", "telefone", "numero", "data"].map((t) => <option key={t}>{t}</option>)}</select>
            <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
              <label title="Obrigatório para registrar"><input type="checkbox" checked={c.obrigatorio !== false} onChange={(e) => u({ coleta: coleta.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)) })} /> obrig.</label>
              <button type="button" onClick={() => u({ coleta: coleta.filter((_, j) => j !== i) })} style={{ border: 0, background: "none", color: "#b91c1c", cursor: "pointer" }}>✕</button>
            </div>
            <code style={{ gridColumn: "1 / -1", fontSize: 10.5, color: "#94a3b8", marginTop: -3 }}>{`{{${c.variavel || "variavel"}}}`}</code>
          </div>
        ))}
        <button type="button" onClick={() => u({ coleta: [...coleta, { variavel: "", rotulo: "", pergunta: "", tipo: "texto", obrigatorio: true }] })} style={{ ...input, cursor: "pointer", fontWeight: 700, color: "#0F766E" }}>+ Dado a coletar</button>
      </section>

      <section style={caixa}>
        {titulo(5, "Pagamento e agendamento", "O que a vendedora manda depois que o cliente confirma.")}
        {campo("Formas de pagamento", "formas_pagamento", { ph: "Pix, cartão em até 3x, dinheiro na entrega" })}
        {campo("Link de pagamento geral (opcional)", "link_pagamento", { ph: "https://mpago.la/…", ajuda: "Usado quando o item do catálogo não tem link próprio." })}
        {campo("Link de agendamento (opcional)", "link_agendamento", { ph: "https://calendly.com/…" })}
        {campo("Mensagem depois do pedido (opcional)", "mensagem_pos_pedido", { multi: true, rows: 2, ph: "Assim que o pagamento cair, separamos e enviamos em até 24h." })}
      </section>

      <section style={caixa}>
        {titulo(6, "Avisos e integrações", "Para onde vai cada pedido registrado.")}
        {campo("WhatsApp que recebe os avisos de pedido", "aviso_whatsapp", { ph: "5562999999999 (pode pôr mais de um, separados por vírgula)", ajuda: "Enviado pelo próprio número do canal: pedido, dados do cliente e pedidos de atendente." })}
        {campo("Planilha de pedidos (Google Apps Script)", "planilha_registro_url", { ph: "https://script.google.com/macros/s/…/exec", ajuda: "Cada pedido vira uma linha. Na planilha: Extensões → Apps Script, cole o código de recebimento (o mesmo do bloco Google Sheets) e implante como app da Web com acesso 'Qualquer pessoa'." })}
        {d.planilha_registro_url && campo("Aba da planilha (opcional)", "planilha_registro_aba", { ph: "Pedidos" })}
        {campo("Webhook (sistema externo, opcional)", "webhook_url", { ph: "https://seu-sistema.com/webhook", ajuda: "Recebe um POST JSON a cada pedido: dados do cliente, itens, total, resumo, idioma e WhatsApp. Serve para Zapier, Make, n8n, ERP…" })}
        <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.6, background: "#f8fafc", padding: 10, borderRadius: 8 }}>
          💡 Quer criar a venda no CRM, aplicar etiqueta ou mandar para outra planilha? Ligue a saída deste bloco a <b>Enviar Venda</b>, <b>Etiqueta</b>, <b>Google Sheets</b> ou <b>Webhook</b>: eles rodam logo depois do pedido, com todas as {"{{variáveis}}"} preenchidas. Para a IA passar a conversa a uma pessoa, tenha um bloco <b>Transferir</b> no fluxo.
        </div>
      </section>

      <section style={caixa}>
        {titulo(7, "Regras e instruções extras (opcional)")}
        {campo("Dicas do ramo", "dicas", { multi: true, rows: 3 })}
        {campo("Regras deste atendimento", "regras", { multi: true, rows: 3, ph: "Não dar desconto acima de 10%. Não atender CNPJ…" })}
        {campo("Instruções extras para a IA", "prompt", { multi: true, rows: 3 })}
      </section>
    </div>
  );
}
