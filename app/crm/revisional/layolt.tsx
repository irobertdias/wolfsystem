"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useRevisional } from "./_dados";
import { COR } from "../financeiro/_sections/_ui";
import Painel from "./_sections/Painel";
import Andamento from "./_sections/Andamento";
import Contratos from "./_sections/Contratos";
import Calculo from "./_sections/Calculo";
import Honorarios from "./_sections/Honorarios";
import Relatorios from "./_sections/Relatorios";
import ConfigRevisional from "./_sections/ConfigRevisional";

// ═══════════════════════════════════════════════════════════════════════
// ⚖️ Revisional — shell no mesmo formato do Financeiro (menu interno em
// grupos + telas com o kit visual _ui do Financeiro).
// ═══════════════════════════════════════════════════════════════════════

type Item = { key: string; label: string; icone: string; soGestor?: boolean };
type Grupo = { nome: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  { nome: "Visão Geral", itens: [
    { key: "painel",    label: "Painel",            icone: "📊" },
    { key: "andamento", label: "Andamento",         icone: "🗂️" },
  ]},
  { nome: "Contratos", itens: [
    { key: "contratos", label: "Contratos dos clientes", icone: "📑" },
    { key: "calculo",   label: "Cálculo revisional", icone: "🧮" },
  ]},
  { nome: "Financeiro", itens: [
    { key: "honorarios", label: "Honorários",  icone: "💰" },
    { key: "relatorios", label: "Relatórios",  icone: "📈" },
  ]},
  { nome: "Configurações", itens: [
    { key: "config", label: "Taxas e honorários", icone: "⚙️", soGestor: true },
  ]},
];

const SECTIONS: Record<string, React.ComponentType<any>> = {
  painel: Painel,
  andamento: Andamento,
  contratos: Contratos,
  calculo: Calculo,
  honorarios: Honorarios,
  relatorios: Relatorios,
  config: ConfigRevisional,
};

export type Navegar = (aba: string, alvo?: { contratoId?: number; novo?: boolean; etapa?: string }) => void;

export default function RevisionalLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const dados = useRevisional();

  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;

  const [aba, setAba] = useState("painel");
  const [alvo, setAlvo] = useState<{ contratoId?: number; novo?: boolean; etapa?: string; t?: number }>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>(
    GRUPOS.reduce((acc, g) => { acc[g.nome] = true; return acc; }, {} as Record<string, boolean>)
  );

  useEffect(() => {
    try { const salva = localStorage.getItem("wolf_revisional_aba"); if (salva && SECTIONS[salva]) setAba(salva); } catch {}
  }, []);

  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova);
    setAlvo({ ...(novoAlvo || {}), t: Date.now() });
    try { localStorage.setItem("wolf_revisional_aba", nova); } catch {}
    window.scrollTo({ top: 0 });
  };

  const gruposVisiveis = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.soGestor || gestor) }))
    .filter((g) => g.itens.length > 0);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Carregando…</div>;

  if (!temAcesso) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", color: "#111827", fontSize: 20 }}>Revisional</h2>
        <p style={{ margin: 0, fontSize: 14 }}>Você não tem acesso a este módulo.</p>
      </div>
    );
  }

  const abaValida = SECTIONS[aba] && (aba !== "config" || gestor) ? aba : "painel";
  const Comp = SECTIONS[abaValida];

  return (
    <div className="rev-shell" style={{ display: "flex", minHeight: "calc(100vh - 64px)", background: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media (max-width: 767px) {
          .rev-shell { flex-direction: column; }
          .rev-aside { width: auto !important; border-right: none !important; border-bottom: 1px solid #e5e7eb; padding: 10px 12px !important; display: flex; gap: 6px; overflow-x: auto; }
          .rev-aside .rev-marca, .rev-aside .rev-grupo-titulo { display: none !important; }
          .rev-aside .rev-grupo { display: contents; }
          .rev-aside .rev-item { width: auto !important; white-space: nowrap; margin: 0 !important; }
        }
      `}</style>

      <aside className="rev-aside" style={{ width: 248, background: "#fff", borderRight: "1px solid #e5e7eb", padding: "16px 10px", flexShrink: 0 }}>
        <div className="rev-marca" style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 16px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COR} 0%, #f59e0b 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 10px ${COR}40` }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>⚖️</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: COR, fontSize: 16, lineHeight: 1.1 }}>Revisional</div>
            <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Contratos financeiros</div>
          </div>
        </div>

        {gruposVisiveis.map((g) => (
          <div key={g.nome} className="rev-grupo" style={{ marginBottom: 6 }}>
            <button
              className="rev-grupo-titulo"
              onClick={() => setAbertos((p) => ({ ...p, [g.nome]: !p[g.nome] }))}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              {g.nome}
              <span style={{ fontSize: 10 }}>{abertos[g.nome] ? "▼" : "▶"}</span>
            </button>

            {abertos[g.nome] && g.itens.map((i) => {
              const sel = abaValida === i.key;
              return (
                <button
                  key={i.key}
                  className="rev-item"
                  onClick={() => ir(i.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", marginBottom: 2,
                    background: sel ? `${COR}14` : "transparent",
                    border: sel ? `1px solid ${COR}55` : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer", textAlign: "left",
                    color: sel ? COR : "#374151", fontSize: 13.5, fontWeight: sel ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{i.icone}</span>
                  {i.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <Comp dados={dados} ir={ir} alvo={alvo} gestor={gestor} />
      </main>
    </div>
  );
}
