"use client";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase";
import { usePermissao } from "../../../hooks/usePermissao";
import { useEquipeFiltro } from "../../../hooks/useEquipeFiltro";
import {
  CAMPOS_FIXOS_MAP,
  STATUS_OPCOES,
  montarCamposUnificados,
  type CampoUnificado,
  type ConfigCampoPadrao,
  type CampoCustom,
} from "../../../lib/campos_proposta_definicao";

// ═══════════════════════════════════════════════════════════════════════════
// 💰 VENDAS — Wolf CRM (multi-tenant)
// ───────────────────────────────────────────────────────────────────────────
// Tabela mestra de propostas. Isola por workspace_id em TODAS as queries.
//   • 🛡️ Permissões reais via usePermissao (Fase 2):
//       escopoVisao("vendas_equipe","vendas_proprio") → all | team | own | none
//       - none → tela bloqueada
//       - own  → vê só onde vendedor == email dele
//       - team → vê só a equipe_id dele (dropdown vira rótulo fixo)
//       - all  → vê o workspace todo (dropdown de equipe livre)
//   • KPIs rápidos (Visíveis / Instaladas / Pendentes / Canceladas / Receita)
//   • Real-time channel por workspace
// ═══════════════════════════════════════════════════════════════════════════

type Proposta = {
  id: number; created_at: string; data_proposta: string; nome: string;
  cpf?: string; rg?: string; data_nascimento?: string; nome_mae?: string;
  email?: string; endereco?: string; cep?: string; cidade?: string; estado?: string;
  telefone1?: string; telefone2?: string; telefone3?: string;
  vencimento?: string; forma_pagamento?: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora: string; plano: string; workspace_id: string;
  data_agendamento?: string; periodo_instalacao?: string;
  data_instalacao?: string; data_cancelamento?: string;
  dados_customizados?: Record<string, any>;
  equipe_id?: string | null;
  criado_por?: string | null;
  equipe_id_criador?: number | string | null;
  updated_at?: string | null;
  atualizado_por?: string | null;
};
type UsuarioWs = { email: string; nome: string; equipe_id?: string | null; };
type AnexoMeta = { url: string; nome: string; tipo: string; tamanho: number; enviado_em: string };

const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatarDataCRM = (valor: any): string => {
  const texto = String(valor ?? "").trim();
  if (!texto) return "-";
  const br = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const ano = br[3].length === 2 ? "20" + br[3] : br[3];
    return br[1].padStart(2, "0") + "/" + br[2].padStart(2, "0") + "/" + ano;
  }
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString("pt-BR");
};

const formatarTamanhoArquivo = (bytes: number): string => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const iconeArquivo = (tipo?: string): string => {
  if (tipo?.startsWith("image/")) return "Imagem";
  if (tipo?.includes("pdf")) return "PDF";
  if (tipo?.includes("word") || tipo?.includes("document")) return "DOC";
  if (tipo?.includes("sheet") || tipo?.includes("excel")) return "XLS";
  return "ARQ";
};

const fmtLogVal = (v: any): string => {
  if (v === null || v === undefined || v === "") return "-";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (s.length > 64) s = s.slice(0, 61) + "...";
  return s;
};

const normalizarStatusVenda = (s: any): string =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

type GrupoStatusVenda = "instaladas" | "andamento" | "canceladas" | "outros";
type MetaStatusVenda = { cor: string; bg: string; border: string; emoji: string; grupo: GrupoStatusVenda };

const metaStatusPersonalizado = (statusNormalizado: string, grupo: GrupoStatusVenda = "outros"): MetaStatusVenda => {
  let hash = 0;
  for (let i = 0; i < statusNormalizado.length; i++) {
    hash = ((hash << 5) - hash + statusNormalizado.charCodeAt(i)) | 0;
  }
  const valor = Math.abs(hash);
  const hue = valor % 360;
  const saturacao = 62 + ((valor >>> 8) % 16);
  return {
    cor: `hsl(${hue}, ${saturacao}%, 34%)`,
    bg: `hsl(${hue}, ${Math.min(85, saturacao + 8)}%, 96%)`,
    border: `hsl(${hue}, ${saturacao}%, 76%)`,
    emoji: "●",
    grupo,
  };
};

const statusMeta = (s: any): MetaStatusVenda => {
  const t = normalizarStatusVenda(s);
  if (!t) return { cor: "#64748b", bg: "#f8fafc", border: "#cbd5e1", emoji: "•", grupo: "outros" };

  if (/INSTALAD|ATIVAD|CONCLUID|FINALIZAD/.test(t) && !/NAO|CANCEL|REPROV|CHURN/.test(t)) {
    return { cor: "#16a34a", bg: "#ecfdf5", border: "#86efac", emoji: "✅", grupo: "instaladas" };
  }

  if (/FRAUDE/.test(t)) return { cor: "#a21caf", bg: "#fdf4ff", border: "#f0abfc", emoji: "⚠", grupo: "canceladas" };
  if (/REPROV/.test(t)) return { cor: "#e11d48", bg: "#fff1f2", border: "#fda4af", emoji: "✕", grupo: "canceladas" };
  if (/CHURN/.test(t)) return { cor: "#be123c", bg: "#fff1f2", border: "#fb7185", emoji: "↘", grupo: "canceladas" };
  if (/PERDID/.test(t)) return { cor: "#991b1b", bg: "#fef2f2", border: "#fca5a5", emoji: "−", grupo: "canceladas" };
  if (/NEGAD|RECUSAD/.test(t)) return { cor: "#b91c1c", bg: "#fef2f2", border: "#fecaca", emoji: "⊘", grupo: "canceladas" };
  if (/CANCEL|FR PREV/.test(t)) {
    return { cor: "#dc2626", bg: "#fef2f2", border: "#fecaca", emoji: "✕", grupo: "canceladas" };
  }

  if (/AGUARDANDO AUDITORIA|AUDITORIA/.test(t)) return { cor: "#2563eb", bg: "#eff6ff", border: "#93c5fd", emoji: "🔎", grupo: "andamento" };
  if (/PENDENTE DE INSTALACAO/.test(t)) return { cor: "#d97706", bg: "#fffbeb", border: "#fcd34d", emoji: "🛠", grupo: "andamento" };
  if (/AGUARDANDO INSTALACAO/.test(t)) return { cor: "#0891b2", bg: "#ecfeff", border: "#67e8f9", emoji: "⌛", grupo: "andamento" };
  if (/GERAD/.test(t)) return { cor: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", emoji: "◆", grupo: "andamento" };
  if (/BIOMETR/.test(t)) return { cor: "#4f46e5", bg: "#eef2ff", border: "#a5b4fc", emoji: "◎", grupo: "andamento" };
  if (/ANALIS|ANALISE/.test(t)) return { cor: "#9333ea", bg: "#faf5ff", border: "#d8b4fe", emoji: "◈", grupo: "andamento" };
  if (/VALIDA/.test(t)) return { cor: "#c026d3", bg: "#fdf4ff", border: "#f0abfc", emoji: "✓", grupo: "andamento" };
  if (/PROCESS/.test(t)) return { cor: "#0f766e", bg: "#f0fdfa", border: "#5eead4", emoji: "↻", grupo: "andamento" };
  if (/ENVIAD/.test(t)) return { cor: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc", emoji: "➜", grupo: "andamento" };
  if (/ABERT/.test(t)) return { cor: "#475569", bg: "#f8fafc", border: "#cbd5e1", emoji: "○", grupo: "andamento" };
  if (/ANDAMENTO/.test(t)) return { cor: "#0284c7", bg: "#f0f9ff", border: "#7dd3fc", emoji: "▶", grupo: "andamento" };
  if (/PENDENT/.test(t)) return { cor: "#ea580c", bg: "#fff7ed", border: "#fdba74", emoji: "⏳", grupo: "andamento" };
  if (/AGUARD|INSTALACAO/.test(t)) return metaStatusPersonalizado(t, "andamento");

  return metaStatusPersonalizado(t);
};

export default function Vendas() {
  const router = useRouter();
  // 🛡️ Permissões reais (Fase 2): escopo + equipe do usuário logado
  const {
    isDono, perfil, permissoes,
    escopoVisao, equipeId: minhaEquipeId, userEmail: meuEmailPerm,
    loading: permLoading,
  } = usePermissao();

  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");

  // 👥 Filtro por equipe (dropdown que aparece pro admin)
  const { equipes, equipeId, EquipeSelector } = useEquipeFiltro(workspaceId);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => isoLocal(new Date()));
  const [filtroDataFim, setFiltroDataFim] = useState(() => isoLocal(new Date()));
  const [rangeRapido, setRangeRapido] = useState<"todos" | "hoje" | "7d" | "30d" | "mes" | "custom">("hoje");
  const [filtroModif, setFiltroModif] = useState<"qualquer" | "hoje" | "7d" | "30d">("qualquer");
  const [propostaVisualizando, setPropostaVisualizando] = useState<Proposta | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);

  const [camposUnificados, setCamposUnificados] = useState<CampoUnificado[]>([]);
  const [slugsNaLista, setSlugsNaLista] = useState<Set<string>>(new Set());

  // 🔎 Filtros dinâmicos por coluna (slug → valor)
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string>>({});

  const statusOpcoesFiltro = useMemo(() => {
    const set = new Set<string>();
    const campoStatus = camposUnificados.find(c => c.slug === "status_venda");
    if (Array.isArray(campoStatus?.opcoes)) {
      for (const s of campoStatus.opcoes) {
        const v = String(s || "").trim();
        if (v) set.add(v);
      }
    }
    for (const s of (STATUS_OPCOES as string[])) {
      const v = String(s || "").trim();
      if (v) set.add(v);
    }
    for (const p of propostas) {
      const v = String(p.status_venda || "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [camposUnificados, propostas]);

  // 📏 Refs pro scrollbar superior sincronizado com o de baixo
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollerRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLTableElement>(null);
  const [topInnerWidth, setTopInnerWidth] = useState(0);
  const sincronizando = useRef(false);

  // ⬆️⬇️ Botões flutuantes — mostra "topo" só quando rolou um pouco
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 📏 Mede a tabela pra dimensionar o scrollbar superior e ver se transborda
  const [tabelaTransborda, setTabelaTransborda] = useState(false);
  useEffect(() => {
    const medir = () => {
      if (tableContainerRef.current && tableInnerRef.current) {
        const innerW = tableInnerRef.current.offsetWidth;
        const containerW = tableContainerRef.current.offsetWidth;
        setTopInnerWidth(innerW);
        setTabelaTransborda(innerW > containerW + 1);
      }
    };
    medir();
    const t = setTimeout(medir, 50);
    window.addEventListener("resize", medir);
    return () => { clearTimeout(t); window.removeEventListener("resize", medir); };
  });

  // Modal edição
  const [showModal, setShowModal] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [dadosCustomizadosEdit, setDadosCustomizadosEdit] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);
  const [logsProposta, setLogsProposta] = useState<any[]>([]);
  const [carregandoLogs, setCarregandoLogs] = useState(false);
  const [logsTabelaFalta, setLogsTabelaFalta] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCampos, setExportCampos] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const aplicarRange = (r: "todos" | "hoje" | "7d" | "30d" | "mes" | "custom") => {
    setRangeRapido(r);
    if (r === "custom") return;
    if (r === "todos") {
      setFiltroDataInicio("");
      setFiltroDataFim("");
      return;
    }
    const hoje = new Date();
    let ini = isoLocal(hoje);
    const fim = isoLocal(hoje);
    if (r === "7d") {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 6);
      ini = isoLocal(d);
    } else if (r === "30d") {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 29);
      ini = isoLocal(d);
    } else if (r === "mes") {
      ini = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    }
    setFiltroDataInicio(ini);
    setFiltroDataFim(fim);
  };

  // 🛡️ ESCOPO de visão (Fase 2)
  const esc = escopoVisao("vendas_equipe", "vendas_proprio"); // all | team | own | none
  const travadoEquipe = esc === "team";
  const podeVerTudo = esc === "all";                 // dono / admin / super → vê o workspace todo
  const podeEscolherVendedor = esc === "all" || esc === "team";

  // Equipe efetivamente aplicada: Diretor travado na dele; admin usa o dropdown
  const equipeEfetiva = travadoEquipe ? (minhaEquipeId || "") : equipeId;
  const minhaEquipeNome = minhaEquipeId
    ? (equipes.find(e => e.id === minhaEquipeId)?.nome || "Minha equipe")
    : "";

  const podeExcluir = isDono || perfil === "Administrador";
  const podeEditarCamposCustom = isDono || perfil === "Administrador";

  // 🎨 ESTILOS LIGHT TECH
  const inputStyle = {
    width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "9px 12px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const,
    outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };

  // ═══ Renderização dinâmica de cada célula da tabela (respeita config do Editor) ═══
  const renderCelulaTabela = (c: CampoUnificado, v: Proposta): ReactNode => {
    const raw = c.origem === "fixo"
      ? (v as any)[c.slug]
      : v.dados_customizados?.[c.slug];

    if (c.slug === "status_venda") {
      const meta = statusMeta(raw);
      return raw ? (
        <span style={{
          background: meta.bg, color: meta.cor, border: `1px solid ${meta.border}`,
          padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
        }}>{meta.emoji} {raw}</span>
      ) : <span style={{ color: "#d1d5db" }}>—</span>;
    }
    if (c.slug === "valor_plano") {
      return (
        <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 800, letterSpacing: -0.2, whiteSpace: "nowrap" }}>
          R$ {Number(raw || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    if (c.slug === "vendedor") {
      return <span style={{ color: "#4b5563", fontSize: 12 }}>{nomeVendedor(raw)}</span>;
    }
    if (c.slug === "nome") {
      return <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{raw || <span style={{ color: "#d1d5db" }}>—</span>}</span>;
    }
    if (c.slug === "cpf") {
      return <span style={{ color: "#6b7280", fontSize: 12, fontFamily: "monospace" }}>{raw || <span style={{ color: "#d1d5db" }}>—</span>}</span>;
    }

    if (raw === undefined || raw === null || raw === "") {
      return <span style={{ color: "#d1d5db" }}>—</span>;
    }

    if (c.tipo === "data") {
      try {
        return <span style={{ color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
          {formatarDataCRM(raw)}
        </span>;
      } catch { return <span style={{ color: "#4b5563", fontSize: 12 }}>{String(raw)}</span>; }
    }
    if (c.tipo === "moeda") {
      return <span style={{ color: "#4b5563", fontSize: 12, whiteSpace: "nowrap" }}>
        R$ {Number(raw).toFixed(2).replace(".", ",")}
      </span>;
    }
    if (c.tipo === "checkbox") {
      return <span style={{ color: raw === true ? "#16a34a" : "#9ca3af", fontSize: 12, fontWeight: 600 }}>
        {raw === true ? "✓ Sim" : "Não"}
      </span>;
    }
    if (c.slug === "vencimento") {
      return <span style={{ color: "#4b5563", fontSize: 12 }}>Dia {String(raw)}</span>;
    }

    return <span style={{ color: "#4b5563", fontSize: 12 }}>{String(raw)}</span>;
  };

  // ═══ Filtro por coluna — input apropriado por tipo ═══
  const filtroInputStyle = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "4px 8px",
    color: "#1f2937",
    fontSize: 11,
    boxSizing: "border-box" as const,
    outline: "none",
    fontWeight: 500,
  };

  const setarFiltroColuna = (slug: string, valor: string) => {
    setFiltrosColuna(prev => {
      const novo = { ...prev };
      if (!valor) delete novo[slug];
      else novo[slug] = valor;
      return novo;
    });
  };

  const renderFiltroColuna = (c: CampoUnificado): ReactNode => {
    const val = filtrosColuna[c.slug] ?? "";

    if (c.slug === "vendedor" || c.tipo === "vendedor") {
      // Pro travado na equipe, só mostra vendedores da equipe dele
      const baseVend = travadoEquipe
        ? usuariosWs.filter(u => String(u.equipe_id ?? "") === String(minhaEquipeId))
        : usuariosWs;
      const vendedoresVisiveis = equipeEfetiva
        ? baseVend.filter(u => String(u.equipe_id ?? "") === String(equipeEfetiva))
        : baseVend;
      return (
        <select value={val} onChange={e => setarFiltroColuna(c.slug, e.target.value)} style={filtroInputStyle}>
          <option value="">Todos</option>
          {vendedoresVisiveis.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
        </select>
      );
    }

    if (c.tipo === "dropdown") {
      const prefixoVenc = c.slug === "vencimento";
      return (
        <select value={val} onChange={e => setarFiltroColuna(c.slug, e.target.value)} style={filtroInputStyle}>
          <option value="">Todos</option>
          {(c.opcoes || []).map(op => (
            <option key={op} value={op}>{prefixoVenc ? `Dia ${op}` : op}</option>
          ))}
        </select>
      );
    }

    if (c.tipo === "checkbox") {
      return (
        <select value={val} onChange={e => setarFiltroColuna(c.slug, e.target.value)} style={filtroInputStyle}>
          <option value="">Todos</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      );
    }

    if (c.tipo === "data") {
      return <input type="date" value={val} onChange={e => setarFiltroColuna(c.slug, e.target.value)} style={filtroInputStyle} />;
    }

    return <input placeholder="filtrar..." value={val} onChange={e => setarFiltroColuna(c.slug, e.target.value)} style={filtroInputStyle} />;
  };

  const passaFiltrosColuna = (p: Proposta): boolean => {
    for (const [slug, valor] of Object.entries(filtrosColuna)) {
      if (!valor) continue;
      const campo = camposUnificados.find(c => c.slug === slug);
      if (!campo) continue;

      const raw = campo.origem === "fixo"
        ? (p as any)[slug]
        : p.dados_customizados?.[slug];

      if (campo.tipo === "checkbox") {
        const esperado = valor === "sim";
        if (!!raw !== esperado) return false;
        continue;
      }

      if (campo.tipo === "dropdown" || campo.tipo === "vendedor" || slug === "vendedor") {
        if (String(raw ?? "") !== valor) return false;
        continue;
      }

      if (campo.tipo === "data") {
        if (String(raw ?? "") !== valor) return false;
        continue;
      }

      const txt = String(raw ?? "").toLowerCase();
      if (!txt.includes(valor.toLowerCase())) return false;
    }
    return true;
  };

  const fetchPropostas = async (wsId: string) => {
    const PAGE_SIZE = 1000;
    const TOTAL_LIMITE = 10000;
    let lista: any[] = [];
    let offset = 0;
    while (offset < TOTAL_LIMITE) {
      const { data: pagina, error } = await supabase.from("proposta").select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) { console.error("Erro fetchPropostas paginado:", error); break; }
      if (!pagina || pagina.length === 0) break;
      lista = lista.concat(pagina);
      if (pagina.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    setPropostas(lista);
  };

  const fetchUsuariosWs = async (wsId: string, wsData?: any) => {
    const lista: UsuarioWs[] = [];
    const ws = wsData || (await supabase.from("workspaces").select("nome, owner_email, username, id").or(`username.eq.${wsId},id.eq.${wsId}`).maybeSingle()).data;
    if (ws?.owner_email) lista.push({ email: ws.owner_email, nome: ws.nome || "Dono", equipe_id: null });
    const { data: subs } = await supabase.from("usuarios_workspace").select("email, nome, equipe_id").eq("workspace_id", wsId);
    for (const s of (subs || [])) {
      if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
        lista.push({ email: s.email, nome: s.nome || s.email, equipe_id: s.equipe_id });
      }
    }
    setUsuariosWs(lista);
  };

  const fetchCamposUnificados = async (wsId: string) => {
    const [respConfig, respCustom] = await Promise.all([
      supabase.from("proposta_campos_padrao_config")
        .select("*")
        .eq("workspace_id", wsId),
      supabase.from("proposta_campos_customizados")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
    ]);
    const configs: ConfigCampoPadrao[] = (respConfig.data || []).map((c: any) => ({
      id: c.id, campo_slug: c.campo_slug, label_custom: c.label_custom,
      obrigatorio: c.obrigatorio, visivel: c.visivel, ordem: c.ordem,
      opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" && c.opcoes ? JSON.parse(c.opcoes) : null),
      placeholder_custom: c.placeholder_custom,
    }));
    const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
      id: c.id, slug: c.slug, label: c.label, tipo: c.tipo,
      obrigatorio: c.obrigatorio, ordem: c.ordem,
      opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
      placeholder: c.placeholder, ativo: c.ativo,
    }));

    const slugs = new Set<string>();
    for (const c of (respConfig.data || [])) {
      if (c.mostrar_na_lista) slugs.add(c.campo_slug);
    }
    for (const c of (respCustom.data || [])) {
      if (c.mostrar_na_lista) slugs.add(c.slug);
    }
    setSlugsNaLista(slugs);

    setCamposUnificados(montarCamposUnificados(configs, customs).filter(c => c.visivel));
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono?.username) {
        setWorkspaceId(wsDono.username);
        await fetchPropostas(wsDono.username);
        await fetchUsuariosWs(wsDono.username, wsDono);
        await fetchCamposUnificados(wsDono.username);
        setLoading(false);
        return;
      }
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("workspace_id").eq("email", user.email)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (usuarioWs?.workspace_id) {
        setWorkspaceId(usuarioWs.workspace_id);
        await fetchPropostas(usuarioWs.workspace_id);
        await fetchUsuariosWs(usuarioWs.workspace_id);
        await fetchCamposUnificados(usuarioWs.workspace_id);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("proposta_rt_" + workspaceId)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta", filter: `workspace_id=eq.${workspaceId}` }, () => fetchPropostas(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${workspaceId}` }, () => fetchUsuariosWs(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_campos_customizados", filter: `workspace_id=eq.${workspaceId}` }, () => fetchCamposUnificados(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_campos_padrao_config", filter: `workspace_id=eq.${workspaceId}` }, () => fetchCamposUnificados(workspaceId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);


  const fetchLogsProposta = async (propostaId: number) => {
    setCarregandoLogs(true);
    setLogsTabelaFalta(false);
    try {
      const { data, error } = await supabase
        .from("proposta_logs")
        .select("*")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        if (["42P01", "PGRST205", "PGRST116"].includes((error as any).code)) {
          setLogsTabelaFalta(true);
          setLogsProposta([]);
          return;
        }
        console.warn("Erro ao buscar historico da proposta:", error);
        setLogsProposta([]);
        return;
      }
      setLogsProposta(data || []);
    } finally {
      setCarregandoLogs(false);
    }
  };

  useEffect(() => {
    if (propostaVisualizando?.id) fetchLogsProposta(propostaVisualizando.id);
    else setLogsProposta([]);
  }, [propostaVisualizando?.id]);

  const registrarLogProposta = async (propostaId: number, acao: string, campo: string, antes: any, depois: any) => {
    try {
      const payload: any = {
        workspace_id: workspaceId,
        proposta_id: propostaId,
        acao,
        campo,
        valor_anterior: antes,
        valor_novo: depois,
        usuario_email: meuEmailPerm || userEmail || null,
        usuario_nome: nomeVendedor(meuEmailPerm || userEmail || ""),
        created_at: new Date().toISOString(),
      };
      let resp = await supabase.from("proposta_logs").insert(payload);
      if (resp.error && String(resp.error.message || "").toLowerCase().includes("workspace_id")) {
        delete payload.workspace_id;
        resp = await supabase.from("proposta_logs").insert(payload);
      }
      if (resp.error && ["42P01", "PGRST205", "PGRST116"].includes((resp.error as any).code)) setLogsTabelaFalta(true);
    } catch (e) {
      console.warn("Nao foi possivel gravar historico da proposta:", e);
    }
  };

  const anexosDoCampo = (slug: string): AnexoMeta[] => {
    const raw = dadosCustomizadosEdit[slug];
    if (Array.isArray(raw)) return raw as AnexoMeta[];
    if (raw && typeof raw === "object" && raw.url) return [raw as AnexoMeta];
    return [];
  };

  const uploadArquivoCampo = async (c: CampoUnificado, files: FileList | null) => {
    if (!files || !files.length || !workspaceId) return;
    const atuais = anexosDoCampo(c.slug);
    const enviados: AnexoMeta[] = [];
    for (const file of Array.from(files)) {
      const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminho = `${workspaceId}/${propostaEditando?.id || "nova"}/${c.slug}/${Date.now()}_${nomeSeguro}`;
      const { error } = await supabase.storage.from("propostas-anexos").upload(caminho, file, { upsert: false });
      if (error) {
        alert("Erro ao enviar arquivo: " + error.message);
        continue;
      }
      const { data } = supabase.storage.from("propostas-anexos").getPublicUrl(caminho);
      enviados.push({ url: data.publicUrl, nome: file.name, tipo: file.type, tamanho: file.size, enviado_em: new Date().toISOString() });
    }
    if (enviados.length) {
      setDadosCustomizadosEdit(prev => ({ ...prev, [c.slug]: [...atuais, ...enviados] }));
    }
  };

  const removerArquivoCampo = (slug: string, idx: number) => {
    setDadosCustomizadosEdit(prev => {
      const lista = Array.isArray(prev[slug]) ? [...prev[slug]] : [];
      lista.splice(idx, 1);
      return { ...prev, [slug]: lista };
    });
  };

  const abrirEditar = (p: Proposta) => {
    setPropostaEditando(p);
    setForm({ ...p });
    const dadosIniciais: Record<string, any> = {};
    for (const c of camposUnificados) {
      if (c.origem === "custom") {
        const v = p.dados_customizados?.[c.slug];
        dadosIniciais[c.slug] = v !== undefined ? v : (c.tipo === "checkbox" ? false : "");
      }
    }
    setDadosCustomizadosEdit(dadosIniciais);
    setShowModal(true);
  };

  const salvar = async () => {
    if (!propostaEditando) return;
    for (const c of camposUnificados) {
      if (!c.obrigatorio) continue;
      const v = c.origem === "fixo" ? form[c.slug] : dadosCustomizadosEdit[c.slug];
      const vazio = c.tipo === "checkbox" ? v !== true : (v === undefined || v === null || String(v).trim() === "");
      if (vazio) { alert(`O campo "${c.label}" é obrigatório.`); return; }
    }
    setSalvando(true);
    try {
      const updatePayload: any = {
        data_proposta: form.data_proposta, nome: form.nome, cpf: form.cpf, rg: form.rg,
        data_nascimento: form.data_nascimento, nome_mae: form.nome_mae, email: form.email,
        endereco: form.endereco, cep: form.cep, cidade: form.cidade, estado: form.estado,
        telefone1: form.telefone1, telefone2: form.telefone2, telefone3: form.telefone3,
        vencimento: form.vencimento, forma_pagamento: form.forma_pagamento, plano: form.plano,
        valor_plano: form.valor_plano ? Number(form.valor_plano) : null,
        data_agendamento: form.data_agendamento, periodo_instalacao: form.periodo_instalacao,
        vendedor: form.vendedor, status_venda: form.status_venda,
        data_instalacao: form.data_instalacao, data_cancelamento: form.data_cancelamento,
        operadora: form.operadora,
        dados_customizados: dadosCustomizadosEdit,
        updated_at: new Date().toISOString(),
        atualizado_por: meuEmailPerm || userEmail || null,
      };

      const executarUpdate = (payload: any) => supabase.from("proposta").update(payload)
        .eq("id", propostaEditando.id)
        .eq("workspace_id", workspaceId);

      let { error } = await executarUpdate(updatePayload);
      if (error && /updated_at|atualizado_por/i.test(error.message || "")) {
        const fallback = { ...updatePayload };
        delete fallback.updated_at;
        delete fallback.atualizado_por;
        const resp = await executarUpdate(fallback);
        error = resp.error;
      }
      if (error) { alert("Erro ao salvar: " + error.message); setSalvando(false); return; }

      const mudancas: Array<{ campo: string; antes: any; depois: any }> = [];
      for (const c of camposUnificados) {
        const antes = c.origem === "fixo" ? (propostaEditando as any)[c.slug] : propostaEditando.dados_customizados?.[c.slug];
        const depois = c.origem === "fixo" ? updatePayload[c.slug] : dadosCustomizadosEdit[c.slug];
        if (JSON.stringify(antes ?? "") !== JSON.stringify(depois ?? "")) mudancas.push({ campo: c.label, antes, depois });
      }
      for (const m of mudancas.slice(0, 20)) {
        await registrarLogProposta(propostaEditando.id, "edicao", m.campo, m.antes, m.depois);
      }

      await fetchPropostas(workspaceId);
      setShowModal(false);
      setPropostaEditando(null);
      alert("Proposta atualizada!");
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };

  const excluir = async (p: Proposta) => {
    if (!podeExcluir) { alert("Você não tem permissão para excluir!"); return; }
    if (!confirm(`⚠️ Excluir a proposta de ${p.nome}?\n\nEsta ação NÃO pode ser desfeita.`)) return;
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    try {
      await registrarLogProposta(p.id, "exclusao", "proposta", p.nome, "Proposta excluida");
      const { error } = await supabase.from("proposta").delete()
        .eq("id", p.id).eq("workspace_id", workspaceId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchPropostas(workspaceId);
      alert("✅ Proposta excluída!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // ═══ Renderização dinâmica de campos no modal ═══
  const renderCampoModal = (c: CampoUnificado) => {
    const labelComObr = (
      <>
        {c.label}
        {c.obrigatorio && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
      </>
    );
    const lab = (
      <label style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5, fontWeight: 700 }}>
        {labelComObr}
      </label>
    );

    if (c.origem === "fixo") {
      const val = form[c.slug] ?? "";
      const set = (v: any) => setForm({ ...form, [c.slug]: v });

      if (c.tipo === "vendedor") {
        // Pro travado na equipe, lista só vendedores da equipe dele
        const vendedoresModal = travadoEquipe
          ? usuariosWs.filter(u => String(u.equipe_id ?? "") === String(minhaEquipeId))
          : usuariosWs;
        return (
          <div>{lab}
            {podeEscolherVendedor ? (
              <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {vendedoresModal.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                {val && !vendedoresModal.find(u => u.email?.toLowerCase() === String(val).toLowerCase()) && (
                  <option value={val}>⚠️ {val} (legado)</option>
                )}
              </select>
            ) : (
              <input value={nomeVendedor(val)} disabled style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }} />
            )}
          </div>
        );
      }

      if (c.tipo === "data") return <div>{lab}<input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "email") return <div>{lab}<input type="email" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "numero") return <div>{lab}<input type="number" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "moeda") return <div>{lab}<input type="number" step="0.01" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "telefone") return <div>{lab}<input type="tel" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "dropdown") {
        const prefixoVenc = c.slug === "vencimento";
        return (
          <div>{lab}
            <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              {(c.opcoes || []).map(op => <option key={op} value={op}>{prefixoVenc ? `Dia ${op}` : op}</option>)}
            </select>
          </div>
        );
      }
      return <div>{lab}<input placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    }

    // CUSTOM
    const val = dadosCustomizadosEdit[c.slug];
    const set = (v: any) => setDadosCustomizadosEdit(prev => ({ ...prev, [c.slug]: v }));

    if (c.tipo === "arquivo") {
      const anexos = anexosDoCampo(c.slug);
      return (
        <div>{lab}
          <div style={{ border: "1px dashed #bfdbfe", borderRadius: 10, padding: 12, background: "#f8fbff" }}>
            <input type="file" multiple onChange={e => uploadArquivoCampo(c, e.target.files)} style={{ ...inputStyle, background: "#ffffff" }} />
            {anexos.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {anexos.map((a, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {iconeArquivo(a.tipo)} · {a.nome} · {formatarTamanhoArquivo(a.tamanho)}
                    </a>
                    <button type="button" onClick={() => removerArquivoCampo(c.slug, idx)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (c.tipo === "textarea") return <div>{lab}<textarea placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} /></div>;
    if (c.tipo === "numero") return <div>{lab}<input type="number" placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "moeda") return <div>{lab}<input type="number" step="0.01" placeholder={c.placeholder || "0,00"} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "data") return <div>{lab}<input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "dropdown") return (
      <div>{lab}<select value={val || ""} onChange={e => set(e.target.value)} style={inputStyle}>
        <option value="">Selecione...</option>
        {(c.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
      </select></div>
    );
    if (c.tipo === "checkbox") {
      const marcado = val === true;
      return (
        <div>{lab}
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 14px",
            background: marcado ? "#f0fdf4" : "#ffffff",
            borderRadius: 10,
            border: `1px solid ${marcado ? "#bbf7d0" : "#e5e7eb"}`,
            cursor: "pointer",
            transition: "all 0.15s",
          }}>
            <input type="checkbox" checked={marcado} onChange={e => set(e.target.checked)} style={{ accentColor: "#16a34a", width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ color: marcado ? "#16a34a" : "#6b7280", fontSize: 13, fontWeight: 600 }}>{marcado ? "Sim" : "Não"}</span>
          </label>
        </div>
      );
    }
    return <div>{lab}<input placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
  };

  const propostasFiltradas = propostas
    .filter(p => {
      if (esc === "own") {
        const meu = (meuEmailPerm || userEmail || "").toLowerCase();
        return (p.vendedor || "").toLowerCase() === meu;
      }
      return true;
    })
    .filter(p => !equipeEfetiva || String(p.equipe_id ?? "") === String(equipeEfetiva))
    .filter(p => filtroStatus === "todos" || p.status_venda === filtroStatus)
    .filter(p => !buscaDebounced || p.nome?.toLowerCase().includes(buscaDebounced.toLowerCase()) || p.cpf?.includes(buscaDebounced) || nomeVendedor(p.vendedor).toLowerCase().includes(buscaDebounced.toLowerCase()))
    .filter(p => {
      if (!filtroDataInicio && !filtroDataFim) return true;
      const dt = String(p.data_proposta || p.created_at?.slice(0, 10) || "");
      if (!dt) return false;
      if (filtroDataInicio && dt < filtroDataInicio) return false;
      if (filtroDataFim && dt > filtroDataFim) return false;
      return true;
    })
    .filter(p => {
      if (filtroModif === "qualquer") return true;
      const dt = String((p.updated_at || p.created_at || "").slice(0, 10));
      if (!dt) return false;
      const hoje = new Date();
      if (filtroModif === "hoje") return dt === isoLocal(hoje);
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - (filtroModif === "7d" ? 6 : 29));
      return dt >= isoLocal(ini) && dt <= isoLocal(hoje);
    })
    .filter(p => passaFiltrosColuna(p));

  // 📊 Colunas a renderizar na tabela
  const COLUNAS_LEGADO = ["nome", "cpf", "vendedor", "plano", "valor_plano", "status_venda", "data_proposta"];
  const colunasTabela = slugsNaLista.size > 0
    ? camposUnificados.filter(c => slugsNaLista.has(c.slug))
    : camposUnificados.filter(c => COLUNAS_LEGADO.includes(c.slug));

  const totalVisivel = propostasFiltradas.length;
  const totalGeral = propostas.length;

  // KPIs dinâmicos sobre o que está visível, usando os status reais/configurados do workspace.
  const kpis = useMemo(() => {
    const statusResumo = statusOpcoesFiltro.map(status => {
      const total = propostasFiltradas.filter(p => normalizarStatusVenda(p.status_venda) === normalizarStatusVenda(status)).length;
      const meta = statusMeta(status);
      return { status, total, ...meta };
    });
    const instaladasArr = propostasFiltradas.filter(p => statusMeta(p.status_venda).grupo === "instaladas");
    const andamentoArr = propostasFiltradas.filter(p => statusMeta(p.status_venda).grupo === "andamento");
    const canceladasArr = propostasFiltradas.filter(p => statusMeta(p.status_venda).grupo === "canceladas");
    const receita = instaladasArr.reduce((a, p) => a + (Number(p.valor_plano) || 0), 0);
    const receitaAndamento = andamentoArr.reduce((a, p) => a + (Number(p.valor_plano) || 0), 0);
    const ticketMedio = instaladasArr.length > 0 ? receita / instaladasArr.length : 0;
    return {
      instaladas: instaladasArr.length,
      andamento: andamentoArr.length,
      canceladas: canceladasArr.length,
      receita,
      receitaAndamento,
      ticketMedio,
      statusResumo,
    };
  }, [propostasFiltradas, statusOpcoesFiltro]);


  const colunasExportaveis = useMemo(() => [
    { slug: "id", label: "ID", origem: "fixo" as const, tipo: "texto" },
    { slug: "created_at", label: "Criado em", origem: "fixo" as const, tipo: "data" },
    ...camposUnificados,
  ], [camposUnificados]);

  const abrirExportacao = () => {
    setExportCampos(colunasTabela.map(c => c.slug));
    setShowExportModal(true);
  };

  const toggleCampoExport = (slug: string) => {
    setExportCampos(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const valorCampoExport = (p: Proposta, c: any) => {
    let v = c.origem === "fixo" ? (p as any)[c.slug] : p.dados_customizados?.[c.slug];
    if (c.slug === "vendedor") return nomeVendedor(v);
    if (c.tipo === "checkbox") return v === true ? "Sim" : v === false ? "Nao" : "";
    if (c.tipo === "moeda") return Number(v || 0);
    if (c.tipo === "arquivo") {
      const anexos = Array.isArray(v) ? v : v?.url ? [v] : [];
      return anexos.map((a: AnexoMeta) => a.url).join(" | ");
    }
    if (typeof v === "object" && v !== null) return JSON.stringify(v);
    return v ?? "";
  };

  const exportarExcel = () => {
    if (exportCampos.length === 0) return;
    setExportando(true);
    try {
      const selecionadas = colunasExportaveis.filter(c => exportCampos.includes(c.slug));
      const rows = propostasFiltradas.map(p => {
        const row: Record<string, any> = {};
        for (const c of selecionadas) row[c.label] = valorCampoExport(p, c);
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas");
      XLSX.writeFile(wb, `vendas_${workspaceId || "workspace"}_${isoLocal(new Date())}.xlsx`);
      setShowExportModal(false);
    } finally {
      setExportando(false);
    }
  };

  // 🛡️ Guards visuais
  if (permLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>⏳ Verificando permissões...</p>
      </div>
    );
  }
  if (esc === "none") {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 48, textAlign: "center", maxWidth: 480, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Sem acesso a Vendas</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 8px" }}>
            Teu grupo de permissão não tem acesso às vendas.
          </p>
          <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>
            Peça ao admin pra ativar <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>Ver próprias vendas</code> ou <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>Ver vendas da equipe</code> no teu grupo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>


      {showExportModal && (
        <div onClick={() => setShowExportModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", backdropFilter: "blur(4px)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: "100%", maxWidth: 720, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 900, margin: 0 }}>Exportar vendas</h2>
                <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>{propostasFiltradas.length.toLocaleString("pt-BR")} venda(s) filtrada(s) neste workspace</p>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", color: "#64748b", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontWeight: 900 }}>x</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={() => setExportCampos(colunasExportaveis.map(c => c.slug))} style={{ background: "#ecfdf5", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Selecionar tudo</button>
                <button onClick={() => setExportCampos([])} style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Limpar</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {colunasExportaveis.map(c => (
                  <label key={c.slug} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, background: exportCampos.includes(c.slug) ? "#f0fdf4" : "#ffffff", cursor: "pointer" }}>
                    <input type="checkbox" checked={exportCampos.includes(c.slug)} onChange={() => toggleCampoExport(c.slug)} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
                    <span style={{ color: "#334155", fontSize: 13, fontWeight: 700 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowExportModal(false)} style={{ background: "#ffffff", color: "#64748b", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
              <button onClick={exportarExcel} disabled={exportando || exportCampos.length === 0} style={{ background: exportCampos.length === 0 ? "#94a3b8" : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 900, cursor: exportCampos.length === 0 ? "not-allowed" : "pointer", boxShadow: "0 6px 16px rgba(37,99,235,0.25)" }}>
                {exportando ? "Exportando..." : "Baixar Excel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL EDITAR ═══ */}
      {showModal && propostaEditando && (
        <div onClick={() => { setShowModal(false); setPropostaEditando(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              ...cardStyle,
              width: "100%", maxWidth: 860, maxHeight: "92vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.08)",
            }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✏️</div>
                <h2 style={{ color: "#1f2937", fontSize: 17, fontWeight: 700, margin: 0 }}>Editar Proposta <span style={{ color: "#9ca3af", fontWeight: 500 }}>#{propostaEditando.id}</span></h2>
              </div>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                {camposUnificados.map(c => (
                  <div key={`${c.origem}-${c.slug}`} style={c.larguraTotal || c.tipo === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                    {renderCampoModal(c)}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{
                  background: salvando ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>
                {salvando ? "⏳ Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 18, padding: isMobile ? 16 : "18px 20px", borderRadius: 20, border: "1px solid #dbeafe", background: "radial-gradient(circle at 10% 0%, rgba(34,197,94,0.10), transparent 34%), linear-gradient(135deg, #ffffff 0%, #f8fbff 58%, #eff6ff 100%)", boxShadow: "0 16px 40px rgba(15,23,42,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17,
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, boxShadow: "0 12px 26px rgba(22,163,74,0.28)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>💰</span>
          </div>
          <div>
            <p style={{ color: "#16a34a", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 3px" }}>Central comercial</p>
            <h1 style={{ color: "#0f172a", fontSize: isMobile ? 22 : 28, fontWeight: 900, margin: 0, letterSpacing: -0.8 }}>Vendas</h1>
            <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>
              {podeVerTudo
                ? <><b style={{ color: "#16a34a" }}>{totalGeral}</b> proposta(s) cadastrada(s){totalVisivel !== totalGeral && <> · <b>{totalVisivel}</b> filtradas</>}</>
                : travadoEquipe
                  ? <><b style={{ color: "#16a34a" }}>{totalVisivel}</b> proposta(s) da sua equipe</>
                  : <><b style={{ color: "#16a34a" }}>{totalVisivel}</b> proposta(s) suas</>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* 👥 Equipe — admin escolhe; Diretor travado mostra rótulo fixo */}
          {podeVerTudo && <EquipeSelector />}
          {travadoEquipe && minhaEquipeNome && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 12, padding: "6px 14px",
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>👥</span>
              <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Equipe</span>
              <span style={{ color: "#15803d", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{minhaEquipeNome}</span>
            </div>
          )}

          <button onClick={abrirExportacao} title="Exportar vendas filtradas"
            style={{
              flex: isMobile ? 1 : "0 0 auto",
              background: "#ecfeff", color: "#0891b2", border: "1px solid #a5f3fc",
              borderRadius: 10, padding: "10px 18px", fontSize: 13,
              cursor: "pointer", fontWeight: 800, whiteSpace: "nowrap",
            }}>
            Exportar
          </button>

          {podeEditarCamposCustom && (
            <button onClick={() => router.push("/crm/editor-proposta")} title="Configurar campos da proposta"
              style={{
                flex: isMobile ? 1 : "0 0 auto",
                background: "#f3e8ff", color: "#a855f7", border: "1px solid #ddd6fe",
                borderRadius: 10, padding: "10px 18px", fontSize: 13,
                cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
              }}>
              🛠️ Editar Campos
            </button>
          )}
          <button onClick={() => router.push("/crm/proposta")}
            style={{
              flex: isMobile ? 1 : "0 0 auto",
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
              whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            📋 Nova Proposta
          </button>
        </div>
      </div>


      {/* Resumo operacional */}
      <section style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)", boxShadow: "0 18px 42px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          {[
            { label: "Visiveis", valor: totalVisivel, detalhe: `${totalGeral} no workspace`, cor: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
            { label: "Instaladas", valor: kpis.instaladas, detalhe: `R$ ${kpis.receita.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, cor: "#16a34a", bg: "#ecfdf5", border: "#bbf7d0" },
            { label: "Em andamento", valor: kpis.andamento, detalhe: "aguardando/geradas", cor: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
            { label: "Canceladas", valor: kpis.canceladas, detalhe: "canceladas/reprovadas", cor: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            { label: "Ticket", valor: `R$ ${kpis.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, detalhe: "media instalada", cor: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
          ].map(card => (
            <button key={card.label} type="button" style={{
              textAlign: "left",
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 15,
              padding: "14px 15px",
              cursor: "default",
              minHeight: 94,
              boxShadow: "inset 3px 0 0 " + card.cor + ", 0 8px 22px rgba(15,23,42,0.04)",
            }}>
              <p style={{ color: "#64748b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>{card.label}</p>
              <p style={{ color: card.cor, fontSize: 24, fontWeight: 900, margin: "6px 0 0", letterSpacing: -0.5 }}>{typeof card.valor === "number" ? card.valor.toLocaleString("pt-BR") : card.valor}</p>
              <p style={{ color: "#64748b", fontSize: 11, margin: "2px 0 0", fontWeight: 700 }}>{card.detalhe}</p>
            </button>
          ))}
        </div>

        <details style={{
          marginTop: 14,
          borderRadius: 15,
          border: filtroStatus === "todos" ? "1px solid #e2e8f0" : "1px solid #93c5fd",
          background: filtroStatus === "todos" ? "#f8fafc" : "#eff6ff",
          overflow: "hidden",
        }}>
          <summary style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "13px 15px",
            cursor: "pointer",
            userSelect: "none",
            listStyle: "none",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10,
                display: "grid", placeItems: "center",
                background: "#ffffff", border: "1px solid #dbeafe",
                color: "#2563eb", fontSize: 15, flexShrink: 0,
              }}>◫</span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "#0f172a", fontSize: 12 }}>Distribuição por status</strong>
                <span style={{ display: "block", color: "#64748b", fontSize: 10, marginTop: 2 }}>
                  {filtroStatus === "todos"
                    ? statusOpcoesFiltro.length + " status disponíveis · clique para visualizar"
                    : "Filtro ativo: " + filtroStatus}
                </span>
              </span>
            </span>
            <span style={{ color: "#2563eb", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>Ver status ▾</span>
          </summary>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 8,
            padding: "0 13px 13px",
          }}>
            <button onClick={() => setFiltroStatus("todos")} style={{
              textAlign: "left",
              background: filtroStatus === "todos" ? "#0f172a" : "#ffffff",
              color: filtroStatus === "todos" ? "#ffffff" : "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
            }}>Todos os status · {totalVisivel.toLocaleString("pt-BR")}</button>
            {kpis.statusResumo.map(item => {
              const ativo = filtroStatus === item.status;
              return (
                <button key={item.status} onClick={() => setFiltroStatus(item.status)} title={item.status}
                  style={{
                    textAlign: "left",
                    background: ativo ? item.cor : "#ffffff",
                    color: ativo ? "#ffffff" : item.cor,
                    border: "1px solid " + (ativo ? item.cor : item.border),
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>{item.emoji} {item.status} · {item.total.toLocaleString("pt-BR")}</button>
              );
            })}
          </div>
        </details>
      </section>

      {/* Filtros */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderRadius: 18, border: "1px solid #dbeafe", background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)", boxShadow: "0 12px 30px rgba(15,23,42,0.05)" }}>
        <input placeholder="Buscar por nome, CPF, vendedor..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360, flex: "1 1 220px", borderRadius: 20 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
          <option value="todos">Status: Todos</option>
          {statusOpcoesFiltro.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: 4, borderRadius: 12, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
          {[
            ["todos", "Todo periodo"],
            ["hoje", "Hoje"],
            ["7d", "7 dias"],
            ["30d", "30 dias"],
            ["mes", "Mes atual"],
            ["custom", "Personalizado"],
          ].map(([k, label]) => (
            <button key={k} onClick={() => aplicarRange(k as any)} style={{
              background: rangeRapido === k ? "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)" : "transparent",
              color: rangeRapido === k ? "#ffffff" : "#475569",
              border: rangeRapido === k ? "1px solid #2563eb" : "1px solid transparent",
              boxShadow: rangeRapido === k ? "0 5px 12px rgba(37,99,235,0.22)" : "none",
              borderRadius: 9,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>
        {rangeRapido === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "5px 10px" }}>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>De</span>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} max={filtroDataFim || undefined}
              style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: 12, padding: "5px 0", outline: "none", fontWeight: 700 }} />
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>Ate</span>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} min={filtroDataInicio || undefined}
              style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: 12, padding: "5px 0", outline: "none", fontWeight: 700 }} />
          </div>
        )}
        <select value={filtroModif} onChange={e => setFiltroModif(e.target.value as any)} style={{ ...inputStyle, maxWidth: 230, borderColor: filtroModif !== "qualquer" ? "#bfdbfe" : "#e5e7eb", background: filtroModif !== "qualquer" ? "#eff6ff" : "#ffffff", fontWeight: filtroModif !== "qualquer" ? 800 : 500 }}>
          <option value="qualquer">Modificacao: qualquer</option>
          <option value="hoje">Modificada hoje</option>
          <option value="7d">Modificada em 7 dias</option>
          <option value="30d">Modificada em 30 dias</option>
        </select>
        {(busca || filtroStatus !== "todos" || rangeRapido !== "hoje" || filtroModif !== "qualquer" || Object.keys(filtrosColuna).length > 0) && (
          <button onClick={() => { setBusca(""); setFiltroStatus("todos"); setFiltrosColuna({}); setFiltroModif("qualquer"); aplicarRange("hoje"); }}
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 800 }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ═══ TABELA ═══ */}
      {/* ═══ TABELA ═══ */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        {tabelaTransborda && (
          <div ref={topScrollerRef}
            onScroll={() => {
              if (sincronizando.current) return;
              sincronizando.current = true;
              if (tableContainerRef.current && topScrollerRef.current) {
                tableContainerRef.current.scrollLeft = topScrollerRef.current.scrollLeft;
              }
              sincronizando.current = false;
            }}
            style={{
              overflowX: "auto", overflowY: "hidden",
              height: 14, borderBottom: "1px solid #f3f4f6",
            }}>
            <div style={{ width: topInnerWidth || "100%", height: 1 }} />
          </div>
        )}

        <div ref={tableContainerRef}
          onScroll={() => {
            if (sincronizando.current) return;
            sincronizando.current = true;
            if (tableContainerRef.current && topScrollerRef.current) {
              topScrollerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
            }
            sincronizando.current = false;
          }}
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table ref={tableInnerRef}
            style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 720 : "auto" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {colunasTabela.map(c => (
                  <th key={`th-${c.origem}-${c.slug}`}
                    style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                    {c.label}
                  </th>
                ))}
                <th key="th-acoes"
                  style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                  Ações
                </th>
              </tr>
              <tr style={{ background: "#fbfbfc" }}>
                {colunasTabela.map(c => (
                  <th key={`fil-${c.origem}-${c.slug}`}
                    style={{ padding: "6px 12px", borderBottom: "1px solid #e5e7eb" }}>
                    {renderFiltroColuna(c)}
                  </th>
                ))}
                <th key="fil-acoes" style={{ padding: "6px 12px", borderBottom: "1px solid #e5e7eb" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colunasTabela.length + 1} style={{ padding: 32, color: "#6b7280", textAlign: "center", fontSize: 13 }}>⏳ Carregando...</td></tr>
              ) : propostasFiltradas.length === 0 ? (
                <tr><td colSpan={colunasTabela.length + 1} style={{ padding: 48, textAlign: "center" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 18,
                    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, margin: "0 auto 14px",
                    boxShadow: "0 12px 24px rgba(22,163,74,0.25)",
                  }}>
                    <span style={{ filter: "saturate(0) brightness(2)" }}>💰</span>
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                    {busca || filtroStatus !== "todos"
                      ? "Nenhum resultado pros filtros"
                      : podeVerTudo
                        ? "Nenhuma proposta cadastrada ainda"
                        : travadoEquipe
                          ? "Nenhuma proposta na sua equipe ainda"
                          : "Você ainda não cadastrou nenhuma proposta"}
                  </p>
                </td></tr>
              ) : propostasFiltradas.map((v, i) => {
                return (
                  <tr key={v.id}
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      background: i % 2 === 0 ? "#ffffff" : "#fafbfc",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                  >
                    {colunasTabela.map(c => (
                      <td key={`td-${c.origem}-${c.slug}`} style={{ padding: "12px 16px" }}>
                        {renderCelulaTabela(c, v)}
                      </td>
                    ))}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setPropostaVisualizando(v)} title="Visualizar"
                          style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>👁️</button>
                        <button onClick={() => abrirEditar(v)} title="Editar"
                          style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                        {podeExcluir && (
                          <button onClick={() => excluir(v)} title="Excluir"
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avisos rodapé */}
      {!podeExcluir && propostas.length > 0 && (
        <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>🔒 Apenas o dono do workspace ou administrador podem excluir propostas.</p>
      )}
      {esc === "own" && (
        <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>👤 Você só vê suas próprias propostas. Pra ver as da equipe, peça ao admin para habilitar <b style={{ color: "#6b7280" }}>"Ver vendas da equipe"</b>.</p>
      )}
      {travadoEquipe && (
        <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>👥 Você vê as propostas da sua equipe (<b style={{ color: "#6b7280" }}>{minhaEquipeNome}</b>).</p>
      )}


      {/* ═══ MODAL DE VISUALIZAÇÃO ═══ */}
      {propostaVisualizando && (
        <div onClick={() => setPropostaVisualizando(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...cardStyle, width: "100%", maxWidth: 920, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", gap: 12 }}>
              <div>
                <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 900, margin: 0 }}>Venda #{propostaVisualizando.id}</h2>
                <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>{propostaVisualizando.nome || "Sem nome"} · {nomeVendedor(propostaVisualizando.vendedor)}</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={() => { const p = propostaVisualizando; setPropostaVisualizando(null); abrirEditar(p); }}
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.28)" }}>Editar</button>
                <button onClick={() => setPropostaVisualizando(null)}
                  style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 800 }}>Fechar</button>
              </div>
            </div>

            <div style={{ padding: 22, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                {[
                  { label: "Status", value: propostaVisualizando.status_venda || "-", cor: statusMeta(propostaVisualizando.status_venda).cor, bg: statusMeta(propostaVisualizando.status_venda).bg, border: statusMeta(propostaVisualizando.status_venda).border },
                  { label: "Valor", value: `R$ ${Number(propostaVisualizando.valor_plano || 0).toFixed(2).replace(".", ",")}`, cor: "#16a34a", bg: "#ecfdf5", border: "#bbf7d0" },
                  { label: "Data proposta", value: propostaVisualizando.data_proposta ? new Date(propostaVisualizando.data_proposta + "T00:00:00").toLocaleDateString("pt-BR") : "-", cor: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
                  { label: "Modificado", value: propostaVisualizando.updated_at ? new Date(propostaVisualizando.updated_at).toLocaleString("pt-BR") : "-", cor: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
                ].map(card => (
                  <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 10, padding: 13 }}>
                    <p style={{ color: "#64748b", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: 900, letterSpacing: 0.5 }}>{card.label}</p>
                    <p style={{ color: card.cor, fontSize: 14, margin: "5px 0 0", fontWeight: 900, wordBreak: "break-word" }}>{card.value}</p>
                  </div>
                ))}
              </div>

              <ViewSection
                titulo="Informacoes da venda"
                campos={camposUnificados
                  .filter(c => c.slug !== "status_venda" && c.slug !== "valor_plano" && c.slug !== "vendedor" && c.tipo !== "arquivo")
                  .map(c => {
                    let v = c.origem === "fixo" ? (propostaVisualizando as any)[c.slug] : propostaVisualizando.dados_customizados?.[c.slug];
                    if (c.tipo === "checkbox") v = v === true ? "Sim" : v === false ? "Nao" : "";
                    else if (c.tipo === "moeda" && v) v = `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
                    else if (c.tipo === "data" && v) v = formatarDataCRM(v);
                    else if (c.tipo === "vendedor" && v) v = nomeVendedor(v);
                    return [c.label, v] as [string, any];
                  })}
              />

              <div>
                <h3 style={{ color: "#334155", fontSize: 12, fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Anexos e arquivos</h3>
                {(() => {
                  const anexos = camposUnificados
                    .filter(c => c.tipo === "arquivo")
                    .flatMap(c => {
                      const raw = c.origem === "fixo" ? (propostaVisualizando as any)[c.slug] : propostaVisualizando.dados_customizados?.[c.slug];
                      const lista = Array.isArray(raw) ? raw : raw?.url ? [raw] : [];
                      return lista.map((a: AnexoMeta) => ({ ...a, campo: c.label }));
                    });
                  if (!anexos.length) return <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, fontStyle: "italic" }}>Nenhum arquivo anexado nesta venda.</p>;
                  return (
                    <div style={{ display: "grid", gap: 8 }}>
                      {anexos.map((a, idx) => (
                        <a key={idx} href={a.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, color: "#2563eb", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iconeArquivo(a.tipo)} · {a.nome}</span>
                          <span style={{ color: "#64748b", flexShrink: 0 }}>{a.campo} · {formatarTamanhoArquivo(a.tamanho)}</span>
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div>
                <h3 style={{ color: "#334155", fontSize: 12, fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Historico</h3>
                {logsTabelaFalta ? (
                  <p style={{ color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, fontSize: 12, margin: 0 }}>A tabela proposta_logs ainda nao existe neste banco. Crie essa tabela para salvar o historico das alteracoes.</p>
                ) : carregandoLogs ? (
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Carregando historico...</p>
                ) : logsProposta.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, fontStyle: "italic" }}>Nenhuma alteracao registrada para esta venda.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {logsProposta.map((l, idx) => (
                      <div key={l.id || idx} style={{ padding: 12, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <strong style={{ color: "#0f172a", fontSize: 12 }}>{l.acao || "alteracao"} · {l.campo || "proposta"}</strong>
                          <span style={{ color: "#64748b", fontSize: 11 }}>{l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : ""}</span>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 11, margin: "5px 0 0" }}>{l.usuario_nome || l.usuario_email || "Sistema"}</p>
                        <p style={{ color: "#334155", fontSize: 12, margin: "6px 0 0" }}>
                          <span style={{ color: "#dc2626" }}>{fmtLogVal(l.valor_anterior ?? l.antes)}</span>
                          <span style={{ color: "#94a3b8" }}> → </span>
                          <span style={{ color: "#16a34a" }}>{fmtLogVal(l.valor_novo ?? l.depois)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BOTÕES FLUTUANTES ↑↓ ═══ */}
      {/* ═══ BOTÕES FLUTUANTES ↑↓ ═══ */}
      <div style={{
        position: "fixed", right: 16, bottom: 20, zIndex: 1500,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {scrollY > 200 && (
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Ir para o topo"
            style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", cursor: "pointer", fontSize: 18,
              boxShadow: "0 6px 16px rgba(22,163,74,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700,
            }}>↑</button>
        )}
        <button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          title="Ir para o fim"
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "#ffffff",
            color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontSize: 18,
            boxShadow: "0 6px 16px rgba(0,0,0,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700,
          }}>↓</button>
      </div>
    </div>
  );
}

function ViewSection({ titulo, campos }: { titulo: string; campos: [string, any][] }) {
  const todosVazios = campos.every(([, v]) => !v && v !== false);
  return (
    <div>
      <h3 style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</h3>
      {todosVazios ? (
        <p style={{ color: "#9ca3af", fontSize: 12, margin: 0, fontStyle: "italic" }}>Nenhuma informação cadastrada</p>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14, background: "#f9fafb", padding: 16, borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}>
          {campos.map(([label, valor]) => (
            <div key={label}>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 }}>{label}</p>
              <p style={{
                color: valor || valor === false ? "#1f2937" : "#d1d5db",
                fontSize: 13, margin: "3px 0 0", wordBreak: "break-word",
                fontWeight: valor || valor === false ? 600 : 400,
              }}>
                {valor !== "" && valor !== null && valor !== undefined ? String(valor) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
