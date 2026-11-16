"use client";
import { useEffect, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useConsignado, valorLiberado, brl } from "./_dados";
import Painel from "./_sections/Painel";
import Esteira from "./_sections/Esteira";
import Contratos from "./_sections/Contratos";
import Simulador from "./_sections/Simulador";
import Clientes from "./_sections/Clientes";
import Comissoes from "./_sections/Comissoes";
import ConfigConsignado from "./_sections/ConfigConsignado";
import Icone, { IconeEmoji } from "../../components/a2/Icone";
import { useAppNicho } from "../_app-nicho";
import { Dinheiro } from "./_ui";

// ═══════════════════════════════════════════════════════════════════════
// Sistema do nicho Consignado: um app de mesa de crédito, em tela inteira.
// Cabeçalho azul-marinho de banco com a produção do mês, abas em pílula e
// cartões brancos sobrepostos. A esteira é um trilho de etapas por contrato.
// Não usa a moldura do CRM.
// ═══════════════════════════════════════════════════════════════════════

type Aba = { key: string; label: string; icone: string; soGestor?: boolean };
const ABAS: Aba[] = [
  { key: "painel", label: "Início", icone: "grafico" },
  { key: "esteira", label: "Esteira", icone: "funil" },
  { key: "simulador", label: "Simular margem", icone: "carteira" },
  { key: "contratos", label: "Contratos", icone: "documento" },
  { key: "clientes", label: "Clientes", icone: "usuarios" },
  { key: "comissoes", label: "Comissões", icone: "dinheiro" },
  { key: "config", label: "Bancos e tabelas", icone: "config", soGestor: true },
];
const SECTIONS: Record<string, React.ComponentType<any>> = {
  painel: Painel, esteira: Esteira, clientes: Clientes, contratos: Contratos,
  simulador: Simulador, comissoes: Comissoes, config: ConfigConsignado,
};

export type Alvo = { contratoId?: number; novo?: boolean; etapa?: string; cpf?: string; preenchido?: Record<string, any>; t?: number };
export type Navegar = (aba: string, alvo?: Alvo) => void;

export default function ConsignadoLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil, loading } = usePermissao() as any;
  const dados = useConsignado();
  const gestor = isSuperAdmin || isDono || perfil === "Administrador";
  const temAcesso = gestor || !!(permissoes as any).crm_acessar || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || !!permissoes.dashboard;
  return <TelaConsignado dados={dados} gestor={gestor} temAcesso={temAcesso} loading={loading} />;
}

export function TelaConsignado({ dados, gestor, temAcesso, loading }: { dados: any; gestor: boolean; temAcesso: boolean; loading: boolean }) {
  const app = useAppNicho();
  const [aba, setAba] = useState("painel");
  const [alvo, setAlvo] = useState<Alvo>({});
  const [menu, setMenu] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try {
      const salva = localStorage.getItem("wolf_consignado_aba"); if (salva && SECTIONS[salva]) setAba(salva);
      setOculto(localStorage.getItem("wolf_consignado_oculto") === "1");
    } catch {}
  }, []);
  const ir: Navegar = (nova, novoAlvo) => {
    setAba(nova); setAlvo({ ...(novoAlvo || {}), t: Date.now() }); setMenu(false);
    try { localStorage.setItem("wolf_consignado_aba", nova); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const alternarOculto = () => setOculto((v) => { try { localStorage.setItem("wolf_consignado_oculto", v ? "0" : "1"); } catch {} return !v; });

  const abas = ABAS.filter((a) => !a.soGestor || gestor);
  const valida = abas.some((a) => a.key === aba) ? aba : "painel";
  const Comp = SECTIONS[valida];
  const contratos: any[] = dados.contratos || [];
  const mes = new Date().toISOString().slice(0, 7);
  const pagosMes = contratos.filter((c) => c.status_venda === "PAGO" && String(c.updated_at || c.created_at).slice(0, 7) === mes);
  const producao = pagosMes.reduce((s, c) => s + valorLiberado(c), 0);
  const andamento = contratos.filter((c) => !["PAGO", "REPROVADA", "CANCELADA"].includes(c.status_venda || "SIMULACAO"));
  const valorAndamento = andamento.reduce((s, c) => s + valorLiberado(c), 0);
  const iniciais = (app.userNome || app.userEmail || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const saud = (() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })();
  const mascara = (v: string) => (oculto ? "R$ ••••••" : v);

  return (
    <div className="cons-app nicho-app">
      <header className="cons-cabeca">
        <div className="cons-cabeca-topo">
          <button className="cons-marca" onClick={() => ir("painel")}>
            <span className="cons-selo"><Icone nome="predio" tamanho={18} /></span>
            <span><b>{app.workspaceNome || "Mesa de crédito"}</b><small>Correspondente · Consignado</small></span>
          </button>
          <div className="cons-cabeca-acoes">
            {app.atalhos.slice(0, 3).map((a) => <button key={a.path} className="cons-atalho" onClick={() => app.ir(a.path)} title={a.label}><IconeEmoji e={a.icon} tamanho={16} /><span>{a.label}</span></button>)}
            <div style={{ position: "relative" }}>
              <button className="cons-av" onClick={() => setMenu((v) => !v)}>{app.fotoUrl ? <img src={app.fotoUrl} alt="" /> : iniciais}</button>
              {menu && (
                <div className="cons-menu" onMouseLeave={() => setMenu(false)}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--k-borda)" }}><b style={{ display: "block", fontSize: 14 }}>{app.userNome || app.userEmail}</b><small style={{ color: "var(--k-sub)" }}>{app.perfilLabel}</small></div>
                  {app.atalhos.map((a) => <button key={a.path} onClick={() => app.ir(a.path)}><IconeEmoji e={a.icon} tamanho={15} />{a.label}</button>)}
                  <button onClick={() => app.ir("/meu-perfil")}><Icone nome="usuario" tamanho={15} />Meu perfil</button>
                  <button onClick={app.sair} style={{ color: "#C0262D" }}><Icone nome="sair" tamanho={15} />Sair</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="cons-saldo">
          <div>
            <span className="cons-saud">{saud}, {(app.userNome || "").split(" ")[0] || "bem-vindo"}</span>
            <span className="cons-rot">Produção paga em {new Date().toLocaleDateString("pt-BR", { month: "long" })} <button onClick={alternarOculto} title={oculto ? "Mostrar valores" : "Ocultar valores"}><Icone nome="olho" tamanho={15} /></button></span>
            <span className="cons-valor">{oculto ? "R$ ••••••" : <Dinheiro v={brl(producao)} tam={40} />}</span>
          </div>
          <div className="cons-chips">
            <span><small>Na esteira</small><b>{andamento.length} contrato(s)</b><em>{mascara(brl(valorAndamento))}</em></span>
            <span><small>Pagos no mês</small><b>{pagosMes.length} contrato(s)</b><em>ticket {mascara(brl(pagosMes.length ? producao / pagosMes.length : 0))}</em></span>
          </div>
        </div>
        <nav className="cons-abas" aria-label="Áreas">
          {abas.map((a) => <button key={a.key} onClick={() => ir(a.key)} className={valida === a.key ? "ativo" : ""}><Icone nome={a.icone as any} tamanho={15} />{a.label}</button>)}
        </nav>
      </header>
      <main className="cons-conteudo">
        {loading ? <div className="cons-cartao-msg">Carregando…</div>
          : !temAcesso ? <div className="cons-cartao-msg"><Icone nome="cadeado" tamanho={22} /><b>Sem acesso</b><span>Fale com o administrador do workspace.</span></div>
          : <Comp dados={dados} ir={ir} alvo={alvo} gestor={gestor} />}
      </main>
    </div>
  );
}
