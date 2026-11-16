"use client";
import { use, useEffect, useState } from "react";
import { baixarPdfPedido, brlDoc, cnpjFmt } from "../../lib/loja-orcamento";

// Página pública do orçamento da loja: o cliente vê os itens, baixa o PDF e aceita,
// informando entrega (endereço) ou retirada e a forma de pagamento.

type Pub = {
  tipo: "orcamento" | "pedido"; numero: string; data: string; validade: string | null;
  cliente: { nome: string; telefone: string; endereco: string; cidade: string; estado: string };
  itens: { nome: string; qtd: number; preco: number; detalhe?: string }[];
  subtotal: number; desconto: number; frete: number; entrega: string; pagamento: string; observacoes: string;
  empresa: { nome: string; cnpj: string; ie: string; endereco: string; cidade: string; cep: string; telefone: string; email: string; site: string; logo: string; condicoes: string; cor?: string; cor2?: string };
  formas_pagamento: string[]; taxa_entrega: number; frete_modo: "fixo" | "calculado"; frete_gratis_acima: number; servico_frete: string; prazo_frete: string; cor: string; cor2: string;
  status: "aberto" | "aceito" | "expirado" | "fechado";
  aceite: null | { em: string; entrega: string; endereco?: string; cidade?: string; pagamento?: string };
};

const dataBr = (s?: string | null) => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("pt-BR") : "");
const COR = "#0F172A";

export default function PedidoPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Pub | null>(null);
  const [erro, setErro] = useState("");
  const [etapa, setEtapa] = useState<"ver" | "aceitar">("ver");
  const [f, setF] = useState({ entrega: "retirada", cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", pagamento: "", documento: "", observacoes: "" });
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [opcoes, setOpcoes] = useState<{ servico: string; valor: number; prazo?: string; fonte: string }[]>([]);
  const [servico, setServico] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [avisoFrete, setAvisoFrete] = useState("");

  useEffect(() => {
    fetch(`/api/loja/publico/${token}`).then((r) => r.json()).then((j) => {
      if (!j.success) { setErro(j.error || "Não foi possível abrir"); return; }
      const x: Pub = j.pedido; setP(x);
      setF((v) => ({ ...v, entrega: x.entrega === "entrega" ? "entrega" : "retirada", pagamento: x.formas_pagamento.includes(x.pagamento) ? x.pagamento : "", endereco: x.cliente.endereco, cidade: x.cliente.cidade, estado: x.cliente.estado }));
    }).catch(() => setErro("Sem conexão. Tente novamente."));
  }, [token]);

  async function buscarCep(cep: string) {
    const c = cep.replace(/\D/g, ""); if (c.length !== 8) return;
    try {
      const j = await fetch(`https://viacep.com.br/ws/${c}/json/`).then((r) => r.json());
      if (!j.erro) setF((v) => ({ ...v, endereco: j.logradouro || v.endereco, bairro: j.bairro || v.bairro, cidade: j.localidade || v.cidade, estado: j.uf || v.estado }));
    } catch {}
    if (p?.frete_modo === "calculado") {
      setCalculando(true); setAvisoFrete(""); setOpcoes([]);
      const r = await fetch(`/api/loja/publico/${token}/frete?cep=${c}`).then((x) => x.json()).catch(() => ({ success: false }));
      setCalculando(false);
      if (!r.success || !r.opcoes?.length) { setAvisoFrete(r.aviso || r.error || "Não foi possível calcular o frete para este CEP."); return; }
      setOpcoes(r.opcoes); setServico(r.opcoes[0].servico);
    }
  }

  async function aceitar() {
    if (!p) return;
    setFalha("");
    if (!f.pagamento) { setFalha("Escolha a forma de pagamento."); return; }
    if (f.entrega === "entrega" && (!f.endereco.trim() || !f.cidade.trim())) { setFalha("Informe o endereço e a cidade da entrega."); return; }
    if (f.entrega === "entrega" && p.frete_modo === "calculado" && !opcoes.length) { setFalha("Digite o CEP para calcular o frete."); return; }
    setEnviando(true);
    const r = await fetch(`/api/loja/publico/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      entrega: f.entrega, servico_frete: servico, pagamento: f.pagamento, documento: f.documento, observacoes: f.observacoes, cep: f.cep, estado: f.estado, cidade: f.cidade,
      endereco: [f.endereco, f.numero, f.bairro].filter((x) => x.trim()).join(", "),
    }) }).then((x) => x.json()).catch(() => ({ success: false, error: "Sem conexão" }));
    setEnviando(false);
    if (!r.success) { setFalha(r.error || "Não foi possível confirmar"); return; }
    setP(r.pedido); setEtapa("ver");
  }

  const pdf = () => p && baixarPdfPedido({ empresa: p.empresa, tipo: p.tipo, numero: p.numero, data: p.data, validade: p.validade || undefined, cliente: { nome: p.cliente.nome, telefone: p.cliente.telefone }, itens: p.itens, desconto: p.desconto, frete: p.frete, pagamento: p.aceite?.pagamento || p.pagamento, link: undefined, entrega: (p.aceite?.entrega || p.entrega) === "entrega" ? "Entrega no endereço" : "Retirada na loja", observacoes: p.observacoes });

  const box: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 20px 40px -24px rgba(16,24,40,.25)", padding: 22 };
  const inp: any = { width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", fontSize: 15, boxSizing: "border-box", outline: "none", color: COR };
  const lab: any = { fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 };

  if (erro) return <main style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div style={{ ...box, textAlign: "center", maxWidth: 420 }}><h1 style={{ fontSize: 20, margin: "0 0 6px", color: COR }}>Link indisponível</h1><p style={{ color: "#64748B", margin: 0 }}>{erro}</p></div></main>;
  if (!p) return <main style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>Carregando…</main>;

  const gratis = p.frete_gratis_acima > 0 && p.subtotal >= p.frete_gratis_acima;
  const freteSim = f.entrega !== "entrega" ? 0 : p.frete_modo === "calculado" ? (opcoes.find((o) => o.servico === servico)?.valor || 0) : gratis ? 0 : (p.frete || p.taxa_entrega);
  const AC = p.cor || "#16A34A";
  const AC2 = p.cor2 || AC;
  const total = Math.max(0, p.subtotal - p.desconto + (etapa === "aceitar" ? freteSim : p.frete));
  const e = p.empresa;

  return (
    <main style={{ minHeight: "100vh", background: "#F1F5F9", padding: "24px 14px 48px", color: COR, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* empresa */}
        <header style={{ ...box, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderTop: `5px solid ${p.cor || COR}` }}>
          {e.logo && <img src={e.logo} alt="" style={{ height: 64, maxWidth: 160, objectFit: "contain" }} />}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: p.cor || COR }}>{e.nome}</h1>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
              {[e.cnpj ? `CNPJ ${cnpjFmt(e.cnpj)}` : "", e.ie ? `IE ${e.ie}` : ""].filter(Boolean).join(" · ")}
              {(e.endereco || e.cidade) && <div>{[e.endereco, e.cidade, e.cep].filter(Boolean).join(" · ")}</div>}
              {(e.telefone || e.email) && <div>{[e.telefone, e.email, e.site].filter(Boolean).join(" · ")}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: AC2, letterSpacing: ".08em" }}>{p.tipo === "orcamento" ? "ORÇAMENTO" : "PEDIDO"}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Nº {p.numero}</div>
            <div style={{ fontSize: 12.5, color: "#64748B" }}>{dataBr(p.data)}{p.validade ? ` · válido até ${dataBr(p.validade)}` : ""}</div>
          </div>
        </header>

        {p.status === "aceito" && p.aceite && (
          <div style={{ ...box, background: "#ECFDF5", boxShadow: "inset 0 0 0 1.5px #A7F3D0" }}>
            <b style={{ fontSize: 16, color: "#065F46" }}>✓ Orçamento aprovado em {new Date(p.aceite.em).toLocaleString("pt-BR")}</b>
            <div style={{ fontSize: 14, color: "#065F46", marginTop: 4 }}>{p.aceite.entrega === "entrega" ? `Entrega em ${[p.aceite.endereco, p.aceite.cidade].filter(Boolean).join(", ")}` : "Retirada na loja"} · Pagamento: {p.aceite.pagamento}. A loja vai entrar em contato para finalizar.</div>
          </div>
        )}
        {p.status === "expirado" && <div style={{ ...box, background: "#FFFBEB", color: "#92400E" }}>O prazo deste orçamento expirou. Fale com a loja para atualizar os valores.</div>}

        {/* itens */}
        <section style={box}>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>Para <b style={{ color: COR }}>{p.cliente.nome}</b></div>
          {p.itens.map((i, k) => (
            <div key={k} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: k ? "1px solid #F1F5F9" : "none", alignItems: "baseline" }}>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{i.nome}</b>{i.detalhe && <div style={{ fontSize: 12.5, color: "#64748B" }}>{i.detalhe}</div>}<div style={{ fontSize: 12.5, color: "#64748B" }}>{i.qtd} × {brlDoc(i.preco)}</div></div>
              <b style={{ fontSize: 15, whiteSpace: "nowrap" }}>{brlDoc(i.qtd * i.preco)}</b>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #E2E8F0", marginTop: 8, paddingTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "#475569" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{brlDoc(p.subtotal)}</span></div>
            {p.desconto > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Desconto</span><span>- {brlDoc(p.desconto)}</span></div>}
            {(etapa === "aceitar" ? freteSim : p.frete) > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Frete / entrega</span><span>{brlDoc(etapa === "aceitar" ? freteSim : p.frete)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, color: p.cor || COR, marginTop: 4 }}><span>Total</span><span>{brlDoc(total)}</span></div>
          </div>
          {(p.observacoes || e.condicoes) && <div style={{ marginTop: 12, fontSize: 13, color: "#64748B", whiteSpace: "pre-wrap" }}>{[p.observacoes, e.condicoes].filter(Boolean).join("\n")}</div>}
        </section>

        {/* aceite */}
        {p.status === "aberto" && etapa === "ver" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setEtapa("aceitar")} style={{ flex: "2 1 240px", height: 54, borderRadius: 14, border: 0, background: AC, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Aprovar orçamento</button>
            <button onClick={pdf} style={{ flex: "1 1 160px", height: 54, borderRadius: 14, border: 0, background: "#fff", color: COR, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "inset 0 0 0 1.5px #CBD5E1" }}>Baixar PDF</button>
          </div>
        )}
        {p.status !== "aberto" && <button onClick={pdf} style={{ height: 50, borderRadius: 14, border: 0, background: "#fff", color: COR, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "inset 0 0 0 1.5px #CBD5E1" }}>Baixar PDF</button>}

        {p.status === "aberto" && etapa === "aceitar" && (
          <section style={{ ...box, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Como você quer receber?</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[["retirada", "Retirar na loja", "sem custo"], ["entrega", "Receber em casa", p.frete_modo === "calculado" ? (gratis ? "frete grátis" : "frete calculado pelo CEP (Sedex/PAC)") : gratis ? "frete grátis" : p.frete || p.taxa_entrega ? brlDoc(p.frete || p.taxa_entrega) : "a combinar"]].map(([k, l, s]) => (
                <button key={k} onClick={() => setF({ ...f, entrega: k })} style={{ flex: "1 1 200px", textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer", border: 0, background: f.entrega === k ? `${AC}14` : "#F8FAFC", boxShadow: f.entrega === k ? `inset 0 0 0 2px ${AC}` : "inset 0 0 0 1px #E2E8F0" }}>
                  <b style={{ display: "block", fontSize: 15, color: COR }}>{l}</b><span style={{ fontSize: 13, color: "#64748B" }}>{s}</span>
                </button>
              ))}
            </div>
            {f.entrega === "entrega" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div><label style={lab}>CEP</label><input style={inp} inputMode="numeric" value={f.cep} onChange={(e) => { setF({ ...f, cep: e.target.value }); if (e.target.value.replace(/\D/g, "").length === 8) buscarCep(e.target.value); }} placeholder="00000-000" /></div>
                <div style={{ gridColumn: "span 2" }}><label style={lab}>Rua</label><input style={inp} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
                <div><label style={lab}>Número / complemento</label><input style={inp} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
                <div><label style={lab}>Bairro</label><input style={inp} value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} /></div>
                <div><label style={lab}>Cidade</label><input style={inp} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></div>
                <div><label style={lab}>UF</label><input style={inp} maxLength={2} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value.toUpperCase() })} /></div>
              </div>
            )}
            {f.entrega === "entrega" && p.frete_modo === "calculado" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calculando && <span style={{ fontSize: 14, color: "#64748B" }}>Calculando o frete…</span>}
                {avisoFrete && <span style={{ fontSize: 13.5, color: "#B45309", fontWeight: 700 }}>{avisoFrete}</span>}
                {!calculando && !opcoes.length && !avisoFrete && <span style={{ fontSize: 13.5, color: "#64748B" }}>Digite o CEP para ver o valor e o prazo do frete.</span>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {opcoes.map((o) => (
                    <button key={o.servico} onClick={() => setServico(o.servico)} style={{ flex: "1 1 200px", textAlign: "left", padding: "12px 16px", borderRadius: 14, cursor: "pointer", border: 0, background: servico === o.servico ? `${AC}14` : "#F8FAFC", boxShadow: servico === o.servico ? `inset 0 0 0 2px ${AC}` : "inset 0 0 0 1px #E2E8F0" }}>
                      <b style={{ display: "block", fontSize: 15, color: COR }}>{o.servico} · {o.valor ? brlDoc(o.valor) : "grátis"}</b>
                      <span style={{ fontSize: 13, color: "#64748B" }}>{o.prazo || ""}{o.fonte === "tabela" ? " · estimativa" : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>Forma de pagamento</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.formas_pagamento.map((x) => <button key={x} onClick={() => setF({ ...f, pagamento: x })} style={{ padding: "11px 16px", borderRadius: 12, cursor: "pointer", border: 0, fontSize: 14, fontWeight: 700, background: f.pagamento === x ? AC : "#F8FAFC", color: f.pagamento === x ? "#fff" : COR, boxShadow: f.pagamento === x ? "none" : "inset 0 0 0 1px #E2E8F0" }}>{x}</button>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <div><label style={lab}>CPF ou CNPJ (para a nota)</label><input style={inp} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></div>
              <div><label style={lab}>Observações</label><input style={inp} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder="Horário, ponto de referência…" /></div>
            </div>
            {falha && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 14 }}>{falha}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button disabled={enviando} onClick={aceitar} style={{ flex: "2 1 240px", height: 54, borderRadius: 14, border: 0, background: AC, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}>{enviando ? "Confirmando…" : `Confirmar · ${brlDoc(total)}`}</button>
              <button onClick={() => setEtapa("ver")} style={{ flex: "1 1 140px", height: 54, borderRadius: 14, border: 0, background: "#F1F5F9", color: "#475569", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Voltar</button>
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Ao confirmar, você aprova este orçamento. A loja recebe seus dados e entra em contato para o pagamento.</p>
          </section>
        )}
      </div>
    </main>
  );
}
