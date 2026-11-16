"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { baixarPdfPedido, linkPublicoPedido, novoToken, docDoFormulario, brlDoc, type EmpresaLoja, type OpcaoFrete } from "../lib/loja-orcamento";

// Botões "PDF" e "Link de aceite" do orçamento/pedido das lojas, o popup que
// aparece ao salvar e a calculadora de frete do modal.
// O token do link fica em dados_customizados.pedido.link_token.

type Form = { nome: string; telefone1: string; cpf?: string; email?: string; endereco?: string; cidade?: string; estado?: string; d: any };
type Atual = { id: number; created_at: string; data_proposta?: string | null; dados_customizados?: any } | null;
type Props = { wsId: string; atual: Atual; form: Form; empresa: EmpresaLoja | undefined; nomeLoja: string; onAtualizado?: () => void };

const bt: any = { height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "0 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: 0, background: "var(--w-50)", color: "var(--w-800)", whiteSpace: "nowrap", textDecoration: "none" };
const textoZap = (form: Form, emp: EmpresaLoja, numero: string, link: string) =>
  `Olá, ${form.nome.split(" ")[0] || ""}! Segue o ${form.d.tipo === "orcamento" ? "orçamento" : "pedido"} nº ${numero} da ${emp.nome}.\nPara ver, baixar o PDF e aprovar (escolhendo entrega e pagamento), acesse:\n${link}`;
const telDe = (form: Form) => form.telefone1.replace(/\D/g, "").replace(/^55/, "");

export default function AcoesOrcamentoLoja({ wsId, atual, form, empresa, nomeLoja, onAtualizado }: Props) {
  const [link, setLink] = useState<string>(atual?.dados_customizados?.pedido?.link_token ? linkPublicoPedido(atual.dados_customizados.pedido.link_token) : "");
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);
  const emp: EmpresaLoja = { ...(empresa || {}), nome: empresa?.nome || nomeLoja };
  const d = form.d;
  const aceite = atual?.dados_customizados?.pedido?.aceite;
  const pagOnline = atual?.dados_customizados?.pedido?.pagamento_online;

  async function gerarLink() {
    if (!atual) { setMsg("Salve o orçamento: o link aparece na hora."); return; }
    setGerando(true); setMsg("");
    const pedido = atual.dados_customizados?.pedido || {};
    let token: string = pedido.link_token;
    if (!token) {
      token = novoToken();
      const { error } = await supabase.from("proposta").update({ dados_customizados: { ...(atual.dados_customizados || {}), pedido: { ...pedido, link_token: token, link_criado_em: new Date().toISOString() } } }).eq("workspace_id", wsId).eq("id", atual.id);
      if (error) { setGerando(false); setMsg("Erro ao gerar o link: " + error.message); return; }
      onAtualizado?.();
    }
    const url = linkPublicoPedido(token);
    setLink(url); setGerando(false);
    try { await navigator.clipboard.writeText(url); setMsg("Link copiado."); } catch { setMsg(""); }
  }

  const tel = telDe(form);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {aceite && (
        <div style={{ background: "#ECFDF5", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#065F46" }}>
          <b>✓ Aprovado pelo cliente em {new Date(aceite.em).toLocaleString("pt-BR")}</b> · {aceite.entrega === "entrega" ? `entrega em ${[aceite.endereco, aceite.cidade].filter(Boolean).join(", ")}${d.servico_frete ? ` (${d.servico_frete})` : ""}` : "retirada na loja"} · pagamento: {aceite.pagamento}
          {aceite.observacoes ? <div>Obs.: {aceite.observacoes}</div> : null}
        </div>
      )}
      {pagOnline && (
        <div style={{ background: pagOnline.status === "pago" ? "#ECFDF5" : "#FFFBEB", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: pagOnline.status === "pago" ? "#065F46" : "#92400E" }}>
          {pagOnline.status === "pago"
            ? <b>💳 Pago online em {new Date(pagOnline.pago_em).toLocaleString("pt-BR")} · {brlDoc(Number(pagOnline.valor) || 0)}{pagOnline.metodo ? ` · ${pagOnline.metodo}` : ""} ({pagOnline.gateway === "asaas" ? "Asaas" : "Mercado Pago"})</b>
            : <b>💳 Cliente abriu o pagamento online em {new Date(pagOnline.criado_em).toLocaleString("pt-BR")}: aguardando a confirmação do {pagOnline.gateway === "asaas" ? "Asaas" : "Mercado Pago"}.</b>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={bt} onClick={() => baixarPdfPedido(docDoFormulario(form, atual, emp, link || undefined))}>⬇ Baixar PDF</button>
        <button type="button" style={bt} disabled={gerando} onClick={gerarLink}>{gerando ? "Gerando…" : link ? "🔗 Copiar link de aceite" : "🔗 Gerar link de aceite"}</button>
        {link && tel.length >= 10 && <a style={bt} href={`https://wa.me/55${tel}?text=${encodeURIComponent(textoZap(form, emp, String(d.numero || atual?.id), link))}`} target="_blank" rel="noreferrer">Enviar link no WhatsApp</a>}
        {link && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 240px", minWidth: 0, background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#334155" }} />}
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("Erro") ? "#B91C1C" : "#047857", fontWeight: 700 }}>{msg}</span>}
      </div>
      {!empresa?.cnpj && <span style={{ fontSize: 12, color: "#B45309" }}>Dica: cadastre logo, CNPJ, endereço e as cores da empresa em Ajustes para sair no PDF e no link.</span>}
    </div>
  );
}

/** Popup mostrado logo depois de salvar o orçamento: link, WhatsApp e PDF. */
export function PopupOrcamentoSalvo({ token, form, atual, empresa, nomeLoja, onClose }: { token: string; form: Form; atual: Atual; empresa: EmpresaLoja | undefined; nomeLoja: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const emp: EmpresaLoja = { ...(empresa || {}), nome: empresa?.nome || nomeLoja };
  const link = linkPublicoPedido(token);
  const numero = String(form.d.numero || atual?.id || "");
  const tel = telDe(form);
  const orc = form.d.tipo === "orcamento";
  async function copiar() { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch {} }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, width: "min(520px, 100%)", padding: 24, boxShadow: "0 30px 60px -20px rgba(15,23,42,.45)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: "var(--w-100)", color: "var(--w-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>✓</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 18, color: "#0F172A" }}>{orc ? "Orçamento" : "Pedido"} nº {numero} salvo</b>
            <div style={{ fontSize: 13, color: "#64748B" }}>Envie o link: o cliente vê, baixa o PDF e aprova escolhendo entrega e pagamento.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 12px", fontSize: 13, color: "#334155" }} />
          <button type="button" onClick={copiar} style={{ ...bt, background: "var(--w-600)", color: "#fff" }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tel.length >= 10 && <a style={{ ...bt, flex: "1 1 200px", background: "#16A34A", color: "#fff" }} href={`https://wa.me/55${tel}?text=${encodeURIComponent(textoZap(form, emp, numero, link))}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>}
          <button type="button" style={{ ...bt, flex: "1 1 160px" }} onClick={() => baixarPdfPedido(docDoFormulario(form, atual, emp, link))}>⬇ Baixar PDF</button>
          <a style={{ ...bt, flex: "1 1 140px" }} href={link} target="_blank" rel="noreferrer">Abrir link</a>
        </div>
        <button type="button" onClick={onClose} style={{ ...bt, background: "#F1F5F9", color: "#475569" }}>Fechar</button>
      </div>
    </div>
  );
}

/** Calculadora de frete do modal: CEP do cliente → opções (SEDEX/PAC ou taxa fixa). */
export function CalcularFreteLoja({ wsId, itens, cepInicial, onEscolher }: { wsId: string; itens: any[]; cepInicial?: string; onEscolher: (o: OpcaoFrete & { destino?: any }) => void }) {
  const [cep, setCep] = useState(cepInicial || "");
  const [ops, setOps] = useState<OpcaoFrete[]>([]);
  const [dest, setDest] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);
  async function calcular() {
    if (cep.replace(/\D/g, "").length !== 8) { setMsg("Digite o CEP do cliente."); return; }
    setCarregando(true); setMsg(""); setOps([]);
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/loja/frete", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify({ ws: wsId, cep, itens }) }).then((x) => x.json()).catch(() => ({ success: false, error: "Sem conexão" }));
    setCarregando(false);
    if (!r.success) { setMsg(r.error || "Não foi possível calcular"); return; }
    setOps(r.opcoes || []); setDest(r.destino); setMsg(r.aviso || (r.opcoes?.length ? "" : "Sem opções para este CEP."));
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "var(--w-50)", borderRadius: 12, padding: 10 }}>
      <b style={{ fontSize: 12.5, color: "var(--w-800)" }}>Calcular frete</b>
      <input value={cep} onChange={(e) => setCep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); calcular(); } }} placeholder="CEP do cliente" inputMode="numeric" style={{ width: 130, background: "#fff", border: "1px solid #E6ECEA", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
      <button type="button" onClick={calcular} disabled={carregando} style={{ ...bt, height: 36 }}>{carregando ? "Calculando…" : "Calcular"}</button>
      {ops.map((o) => (
        <button key={o.servico} type="button" onClick={() => onEscolher({ ...o, destino: dest })} title="Usar este frete" style={{ ...bt, height: 36, background: "#fff", boxShadow: "inset 0 0 0 1.5px var(--w-200)" }}>
          {o.servico} · {o.valor ? brlDoc(o.valor) : "grátis"}{o.prazo ? ` · ${o.prazo}` : ""}{o.fonte === "tabela" ? " (estim.)" : ""}
        </button>
      ))}
      {dest && <span style={{ fontSize: 12, color: "#64748B" }}>{dest.cidade}/{dest.uf}</span>}
      {msg && <span style={{ fontSize: 12, color: "#B45309", fontWeight: 700 }}>{msg}</span>}
    </div>
  );
}
