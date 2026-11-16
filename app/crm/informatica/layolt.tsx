"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useLoja, type Modo } from "./_dados";
import Painel from "./_sections/Painel";
import Pedidos from "./_sections/Pedidos";
import Catalogo from "./_sections/Catalogo";
import Estoque from "./_sections/Estoque";
import OrdensServico from "./_sections/OrdensServico";
import Clientes from "./_sections/Clientes";
import ConfigLoja from "./_sections/ConfigLoja";
import Icone, { IconeEmoji } from "../../components/a2/Icone";
import { useAppNicho } from "../_app-nicho";
import { MONO } from "./_ui";

// ═══════════════════════════════════════════════════════════════════════
// Sistema do nicho Informática: um app próprio, em tela inteira e tema escuro de
// bancada técnica. Barra de comando no topo, abas por área (Assistência, Vendas,
// Estoque…) e a bancada de OS como tela principal. Não usa a moldura do CRM.
// ═══════════════════════════════════════════════════════════════════════

type Aba = { key: string; label: string; atalho: string; soGestor?: boolean };
const ABAS: Aba[] = [
  { key: "painel", label: "Monitor", atalho: "F1" },
  { key: "os", label: "Bancada OS", atalho: "F2" },
  { key: "orcamentos", label: "Orçamentos", atalho: "F3" },
  { key: "pedidos", label: "Vendas", atalho: "F4" },
  { key: "clientes", label: "Clientes", atalho: "F5" },
  { key: "catalogo", label: "Produtos", atalho: "F6" },
  { key: "estoque", label: "Estoque", atalho: "F7" },
  { key: "config", label: "Sistema", atalho: "F8", soGestor: true },
];
export type Alvo = { pedidoId?: number; novo?: boolean; orcamento?: boolean; telefone?: string; t?: number };
export type Navegar = (aba: string, alvo?: Alvo) => void;

export default function InformaticaLayolt() {
  return <App modo="vendas" />;
}

function App({ modo }: { modo: Modo }) {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const dados = useLoja(modo);
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;
  return <TelaInformatica dados={dados} gestor={gestor} temAcesso={temAcesso} loading={loading} />;
}

export function TelaInformatica({ dados, gestor, temAcesso, loading }: { dados: any; gestor: boolean; temAcesso: boolean; loading: boolean }) {
  const app = useAppNicho();
  const chave = "wolf_informatica_aba";
  const [aba, setAba] = useState("os");
  const [alvo, setAlvo] = useState<Alvo>({});
  const [menu, setMenu] = useState(false);
  const [relogio, setRelogio] = useState("");
  const SECTIONS: Record<string, React.ComponentType<any>> = { painel: Painel, pedidos: Pedidos, orcamentos: Pedidos, catalogo: Catalogo, estoque: Estoque, os: OrdensServico, clientes: Clientes, config: ConfigLoja };
  const abas = ABAS.filter((a) => !a.soGestor || gestor);

  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova); setAlvo({ ...(novoAlvo || {}), t: Date.now() }); setMenu(false);
    try { localStorage.setItem(chave, nova); } catch {}
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    try { const s = localStorage.getItem(chave); if (s) setAba(s); } catch {}
    const tick = () => setRelogio(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick(); const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);
  // teclas F1…F8 trocam de área, como num sistema de balcão
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const a = abas.find((x) => x.atalho === e.key);
      if (a && !(e.target as HTMLElement)?.closest?.("input, textarea, select")) { e.preventDefault(); ir(a.key); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor]);

  const valida = abas.some((a) => a.key === aba) ? aba : "os";
  const Comp = SECTIONS[valida];
  const abertas = (dados.ordens || []).filter((p: any) => ["RECEBIDO", "EM DIAGNOSTICO", "AGUARDANDO APROVACAO", "EM REPARO", "PRONTO"].includes(p.status_venda || "RECEBIDO")).length;
  const iniciais = (app.userNome || app.userEmail || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="info-app nicho-app">
      <header className="info-topo">
        <div className="info-topo-linha">
          <button className="info-marca" onClick={() => ir("os")} title="Bancada">
            <span className="info-chip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx=".6" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg></span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15, minWidth: 0 }}>
              <b style={{ fontFamily: MONO, fontSize: 13.5, letterSpacing: ".02em", color: "var(--i-txt)" }}>tech<span style={{ color: "var(--i-acento)" }}>desk</span></b>
              <span style={{ fontSize: 11, color: "var(--i-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{app.workspaceNome || "Assistência e loja"}</span>
            </span>
          </button>
          <div className="info-status">
            <span><i style={{ background: "#34D399", boxShadow: "0 0 8px #34D399" }} />online</span>
            <span><i style={{ background: "#22D3EE", boxShadow: "0 0 8px #22D3EE" }} />{abertas} OS na bancada</span>
            <span style={{ color: "var(--i-mut)" }}>{relogio}</span>
          </div>
          <div className="info-acoes">
            <button className="info-novo" onClick={() => ir("os", { novo: true })}>＋ OS</button>
            <button className="info-novo info-novo-2" onClick={() => ir("pedidos", { novo: true })}>＋ Venda</button>
            {app.atalhos.slice(0, 3).map((a) => (
              <button key={a.path} className="info-atalho" onClick={() => app.ir(a.path)} title={a.label}><IconeEmoji e={a.icon} tamanho={16} /><span>{a.label}</span></button>
            ))}
            <div style={{ position: "relative" }}>
              <button className="info-user" onClick={() => setMenu((v) => !v)} title={app.userNome}>
                {app.fotoUrl ? <img src={app.fotoUrl} alt="" /> : <span>{iniciais}</span>}
              </button>
              {menu && (
                <div className="info-menu" onMouseLeave={() => setMenu(false)}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--i-borda)" }}>
                    <b style={{ display: "block", fontSize: 13, color: "var(--i-txt)" }}>{app.userNome || app.userEmail}</b>
                    <span style={{ fontSize: 11.5, color: "var(--i-mut)", fontFamily: MONO }}>{app.perfilLabel}</span>
                  </div>
                  {app.atalhos.map((a) => <button key={a.path} onClick={() => app.ir(a.path)}><IconeEmoji e={a.icon} tamanho={15} />{a.label}</button>)}
                  <button onClick={() => app.ir("/meu-perfil")}><Icone nome="usuario" tamanho={15} />Meu perfil</button>
                  <button onClick={app.sair} style={{ color: "#F87171" }}><Icone nome="sair" tamanho={15} />Sair</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="info-abas" aria-label="Áreas">
          {abas.map((a) => (
            <button key={a.key} onClick={() => ir(a.key)} className={valida === a.key ? "ativo" : ""}>
              <kbd>{a.atalho}</kbd>{a.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="info-conteudo">
        {loading ? <div style={{ padding: 48, textAlign: "center", color: "var(--i-mut)", fontFamily: MONO }}>carregando…</div>
          : !temAcesso ? <div style={{ padding: 48, textAlign: "center", color: "var(--i-sub)" }}>Você não tem acesso a este sistema.</div>
          : <Comp key={valida} dados={dados} ir={ir} alvo={alvo} gestor={gestor} orcamentos={valida === "orcamentos"} />}
      </main>
    </div>
  );
}
