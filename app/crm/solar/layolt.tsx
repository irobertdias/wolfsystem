"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import { nichoLiberado } from "../../lib/modulos-nicho";
import { useSolar } from "./_dados";
import Painel from "./_sections/Painel";
import Propostas from "./_sections/Propostas";
import Obras from "./_sections/Obras";
import Simulador from "./_sections/Simulador";
import ConfigSolarTela from "./_sections/ConfigSolar";
import Icone from "../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// CRM da Energia Solar — mesma moldura dos outros nichos: menu lateral com
// grupos à esquerda e a tela ativa à direita (no celular vira um botão).
// ═══════════════════════════════════════════════════════════════════════

type Item = { key: string; label: string; icone: string; soGestor?: boolean; modulo?: string };
type Grupo = { nome: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  { nome: "CRM", itens: [
    { key: "painel",    label: "Painel de vendas", icone: "grafico" },
    { key: "propostas", label: "Propostas", icone: "documento", modulo: "propostas" },
  ]},
  { nome: "Operação", itens: [
    { key: "simulador", label: "Simulador de sistema", icone: "raio", modulo: "simulador" },
    { key: "obras",     label: "Visitas e instalações", icone: "calendario", modulo: "obras" },
  ]},
  { nome: "Configurações", itens: [
    { key: "config", label: "Kit, preços e financiamento", icone: "config", soGestor: true },
  ]},
];

const SECTIONS: Record<string, React.ComponentType<any>> = {
  painel: Painel, propostas: Propostas, simulador: Simulador, obras: Obras, config: ConfigSolarTela,
};
const LABELS: Record<string, string> = Object.fromEntries(GRUPOS.flatMap((g) => g.itens.map((i) => [i.key, i.label])));
const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

export type AlvoSolar = { propostaId?: number; novo?: boolean; etapa?: string; preenchido?: any; t?: number };
export type NavegarSolar = (aba: string, alvo?: AlvoSolar) => void;

export default function SolarLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const { modulos } = useModulos();
  const liberado = (k?: string) => !k || nichoLiberado(modulos.nicho_opcoes, "solar", k);
  const dados = useSolar();
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;

  const [aba, setAba] = useState("painel");
  const [alvo, setAlvo] = useState<AlvoSolar>({});
  const [isMobile, setIsMobile] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);

  useEffect(() => {
    try { const salva = localStorage.getItem("wolf_solar_aba"); if (salva && SECTIONS[salva]) setAba(salva); } catch {}
    const ver = () => setIsMobile(window.innerWidth < 900);
    ver(); window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);

  const ir: NavegarSolar = (nova, novoAlvo) => {
    setAba(nova);
    setAlvo({ ...(novoAlvo || {}), t: Date.now() });
    setMenuMobile(false);
    try { localStorage.setItem("wolf_solar_aba", nova); } catch {}
    window.scrollTo({ top: 0 });
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Carregando…</div>;
  if (!temAcesso) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 40, textAlign: "center", maxWidth: 420 }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="cadeado" tamanho={24} /></span>
          <h2 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: 19, fontWeight: 800 }}>CRM Energia Solar</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Você não tem acesso a este módulo. Fale com o administrador.</p>
        </div>
      </div>
    );
  }

  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => (!i.soGestor || gestor) && liberado(i.modulo)) })).filter((g) => g.itens.length);
  const visiveis = grupos.flatMap((g) => g.itens.map((i) => i.key));
  const abaValida = SECTIONS[aba] && visiveis.includes(aba) ? aba : "painel";
  const Comp = SECTIONS[abaValida];

  const botao = (i: Item) => {
    const sel = abaValida === i.key;
    return (
      <button key={i.key} onClick={() => ir(i.key)} className={`a2-menu-config${sel ? " ativo" : ""}`}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: 0, borderRadius: 11, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
          background: sel ? "var(--w-50)" : "transparent", color: sel ? "var(--w-800)" : "#475569", fontSize: 13.5, fontWeight: sel ? 800 : 600, transition: "background .15s" }}>
        <Icone nome={i.icone} tamanho={16} cor={sel ? "var(--w-600)" : "#94A3B8"} />
        {i.label}
      </button>
    );
  };
  const menu = grupos.map((g) => (
    <div key={g.nome} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, padding: "12px 12px 4px" }}>{g.nome}</span>
      {g.itens.map(botao)}
    </div>
  ));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start", padding: isMobile ? "4px 0 20px" : "8px 4px 28px", maxWidth: 1440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {isMobile ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setMenuMobile((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: 0, borderRadius: 16, boxShadow: SOMBRA, padding: "12px 16px", fontSize: 14, fontWeight: 800, color: "#0F172A", cursor: "pointer" }}>
            <Icone nome="raio" tamanho={18} cor="var(--w-600)" />
            Solar · {LABELS[abaValida] || ""}
            <span style={{ marginLeft: "auto", display: "inline-flex", transform: menuMobile ? "rotate(180deg)" : "none", transition: "transform .15s" }}><Icone nome="baixo" tamanho={16} /></span>
          </button>
          {menuMobile && <nav aria-label="Seções da energia solar" style={{ background: "#fff", borderRadius: 16, boxShadow: SOMBRA, padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>{menu}</nav>}
        </div>
      ) : (
        <nav aria-label="Seções da energia solar" style={{ flex: "0 0 250px", background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 12, display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 4px" }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--w-50)", color: "var(--w-600)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="raio" tamanho={17} /></span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 16 }}>CRM</span>
              <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>Energia solar</span>
            </span>
          </div>
          {menu}
        </nav>
      )}
      <main style={{ flex: "999 1 560px", minWidth: 0 }}>
        <Comp dados={dados} ir={ir} alvo={alvo} gestor={gestor} />
      </main>
    </div>
  );
}
