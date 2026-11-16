"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { baixarPdfPedido, linkPublicoPedido, novoToken, n, type EmpresaLoja, type DocPedido } from "../lib/loja-orcamento";

// Botões "PDF" e "Link de aceite" do orçamento/pedido das lojas.
// O link só existe para pedido já salvo; o token fica em dados_customizados.pedido.link_token.

type Props = {
  wsId: string;
  atual: { id: number; created_at: string; data_proposta?: string | null; dados_customizados?: any } | null;
  form: { nome: string; telefone1: string; cpf?: string; email?: string; endereco?: string; cidade?: string; estado?: string; d: any };
  empresa: EmpresaLoja | undefined;
  nomeLoja: string;
  onAtualizado?: () => void;
};

export default function AcoesOrcamentoLoja({ wsId, atual, form, empresa, nomeLoja, onAtualizado }: Props) {
  const [link, setLink] = useState<string>(atual?.dados_customizados?.pedido?.link_token ? linkPublicoPedido(atual.dados_customizados.pedido.link_token) : "");
  const [msg, setMsg] = useState("");
  const [gerando, setGerando] = useState(false);
  const emp: EmpresaLoja = { ...(empresa || {}), nome: empresa?.nome || nomeLoja };
  const d = form.d;
  const aceite = atual?.dados_customizados?.pedido?.aceite;

  const docAtual = (comLink?: string): DocPedido => ({
    empresa: emp,
    tipo: d.tipo === "orcamento" ? "orcamento" : "pedido",
    numero: String(d.numero || atual?.id || "novo"),
    data: atual?.data_proposta || atual?.created_at || new Date().toISOString(),
    validade: d.tipo === "orcamento" ? d.validade : undefined,
    cliente: { nome: form.nome, documento: form.cpf, telefone: form.telefone1, email: form.email, endereco: [form.endereco, form.cidade, form.estado].filter(Boolean).join(" · ") },
    itens: (d.itens || []).map((i: any) => ({ nome: i.nome, qtd: n(i.qtd), preco: n(i.preco), detalhe: [i.tamanho, i.cor, i.serie ? `S/N ${i.serie}` : "", i.garantia_meses ? `garantia ${i.garantia_meses} meses` : ""].filter(Boolean).join(" · ") })),
    desconto: n(d.desconto), frete: n(d.frete),
    entrega: d.entrega === "entrega" ? "Entrega no endereço" : d.entrega === "retirada" ? "Retirada na loja" : undefined,
    pagamento: d.pagamento, observacoes: d.observacoes, link: comLink || link || undefined,
  });

  async function gerarLink() {
    if (!atual) { setMsg("Salve o orçamento antes de gerar o link."); return; }
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

  const tel = form.telefone1.replace(/\D/g, "").replace(/^55/, "");
  const textoZap = link ? `Olá, ${form.nome.split(" ")[0] || ""}! Segue o ${d.tipo === "orcamento" ? "orçamento" : "pedido"} nº ${d.numero || atual?.id} da ${emp.nome}.\nPara aprovar e informar entrega e pagamento, acesse:\n${link}` : "";
  const bt: any = { height: 42, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "0 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: 0, background: "var(--w-50)", color: "var(--w-800)", whiteSpace: "nowrap", textDecoration: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {aceite && (
        <div style={{ background: "#ECFDF5", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#065F46" }}>
          <b>Aceito pelo cliente em {new Date(aceite.em).toLocaleString("pt-BR")}</b> · {aceite.entrega === "entrega" ? `entrega em ${[aceite.endereco, aceite.cidade].filter(Boolean).join(", ")}` : "retirada na loja"} · pagamento: {aceite.pagamento}
          {aceite.observacoes ? <div>Obs.: {aceite.observacoes}</div> : null}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={bt} onClick={() => baixarPdfPedido(docAtual())}>⬇ Baixar PDF</button>
        <button type="button" style={bt} disabled={gerando} onClick={gerarLink}>{gerando ? "Gerando…" : link ? "🔗 Copiar link de aceite" : "🔗 Gerar link de aceite"}</button>
        {link && tel.length >= 10 && <a style={bt} href={`https://wa.me/55${tel}?text=${encodeURIComponent(textoZap)}`} target="_blank" rel="noreferrer">Enviar link no WhatsApp</a>}
        {link && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 240px", minWidth: 0, background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#334155" }} />}
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("Erro") || msg.startsWith("Salve") ? "#B91C1C" : "#047857", fontWeight: 700 }}>{msg}</span>}
      </div>
      {!empresa?.cnpj && <span style={{ fontSize: 12, color: "#B45309" }}>Dica: cadastre logo, CNPJ e endereço da empresa nas configurações para sair no PDF e no link.</span>}
    </div>
  );
}
