"use client";
import { useEffect, useMemo, useState } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import { useModulos } from "../../hooks/useModulos";
import { nichoLiberado } from "../../lib/modulos-nicho";
import { brl0, kwpTxt, ETAPAS_GANHAS } from "../../lib/solar";
import { useSolar, sol } from "./_dados";
import Painel from "./_sections/Painel";
import Propostas from "./_sections/Propostas";
import Obras from "./_sections/Obras";
import Simulador from "./_sections/Simulador";
import ConfigSolarTela from "./_sections/ConfigSolar";
import Icone from "../../components/a2/Icone";
import { SX_CSS, SolLogo } from "./_sections/_sx";

// ═══════════════════════════════════════════════════════════════════════
// Central Solar — CRM da energia solar com identidade própria:
// cabeçalho verde-noite com o sol, números do mês e abas douradas.
// ═══════════════════════════════════════════════════════════════════════

export type Item = { key: string; label: string; icone: string; soGestor?: boolean; modulo?: string };

export const ITENS: Item[] = [
  { key: "painel",    label: "Central",                 icone: "grafico" },
  { key: "propostas", label: "Funil de vendas",         icone: "documento", modulo: "propostas" },
  { key: "simulador", label: "Simulador",               icone: "raio", modulo: "simulador" },
  { key: "obras",     label: "Projetos e homologação",  icone: "calendario", modulo: "obras" },
  { key: "config",    label: "Kit, preços e ajustes",   icone: "config", soGestor: true },
];

const SECTIONS: Record<string, React.ComponentType<any>> = {
  painel: Painel, propostas: Propostas, simulador: Simulador, obras: Obras, config: ConfigSolarTela,
};

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

  useEffect(() => {
    try { const salva = localStorage.getItem("wolf_solar_aba"); if (salva && SECTIONS[salva]) setAba(salva); } catch {}
  }, []);

  const ir: NavegarSolar = (nova, novoAlvo) => {
    setAba(nova);
    setAlvo({ ...(novoAlvo || {}), t: Date.now() });
    try { localStorage.setItem("wolf_solar_aba", nova); } catch {}
    window.scrollTo({ top: 0 });
  };

  const mes = new Date().toISOString().slice(0, 7);
  const topo = useMemo(() => {
    const ps = dados.propostas;
    const abertas = ps.filter((p) => ["LEAD", "PROPOSTA ENVIADA", "ACEITA", "VISITA TECNICA"].includes(p.status_venda || "LEAD"));
    const ganhasMes = ps.filter((p) => ETAPAS_GANHAS.includes(p.status_venda || "") && (sol(p).historico || []).some((h) => h.etapa && ETAPAS_GANHAS.includes(h.etapa) && h.em.slice(0, 7) === mes));
    const obras = ps.filter((p) => ["ACEITA", "VISITA TECNICA", "CONTRATO", "HOMOLOGACAO", "INSTALACAO"].includes(p.status_venda || ""));
    return {
      negociacao: abertas.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0),
      kwpMes: ganhasMes.reduce((s, p) => s + (sol(p).resultado?.kwp || 0), 0),
      obras: obras.length,
    };
  }, [dados.propostas, mes]);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Carregando…</div>;
  if (!temAcesso) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 40, textAlign: "center", maxWidth: 420, boxShadow: "0 14px 32px -18px rgba(16,24,40,.2)" }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="cadeado" tamanho={24} /></span>
          <h2 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: 19, fontWeight: 800 }}>Central Solar</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Você não tem acesso a este módulo. Fale com o administrador.</p>
        </div>
      </div>
    );
  }

  const itens = ITENS.filter((i) => (!i.soGestor || gestor) && liberado(i.modulo));
  const abaValida = SECTIONS[aba] && itens.some((i) => i.key === aba) ? aba : "painel";
  const Comp = SECTIONS[abaValida];
  return (
    <MolduraSolar dados={dados} itens={itens} aba={abaValida} ir={ir} topo={topo}>
      <Comp dados={dados} ir={ir} alvo={alvo} gestor={gestor} />
    </MolduraSolar>
  );
}

/** Cabeçalho + abas + área da tela (separado para a prévia local). */
export function MolduraSolar({ dados, itens, aba, ir, topo, children }: { dados: any; itens: Item[]; aba: string; ir: NavegarSolar; topo: { negociacao: number; kwpMes: number; obras: number }; children: React.ReactNode }) {
  const abaValida = aba;
  const empresa = dados.cfg.empresa?.nome || "Energia Solar";
  const logo = /^https?:\/\//.test(dados.cfg.empresa?.logo || "") ? dados.cfg.empresa.logo : "";
  const hojeTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="sx-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: SX_CSS }} />

      <header className="sx-topo">
        <div className="sx-topo-grade" aria-hidden />
        <div className="sx-topo-sol" aria-hidden />
        <div className="sx-topo-l">
          <span className="sx-topo-logo">{logo ? <img src={logo} alt={empresa} /> : <SolLogo />}</span>
          <div>
            <span className="sx-topo-pre">Central Solar</span>
            <h1 className="sx-serif">{empresa}</h1>
            <span className="sx-topo-dia">{hojeTxt}</span>
          </div>
        </div>
        <div className="sx-topo-k">
          <div><b>{brl0(topo.negociacao)}</b><span>em negociação</span></div>
          <div><b>{kwpTxt(topo.kwpMes)}</b><span>vendidos no mês</span></div>
          <div><b>{topo.obras}</b><span>obra{topo.obras === 1 ? "" : "s"} em andamento</span></div>
        </div>
        <div className="sx-topo-a">
          {itens.some((i) => i.key === "simulador") && <button className="sx-btn sx-btn-vidro" onClick={() => ir("simulador")}><Icone nome="raio" tamanho={15} /> Simular</button>}
          <button className="sx-btn sx-btn-ouro" onClick={() => ir("propostas", { novo: true })}>+ Nova proposta</button>
        </div>
      </header>

      <nav className="sx-abas" aria-label="Seções da energia solar">
        {itens.map((i) => (
          <button key={i.key} onClick={() => ir(i.key)} className={`sx-aba${abaValida === i.key ? " on" : ""}`}>
            <Icone nome={i.icone} tamanho={15} />{i.label}
          </button>
        ))}
      </nav>

      <main className="sx-main">{children}</main>
    </div>
  );
}
