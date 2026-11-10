"use client";
import { useState, useEffect } from "react";
import { usePermissao } from "../../hooks/usePermissao";
import type { ComponentType } from "react";
import { DashboardSection } from "./_sections/dashboardsection";
import { IndicadoresSection } from "./_sections/indicadoressection";
import { FuncionariosSection } from "./_sections/funcionariossection";
import { DepartamentosSection } from "./_sections/departamentossection";
import { CargosSection } from "./_sections/cargossection";
import { FolhaSection } from "./_sections/folhasection";
import { HoleritesSection } from "./_sections/holeritessection";
import { EncargosSection } from "./_sections/encargossection";
import { PontoSection } from "./_sections/pontosection";
import { BaterPontoSection } from "./_sections/baterpontosection";
import { FeriasSection } from "./_sections/feriassection";
import { AfastamentosSection } from "./_sections/afastamentossection";
import { BancoHorasSection } from "./_sections/bancohorassection";
import { BeneficiosSection } from "./_sections/beneficiossection";
import { ValeTransporteSection } from "./_sections/valetransportesection";
import { ValeRefeicaoSection } from "./_sections/valerefeicaosection";
import { PlanoSaudeSection } from "./_sections/planosaudesection";
import { VagasSection } from "./_sections/vagassection";
import { CandidatosSection } from "./_sections/candidatossection";
import { SelecaoSection } from "./_sections/selecaosection";
import { TreinamentosSection } from "./_sections/treinamentossection";
import { AvaliacoesSection } from "./_sections/avaliacoessection";
import { DocumentosSection } from "./_sections/documentossection";
import { ContratosSection } from "./_sections/contratossection";
import { ConfigSection } from "./_sections/configsection";

import Icone from "../../components/a2/Icone";
// 🗂️ Registry de seções — cada key bate com a key do menu (GRUPOS).
// Pra ligar uma nova section: importe acima e adicione uma linha aqui.
const SECTIONS: Record<string, ComponentType> = {
  dashboard: DashboardSection,
  indicadores: IndicadoresSection,
  funcionarios: FuncionariosSection,
  departamentos: DepartamentosSection,
  cargos: CargosSection,
  folha: FolhaSection,
  holerites: HoleritesSection,
  encargos: EncargosSection,
  bater_ponto: BaterPontoSection,
  ponto: PontoSection,
  ferias: FeriasSection,
  afastamentos: AfastamentosSection,
  banco_horas: BancoHorasSection,
  beneficios: BeneficiosSection,
  vale_transporte: ValeTransporteSection,
  vale_refeicao: ValeRefeicaoSection,
  plano_saude: PlanoSaudeSection,
  vagas: VagasSection,
  candidatos: CandidatosSection,
  selecao: SelecaoSection,
  treinamentos: TreinamentosSection,
  avaliacoes: AvaliacoesSection,
  documentos: DocumentosSection,
  contratos: ContratosSection,
  config: ConfigSection,
};
// ═══════════════════════════════════════════════════════════════════════
// RH — moldura do módulo no padrão A2: menu lateral branco agrupado à
// esquerda e a seção ativa à direita. No celular o menu vira um botão.
// ═══════════════════════════════════════════════════════════════════════

type SubItem = { key: string; label: string; icone: string };
type Grupo = { key: string; label: string; itens: SubItem[] };

const GRUPOS: Grupo[] = [
  { key: "visao", label: "Visão geral", itens: [
    { key: "dashboard", label: "Dashboard", icone: "grafico" },
    { key: "indicadores", label: "Indicadores", icone: "alvo" },
  ]},
  { key: "pessoas", label: "Pessoas", itens: [
    { key: "funcionarios", label: "Funcionários", icone: "usuarios" },
    { key: "departamentos", label: "Departamentos", icone: "predio" },
    { key: "cargos", label: "Cargos e salários", icone: "tag" },
  ]},
  { key: "folha", label: "Folha de pagamento", itens: [
    { key: "folha", label: "Folha do mês", icone: "dinheiro" },
    { key: "holerites", label: "Holerites", icone: "documento" },
    { key: "encargos", label: "Encargos e impostos", icone: "balanca" },
  ]},
  { key: "tempo", label: "Jornada e tempo", itens: [
    { key: "ponto", label: "Ponto e frequência", icone: "relogio" },
    { key: "ferias", label: "Férias", icone: "estrela" },
    { key: "afastamentos", label: "Afastamentos", icone: "alerta" },
    { key: "banco_horas", label: "Banco de horas", icone: "atualizar" },
  ]},
  { key: "beneficios", label: "Benefícios", itens: [
    { key: "beneficios", label: "Benefícios", icone: "carteira" },
    { key: "vale_transporte", label: "Vale-transporte", icone: "seta" },
    { key: "vale_refeicao", label: "Vale-refeição", icone: "carteira" },
    { key: "plano_saude", label: "Plano de saúde", icone: "escudo" },
  ]},
  { key: "recrutamento", label: "Recrutamento", itens: [
    { key: "vagas", label: "Vagas", icone: "alvo" },
    { key: "candidatos", label: "Candidatos", icone: "usuario" },
    { key: "selecao", label: "Processos seletivos", icone: "funil" },
  ]},
  { key: "desenvolvimento", label: "Desenvolvimento", itens: [
    { key: "treinamentos", label: "Treinamentos", icone: "estrela" },
    { key: "avaliacoes", label: "Avaliações de desempenho", icone: "check" },
  ]},
  { key: "documentos", label: "Documentos", itens: [
    { key: "documentos", label: "Documentos", icone: "pasta" },
    { key: "contratos", label: "Contratos", icone: "documento" },
  ]},
  { key: "config", label: "Configurações", itens: [{ key: "config", label: "Configurações", icone: "config" }] },
];

const LABELS: Record<string, string> = Object.fromEntries(
  GRUPOS.flatMap((g) => g.itens.map((i) => [i.key, i.label]))
);

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

export default function RHLayolt() {
  const { permissoes, isDono, isSuperAdmin, perfil } = usePermissao();
  const veTudoRH = isSuperAdmin || isDono || perfil === "Administrador";
  const [aba, setAba] = useState("dashboard");
  const [isMobile, setIsMobile] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);

  useEffect(() => {
    const ver = () => setIsMobile(window.innerWidth < 900);
    ver();
    window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);

  const gruposVisiveis = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => veTudoRH || !!(permissoes as any)["rh_" + i.key]) }))
    .filter((g) => g.itens.length > 0);

  useEffect(() => {
    const visiveis = GRUPOS.flatMap((g) => g.itens.map((i) => i.key)).filter((k) => veTudoRH || !!(permissoes as any)["rh_" + k]);
    if (visiveis.length && !visiveis.includes(aba)) setAba(visiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoes, veTudoRH]);

  const Comp = SECTIONS[aba];

  const botao = (i: SubItem) => {
    const sel = aba === i.key;
    return (
      <button key={i.key} onClick={() => { setAba(i.key); setMenuMobile(false); }}
        className={`a2-menu-config${sel ? " ativo" : ""}`}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", border: 0, borderRadius: 11, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
          background: sel ? "#ECFDF5" : "transparent", color: sel ? "#065F46" : "#475569",
          fontSize: 13.5, fontWeight: sel ? 800 : 600, transition: "background .15s",
        }}>
        <Icone nome={i.icone as any} tamanho={16} cor={sel ? "#059669" : "#94A3B8"} />
        {i.label}
      </button>
    );
  };

  const grupos = gruposVisiveis.map((g) => (
    <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, padding: "12px 12px 4px" }}>{g.label}</span>
      {g.itens.map(botao)}
    </div>
  ));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start", padding: isMobile ? "4px 0 20px" : "8px 4px 28px", maxWidth: 1440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {isMobile ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setMenuMobile((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: 0, borderRadius: 16, boxShadow: SOMBRA, padding: "12px 16px", fontSize: 14, fontWeight: 800, color: "#0F172A", cursor: "pointer" }}>
            <Icone nome="usuarios" tamanho={18} cor="#059669" />
            RH · {LABELS[aba] || ""}
            <span style={{ marginLeft: "auto", display: "inline-flex", transform: menuMobile ? "rotate(180deg)" : "none", transition: "transform .15s" }}><Icone nome="baixo" tamanho={16} /></span>
          </button>
          {menuMobile && (
            <nav aria-label="Seções do RH" style={{ background: "#fff", borderRadius: 16, boxShadow: SOMBRA, padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {grupos}
            </nav>
          )}
        </div>
      ) : (
        <nav aria-label="Seções do RH" style={{ flex: "0 0 250px", background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: 12, display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 4px" }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="usuarios" tamanho={17} /></span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 16 }}>Recursos humanos</span>
              <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>Gestão de pessoas</span>
            </span>
          </div>
          {grupos}
        </nav>
      )}

      <main style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {Comp ? <Comp /> : <EmConstrucao titulo={LABELS[aba] || "Seção"} />}
      </main>
    </div>
  );
}

function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: SOMBRA, padding: "44px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="relogio" tamanho={24} /></span>
      <h2 style={{ margin: 0, color: "#0F172A", fontSize: 18, fontWeight: 800 }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Tela em construção, chega em breve.</p>
    </div>
  );
}
