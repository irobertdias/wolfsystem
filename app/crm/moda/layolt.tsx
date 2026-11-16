"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useLoja } from "./_dados";
import Painel from "./_sections/Painel";
import Pedidos from "./_sections/Pedidos";
import Catalogo from "./_sections/Catalogo";
import Estoque from "./_sections/Estoque";
import Entregas from "./_sections/Entregas";
import Clientes from "./_sections/Clientes";
import ConfigLoja from "./_sections/ConfigLoja";
import Icone, { IconeEmoji } from "../../components/a2/Icone";
import { useAppNicho } from "../_app-nicho";
import { SERIFA } from "./_ui";

// ═══════════════════════════════════════════════════════════════════════
// Sistema do nicho Roupas: um app de boutique, em tela inteira. Faixa de aviso,
// nome da loja centralizado em serifa, menu de vitrine em caixa alta e a
// vitrine (lookbook) como tela principal. Não usa a moldura do CRM.
// ═══════════════════════════════════════════════════════════════════════

type Aba = { key: string; label: string; soGestor?: boolean };
const ABAS: Aba[] = [
  { key: "catalogo", label: "Vitrine" },
  { key: "pedidos", label: "Pedidos" },
  { key: "entregas", label: "Expedição" },
  { key: "clientes", label: "Clientes" },
  { key: "estoque", label: "Grade & estoque" },
  { key: "painel", label: "Caixa do mês" },
  { key: "config", label: "Ateliê", soGestor: true },
];
export type Alvo = { pedidoId?: number; novo?: boolean; orcamento?: boolean; telefone?: string; t?: number };
export type Navegar = (aba: string, alvo?: Alvo) => void;

export default function ModaLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const dados = useLoja("roupas");
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;
  return <TelaModa dados={dados} gestor={gestor} temAcesso={temAcesso} loading={loading} />;
}

export function TelaModa({ dados, gestor, temAcesso, loading }: { dados: any; gestor: boolean; temAcesso: boolean; loading: boolean }) {
  const app = useAppNicho();
  const chave = "wolf_moda_aba";
  const [aba, setAba] = useState("catalogo");
  const [alvo, setAlvo] = useState<Alvo>({});
  const [menu, setMenu] = useState(false);
  const SECTIONS: Record<string, React.ComponentType<any>> = { painel: Painel, pedidos: Pedidos, catalogo: Catalogo, estoque: Estoque, entregas: Entregas, clientes: Clientes, config: ConfigLoja };
  const abas = ABAS.filter((a) => !a.soGestor || gestor);

  useEffect(() => { try { const s = localStorage.getItem(chave); if (s) setAba(s); } catch {} }, []);
  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova); setAlvo({ ...(novoAlvo || {}), t: Date.now() }); setMenu(false);
    try { localStorage.setItem(chave, nova); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const valida = abas.some((a) => a.key === aba) ? aba : "catalogo";
  const Comp = SECTIONS[valida];
  const nome = app.workspaceNome || "Boutique";
  const abertos = (dados.pedidos || []).filter((p: any) => ["PENDENTE", "AGUARDANDO PAGAMENTO", "EM SEPARACAO"].includes(p.status_venda || "PENDENTE")).length;

  return (
    <div className="moda-app nicho-app">
      <div className="moda-faixa">
        <span>{abertos ? `${abertos} sacola(s) em aberto no provador` : "Nenhuma sacola em aberto"}</span>
        <span className="moda-faixa-sep">·</span>
        <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>
      <header className="moda-topo">
        <div className="moda-topo-esq">
          {app.atalhos.slice(0, 3).map((a) => <button key={a.path} onClick={() => app.ir(a.path)}>{a.label}</button>)}
        </div>
        <button className="moda-logo" onClick={() => ir("catalogo")}>
          <span style={{ fontFamily: SERIFA }}>{nome}</span>
          <small>maison · ateliê · loja</small>
        </button>
        <div className="moda-topo-dir">
          <button className="moda-sacola" onClick={() => ir("pedidos", { novo: true })} title="Novo pedido">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l1 14H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
            <span>Nova venda</span>
            {abertos > 0 && <i>{abertos}</i>}
          </button>
          <div style={{ position: "relative" }}>
            <button className="moda-conta" onClick={() => setMenu((v) => !v)}>{(app.userNome || "Conta").split(" ")[0]} <Icone nome="baixo" tamanho={13} /></button>
            {menu && (
              <div className="moda-menu" onMouseLeave={() => setMenu(false)}>
                <span style={{ fontFamily: SERIFA, fontSize: 17, padding: "4px 14px 10px", display: "block", borderBottom: "1px solid var(--m-linha)" }}>{app.userNome || app.userEmail}<small style={{ display: "block", fontFamily: "inherit", fontSize: 11, color: "var(--m-sub)", fontStyle: "italic" }}>{app.perfilLabel}</small></span>
                {app.atalhos.map((a) => <button key={a.path} onClick={() => app.ir(a.path)}><IconeEmoji e={a.icon} tamanho={14} />{a.label}</button>)}
                <button onClick={() => app.ir("/meu-perfil")}><Icone nome="usuario" tamanho={14} />Meu perfil</button>
                <button onClick={app.sair} style={{ color: "#9F1239" }}><Icone nome="sair" tamanho={14} />Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="moda-nav" aria-label="Seções">
        {abas.map((a) => <button key={a.key} onClick={() => ir(a.key)} className={valida === a.key ? "ativo" : ""}>{a.label}</button>)}
      </nav>
      <main className="moda-conteudo">
        {loading ? <div style={{ padding: 60, textAlign: "center", fontFamily: SERIFA, fontStyle: "italic", color: "var(--m-sub)" }}>Abrindo a loja…</div>
          : !temAcesso ? <div style={{ padding: 60, textAlign: "center", fontFamily: SERIFA, color: "var(--m-sub)" }}>Você não tem acesso a esta loja.</div>
          : <Comp key={valida} dados={dados} ir={ir} alvo={alvo} gestor={gestor} orcamentos={false} />}
      </main>
      <footer className="moda-rodape"><span style={{ fontFamily: SERIFA, fontStyle: "italic" }}>{nome}</span> · feito com cuidado, peça por peça</footer>
    </div>
  );
}
