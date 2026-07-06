"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../../lib/supabase";
import { useEquipeFiltro } from "../../../hooks/useEquipeFiltro";

type Proposta = {
  id: number;
  created_at: string;
  data_proposta?: string | null;
  nome?: string | null;
  vendedor?: string | null;
  valor_plano?: number | null;
  status_venda?: string | null;
  operadora?: string | null;
  plano?: string | null;
  workspace_id?: string | null;
  equipe_id?: string | null;
  equipe_id_criador?: number | string | null;
};

type UsuarioWs = {
  email: string;
  nome: string;
};

type Periodo = "hoje" | "semana" | "mes" | "trimestre";
type Grupo =
  | "INSTALADA"
  | "AGUARDANDO_INST"
  | "BIOMETRIA"
  | "GERADA"
  | "PENDENTE"
  | "AUDITORIA"
  | "CANCELADA"
  | "CHURN"
  | "EXCLUIDA"
  | "A_CANCELAR";

const META_INSTALADAS = 30;

const T = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  ink: "#0f172a",
  sub: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f8fafc",
  green: "#059669",
  greenLt: "#10b981",
  brand: "#2563eb",
  brand2: "#3b82f6",
};

const normStatus = (status: any) =>
  String(status ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const STATUS_GRUPO: Record<string, Grupo> = {
  INSTALADA: "INSTALADA",
  INSTALADO: "INSTALADA",
  CONCLUIDA: "INSTALADA",
  APROVADA: "INSTALADA",

  "AGUARDANDO INSTALACAO": "AGUARDANDO_INST",
  "AGUARDANDO INSTALAÇÃO": "AGUARDANDO_INST",
  "AGUARDANDO_INSTALACAO": "AGUARDANDO_INST",
  "AGUARDANDO INST": "AGUARDANDO_INST",

  "AGUARDANDO BIOMETRIA": "BIOMETRIA",
  BIOMETRIA: "BIOMETRIA",

  GERADA: "GERADA",
  GERADO: "GERADA",
  VISIVEL: "GERADA",
  VISIVEIS: "GERADA",
  NOVA: "GERADA",

  PENDENTE: "PENDENTE",
  PENDENTES: "PENDENTE",
  "EM TRATATIVA": "PENDENTE",
  ANDAMENTO: "PENDENTE",
  "EM ANDAMENTO": "PENDENTE",

  AUDITADA: "AUDITORIA",
  AUDITORIA: "AUDITORIA",
  "AGUARDANDO AUDITORIA": "AUDITORIA",

  CANCELADA: "CANCELADA",
  CANCELADO: "CANCELADA",
  "CANCELADA INTERNAMENTE": "CANCELADA",
  "CANCELADA EXTERNAMENTE": "CANCELADA",
  REPROVADA: "CANCELADA",

  CHURN: "CHURN",
  EXCLUIDA: "EXCLUIDA",
  EXCLUIDO: "EXCLUIDA",
  "GROSS A CANCELAR": "A_CANCELAR",
  "A CANCELAR": "A_CANCELAR",
};

const grupoDe = (status: any): Grupo => STATUS_GRUPO[normStatus(status)] || "PENDENTE";

const GRUPO_META: Record<Grupo, { label: string; cor: string; bg: string; icone: string }> = {
  INSTALADA: { label: "Instaladas", cor: "#059669", bg: "#ecfdf5", icone: "✅" },
  AGUARDANDO_INST: { label: "Aguardando instalação", cor: "#0284c7", bg: "#f0f9ff", icone: "🔧" },
  BIOMETRIA: { label: "Aguardando biometria", cor: "#6366f1", bg: "#eef2ff", icone: "🪪" },
  GERADA: { label: "Geradas", cor: "#7c3aed", bg: "#f5f3ff", icone: "📄" },
  PENDENTE: { label: "Pendentes", cor: "#d97706", bg: "#fffbeb", icone: "⏳" },
  AUDITORIA: { label: "Auditoria", cor: "#0891b2", bg: "#ecfeff", icone: "🔍" },
  CANCELADA: { label: "Canceladas", cor: "#dc2626", bg: "#fef2f2", icone: "❌" },
  CHURN: { label: "Churn", cor: "#9333ea", bg: "#faf5ff", icone: "📉" },
  EXCLUIDA: { label: "Excluídas", cor: "#78716c", bg: "#fafaf9", icone: "🗑️" },
  A_CANCELAR: { label: "A cancelar", cor: "#ea580c", bg: "#fff7ed", icone: "⚠️" },
};

const periodoLabel: Record<Periodo, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
};

function AnelMeta({ valor, meta, mobile }: { valor: number; meta: number; mobile: boolean }) {
  const size = mobile ? 168 : 210;
  const stroke = mobile ? 16 : 20;
  const radius = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, meta > 0 ? (valor / meta) * 100 : 0);
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setAnim(pct);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const k = Math.min(1, (time - start) / 1000);
      const eased = 1 - Math.pow(1 - k, 3);
      setAnim(pct * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const dash = (anim / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="wolfAnelGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#wolfAnelGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#fff", fontSize: mobile ? 38 : 50, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{valor}</span>
        <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700, marginTop: 4 }}>de {meta} vendas</span>
        <span style={{ color: "#fff", background: "rgba(255,255,255,0.16)", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 900, marginTop: 8 }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function BarraProg({ pct, cor }: { pct: number; cor: string }) {
  const [w, setW] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setW(pct), 80);
    return () => window.clearTimeout(id);
  }, [pct]);

  return (
    <div style={{ width: "100%", height: 10, background: "#e2e8f0", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: cor, borderRadius: 6, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [workspaceNome, setWorkspaceNome] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [userNome, setUserNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const { equipeId, EquipeSelector } = useEquipeFiltro(workspaceId);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      let wsIds: string[] = [];
      let wsNome = "";
      let ownerEmail = "";
      let nomeLogado = (user.user_metadata as any)?.nome || user.email?.split("@")[0] || "";

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();

      if (wsDono) {
        if (wsDono.username) wsIds.push(String(wsDono.username));
        if (wsDono.id) wsIds.push(String(wsDono.id));
        wsNome = wsDono.nome || "";
        ownerEmail = wsDono.owner_email || "";
      } else {
        const { data: usuarioWs } = await supabase
          .from("usuarios_workspace")
          .select("workspace_id, nome")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (usuarioWs?.workspace_id) {
          wsIds.push(String(usuarioWs.workspace_id));
          if (usuarioWs.nome) nomeLogado = usuarioWs.nome;

          const { data: wsSub } = await supabase
            .from("workspaces")
            .select("nome, username, id, owner_email")
            .or(`username.eq.${usuarioWs.workspace_id},id.eq.${usuarioWs.workspace_id}`)
            .maybeSingle();

          if (wsSub) {
            wsNome = wsSub.nome || "";
            ownerEmail = wsSub.owner_email || "";
            if (wsSub.username && !wsIds.includes(String(wsSub.username))) wsIds.push(String(wsSub.username));
            if (wsSub.id && !wsIds.includes(String(wsSub.id))) wsIds.push(String(wsSub.id));
          }
        }
      }

      wsIds = [...new Set(wsIds.filter(Boolean))];
      setUserNome(nomeLogado);
      setWorkspaceNome(wsNome);
      setWorkspaceId(wsIds[0] || "");

      if (wsIds.length === 0) {
        setLoading(false);
        return;
      }

      const PAGE = 1000;
      const acc: Proposta[] = [];
      let from = 0;

      while (from < 20000) {
        const { data, error } = await supabase
          .from("proposta")
          .select("*")
          .in("workspace_id", wsIds)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);

        if (error) {
          console.error(error);
          break;
        }

        if (!data || data.length === 0) break;
        acc.push(...(data as Proposta[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const nomes: UsuarioWs[] = [];
      if (ownerEmail) nomes.push({ email: ownerEmail, nome: wsNome || "Dono" });

      const { data: subs } = await supabase.from("usuarios_workspace").select("email, nome").in("workspace_id", wsIds);
      for (const sub of subs || []) {
        if (!sub.email) continue;
        const jaExiste = nomes.some((n) => n.email?.toLowerCase() === sub.email?.toLowerCase());
        if (!jaExiste) nomes.push({ email: sub.email, nome: sub.nome || sub.email });
      }

      setPropostas(acc);
      setUsuariosWs(nomes);
      setLoading(false);
    };

    init();
  }, [router]);

  const nomeVendedor = (email?: string | null) => {
    if (!email) return "Sem vendedor";
    const usuario = usuariosWs.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
    return usuario?.nome || email.split("@")[0];
  };

  const saudacao = useMemo(() => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const mesmaEquipe = (p: Proposta) => {
    if (!equipeId) return true;
    const atual = p.equipe_id ?? p.equipe_id_criador ?? "";
    return String(atual) === String(equipeId);
  };

  const filtrarPorPeriodo = (lista: Proposta[], p: Periodo) => {
    const agora = new Date();
    return lista.filter((prop) => {
      if (!mesmaEquipe(prop)) return false;
      const data = new Date(prop.created_at);
      if (Number.isNaN(data.getTime())) return false;

      if (p === "hoje") return data.toDateString() === agora.toDateString();
      if (p === "semana") {
        const diff = (agora.getTime() - data.getTime()) / 86400000;
        return diff >= 0 && diff <= 7;
      }
      if (p === "mes") return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();

      const trimAtual = Math.floor(agora.getMonth() / 3);
      const trimData = Math.floor(data.getMonth() / 3);
      return trimAtual === trimData && data.getFullYear() === agora.getFullYear();
    });
  };

  const periodoAnterior = (lista: Proposta[], p: Periodo) => {
    const agora = new Date();
    return lista.filter((prop) => {
      if (!mesmaEquipe(prop)) return false;
      const data = new Date(prop.created_at);
      if (Number.isNaN(data.getTime())) return false;

      if (p === "hoje") {
        const ontem = new Date(agora);
        ontem.setDate(ontem.getDate() - 1);
        return data.toDateString() === ontem.toDateString();
      }
      if (p === "semana") {
        const diff = (agora.getTime() - data.getTime()) / 86400000;
        return diff > 7 && diff <= 14;
      }
      if (p === "mes") {
        const mesAnterior = agora.getMonth() === 0 ? 11 : agora.getMonth() - 1;
        const anoAnterior = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
        return data.getMonth() === mesAnterior && data.getFullYear() === anoAnterior;
      }

      const trimAtual = Math.floor(agora.getMonth() / 3);
      const trimAnterior = trimAtual === 0 ? 3 : trimAtual - 1;
      const ano = trimAtual === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
      return Math.floor(data.getMonth() / 3) === trimAnterior && data.getFullYear() === ano;
    });
  };

  const pf = useMemo(() => filtrarPorPeriodo(propostas, periodo), [propostas, periodo, equipeId]);
  const pAnt = useMemo(() => periodoAnterior(propostas, periodo), [propostas, periodo, equipeId]);
  const propostasDaEquipe = useMemo(() => propostas.filter(mesmaEquipe), [propostas, equipeId]);

  const contaGrupos = (lista: Proposta[]) => {
    const base: Record<Grupo, number> = {
      INSTALADA: 0,
      AGUARDANDO_INST: 0,
      BIOMETRIA: 0,
      GERADA: 0,
      PENDENTE: 0,
      AUDITORIA: 0,
      CANCELADA: 0,
      CHURN: 0,
      EXCLUIDA: 0,
      A_CANCELAR: 0,
    };

    for (const p of lista) base[grupoDe(p.status_venda)]++;
    return base;
  };

  const calc = (lista: Proposta[]) => {
    const grupos = contaGrupos(lista);
    const instaladas = lista.filter((p) => grupoDe(p.status_venda) === "INSTALADA");
    const totalReceita = instaladas.reduce((acc, p) => acc + Number(p.valor_plano || 0), 0);
    const total = lista.length;
    const taxaInstalacao = total > 0 ? (grupos.INSTALADA / total) * 100 : 0;
    const ticketMedio = instaladas.length > 0 ? totalReceita / instaladas.length : 0;
    const vendedoresAtivos = new Set(lista.filter((p) => p.vendedor).map((p) => p.vendedor)).size;

    return { grupos, totalReceita, total, taxaInstalacao, ticketMedio, vendedoresAtivos };
  };

  const stats = useMemo(() => calc(pf), [pf]);
  const statsAnt = useMemo(() => calc(pAnt), [pAnt]);

  const trend = (atual: number, anterior: number) => {
    if (anterior === 0) return { val: atual > 0 ? 100 : 0, up: atual > 0 };
    const diff = ((atual - anterior) / anterior) * 100;
    return { val: Math.abs(diff), up: diff >= 0 };
  };

  const rankingVendedores = useMemo(() => {
    const acc: Record<string, { instaladas: number; aguardando: number; receita: number }> = {};

    for (const p of pf) {
      if (!p.vendedor) continue;
      const grupo = grupoDe(p.status_venda);
      if (!acc[p.vendedor]) acc[p.vendedor] = { instaladas: 0, aguardando: 0, receita: 0 };
      if (grupo === "INSTALADA") {
        acc[p.vendedor].instaladas++;
        acc[p.vendedor].receita += Number(p.valor_plano || 0);
      }
      if (grupo === "AGUARDANDO_INST") acc[p.vendedor].aguardando++;
    }

    return Object.entries(acc)
      .map(([key, v]) => {
        const nome = nomeVendedor(key);
        const partes = nome.trim().split(/\s+/);
        const nomeCurto = partes.length > 1 ? `${partes[0]} ${partes[1].charAt(0)}.` : partes[0];
        return { key, nome, nomeCurto, ...v };
      })
      .sort((a, b) => b.instaladas - a.instaladas || b.receita - a.receita || b.aguardando - a.aguardando);
  }, [pf, usuariosWs]);

  const funilVendedores = useMemo(() => {
    const acc: Record<string, Record<Grupo, number>> = {};
    for (const p of pf) {
      if (!p.vendedor) continue;
      if (!acc[p.vendedor]) acc[p.vendedor] = contaGrupos([]);
      acc[p.vendedor][grupoDe(p.status_venda)]++;
    }

    return Object.entries(acc)
      .map(([key, value]) => ({ vendedor: nomeVendedor(key), ...value }))
      .sort((a, b) => b.INSTALADA - a.INSTALADA);
  }, [pf, usuariosWs]);

  const distData = useMemo(() => {
    return (Object.keys(stats.grupos) as Grupo[])
      .map((g) => ({ name: GRUPO_META[g].label, value: stats.grupos[g], color: GRUPO_META[g].cor }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const operadorasData = useMemo(() => {
    const counts: Record<string, number> = {};
    pf.forEach((p) => {
      const nome = p.operadora || "Não informado";
      counts[nome] = (counts[nome] || 0) + 1;
    });

    const cores = ["#2563eb", "#059669", "#7c3aed", "#0284c7", "#d97706", "#dc2626"];
    return Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: cores[i % cores.length] }))
      .sort((a, b) => b.value - a.value);
  }, [pf]);

  const vendasPorDia = useMemo(() => {
    const instaladas: Record<string, number> = {};
    const aguardando: Record<string, number> = {};
    const agora = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(agora);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      instaladas[key] = 0;
      aguardando[key] = 0;
    }

    propostasDaEquipe.forEach((p) => {
      const grupo = grupoDe(p.status_venda);
      if (grupo !== "INSTALADA" && grupo !== "AGUARDANDO_INST") return;
      const key = (p.created_at || "").slice(0, 10);
      if (instaladas[key] === undefined) return;
      if (grupo === "INSTALADA") instaladas[key]++;
      else aguardando[key]++;
    });

    return Object.entries(instaladas).map(([data, value]) => {
      const d = new Date(`${data}T12:00:00`);
      return {
        data: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        instaladas: value,
        aguardando: aguardando[data] || 0,
      };
    });
  }, [propostasDaEquipe]);

  const receitaPorDia = useMemo(() => {
    const dias: Record<string, number> = {};
    const agora = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(agora);
      d.setDate(d.getDate() - i);
      dias[d.toISOString().slice(0, 10)] = 0;
    }

    propostasDaEquipe.forEach((p) => {
      if (grupoDe(p.status_venda) !== "INSTALADA") return;
      const key = (p.created_at || "").slice(0, 10);
      if (dias[key] === undefined) return;
      dias[key] += Number(p.valor_plano || 0);
    });

    return Object.entries(dias).map(([data, receita]) => {
      const d = new Date(`${data}T12:00:00`);
      return {
        data: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        receita,
      };
    });
  }, [propostasDaEquipe]);

  const atividadeRecente = useMemo(() => propostasDaEquipe.slice(0, 6), [propostasDaEquipe]);

  const instaladas = stats.grupos.INSTALADA;
  const aguardandoInst = stats.grupos.AGUARDANDO_INST;
  const faltam = Math.max(0, META_INSTALADAS - instaladas);
  const pctMeta = Math.min(100, (instaladas / META_INSTALADAS) * 100);
  const tInst = trend(instaladas, statsAnt.grupos.INSTALADA);

  const kpisHero = [
    { label: "Aguardando instalação", value: aguardandoInst, cor: GRUPO_META.AGUARDANDO_INST.cor, icone: "🔧", hint: "podem virar venda" },
    { label: "Pendentes", value: stats.grupos.PENDENTE, cor: GRUPO_META.PENDENTE.cor, icone: "⏳", hint: "precisam de ação" },
    { label: "Ticket médio", value: stats.ticketMedio, cor: T.brand, icone: "💳", hint: "em instaladas", money: true },
    { label: "Vendedores ativos", value: stats.vendedoresAtivos, cor: "#7c3aed", icone: "👥", hint: "no período" },
  ];

  const insights = useMemo(() => {
    const lista: { icon: string; text: string; color: string }[] = [];

    if (rankingVendedores.length > 0) {
      lista.push({
        icon: "🏆",
        text: `${rankingVendedores[0].nome} lidera com ${rankingVendedores[0].instaladas} instalada(s)`,
        color: "#d97706",
      });
    }

    if (statsAnt.total > 0) {
      const t = trend(stats.total, statsAnt.total);
      lista.push({
        icon: t.up ? "📈" : "📉",
        text: `Volume ${t.up ? "cresceu" : "caiu"} ${t.val.toFixed(1)}% vs período anterior`,
        color: t.up ? T.green : "#dc2626",
      });
    }

    if (stats.taxaInstalacao >= 50) {
      lista.push({ icon: "🎯", text: `Taxa de instalação em ${stats.taxaInstalacao.toFixed(1)}%`, color: T.green });
    } else if (stats.grupos.PENDENTE > 0) {
      lista.push({ icon: "💪", text: `${stats.grupos.PENDENTE} proposta(s) pendentes esperando ação`, color: "#7c3aed" });
    }

    if (operadorasData.length > 0) {
      lista.push({ icon: "📡", text: `${operadorasData[0].name} é a operadora mais recorrente`, color: "#0284c7" });
    }

    return lista.slice(0, 4);
  }, [rankingVendedores, stats, statsAnt, operadorasData]);

  const surface = {
    background: T.surface,
    borderRadius: 18,
    border: `1px solid ${T.line}`,
    boxShadow: "0 1px 2px rgba(15,23,42,0.03), 0 6px 20px rgba(15,23,42,0.05)",
  };
  const eyebrow = {
    color: T.faint,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    margin: 0,
  };
  const numStyle = { fontVariantNumeric: "tabular-nums" as const };

  if (loading) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: T.green, borderRadius: "50%", margin: "0 auto 14px", animation: "spin .7s linear infinite" }} />
          <p style={{ color: T.sub, fontSize: 14, margin: 0 }}>Carregando dashboard...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, margin: isMobile ? -14 : -20, padding: isMobile ? 14 : 22, minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .fu { animation: fadeUp .55s cubic-bezier(0.16,1,0.3,1) backwards; }
        .pbtn { padding: 9px 15px; border-radius: 11px; border: 1px solid ${T.line}; background: #fff; color: ${T.sub}; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all .15s; }
        .pbtn:hover { border-color: #cbd5e1; color: ${T.ink}; }
        .pbtn.on { background: ${T.ink}; color: #fff; border-color: ${T.ink}; }
        .lift { transition: transform .18s ease, box-shadow .18s ease; }
        .lift:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.10) !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18, maxWidth: 1400, margin: "0 auto" }}>
        <div className="fu" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-end", gap: 14 }}>
          <div>
            <p style={{ ...eyebrow, color: T.green }}>
              {saudacao}, {userNome || "vendedor"}
            </p>
            <h1 style={{ color: T.ink, fontSize: isMobile ? 24 : 32, fontWeight: 900, margin: "4px 0 0", letterSpacing: -1 }}>
              Painel de Vendas
            </h1>
            <p style={{ color: T.sub, fontSize: 12.5, margin: "6px 0 0", fontWeight: 600 }}>
              {workspaceNome || "Workspace"} · {stats.total} proposta(s) em {periodoLabel[periodo].toLowerCase()}
            </p>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <EquipeSelector />
            {([
              { key: "hoje", label: "Hoje" },
              { key: "semana", label: "Semana" },
              { key: "mes", label: "Mês" },
              { key: "trimestre", label: "Trimestre" },
            ] as { key: Periodo; label: string }[]).map((f) => (
              <button key={f.key} onClick={() => setPeriodo(f.key)} className={`pbtn ${periodo === f.key ? "on" : ""}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fu" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(340px, 1fr) 1.3fr", gap: isMobile ? 14 : 18 }}>
          <div style={{ borderRadius: 20, padding: isMobile ? 22 : 28, background: "linear-gradient(140deg, #064e3b 0%, #065f46 55%, #047857 100%)", boxShadow: "0 10px 30px rgba(6,78,59,0.35)", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", gap: isMobile ? 18 : 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -42, right: -42, width: 160, height: 160, borderRadius: "50%", background: "rgba(52,211,153,0.15)" }} />
            <AnelMeta valor={instaladas} meta={META_INSTALADAS} mobile={isMobile} />
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
              <p style={{ ...eyebrow, color: "rgba(255,255,255,0.65)" }}>Meta do mês · instaladas</p>
              <p style={{ color: "#fff", fontSize: isMobile ? 15 : 17, fontWeight: 650, margin: "8px 0 0", lineHeight: 1.45 }}>
                {faltam === 0 ? "Meta batida. A equipe fechou o objetivo do mês." : <>Faltam <b>{faltam}</b> instalada(s) para bater <b>{META_INSTALADAS}</b>.</>}
              </p>
              <div style={{ display: "flex", gap: 18, marginTop: 18, flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, margin: 0, fontWeight: 700 }}>vs período anterior</p>
                  <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: "2px 0 0", ...numStyle }}>{tInst.up ? "▲" : "▼"} {tInst.val.toFixed(0)}%</p>
                </div>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, margin: 0, fontWeight: 700 }}>aguardando instalar</p>
                  <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: "2px 0 0", ...numStyle }}>+{aguardandoInst}</p>
                </div>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, margin: 0, fontWeight: 700 }}>taxa de instalação</p>
                  <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: "2px 0 0", ...numStyle }}>{stats.taxaInstalacao.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 12 : 14 }}>
            {kpisHero.map((kpi) => (
              <div key={kpi.label} className="lift" style={{ ...surface, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: `${kpi.cor}15`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{kpi.icone}</span>
                  <p style={{ ...eyebrow, fontSize: 10.5 }}>{kpi.label}</p>
                </div>
                <p style={{ color: T.ink, fontSize: isMobile ? 26 : 34, fontWeight: 900, margin: 0, letterSpacing: -1, ...numStyle }}>
                  {kpi.money ? `R$ ${Math.round(kpi.value).toLocaleString("pt-BR")}` : kpi.value.toLocaleString("pt-BR")}
                </p>
                <p style={{ color: T.faint, fontSize: 11, margin: "3px 0 0", fontWeight: 600 }}>{kpi.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {insights.length > 0 && (
          <div className="fu" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${insights.length}, 1fr)`, gap: 10 }}>
            {insights.map((item, i) => (
              <div key={i} style={{ ...surface, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10, borderLeft: `4px solid ${item.color}` }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <p style={{ color: T.ink, fontSize: 12.5, lineHeight: 1.35, margin: 0, fontWeight: 700 }}>{item.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="fu" style={{ ...surface, padding: isMobile ? 18 : 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, flexWrap: "wrap", gap: 6 }}>
            <h3 style={{ color: T.ink, fontSize: 16, fontWeight: 900, margin: 0 }}>Metas do mês</h3>
            <span style={{ ...eyebrow }}>acompanhamento em tempo real</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 18 : 28 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ color: "#334155", fontSize: 13, margin: 0, fontWeight: 800 }}>✅ Instaladas</p>
                <p style={{ color: T.ink, fontSize: 14, margin: 0, fontWeight: 900, ...numStyle }}>{instaladas} <span style={{ color: T.faint, fontWeight: 600 }}>/ {META_INSTALADAS}</span></p>
              </div>
              <BarraProg pct={pctMeta} cor={`linear-gradient(90deg, #34d399, ${T.green})`} />
              <p style={{ color: pctMeta >= 100 ? T.green : T.sub, fontSize: 11.5, margin: "6px 0 0", fontWeight: 700 }}>{pctMeta >= 100 ? "Meta batida" : `${pctMeta.toFixed(1)}% · faltam ${faltam}`}</p>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ color: "#334155", fontSize: 13, margin: 0, fontWeight: 800 }}>🔧 Aguardando → instalada</p>
                <p style={{ color: T.ink, fontSize: 14, margin: 0, fontWeight: 900, ...numStyle }}>{aguardandoInst} <span style={{ color: T.faint, fontWeight: 600 }}>na fila</span></p>
              </div>
              <BarraProg pct={Math.min(100, (aguardandoInst / Math.max(1, faltam)) * 100)} cor={`linear-gradient(90deg, #38bdf8, ${GRUPO_META.AGUARDANDO_INST.cor})`} />
              <p style={{ color: T.sub, fontSize: 11.5, margin: "6px 0 0", fontWeight: 700 }}>
                {faltam === 0 ? "Meta já batida" : aguardandoInst >= faltam ? "A fila atual cobre o que falta" : `Cobre ${Math.round((aguardandoInst / Math.max(1, faltam)) * 100)}% do que falta`}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? 14 : 18 }}>
          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: 0 }}>Vendas · últimos 30 dias</h3>
                <p style={{ color: T.sub, fontSize: 12, margin: "3px 0 0" }}>Instaladas e aguardando instalação por dia</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ background: "#ecfdf5", color: T.green, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8 }}>{vendasPorDia.reduce((a, d) => a + d.instaladas, 0)} inst.</span>
                <span style={{ background: "#f0f9ff", color: GRUPO_META.AGUARDANDO_INST.cor, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8 }}>{vendasPorDia.reduce((a, d) => a + d.aguardando, 0)} aguard.</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
              <AreaChart data={vendasPorDia} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="wolfInstaladas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.35} /><stop offset="95%" stopColor={T.green} stopOpacity={0} /></linearGradient>
                  <linearGradient id="wolfAguardando" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GRUPO_META.AGUARDANDO_INST.cor} stopOpacity={0.3} /><stop offset="95%" stopColor={GRUPO_META.AGUARDANDO_INST.cor} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="data" stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} interval={isMobile ? 6 : 3} />
                <YAxis stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="instaladas" name="Instaladas" stroke={T.green} strokeWidth={2.5} fill="url(#wolfInstaladas)" />
                <Area type="monotone" dataKey="aguardando" name="Aguardando inst." stroke={GRUPO_META.AGUARDANDO_INST.cor} strokeWidth={2} fill="url(#wolfAguardando)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px" }}>Distribuição</h3>
            <p style={{ color: T.sub, fontSize: 12, margin: "0 0 14px" }}>{periodoLabel[periodo]} · {stats.total} propostas</p>
            {distData.length === 0 ? (
              <p style={{ color: T.faint, fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>Sem dados no período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={distData} innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                      {distData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
                  {distData.slice(0, 6).map((s) => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                        <span style={{ color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      </div>
                      <span style={{ color: T.ink, fontWeight: 900, ...numStyle }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? 14 : 18 }}>
          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>🏆</span> Ranking de vendedores</h3>
            <p style={{ color: T.sub, fontSize: 12, margin: "0 0 16px" }}>Por instaladas · {periodoLabel[periodo]}</p>
            {rankingVendedores.length === 0 ? (
              <p style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Sem vendas no período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={isMobile ? 180 : 210}>
                  <BarChart data={rankingVendedores.slice(0, 10)} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs><linearGradient id="wolfRankBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor={T.green} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="nomeCurto" stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={isMobile ? 60 : 55} />
                    <YAxis stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} cursor={{ fill: "#ecfdf5" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="instaladas" name="Instaladas" stackId="rank" fill="url(#wolfRankBar)" />
                    <Bar dataKey="aguardando" name="Aguardando inst." stackId="rank" fill={GRUPO_META.AGUARDANDO_INST.cor} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  {rankingVendedores.slice(0, 5).map((v, i) => {
                    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                    return (
                      <div key={v.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: i === 0 ? "linear-gradient(135deg,#ecfdf5,#d1fae5)" : T.soft, border: `1px solid ${i === 0 ? "#a7f3d0" : T.line}`, borderRadius: 11, padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          {medalha ? <span style={{ fontSize: 18, flexShrink: 0 }}>{medalha}</span> : <span style={{ background: "#e2e8f0", color: T.sub, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, flexShrink: 0, minWidth: 28, textAlign: "center" }}>#{i + 1}</span>}
                          <span style={{ color: T.ink, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nome}</span>
                        </div>
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span style={{ color: i === 0 ? "#065f46" : T.green, fontSize: 14, fontWeight: 900, ...numStyle }}>{v.instaladas} inst.</span>
                          {v.aguardando > 0 && <span style={{ color: GRUPO_META.AGUARDANDO_INST.cor, fontSize: 10.5, fontWeight: 800 }}>+{v.aguardando} aguard.</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>📡</span> Operadoras</h3>
            <p style={{ color: T.sub, fontSize: 12, margin: "0 0 16px" }}>{periodoLabel[periodo]}</p>
            {operadorasData.length === 0 ? (
              <p style={{ color: T.faint, fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>Sem dados no período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={operadorasData} innerRadius={42} outerRadius={66} paddingAngle={2} dataKey="value">
                      {operadorasData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {operadorasData.slice(0, 5).map((op) => (
                    <div key={op.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: op.color, flexShrink: 0 }} />
                        <span style={{ color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{op.name}</span>
                      </div>
                      <span style={{ color: T.ink, fontWeight: 900, ...numStyle }}>{op.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>🎯</span> Funil por vendedor</h3>
          <p style={{ color: T.sub, fontSize: 12, margin: "0 0 16px" }}>Quantidade por status · {periodoLabel[periodo]}</p>
          {funilVendedores.length === 0 ? (
            <p style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Sem propostas no período.</p>
          ) : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {funilVendedores.map((v, i) => (
                <div key={`${v.vendedor}-${i}`} style={{ background: T.soft, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ color: T.ink, fontSize: 13, fontWeight: 800, margin: "0 0 10px" }}>{v.vendedor}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(["INSTALADA", "AGUARDANDO_INST", "PENDENTE", "CANCELADA"] as Grupo[]).map((g) => (
                      <div key={g} style={{ background: GRUPO_META[g].bg, border: `1px solid ${GRUPO_META[g].cor}25`, borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ color: T.sub, fontSize: 10, margin: 0, fontWeight: 700 }}>{GRUPO_META[g].label}</p>
                        <p style={{ color: GRUPO_META[g].cor, fontSize: 18, fontWeight: 900, margin: "2px 0 0", ...numStyle }}>{(v as any)[g] || 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflow: "auto", border: `1px solid ${T.line}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.soft }}>
                    {["Vendedor", "✅ Inst.", "🔧 Aguard.", "🪪 Biometria", "⏳ Pendentes", "🔍 Auditoria", "❌ Cancel."].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", color: T.sub, fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800, borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funilVendedores.map((v, i) => (
                    <tr key={`${v.vendedor}-${i}`} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "12px 14px", color: T.ink, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{v.vendedor}</td>
                      {(["INSTALADA", "AGUARDANDO_INST", "BIOMETRIA", "PENDENTE", "AUDITORIA", "CANCELADA"] as Grupo[]).map((g) => (
                        <td key={g} style={{ padding: "12px 14px" }}>
                          <span style={{ background: GRUPO_META[g].bg, color: GRUPO_META[g].cor, border: `1px solid ${GRUPO_META[g].cor}35`, fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 800, display: "inline-block", minWidth: 32, textAlign: "center", ...numStyle }}>
                            {(v as any)[g] || 0}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.35fr 1fr", gap: isMobile ? 14 : 18 }}>
          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>💰</span> Receita · últimos 30 dias</h3>
            <p style={{ color: T.sub, fontSize: 12, margin: "0 0 16px" }}>Somente vendas instaladas</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={receitaPorDia} margin={{ top: 5, right: 8, left: -15, bottom: 0 }}>
                <defs><linearGradient id="wolfReceita" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="data" stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} interval={isMobile ? 6 : 3} />
                <YAxis stroke={T.faint} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`} />
                <Tooltip formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Receita"]} contentStyle={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke={T.brand} strokeWidth={2.5} fill="url(#wolfReceita)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
            <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>⚡</span> Atividade recente</h3>
            <p style={{ color: T.sub, fontSize: 12, margin: "0 0 14px" }}>Últimas propostas registradas</p>
            {atividadeRecente.length === 0 ? (
              <p style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Sem atividade recente.</p>
            ) : (
              atividadeRecente.map((p, i) => {
                const grupo = grupoDe(p.status_venda);
                const cor = GRUPO_META[grupo].cor;
                const horas = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
                const label = horas < 1 ? `${Math.max(0, Math.floor(horas * 60))} min atrás` : horas < 24 ? `${Math.floor(horas)}h atrás` : `${Math.floor(horas / 24)}d atrás`;

                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < atividadeRecente.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: T.ink, fontSize: 12.5, margin: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome || "Sem nome"}</p>
                      <p style={{ color: T.faint, fontSize: 11, margin: "2px 0 0" }}>{nomeVendedor(p.vendedor)} · {p.operadora || "sem operadora"}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ color: cor, fontSize: 11, margin: 0, fontWeight: 800 }}>{GRUPO_META[grupo].label}</p>
                      <p style={{ color: T.faint, fontSize: 10, margin: "1px 0 0" }}>{label}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="fu" style={{ ...surface, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ color: T.ink, fontSize: 15, fontWeight: 900, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><span>📋</span> Todos os status</h3>
          <p style={{ color: T.sub, fontSize: 12, margin: "0 0 16px" }}>Contagem completa · {periodoLabel[periodo]}</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 10 }}>
            {(Object.keys(GRUPO_META) as Grupo[]).map((g) => (
              <div key={g} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: GRUPO_META[g].bg, border: `1px solid ${GRUPO_META[g].cor}25` }}>
                <span style={{ fontSize: 20 }}>{GRUPO_META[g].icone}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#475569", fontSize: 11.5, margin: 0, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{GRUPO_META[g].label}</p>
                  <p style={{ color: GRUPO_META[g].cor, fontSize: 22, fontWeight: 900, margin: "1px 0 0", ...numStyle }}>{(stats.grupos[g] || 0).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "4px 0 12px", fontSize: 11, color: T.faint, letterSpacing: 0.3 }}>
          Atualizado em {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Wolf System
        </div>
      </div>
    </div>
  );
}
