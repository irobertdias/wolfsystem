"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import { nichoLiberado } from "../../lib/modulos-nicho";
import { useLoja, type Modo } from "./_dados";
import Painel from "./_sections/Painel";
import Pedidos from "./_sections/Pedidos";
import Catalogo from "./_sections/Catalogo";
import Estoque from "./_sections/Estoque";
import Entregas from "./_sections/Entregas";
import Clientes from "./_sections/Clientes";
import ConfigLoja from "./_sections/ConfigLoja";
import Icone from "../../components/a2/Icone";
import { SIMBOLOS, ROTULO } from "../../lib/arte-nicho";

// ═══════════════════════════════════════════════════════════════════════
// Sistema dos nichos Roupas (loja de moda) e Vendas (produtos e serviços):
// mesma moldura dos outros módulos, menu e telas de acordo com o ramo.
// ═══════════════════════════════════════════════════════════════════════

type Item = { key: string; label: string; icone: string; soGestor?: boolean };
type Grupo = { nome: string; itens: Item[] };

const GRUPOS: Record<Modo, Grupo[]> = {
  roupas: [
    { nome: "Loja", itens: [
      { key: "painel", label: "Painel da loja", icone: "grafico" },
      { key: "pedidos", label: "Pedidos", icone: "documento" },
      { key: "entregas", label: "Separação e entregas", icone: "enviar" },
      { key: "clientes", label: "Clientes", icone: "usuarios" },
    ]},
    { nome: "Produtos", itens: [
      { key: "catalogo", label: "Catálogo (grade)", icone: "tag" },
      { key: "estoque", label: "Estoque por peça", icone: "pasta" },
    ]},
    { nome: "Configurações", itens: [{ key: "config", label: "Pagamentos, entrega e tamanhos", icone: "config", soGestor: true }] },
  ],
  vendas: [
    { nome: "Vendas", itens: [
      { key: "painel", label: "Painel de vendas", icone: "grafico" },
      { key: "orcamentos", label: "Orçamentos", icone: "documento" },
      { key: "pedidos", label: "Pedidos e vendas", icone: "dinheiro" },
      { key: "clientes", label: "Clientes", icone: "usuarios" },
    ]},
    { nome: "Produtos", itens: [
      { key: "catalogo", label: "Produtos e serviços", icone: "tag" },
      { key: "estoque", label: "Estoque", icone: "pasta" },
    ]},
    { nome: "Configurações", itens: [{ key: "config", label: "Pagamentos e regras", icone: "config", soGestor: true }] },
  ],
};

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";
export type Alvo = { pedidoId?: number; novo?: boolean; orcamento?: boolean; telefone?: string; t?: number };
export type Navegar = (aba: string, alvo?: Alvo) => void;

export default function ModaLayolt() {
  return <LojaComModo modo="roupas" />;
}

function LojaComModo({ modo }: { modo: Modo }) {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const { modulos } = useModulos();
  const liberado = (k: string) => nichoLiberado(modulos.nicho_opcoes, "roupas", k);
  const dados = useLoja(modo);
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;
  const chave = "wolf_moda_aba";
  const [aba, setAba] = useState("painel");
  const [alvo, setAlvo] = useState<Alvo>({});
  const [isMobile, setIsMobile] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  const SECTIONS: Record<string, React.ComponentType<any>> = { painel: Painel, pedidos: Pedidos, orcamentos: Pedidos, catalogo: Catalogo, estoque: Estoque, entregas: Entregas, clientes: Clientes, config: ConfigLoja };
  const grupos = GRUPOS[modo].map((g) => ({ ...g, itens: g.itens.filter((i) => (!i.soGestor || gestor) && liberado(i.key)) })).filter((g) => g.itens.length);
  const validas = grupos.flatMap((g) => g.itens.map((i) => i.key));

  useEffect(() => {
    try { const s = localStorage.getItem(chave); if (s) setAba(s); } catch {}
    const ver = () => setIsMobile(window.innerWidth < 900);
    ver(); window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, [chave]);

  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova); setAlvo({ ...(novoAlvo || {}), t: Date.now() }); setMenuMobile(false);
    try { localStorage.setItem(chave, nova); } catch {}
    window.scrollTo({ top: 0 });
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Carregando…</div>;
  if (!temAcesso) {
    return <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 40, textAlign: "center" }}>Você não tem acesso a este módulo.</div></div>;
  }
  const abaValida = validas.includes(aba) ? aba : "painel";
  const Comp = SECTIONS[abaValida];
  const todos = grupos.flatMap((g) => g.itens);
  const simbolo = SIMBOLOS[modo][0];
  const marca = (
    <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--w-50)", color: "var(--w-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={simbolo} /></svg>
    </span>
  );
  const botao = (i: Item) => {
    const sel = abaValida === i.key;
    return (
      <button key={i.key} onClick={() => ir(i.key)} className={`a2-menu-config${sel ? " ativo" : ""}`}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: 0, borderRadius: 11, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
          background: sel ? "var(--w-50)" : "transparent", color: sel ? "var(--w-800)" : "#475569", fontSize: 13.5, fontWeight: sel ? 800 : 600 }}>
        <Icone nome={i.icone as any} tamanho={16} cor={sel ? "var(--w-600)" : "#94A3B8"} />{i.label}
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
          <button onClick={() => setMenuMobile((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: 0, borderRadius: 16, boxShadow: SOMBRA, padding: "12px 16px", fontSize: 14, fontWeight: 800, color: "#0F172A", cursor: "pointer" }}>
            {marca}{modo === "roupas" ? "Loja" : "Vendas"} · {todos.find((i) => i.key === abaValida)?.label}
            <span style={{ marginLeft: "auto" }}><Icone nome="baixo" tamanho={16} /></span>
          </button>
          {menuMobile && <nav style={{ background: "#fff", borderRadius: 16, boxShadow: SOMBRA, padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>{menu}</nav>}
        </div>
      ) : (
        <nav aria-label="Seções" style={{ flex: "0 0 250px", background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 12, display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 4px" }}>
            {marca}
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 16 }}>{modo === "roupas" ? "Loja" : "Vendas"}</span>
              <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>{ROTULO[modo]}</span>
            </span>
          </div>
          {menu}
        </nav>
      )}
      <main style={{ flex: "999 1 560px", minWidth: 0 }}>
        <Comp key={abaValida} dados={dados} ir={ir} alvo={alvo} gestor={gestor} orcamentos={abaValida === "orcamentos"} />
      </main>
    </div>
  );
}
