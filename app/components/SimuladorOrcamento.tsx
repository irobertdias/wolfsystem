"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CONFIGURACAO_PADRAO, PLANOS_WOLF, PRECO_USUARIO_EXTRA as USUARIO_EXTRA_TABELA, PRECO_WHATSAPP_EXTRA } from "../lib/precos-wolf";
import { CONTRATOS_SITE, MODULOS as CATALOGO_MODULOS } from "../lib/orcamento";

type Plano = {
  id: string;
  nome: string;
  mensalidade: number;
  usuarios: number;
  canais: number;
  descricao: string;
  recursos: string[];
};

type Modulo = {
  id: string;
  nome: string;
  descricao: string;
  mensalidade: number;
  implantacao: number;
};

// Preços vêm da tabela única (app/lib/precos-wolf.ts).
const PLANOS: Plano[] = PLANOS_WOLF.map((p) => ({
  id: p.id, nome: p.nome, mensalidade: p.preco, usuarios: p.usuarios, canais: p.whatsapps,
  descricao: p.descricao, recursos: p.resumo,
}));
const INCLUI: Record<string, string[]> = Object.fromEntries(PLANOS_WOLF.map((p) => [p.id, p.inclui]));

// "ref" liga o módulo do simulador ao id da tabela de preços (para saber se já vem no plano).
// Lista: todos os módulos do catálogo (menos CRM e Chatbot, que vêm em todos os planos) + Wolf Contratos.
const MODULOS: (Modulo & { ref?: string })[] = [
  ...CATALOGO_MODULOS.filter((m) => m.id !== "crm" && m.id !== "chatbot" && m.id !== "contratos").map((m) => ({
    id: m.id, ref: m.id, nome: m.nome, descricao: m.linhas[0] || m.sub, mensalidade: m.preco, implantacao: 0,
  })),
  ...Object.entries(CONTRATOS_SITE).map(([id, c]) => ({ id, nome: c.nome, descricao: `${c.sub}. Preço especial para quem contrata o CRM Wolf.`, mensalidade: c.preco, implantacao: 0 })),
];
const WHATSAPP = "5562981519991";
const PRECO_USUARIO_EXTRA = USUARIO_EXTRA_TABELA;
const PRECO_CANAL_EXTRA = PRECO_WHATSAPP_EXTRA;
const moeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export default function SimuladorOrcamento() {
  const [mobile, setMobile] = useState(false);
  const [planoId, setPlanoId] = useState("intermediario");
  const [usuarios, setUsuarios] = useState(12);
  const [canais, setCanais] = useState(2);
  const [modulos, setModulos] = useState<string[]>([]);
  const [dados, setDados] = useState({ nome: "", empresa: "", email: "", telefone: "" });
  const [gerando, setGerando] = useState(false);

  const plano = PLANOS.find((item) => item.id === planoId) || PLANOS[1];
  const usuariosExtras = Math.max(0, usuarios - plano.usuarios);
  const canaisExtras = Math.max(0, canais - plano.canais);
  const noPlano = (item: { ref?: string }) => !!item.ref && (INCLUI[plano.id] || []).includes(item.ref);
  // módulos que já vêm no plano não são cobrados de novo
  const selecionados = MODULOS.filter((item) => modulos.includes(item.id) && !noPlano(item));
  const totalMensal =
    plano.mensalidade +
    usuariosExtras * PRECO_USUARIO_EXTRA +
    canaisExtras * PRECO_CANAL_EXTRA +
    selecionados.reduce((total, item) => total + item.mensalidade, 0);
  // configuração inicial é cobrada em toda contratação (pagamento único)
  const totalImplantacao = CONFIGURACAO_PADRAO + selecionados.reduce((total, item) => total + item.implantacao, 0);

  const itens = useMemo(() => {
    const lista = [{ descricao: `Plano Wolf ${plano.nome}`, tipo: "Mensal", valor: plano.mensalidade }];
    if (usuariosExtras) lista.push({ descricao: `${usuariosExtras} usuário(s) adicional(is)`, tipo: "Mensal", valor: usuariosExtras * PRECO_USUARIO_EXTRA });
    if (canaisExtras) lista.push({ descricao: `${canaisExtras} canal(is) adicional(is)`, tipo: "Mensal", valor: canaisExtras * PRECO_CANAL_EXTRA });
    selecionados.forEach((item) => {
      if (item.mensalidade) lista.push({ descricao: item.nome, tipo: "Mensal", valor: item.mensalidade });
      if (item.implantacao) lista.push({ descricao: item.nome, tipo: "Único", valor: item.implantacao });
    });
    lista.push({ descricao: "Configuração inicial (único)", tipo: "Único", valor: CONFIGURACAO_PADRAO });
    return lista;
  }, [plano, usuariosExtras, canaisExtras, selecionados]);

  function escolherPlano(novo: Plano) {
    setPlanoId(novo.id);
    setUsuarios((atual) => Math.max(atual, novo.usuarios));
    setCanais((atual) => Math.max(atual, novo.canais));
  }

  function alternarModulo(id: string) {
    setModulos((atual) => {
      if (atual.includes(id)) return atual.filter((item) => item !== id);
      if (id.startsWith("contratos-")) return [...atual.filter((item) => !item.startsWith("contratos-")), id];
      return [...atual, id];
    });
  }

  function mensagemWhatsApp() {
    const extras = selecionados.length ? selecionados.map((item) => item.nome).join(", ") : "nenhum módulo adicional";
    return [
      "Olá! Montei um orçamento no site da Wolf e quero falar com um especialista.",
      "",
      `Plano: ${plano.nome}`,
      `Usuários: ${usuarios}`,
      `Canais: ${canais}`,
      `Módulos: ${extras}`,
      `Mensalidade estimada: ${moeda(totalMensal)}`,
      `Investimento inicial: ${moeda(totalImplantacao)}`,
      dados.empresa ? `Empresa: ${dados.empresa}` : "",
      dados.nome ? `Contato: ${dados.nome}` : "",
    ].filter(Boolean).join("\n");
  }

  const [online, setOnline] = useState<{ carregando: boolean; erro: string }>({ carregando: false, erro: "" });
  const [isca, setIsca] = useState("");

  // Gera um orçamento online de verdade (com aceite, PIX e cadastro) e leva o cliente até ele.
  async function gerarOrcamentoOnline() {
    if (dados.nome.trim().length < 2 || dados.telefone.replace(/\D/g, "").length < 10) {
      setOnline({ carregando: false, erro: "Preencha seu nome e WhatsApp com DDD no passo 4." });
      document.getElementById("orcamento-identificacao")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setOnline({ carregando: true, erro: "" });
    try {
      const r = await fetch("/api/orcamentos/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, site: isca, plano: plano.id, usuarios, whatsapps: canais, modulos: selecionados.map((m) => m.id) }),
      });
      const d = await r.json().catch(() => ({ success: false, error: "Resposta inválida" }));
      if (!r.ok || !d.success) throw new Error(d.error || "Não foi possível gerar o orçamento");
      window.location.href = d.link;
    } catch (e) {
      setOnline({ carregando: false, erro: e instanceof Error ? e.message : "Não foi possível gerar o orçamento" });
    }
  }

  function abrirWhatsApp() {
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagemWhatsApp())}`, "_blank", "noopener,noreferrer");
  }

  async function gerarPdf() {
    setGerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const hoje = new Date();
      const validade = new Date(hoje);
      validade.setDate(validade.getDate() + 7);
      const codigo = `WOLF-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}-${String(Date.now()).slice(-5)}`;
      const dataBr = (data: Date) => data.toLocaleDateString("pt-BR");

      doc.setFillColor(37, 99, 235);
      doc.roundedRect(14, 12, 182, 33, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("WOLF SYSTEM", 22, 26);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Orçamento personalizado", 22, 35);
      doc.text(codigo, 188, 26, { align: "right" });
      doc.text(`Emitido em ${dataBr(hoje)}`, 188, 34, { align: "right" });

      let y = 56;
      doc.setTextColor(23, 35, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Dados do orçamento", 16, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const cliente = [
        `Cliente: ${dados.nome || "Não informado"}`,
        `Empresa: ${dados.empresa || "Não informada"}`,
        `E-mail: ${dados.email || "Não informado"}`,
        `Telefone: ${dados.telefone || "Não informado"}`,
        `Validade: ${dataBr(validade)}`,
      ];
      cliente.forEach((linha) => { doc.text(linha, 16, y); y += 6; });

      y += 4;
      doc.setFillColor(245, 248, 255);
      doc.roundedRect(14, y, 182, 26, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Plano ${plano.nome}`, 20, y + 9);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${usuarios} usuário(s) • ${canais} canal(is)`, 20, y + 17);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(37, 99, 235);
      doc.text(`${moeda(totalMensal)}/mês`, 188, y + 14, { align: "right" });
      y += 36;

      doc.setTextColor(23, 35, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Composição do investimento", 16, y);
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("ITEM", 16, y);
      doc.text("COBRANÇA", 148, y);
      doc.text("VALOR", 190, y, { align: "right" });
      y += 4;
      doc.setDrawColor(220, 228, 240);
      doc.line(16, y, 190, y);
      y += 7;

      doc.setTextColor(35, 48, 70);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      itens.forEach((item) => {
        if (y > 258) { doc.addPage(); y = 20; }
        doc.text(item.descricao, 16, y);
        doc.text(item.tipo, 148, y);
        doc.text(moeda(item.valor), 190, y, { align: "right" });
        y += 7;
      });

      y += 4;
      doc.line(16, y, 190, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Mensalidade estimada", 16, y);
      doc.text(moeda(totalMensal), 190, y, { align: "right" });
      y += 7;
      doc.text("Investimento inicial", 16, y);
      doc.text(moeda(totalImplantacao), 190, y, { align: "right" });

      y += 13;
      doc.setFontSize(12);
      doc.text("O que está incluído", 16, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      [...plano.recursos, ...selecionados.map((item) => item.descricao)].forEach((recurso) => {
        const linhas = doc.splitTextToSize(`• ${recurso}`, 172);
        doc.text(linhas, 18, y);
        y += linhas.length * 5;
      });

      if (y > 250) { doc.addPage(); y = 22; }
      y += 7;
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(14, y, 182, 28, 3, 3, "F");
      doc.setTextColor(30, 64, 175);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Fale com um especialista Wolf pelo WhatsApp", 20, y + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Clique aqui para enviar este orçamento e tirar suas dúvidas.", 20, y + 18);
      doc.link(14, y, 182, 28, { url: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagemWhatsApp())}` });

      y += 38;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      const observacao = "Valores estimados conforme a configuração selecionada. A contratação, disponibilidade técnica, integrações e condições comerciais serão confirmadas por um especialista Wolf.";
      doc.text(doc.splitTextToSize(observacao, 178), 16, y);

      const arquivo = `orcamento-wolf-${codigo.toLowerCase()}.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const janela = window.open(url, "_blank", "noopener,noreferrer");
      if (!janela) doc.save(arquivo);
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      setGerando(false);
    }
  }

  return (
    <section id="orcamento" style={{ padding: "96px 20px", background: "linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)", borderTop: "1px solid #e8eef8" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 38px" }}>
          <span style={kicker}>ORÇAMENTO PERSONALIZADO</span>
          <h2 style={{ color: "#0F172A", fontSize: "clamp(34px,5vw,54px)", letterSpacing: -2, lineHeight: 1.06, margin: "15px 0" }}>Monte a Wolf ideal para sua empresa</h2>
          <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.65, margin: 0 }}>Escolha o plano, ajuste usuários e canais e adicione somente os módulos que sua operação precisa. No final, gere seu PDF na hora.</p>
        </div>

        <div style={{ ...layout, ...(mobile ? { gridTemplateColumns: "1fr" } : {}) }}>
          <div style={{ display: "grid", gap: 22 }}>
            <Bloco numero="1" titulo="Escolha o plano principal">
              <div style={gridPlanos}>
                {PLANOS.map((item) => {
                  const ativo = item.id === plano.id;
                  return (
                    <button key={item.id} type="button" onClick={() => escolherPlano(item)} style={{ ...cardPlano, borderColor: ativo ? "#047857" : "#dfe7f3", background: ativo ? "#ECFDF5" : "#fff", boxShadow: ativo ? "0 14px 34px rgba(5,150,105,.14)" : "none" }}>
                      <span style={{ color: "#0F172A", fontSize: 18, fontWeight: 900 }}>{item.nome}</span>
                      <strong style={{ color: "#047857", fontSize: 26 }}>{moeda(item.mensalidade)}</strong>
                      <small style={{ color: "#64748b" }}>{item.usuarios} usuários • {item.canais} canal(is)</small>
                    </button>
                  );
                })}
              </div>
            </Bloco>

            <Bloco numero="2" titulo="Defina o tamanho da operação">
              <div style={gridDois}>
                <Contador titulo="Usuários" texto={`${plano.usuarios} incluídos no plano`} valor={usuarios} minimo={1} onChange={setUsuarios} />
                <Contador titulo="Canais de atendimento" texto={`${plano.canais} incluído(s) no plano`} valor={canais} minimo={1} onChange={setCanais} />
              </div>
            </Bloco>

            <Bloco numero="3" titulo="Adicione recursos">
              <div style={gridModulos}>
                {MODULOS.map((item) => {
                  const incluso = noPlano(item);
                  const ativo = incluso || modulos.includes(item.id);
                  const preco = incluso ? "incluso no plano" : item.mensalidade ? `${moeda(item.mensalidade)}/mês` : `${moeda(item.implantacao)} único`;
                  return (
                    <button key={item.id} type="button" disabled={incluso} onClick={() => alternarModulo(item.id)} style={{ ...cardModulo, borderColor: ativo ? "#047857" : "#dfe7f3", background: ativo ? "#ECFDF5" : "#fff", cursor: incluso ? "default" : cardModulo.cursor }}>
                      <span style={{ ...check, background: ativo ? "#047857" : "#eef2f7", color: ativo ? "#fff" : "#94a3b8" }}>{ativo ? "✓" : "+"}</span>
                      <span style={{ flex: 1 }}><strong style={{ display: "block", color: "#0F172A", marginBottom: 5 }}>{item.nome}</strong><small style={{ color: "#64748b", lineHeight: 1.45 }}>{item.descricao}</small></span>
                      <strong style={{ color: "#065F46", fontSize: 12 }}>{preco}</strong>
                    </button>
                  );
                })}
              </div>
            </Bloco>

            <Bloco numero="4" titulo="Identifique o orçamento">
              <div id="orcamento-identificacao" style={gridDois}>
                {/* campo isca contra robôs: invisível para pessoas */}
                <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} name="site" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
                <Campo label="Seu nome" value={dados.nome} onChange={(valor) => setDados({ ...dados, nome: valor })} />
                <Campo label="Empresa" value={dados.empresa} onChange={(valor) => setDados({ ...dados, empresa: valor })} />
                <Campo label="E-mail" type="email" value={dados.email} onChange={(valor) => setDados({ ...dados, email: valor })} />
                <Campo label="WhatsApp" value={dados.telefone} onChange={(valor) => setDados({ ...dados, telefone: valor })} />
              </div>
            </Bloco>
          </div>

          <aside style={{ ...resumo, ...(mobile ? { position: "static", top: "auto" } : {}) }}>
            <span style={kicker}>SEU ORÇAMENTO</span>
            <h3 style={{ color: "#0F172A", fontSize: 26, margin: "10px 0 4px" }}>Wolf {plano.nome}</h3>
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: "0 0 22px" }}>{plano.descricao}</p>
            <div style={linha}><span>Usuários</span><strong>{usuarios}</strong></div>
            <div style={linha}><span>Canais</span><strong>{canais}</strong></div>
            <div style={linha}><span>Módulos adicionais</span><strong>{selecionados.length}</strong></div>
            <div style={{ height: 1, background: "#E6ECEA", margin: "18px 0" }} />
            {itens.map((item, indice) => <div key={`${item.descricao}-${indice}`} style={{ ...linha, fontSize: 12 }}><span>{item.descricao}</span><strong>{moeda(item.valor)}</strong></div>)}
            <div style={{ padding: 18, borderRadius: 18, background: "linear-gradient(135deg,#065F46,#047857)", color: "#fff", marginTop: 20 }}>
              <small style={{ opacity: .8 }}>mensalidade estimada</small>
              <strong style={{ display: "block", fontSize: 31, marginTop: 3 }}>{moeda(totalMensal)}<span style={{ fontSize: 12, fontWeight: 500 }}>/mês</span></strong>
              <small style={{ display: "block", marginTop: 8, opacity: .85 }}>Investimento inicial: {moeda(totalImplantacao)}</small>
            </div>
            <button type="button" onClick={gerarOrcamentoOnline} disabled={online.carregando} style={botaoOnline}>{online.carregando ? "Gerando seu orçamento..." : "Gerar meu orçamento e contratar →"}</button>
            {online.erro && <p style={{ color: "#dc2626", fontSize: 12, margin: "8px 0 0", textAlign: "center" }}>{online.erro}</p>}
            <button type="button" onClick={gerarPdf} disabled={gerando} style={botaoPdf}>{gerando ? "Gerando PDF..." : "Baixar orçamento em PDF"}</button>
            <button type="button" onClick={abrirWhatsApp} style={botaoWhats}>Falar com um especialista no WhatsApp</button>
            <p style={{ color: "#94a3b8", fontSize: 10, lineHeight: 1.5, textAlign: "center", marginBottom: 0 }}>Ao gerar o orçamento você recebe um link para conferir, aceitar e pagar a configuração inicial. Válido por 7 dias.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Bloco({ numero, titulo, children }: { numero: string; titulo: string; children: ReactNode }) {
  return <div style={bloco}><div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}><span style={numeroStyle}>{numero}</span><h3 style={{ color: "#0F172A", margin: 0, fontSize: 19 }}>{titulo}</h3></div>{children}</div>;
}

function Contador({ titulo, texto, valor, minimo, onChange }: { titulo: string; texto: string; valor: number; minimo: number; onChange: (valor: number) => void }) {
  return <div style={contador}><div><strong style={{ color: "#0F172A", display: "block" }}>{titulo}</strong><small style={{ color: "#64748b" }}>{texto}</small></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button type="button" style={botaoContador} onClick={() => onChange(Math.max(minimo, valor - 1))}>−</button><strong style={{ minWidth: 28, textAlign: "center", fontSize: 20 }}>{valor}</strong><button type="button" style={botaoContador} onClick={() => onChange(valor + 1)}>+</button></div></div>;
}

function Campo({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (valor: string) => void }) {
  return <label style={{ display: "grid", gap: 7, color: "#475569", fontSize: 12, fontWeight: 800 }}>{label}<input type={type} value={value} onChange={(evento) => onChange(evento.target.value)} style={input} placeholder={`Informe ${label.toLowerCase()}`} /></label>;
}

const kicker: CSSProperties = { color: "#047857", fontSize: 11, fontWeight: 950, letterSpacing: 1.7 };
const layout: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(300px,.75fr)", gap: 24, alignItems: "start" };
const bloco: CSSProperties = { background: "#fff", border: "1px solid #e2e9f4", borderRadius: 24, padding: "clamp(20px,3vw,30px)", boxShadow: "0 14px 44px rgba(15,23,42,.055)" };
const numeroStyle: CSSProperties = { width: 32, height: 32, borderRadius: 10, background: "#ECFDF5", color: "#047857", display: "grid", placeItems: "center", fontWeight: 950 };
const gridPlanos: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 };
const cardPlano: CSSProperties = { border: "2px solid", borderRadius: 18, padding: 18, display: "grid", gap: 8, textAlign: "left", cursor: "pointer", transition: ".2s" };
const gridDois: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 };
const contador: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, border: "1px solid #dfe7f3", borderRadius: 17, padding: 17 };
const botaoContador: CSSProperties = { width: 34, height: 34, borderRadius: 10, border: "1px solid #d8e1ef", background: "#F3F6F5", color: "#047857", fontSize: 20, cursor: "pointer" };
const gridModulos: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 };
const cardModulo: CSSProperties = { border: "1.5px solid", borderRadius: 17, padding: 16, display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer" };
const check: CSSProperties = { width: 28, height: 28, flex: "0 0 28px", borderRadius: 9, display: "grid", placeItems: "center", fontWeight: 950 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dbe4f1", borderRadius: 12, padding: "13px 14px", background: "#fbfdff", color: "#0F172A", outline: "none" };
const resumo: CSSProperties = { position: "sticky", top: 88, background: "#fff", border: "1px solid #dce5f2", borderRadius: 25, padding: 24, boxShadow: "0 22px 60px rgba(15,23,42,.1)" };
const linha: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, color: "#475569", margin: "10px 0" };
const botaoOnline: CSSProperties = { width: "100%", border: 0, borderRadius: 13, padding: "16px 12px", marginTop: 16, background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 12px 28px rgba(5,150,105,.28)" };
const botaoPdf: CSSProperties = { width: "100%", border: 0, borderRadius: 13, padding: "14px 12px", marginTop: 10, background: "#0F172A", color: "#fff", fontWeight: 900, cursor: "pointer" };
const botaoWhats: CSSProperties = { width: "100%", border: "1px solid #059669", borderRadius: 13, padding: "14px 12px", marginTop: 10, background: "#ecfdf3", color: "#047857", fontWeight: 900, cursor: "pointer" };
