"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useLoja, CONFIRMADAS, ped, totalPedido } from "./_dados";
import Caixa from "./_sections/Caixa";
import Painel from "./_sections/Painel";
import Pedidos from "./_sections/Pedidos";
import Catalogo from "./_sections/Catalogo";
import Estoque from "./_sections/Estoque";
import Clientes from "./_sections/Clientes";
import ConfigLoja from "./_sections/ConfigLoja";
import Icone, { IconeEmoji } from "../../components/a2/Icone";
import { useAppNicho } from "../_app-nicho";
import { NUM } from "./_ui";

// ═══════════════════════════════════════════════════════════════════════
// Sistema do nicho Vendas: um app de frente de caixa (PDV), em tela inteira.
// Trilho escuro de teclas à esquerda, barra do caixa no topo e a tela de venda
// (Caixa) como principal. Não usa a moldura do CRM.
// ═══════════════════════════════════════════════════════════════════════

type Aba = { key: string; label: string; icone: string; soGestor?: boolean };
const ABAS: Aba[] = [
  { key: "caixa", label: "Caixa", icone: "dinheiro" },
  { key: "pedidos", label: "Vendas", icone: "documento" },
  { key: "orcamentos", label: "Orçamentos", icone: "editar" },
  { key: "clientes", label: "Clientes", icone: "usuarios" },
  { key: "catalogo", label: "Produtos", icone: "tag" },
  { key: "estoque", label: "Estoque", icone: "pasta" },
  { key: "painel", label: "Resultados", icone: "grafico" },
  { key: "config", label: "Regras", icone: "config", soGestor: true },
];
export type Alvo = { pedidoId?: number; novo?: boolean; orcamento?: boolean; telefone?: string; t?: number };
export type Navegar = (aba: string, alvo?: Alvo) => void;

export default function ComercialLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const dados = useLoja("vendas");
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;
  return <TelaComercial dados={dados} gestor={gestor} temAcesso={temAcesso} loading={loading} />;
}

export function TelaComercial({ dados, gestor, temAcesso, loading }: { dados: any; gestor: boolean; temAcesso: boolean; loading: boolean }) {
  const app = useAppNicho();
  const chave = "wolf_comercial_aba";
  const [aba, setAba] = useState("caixa");
  const [alvo, setAlvo] = useState<Alvo>({});
  const [menu, setMenu] = useState(false);
  const [hora, setHora] = useState("");
  const SECTIONS: Record<string, React.ComponentType<any>> = { caixa: Caixa, painel: Painel, pedidos: Pedidos, orcamentos: Pedidos, catalogo: Catalogo, estoque: Estoque, clientes: Clientes, config: ConfigLoja };
  const abas = ABAS.filter((a) => !a.soGestor || gestor);

  useEffect(() => {
    try { const s = localStorage.getItem(chave); if (s) setAba(s); } catch {}
    const t = () => setHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    t(); const i = setInterval(t, 20_000); return () => clearInterval(i);
  }, []);
  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova); setAlvo({ ...(novoAlvo || {}), t: Date.now() }); setMenu(false);
    try { localStorage.setItem(chave, nova); } catch {}
    window.scrollTo({ top: 0 });
  };
  const valida = abas.some((a) => a.key === aba) ? aba : "caixa";
  const Comp = SECTIONS[valida];
  const hojeISO = new Date().toISOString().slice(0, 10);
  const doDia = (dados.pedidos || []).filter((p: any) => CONFIRMADAS.vendas.includes(p.status_venda || "") && String(ped(p).pago_em || p.created_at).slice(0, 10) === hojeISO);
  const caixaDia = doDia.reduce((s: number, p: any) => s + totalPedido(ped(p)), 0);
  const iniciais = (app.userNome || app.userEmail || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="com-app nicho-app">
      <nav className="com-trilho" aria-label="Áreas">
        <button className="com-logo" onClick={() => ir("caixa")} title="Caixa">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18l-1.5 11h-15L3 9Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></svg>
        </button>
        {abas.map((a) => (
          <button key={a.key} onClick={() => ir(a.key)} className={valida === a.key ? "ativo" : ""}>
            <Icone nome={a.icone as any} tamanho={21} /><span>{a.label}</span>
          </button>
        ))}
      </nav>
      <div className="com-corpo">
        <header className="com-barra">
          <div className="com-barra-loja">
            <b>{app.workspaceNome || "Minha loja"}</b>
            <span><i className="com-led" /> Caixa aberto · {hora}</span>
          </div>
          <div className="com-barra-dia">
            <span>Vendido hoje</span>
            <b style={NUM}>{caixaDia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
            <small style={NUM}>{doDia.length} venda(s)</small>
          </div>
          <div className="com-barra-acoes">
            {app.atalhos.slice(0, 3).map((a) => <button key={a.path} className="com-atalho" onClick={() => app.ir(a.path)} title={a.label}><IconeEmoji e={a.icon} tamanho={17} /><span>{a.label}</span></button>)}
            <div style={{ position: "relative" }}>
              <button className="com-operador" onClick={() => setMenu((v) => !v)}>
                <span className="av">{app.fotoUrl ? <img src={app.fotoUrl} alt="" /> : iniciais}</span>
                <span className="nm"><small>Operador</small>{(app.userNome || app.userEmail || "").split(" ")[0]}</span>
              </button>
              {menu && (
                <div className="com-menu" onMouseLeave={() => setMenu(false)}>
                  {app.atalhos.map((a) => <button key={a.path} onClick={() => app.ir(a.path)}><IconeEmoji e={a.icon} tamanho={15} />{a.label}</button>)}
                  <button onClick={() => app.ir("/meu-perfil")}><Icone nome="usuario" tamanho={15} />Meu perfil</button>
                  <button onClick={app.sair} className="sair"><Icone nome="sair" tamanho={15} />Fechar caixa e sair</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={valida === "caixa" ? "com-conteudo com-conteudo-caixa" : "com-conteudo"}>
          {loading ? <div style={{ padding: 48, textAlign: "center", fontWeight: 800, color: "var(--c-sub)" }}>Abrindo o caixa…</div>
            : !temAcesso ? <div style={{ padding: 48, textAlign: "center", fontWeight: 800 }}>Você não tem acesso a este sistema.</div>
            : <Comp key={valida} dados={dados} ir={ir} alvo={alvo} gestor={gestor} orcamentos={valida === "orcamentos"} />}
        </main>
      </div>
    </div>
  );
}
