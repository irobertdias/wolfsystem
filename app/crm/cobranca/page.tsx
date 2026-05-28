"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { useEquipeFiltro } from "../../hooks/useEquipeFiltro";

// ═══════════════════════════════════════════════════════════════════════════
// 💰 COBRANÇA — Sistema integrado ao CRM + Importação de planilha
// ───────────────────────────────────────────────────────────────────────────
// Duas fontes de cobrança:
//   • "Do CRM"     → puxa clientes com status_venda = INSTALADA, filtra
//                    por vencimento (hoje / 7d / atrasados / todos).
//   • "Da planilha" → upload CSV/XLSX. Mapeia colunas (Nome, Telefone,
//                    Valor, Vencimento, Plano) e dispara em massa.
//
// Disparo passa pelo backend wolf-cobranca (rota /api/cobranca?rota=...).
// Enquanto backend não existe, mostra toast amigável sem quebrar UI.
// ═══════════════════════════════════════════════════════════════════════════

// ─── TIPOS ─────────────────────────────────────────────────────────────────
type Proposta = {
  id: number;
  workspace_id: string;
  nome?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  telefone3?: string | null;
  plano?: string | null;
  valor_plano?: number | null;
  vencimento?: string | null;       // dia do mês ("5", "10", "15"…)
  forma_pagamento?: string | null;
  status_venda?: string | null;
  data_instalacao?: string | null;
  operadora?: string | null;
  created_at: string;
};

type Canal = { id: number; nome: string; tipo: string; status: string; waba_id?: string };
type Template = {
  id: number; canal_id: number; meta_template_name: string; nome_amigavel: string;
  categoria: string; idioma: string; status: string; componentes: any[];
};
type Campanha = {
  id: number; workspace_id: string; nome: string; criado_por: string;
  status: string; modo: string; total_contatos: number; total_enviados: number;
  total_falhas: number; created_at: string; finalizado_em?: string;
};

type AbaKey = "do_crm" | "planilha" | "campanhas";
type FiltroVenc = "todos" | "hoje" | "vencendo_7d" | "vencidos" | "este_mes";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatBRLCompacto = (v: number): string => {
  v = v || 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return formatBRL(v);
};

// Calcula a próxima ocorrência do vencimento (dia do mês) a partir de hoje.
// Retorna { data: Date, diasRestantes: number, status: "hoje"|"vencendo"|"atrasado"|"futuro" }
const calcularVencimento = (diaStr: string | null | undefined) => {
  if (!diaStr) return null;
  const dia = parseInt(String(diaStr).replace(/\D/g, ""), 10);
  if (isNaN(dia) || dia < 1 || dia > 31) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diaHoje = hoje.getDate();
  let venc: Date;
  if (dia >= diaHoje) {
    // Vence ainda neste mês
    venc = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  } else {
    // Já passou → última ocorrência foi mês passado, próxima é mês que vem.
    // Pra fins de "atrasado", usa o mês passado como referência.
    venc = new Date(hoje.getFullYear(), hoje.getMonth() - 1, dia);
  }
  const diasRest = Math.round((venc.getTime() - hoje.getTime()) / 86400000);
  let status: "hoje" | "vencendo" | "atrasado" | "futuro";
  if (diasRest === 0) status = "hoje";
  else if (diasRest < 0) status = "atrasado";
  else if (diasRest <= 7) status = "vencendo";
  else status = "futuro";
  return { data: venc, diasRestantes: diasRest, status };
};

const formatDiasVencimento = (info: ReturnType<typeof calcularVencimento>) => {
  if (!info) return "—";
  if (info.status === "hoje") return "⏰ Vence hoje";
  if (info.status === "atrasado") return `🔴 Vencido há ${Math.abs(info.diasRestantes)}d`;
  if (info.status === "vencendo") return `🟡 Em ${info.diasRestantes}d`;
  return `🟢 Em ${info.diasRestantes}d`;
};

const corDoStatusVenc = (s: ReturnType<typeof calcularVencimento>) => {
  if (!s) return "#9ca3af";
  if (s.status === "atrasado") return "#dc2626";
  if (s.status === "hoje") return "#ea580c";
  if (s.status === "vencendo") return "#f59e0b";
  return "#16a34a";
};

const normalizarTelefone = (t: string | null | undefined): string => {
  if (!t) return "";
  return String(t).replace(/\D/g, "");
};

// Substitui {{var}} no template pelos valores
const substituirVars = (texto: string, vars: Record<string, string>): string => {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
};

// ─── ESTILOS ───────────────────────────────────────────────────────────────
const cardStyle = {
  background: "#ffffff",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};
const inputStyle = {
  background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
  padding: "9px 12px", color: "#1f2937", fontSize: 13, outline: "none",
  width: "100%", boxSizing: "border-box" as const,
};
const labelStyle = {
  color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
  letterSpacing: 0.5, display: "block", marginBottom: 6,
};
const btnPrimario = {
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px",
  fontSize: 13, cursor: "pointer", fontWeight: 700,
  boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
};
const btnSecundario = {
  background: "#ffffff", color: "#374151", border: "1px solid #e5e7eb",
  borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600,
};

// Campos canônicos da planilha pra mapear
const CAMPOS_PLANILHA = [
  { key: "telefone", label: "📱 Telefone (obrigatório)", obrigatorio: true },
  { key: "nome",     label: "👤 Nome do cliente",         obrigatorio: false },
  { key: "valor",    label: "💰 Valor da fatura",         obrigatorio: false },
  { key: "vencimento", label: "📅 Vencimento",            obrigatorio: false },
  { key: "plano",    label: "📦 Plano / produto",         obrigatorio: false },
  { key: "codigo",   label: "🔖 Código / identificador",  obrigatorio: false },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function CobrancaPage() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const { equipeId, EquipeSelector } = useEquipeFiltro(wsId);

  // Acesso restrito a dono + admin (ajuste se quiser permissão própria depois)
  const podeAcessar = isDono || isSuperAdmin || (permissoes as any)?.cobranca;

  // ─── ESTADO GERAL ───────────────────────────────────────────────────────
  const [aba, setAba] = useState<AbaKey>("do_crm");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Dados
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);

  // ─── ABA "DO CRM" ───────────────────────────────────────────────────────
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc>("vencendo_7d");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [selecionadosCrm, setSelecionadosCrm] = useState<Set<number>>(new Set());

  // ─── ABA "PLANILHA" ─────────────────────────────────────────────────────
  const [planilhaLinhas, setPlanilhaLinhas] = useState<any[][]>([]);   // primeira linha = cabeçalho
  const [planilhaNomeArquivo, setPlanilhaNomeArquivo] = useState("");
  const [mapeamento, setMapeamento] = useState<Record<string, number>>({}); // {campoCanonico: indiceColuna}
  const [primeiraLinhaCabecalho, setPrimeiraLinhaCabecalho] = useState(true);
  const [selecionadosPlanilha, setSelecionadosPlanilha] = useState<Set<number>>(new Set());
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // ─── MODAL DE ENVIO ─────────────────────────────────────────────────────
  const [showEnvio, setShowEnvio] = useState(false);
  const [envioFonte, setEnvioFonte] = useState<"crm" | "planilha">("crm");
  const [envioContatos, setEnvioContatos] = useState<{ nome: string; telefone: string; vars: Record<string, string> }[]>([]);
  const [envioCanalId, setEnvioCanalId] = useState<number | null>(null);
  const [envioTipo, setEnvioTipo] = useState<"webjs" | "waba">("webjs");
  const [envioTemplateId, setEnvioTemplateId] = useState<number | null>(null);
  const [envioMensagem, setEnvioMensagem] = useState(
    "Olá {{nome}}! 👋\n\nLembrete: sua fatura de {{plano}} no valor de {{valor}} vence dia {{vencimento}}.\n\nPara evitar atrasos, faça o pagamento até o vencimento.\n\nQualquer dúvida, estou à disposição!"
  );
  const [envioNomeCampanha, setEnvioNomeCampanha] = useState("");
  const [envioDelayMin, setEnvioDelayMin] = useState(30);
  const [envioDelayMax, setEnvioDelayMax] = useState(60);
  const [envioEnviando, setEnvioEnviando] = useState(false);

  // ─── FEEDBACK MODAL ─────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{
    tipo: "erro" | "aviso" | "sucesso" | "info";
    titulo: string; mensagem: string; detalhes?: string[];
  } | null>(null);

  // ─── INIT ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!wsId) return;
    fetchTudo();

    const ch = supabase.channel("cobranca_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta", filter: `workspace_id=eq.${wsId}` }, () => fetchPropostas())
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes", filter: `workspace_id=eq.${wsId}` }, () => fetchCanais())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId]);

  async function fetchTudo() {
    setLoading(true);
    await Promise.all([fetchPropostas(), fetchCanais(), fetchTemplates(), fetchCampanhas()]);
    setLoading(false);
  }

  async function fetchPropostas() {
    if (!wsId) return;
    const { data } = await supabase
      .from("proposta")
      .select("id, workspace_id, nome, telefone1, telefone2, telefone3, plano, valor_plano, vencimento, forma_pagamento, status_venda, data_instalacao, operadora, created_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setPropostas(data || []);
  }

  async function fetchCanais() {
    if (!wsId) return;
    const { data } = await supabase
      .from("conexoes")
      .select("id, nome, tipo, status, waba_id")
      .eq("workspace_id", wsId);
    setCanais(data || []);
    // pré-seleciona o primeiro canal pronto
    const primeiro = (data || []).find(c => c.status === "conectado" || c.status === "pronto");
    if (primeiro && !envioCanalId) setEnvioCanalId(primeiro.id);
  }

  async function fetchTemplates() {
    if (!wsId) return;
    const { data } = await supabase
      .from("templates_waba")
      .select("id, canal_id, meta_template_name, nome_amigavel, categoria, idioma, status, componentes")
      .eq("workspace_id", wsId)
      .eq("status", "aprovado");
    setTemplates(data || []);
  }

  async function fetchCampanhas() {
    if (!wsId) return;
    // Tabela `cobrancas_campanhas` será criada quando o backend wolf-cobranca subir.
    // Por enquanto tenta puxar e ignora erro silenciosamente.
    try {
      const { data, error } = await supabase
        .from("cobrancas_campanhas")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error) setCampanhas(data || []);
    } catch { /* tabela ainda não existe */ }
  }

  // ─── DADOS DERIVADOS — INSTALADOS COM VENCIMENTO ────────────────────────
  const instalados = useMemo(() => {
    return propostas
      .filter(p => (p.status_venda || "").toUpperCase() === "INSTALADA")
      .map(p => {
        const venc = calcularVencimento(p.vencimento);
        return { ...p, vencInfo: venc };
      });
  }, [propostas]);

  // Filtrados pela seleção atual do CRM
  const instaladosFiltrados = useMemo(() => {
    let arr = instalados;

    if (filtroVenc !== "todos") {
      arr = arr.filter(p => {
        if (!p.vencInfo) return false;
        if (filtroVenc === "hoje") return p.vencInfo.status === "hoje";
        if (filtroVenc === "vencendo_7d") return p.vencInfo.status === "hoje" || p.vencInfo.status === "vencendo";
        if (filtroVenc === "vencidos") return p.vencInfo.status === "atrasado";
        if (filtroVenc === "este_mes") {
          const hoje = new Date();
          return p.vencInfo.data.getMonth() === hoje.getMonth() && p.vencInfo.data.getFullYear() === hoje.getFullYear();
        }
        return true;
      });
    }

    if (filtroBusca) {
      const b = filtroBusca.toLowerCase();
      arr = arr.filter(p =>
        (p.nome || "").toLowerCase().includes(b) ||
        (p.telefone1 || "").includes(b) ||
        (p.plano || "").toLowerCase().includes(b)
      );
    }

    // Ordena: atrasado → hoje → vencendo → futuro
    const peso = { atrasado: 0, hoje: 1, vencendo: 2, futuro: 3 };
    return [...arr].sort((a, b) => {
      const pa = a.vencInfo ? peso[a.vencInfo.status] : 99;
      const pb = b.vencInfo ? peso[b.vencInfo.status] : 99;
      if (pa !== pb) return pa - pb;
      return (a.vencInfo?.diasRestantes || 0) - (b.vencInfo?.diasRestantes || 0);
    });
  }, [instalados, filtroVenc, filtroBusca]);

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let receitaMes = 0, vencendo = 0, vencidos = 0, totalInst = 0, valorVencendo = 0, valorVencidos = 0;
    for (const p of instalados) {
      totalInst++;
      receitaMes += p.valor_plano || 0;
      if (!p.vencInfo) continue;
      if (p.vencInfo.status === "hoje" || p.vencInfo.status === "vencendo") {
        vencendo++;
        valorVencendo += p.valor_plano || 0;
      }
      if (p.vencInfo.status === "atrasado") {
        vencidos++;
        valorVencidos += p.valor_plano || 0;
      }
    }
    return { receitaMes, vencendo, vencidos, totalInst, valorVencendo, valorVencidos };
  }, [instalados]);

  // ─── SELEÇÃO ────────────────────────────────────────────────────────────
  const toggleSelCrm = (id: number) => {
    setSelecionadosCrm(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };
  const selecionarTodosCrm = () => {
    setSelecionadosCrm(prev => {
      if (prev.size === instaladosFiltrados.length) return new Set();
      return new Set(instaladosFiltrados.map(p => p.id));
    });
  };

  // ─── UPLOAD DE PLANILHA ────────────────────────────────────────────────
  const onArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPlanilhaNomeArquivo(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" });
        if (!rows || rows.length === 0) {
          setFeedback({ tipo: "aviso", titulo: "Planilha vazia", mensagem: "Não consegui ler nenhuma linha do arquivo." });
          return;
        }
        setPlanilhaLinhas(rows);
        setSelecionadosPlanilha(new Set());
        // Auto-mapeamento por palavras-chave no cabeçalho
        const cabec = (rows[0] || []).map((c: any) => String(c || "").toLowerCase().trim());
        const novoMap: Record<string, number> = {};
        const padroes = {
          telefone: ["telefone", "celular", "fone", "whatsapp", "numero", "número", "tel", "phone"],
          nome:     ["nome", "cliente", "name", "contato"],
          valor:    ["valor", "preço", "preco", "value", "fatura", "boleto", "amount", "total"],
          vencimento: ["vencimento", "vence", "due", "data", "dia"],
          plano:    ["plano", "produto", "servico", "serviço", "pacote"],
          codigo:   ["codigo", "código", "id", "ref", "referencia", "referência"],
        };
        for (const [campo, palavras] of Object.entries(padroes)) {
          const idx = cabec.findIndex(c => palavras.some(p => c.includes(p)));
          if (idx >= 0) novoMap[campo] = idx;
        }
        setMapeamento(novoMap);
      } catch (err: any) {
        setFeedback({ tipo: "erro", titulo: "Não consegui ler o arquivo", mensagem: err?.message || "Verifique se o arquivo é .csv, .xlsx ou .xls válido." });
      }
    };
    reader.readAsArrayBuffer(f);
    // Limpa o input pra permitir re-upload do mesmo arquivo
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  };

  // Linhas de dados (sem cabeçalho)
  const planilhaDados = useMemo(() => {
    if (planilhaLinhas.length === 0) return [];
    return primeiraLinhaCabecalho ? planilhaLinhas.slice(1) : planilhaLinhas;
  }, [planilhaLinhas, primeiraLinhaCabecalho]);

  // Cabeçalho original (pra dropdowns de mapeamento)
  const cabecalhoColunas = useMemo(() => {
    if (planilhaLinhas.length === 0) return [];
    if (primeiraLinhaCabecalho) return (planilhaLinhas[0] || []).map((c: any) => String(c || "").trim() || "(vazio)");
    // Sem cabeçalho: gera "Coluna A", "Coluna B"...
    const n = (planilhaLinhas[0] || []).length;
    return Array.from({ length: n }, (_, i) => `Coluna ${String.fromCharCode(65 + i)}`);
  }, [planilhaLinhas, primeiraLinhaCabecalho]);

  // Linhas mapeadas (objeto canônico)
  const linhasMapeadas = useMemo(() => {
    return planilhaDados.map(linha => {
      const obj: Record<string, string> = {};
      for (const campo of CAMPOS_PLANILHA) {
        const idx = mapeamento[campo.key];
        obj[campo.key] = idx !== undefined ? String(linha[idx] || "").trim() : "";
      }
      return obj;
    });
  }, [planilhaDados, mapeamento]);

  // Validação: linhas válidas têm pelo menos telefone com 10+ dígitos
  const linhasValidas = useMemo(() => {
    return linhasMapeadas.filter(l => normalizarTelefone(l.telefone).length >= 10);
  }, [linhasMapeadas]);

  const toggleSelPlanilha = (idx: number) => {
    setSelecionadosPlanilha(prev => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx); else novo.add(idx);
      return novo;
    });
  };
  const selecionarTodosPlanilha = () => {
    setSelecionadosPlanilha(prev => {
      if (prev.size === linhasValidas.length) return new Set();
      return new Set(linhasValidas.map((_, i) => i));
    });
  };

  // ─── ABRIR MODAL DE ENVIO ──────────────────────────────────────────────
  const abrirEnvioCrm = () => {
    if (selecionadosCrm.size === 0) {
      setFeedback({ tipo: "aviso", titulo: "Nenhum cliente selecionado", mensagem: "Marque os clientes que vc quer cobrar pra continuar." });
      return;
    }
    const contatos = instaladosFiltrados
      .filter(p => selecionadosCrm.has(p.id))
      .map(p => {
        const tel = normalizarTelefone(p.telefone1) || normalizarTelefone(p.telefone2) || normalizarTelefone(p.telefone3);
        return {
          nome: p.nome || "Cliente",
          telefone: tel,
          vars: {
            nome: p.nome || "Cliente",
            telefone: tel,
            plano: p.plano || "",
            valor: p.valor_plano ? formatBRL(p.valor_plano) : "",
            vencimento: p.vencimento || "",
            operadora: p.operadora || "",
          },
        };
      })
      .filter(c => c.telefone.length >= 10);

    if (contatos.length === 0) {
      setFeedback({ tipo: "aviso", titulo: "Nenhum telefone válido", mensagem: "Nenhum dos clientes selecionados tem telefone válido (10+ dígitos)." });
      return;
    }
    setEnvioFonte("crm");
    setEnvioContatos(contatos);
    setEnvioNomeCampanha(`Cobrança CRM ${new Date().toLocaleDateString("pt-BR")} (${contatos.length} contatos)`);
    setShowEnvio(true);
  };

  const abrirEnvioPlanilha = () => {
    const idsParaEnvio = selecionadosPlanilha.size > 0
      ? linhasValidas.filter((_, i) => selecionadosPlanilha.has(i))
      : linhasValidas;

    if (idsParaEnvio.length === 0) {
      setFeedback({ tipo: "aviso", titulo: "Nenhuma linha válida", mensagem: "Faça o mapeamento de pelo menos a coluna Telefone, ou selecione linhas com telefone válido." });
      return;
    }

    const contatos = idsParaEnvio.map(l => ({
      nome: l.nome || "Cliente",
      telefone: normalizarTelefone(l.telefone),
      vars: {
        nome: l.nome || "Cliente",
        telefone: normalizarTelefone(l.telefone),
        plano: l.plano || "",
        valor: l.valor || "",
        vencimento: l.vencimento || "",
        codigo: l.codigo || "",
      },
    }));

    setEnvioFonte("planilha");
    setEnvioContatos(contatos);
    setEnvioNomeCampanha(`Cobrança planilha ${planilhaNomeArquivo || ""} (${contatos.length} contatos)`);
    setShowEnvio(true);
  };

  // ─── DISPARAR ───────────────────────────────────────────────────────────
  const dispararCobranca = async () => {
    if (!envioCanalId) {
      setFeedback({ tipo: "aviso", titulo: "Selecione um canal", mensagem: "Escolha qual WhatsApp vai disparar a cobrança." });
      return;
    }
    if (envioTipo === "webjs" && !envioMensagem.trim()) {
      setFeedback({ tipo: "aviso", titulo: "Mensagem vazia", mensagem: "Escreva a mensagem de cobrança." });
      return;
    }
    if (envioTipo === "waba" && !envioTemplateId) {
      setFeedback({ tipo: "aviso", titulo: "Template não selecionado", mensagem: "Escolha um template WABA aprovado." });
      return;
    }

    setEnvioEnviando(true);
    try {
      const resp = await fetch("/api/cobranca?rota=campanhas/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: wsId,
          canalId: envioCanalId,
          criadoPor: user?.email,
          nome: envioNomeCampanha,
          modo: envioFonte,
          tipo: envioTipo,
          mensagem: envioTipo === "webjs" ? envioMensagem : undefined,
          templateId: envioTipo === "waba" ? envioTemplateId : undefined,
          contatos: envioContatos,
          delayMinSeg: envioDelayMin,
          delayMaxSeg: envioDelayMax,
        }),
      });

      // Se backend ainda não existe (404 ou similar), mostra mensagem amigável
      if (resp.status === 404 || resp.status === 502) {
        setFeedback({
          tipo: "info",
          titulo: "Backend de cobrança ainda não está no ar",
          mensagem: "A tela já tá pronta, mas o servidor wolf-cobranca ainda não foi configurado. Suba o backend e tenta de novo — a campanha já está montada e pronta pra disparar.",
          detalhes: [
            `Canal: ${canais.find(c => c.id === envioCanalId)?.nome || "?"}`,
            `Tipo: ${envioTipo === "waba" ? "WABA (template)" : "WebJS (texto livre)"}`,
            `Contatos: ${envioContatos.length}`,
            `Delay: ${envioDelayMin}-${envioDelayMax}s entre envios`,
          ],
        });
        setEnvioEnviando(false);
        return;
      }

      const data = await resp.json();
      if (data.success) {
        setShowEnvio(false);
        setSelecionadosCrm(new Set());
        setSelecionadosPlanilha(new Set());
        setFeedback({
          tipo: "sucesso",
          titulo: "Cobrança disparada!",
          mensagem: `Campanha "${envioNomeCampanha}" criada com ${envioContatos.length} contatos. Acompanhe na aba Campanhas.`,
        });
        await fetchCampanhas();
        setAba("campanhas");
      } else {
        setFeedback({ tipo: "erro", titulo: "Erro ao disparar", mensagem: data.error || "Erro desconhecido." });
      }
    } catch (e: any) {
      setFeedback({
        tipo: "info",
        titulo: "Backend de cobrança ainda não está no ar",
        mensagem: "A tela tá pronta, mas falta subir o servidor wolf-cobranca. Quando subir, é só clicar de novo.",
        detalhes: [`Detalhe técnico: ${e?.message || "fetch falhou"}`],
      });
    }
    setEnvioEnviando(false);
  };

  // Preview da mensagem com vars do primeiro contato
  const previewMensagem = useMemo(() => {
    if (envioContatos.length === 0) return envioMensagem;
    return substituirVars(envioMensagem, envioContatos[0].vars);
  }, [envioMensagem, envioContatos]);

  // ═══════════════════════════════════════════════════════════════════════
  // 🚫 ACESSO RESTRITO
  // ═══════════════════════════════════════════════════════════════════════
  if (!podeAcessar) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 16px", boxShadow: "0 12px 24px rgba(220,38,38,0.25)" }}>🔒</div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Vc não tem permissão pra ver o módulo de Cobrança.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: isMobile ? 14 : 24, background: "#f8fafc", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* HEADER */}
      <div style={{ ...cardStyle, padding: isMobile ? 16 : 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>💰</div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 17 : 20, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>Cobrança</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>Cobre direto do CRM ou suba uma planilha de números.</p>
          </div>
        </div>
        <EquipeSelector />
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
        <KPI cor="#16a34a" bg="#f0fdf4" icone="💵" label="A receber (mês)" valor={formatBRLCompacto(kpis.receitaMes)} sub={`${kpis.totalInst} instalados`} isMobile={isMobile} />
        <KPI cor="#f59e0b" bg="#fffbeb" icone="🟡" label="Vencendo (7d)" valor={formatNum(kpis.vencendo)} sub={`${formatBRLCompacto(kpis.valorVencendo)} em jogo`} isMobile={isMobile} />
        <KPI cor="#dc2626" bg="#fef2f2" icone="🔴" label="Vencidos" valor={formatNum(kpis.vencidos)} sub={`${formatBRLCompacto(kpis.valorVencidos)} atrasado`} isMobile={isMobile} />
        <KPI cor="#3b82f6" bg="#eff6ff" icone="📤" label="Campanhas" valor={formatNum(campanhas.length)} sub="Histórico de envios" isMobile={isMobile} />
      </div>

      {/* TABS */}
      <div style={{ ...cardStyle, padding: 6, display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {([
          { key: "do_crm",    label: "📅 Do CRM",   color: "#dc2626" },
          { key: "planilha",  label: "📤 Planilha", color: "#a855f7" },
          { key: "campanhas", label: "📊 Campanhas", color: "#3b82f6" },
        ] as { key: AbaKey; label: string; color: string }[]).map(t => {
          const at = aba === t.key;
          return (
            <button key={t.key} onClick={() => setAba(t.key)}
              style={{ background: at ? `linear-gradient(135deg, ${t.color} 0%, ${t.color}dd 100%)` : "transparent", color: at ? "white" : "#6b7280", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: at ? `0 4px 12px ${t.color}40` : "none", whiteSpace: "nowrap", flexShrink: 0 }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280" }}>Carregando...</div>
      ) : (
        <>
          {/* ════════════ ABA: DO CRM ════════════ */}
          {aba === "do_crm" && (
            <>
              {/* Filtros */}
              <div style={{ ...cardStyle, padding: isMobile ? 12 : 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {([
                  { k: "vencendo_7d", l: "🟡 Próximos 7 dias", cor: "#f59e0b" },
                  { k: "hoje",        l: "⏰ Vencendo hoje",    cor: "#ea580c" },
                  { k: "vencidos",    l: "🔴 Vencidos",         cor: "#dc2626" },
                  { k: "este_mes",    l: "📅 Este mês",         cor: "#3b82f6" },
                  { k: "todos",       l: "🌐 Todos",            cor: "#6b7280" },
                ] as { k: FiltroVenc; l: string; cor: string }[]).map(f => {
                  const at = filtroVenc === f.k;
                  return (
                    <button key={f.k} onClick={() => { setFiltroVenc(f.k); setSelecionadosCrm(new Set()); }}
                      style={{ background: at ? `${f.cor}15` : "#ffffff", color: at ? f.cor : "#6b7280", border: `1px solid ${at ? f.cor : "#e5e7eb"}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: at ? 700 : 600, whiteSpace: "nowrap" }}>
                      {f.l}
                    </button>
                  );
                })}
                <input value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} placeholder="🔍 Buscar nome/telefone/plano..."
                  style={{ ...inputStyle, flex: 1, minWidth: 180, padding: "7px 12px" }} />
              </div>

              {/* Lista */}
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>
                    {instaladosFiltrados.length} cliente(s) · {selecionadosCrm.size} selecionado(s)
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={selecionarTodosCrm} style={btnSecundario}>
                      {selecionadosCrm.size === instaladosFiltrados.length && instaladosFiltrados.length > 0 ? "✗ Desmarcar todos" : "✓ Selecionar todos"}
                    </button>
                    <button onClick={abrirEnvioCrm} disabled={selecionadosCrm.size === 0} style={{ ...btnPrimario, opacity: selecionadosCrm.size === 0 ? 0.5 : 1, cursor: selecionadosCrm.size === 0 ? "not-allowed" : "pointer" }}>
                      📤 Cobrar {selecionadosCrm.size} cliente(s)
                    </button>
                  </div>
                </div>

                {instaladosFiltrados.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", padding: 32, textAlign: "center" }}>Nenhum cliente nessa categoria.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 760 : "auto" }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          <th style={{ width: 36, padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}></th>
                          {["Cliente", "Telefone", "Plano", "Valor", "Vencimento", "Status"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {instaladosFiltrados.map((p, i) => {
                          const sel = selecionadosCrm.has(p.id);
                          const cor = corDoStatusVenc(p.vencInfo);
                          return (
                            <tr key={p.id} onClick={() => toggleSelCrm(p.id)}
                              style={{ borderTop: "1px solid #f3f4f6", background: sel ? "#fef2f2" : (i % 2 === 0 ? "#ffffff" : "#fafbfc"), cursor: "pointer" }}>
                              <td style={{ padding: "12px", textAlign: "center" }}>
                                <input type="checkbox" checked={sel} onChange={() => toggleSelCrm(p.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", width: 16, height: 16 }} />
                              </td>
                              <td style={{ padding: "12px", color: "#1f2937", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome || "—"}</td>
                              <td style={{ padding: "12px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap", fontFamily: "monospace" }}>{p.telefone1 || "—"}</td>
                              <td style={{ padding: "12px", color: "#374151", fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.plano || "—"}</td>
                              <td style={{ padding: "12px", color: "#16a34a", fontSize: 13, fontWeight: 700 }}>{p.valor_plano ? formatBRL(p.valor_plano) : "—"}</td>
                              <td style={{ padding: "12px", color: "#6b7280", fontSize: 12 }}>Dia {p.vencimento || "—"}</td>
                              <td style={{ padding: "12px" }}>
                                <span style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}33`, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {formatDiasVencimento(p.vencInfo)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════════════ ABA: PLANILHA ════════════ */}
          {aba === "planilha" && (
            <>
              {/* Upload */}
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
                <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>1. Suba sua planilha</h3>
                <input ref={inputArquivoRef} type="file" accept=".csv,.xlsx,.xls" onChange={onArquivoSelecionado} style={{ display: "none" }} />
                <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 24, textAlign: "center", background: "#fafbfc", cursor: "pointer" }} onClick={() => inputArquivoRef.current?.click()}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>📤</div>
                  <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
                    {planilhaNomeArquivo || "Clique pra escolher um arquivo"}
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Aceita .csv, .xlsx, .xls — primeira linha geralmente é o cabeçalho.</p>
                </div>
                {planilhaLinhas.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "#374151", fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={primeiraLinhaCabecalho} onChange={e => setPrimeiraLinhaCabecalho(e.target.checked)} />
                    Primeira linha é o cabeçalho da planilha
                  </label>
                )}
              </div>

              {/* Mapeamento */}
              {planilhaLinhas.length > 0 && (
                <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
                  <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>2. Mapeie as colunas</h3>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 16px" }}>Diga qual coluna da planilha corresponde a cada campo do sistema. Auto-detectei o que pude pelo nome.</p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    {CAMPOS_PLANILHA.map(campo => (
                      <div key={campo.key}>
                        <label style={labelStyle}>{campo.label}{campo.obrigatorio && <span style={{ color: "#dc2626" }}> *</span>}</label>
                        <select
                          value={mapeamento[campo.key] ?? ""}
                          onChange={e => {
                            const v = e.target.value;
                            setMapeamento(prev => {
                              const novo = { ...prev };
                              if (v === "") delete novo[campo.key];
                              else novo[campo.key] = parseInt(v, 10);
                              return novo;
                            });
                          }}
                          style={inputStyle}
                        >
                          <option value="">— Nenhuma —</option>
                          {cabecalhoColunas.map((col, idx) => (
                            <option key={idx} value={idx}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview + Disparo */}
              {planilhaLinhas.length > 0 && (
                <div style={{ ...cardStyle, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>3. Confira e dispare</h3>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>
                        {planilhaDados.length} linha(s) · <b style={{ color: "#16a34a" }}>{linhasValidas.length} válidas</b> (telefone com 10+ dígitos) · {selecionadosPlanilha.size} selecionada(s)
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={selecionarTodosPlanilha} style={btnSecundario}>
                        {selecionadosPlanilha.size === linhasValidas.length && linhasValidas.length > 0 ? "✗ Desmarcar" : "✓ Todos"}
                      </button>
                      <button onClick={abrirEnvioPlanilha} disabled={linhasValidas.length === 0} style={{ ...btnPrimario, opacity: linhasValidas.length === 0 ? 0.5 : 1, cursor: linhasValidas.length === 0 ? "not-allowed" : "pointer" }}>
                        📤 Cobrar {selecionadosPlanilha.size || linhasValidas.length} contato(s)
                      </button>
                    </div>
                  </div>

                  {linhasMapeadas.length === 0 ? (
                    <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", padding: 32, textAlign: "center" }}>Sem dados pra mostrar.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 760 : "auto" }}>
                        <thead>
                          <tr style={{ background: "#f9fafb" }}>
                            <th style={{ width: 36, padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}></th>
                            {["#", "Nome", "Telefone", "Valor", "Vencimento", "Plano", "Válido"].map(h => (
                              <th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {linhasMapeadas.slice(0, 100).map((l, i) => {
                            const tel = normalizarTelefone(l.telefone);
                            const valido = tel.length >= 10;
                            const idxValido = linhasValidas.indexOf(l);
                            const sel = idxValido >= 0 && selecionadosPlanilha.has(idxValido);
                            return (
                              <tr key={i}
                                onClick={() => { if (valido && idxValido >= 0) toggleSelPlanilha(idxValido); }}
                                style={{ borderTop: "1px solid #f3f4f6", background: !valido ? "#fef2f2" : (sel ? "#f0fdf4" : (i % 2 === 0 ? "#ffffff" : "#fafbfc")), cursor: valido ? "pointer" : "default", opacity: valido ? 1 : 0.5 }}>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  {valido && (
                                    <input type="checkbox" checked={sel} onChange={() => toggleSelPlanilha(idxValido)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", width: 16, height: 16 }} />
                                  )}
                                </td>
                                <td style={{ padding: "12px", color: "#9ca3af", fontSize: 11 }}>{i + 1}</td>
                                <td style={{ padding: "12px", color: "#1f2937", fontSize: 12, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome || "—"}</td>
                                <td style={{ padding: "12px", color: "#6b7280", fontSize: 12, fontFamily: "monospace", whiteSpace: "nowrap" }}>{l.telefone || "—"}</td>
                                <td style={{ padding: "12px", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>{l.valor || "—"}</td>
                                <td style={{ padding: "12px", color: "#6b7280", fontSize: 12 }}>{l.vencimento || "—"}</td>
                                <td style={{ padding: "12px", color: "#374151", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.plano || "—"}</td>
                                <td style={{ padding: "12px" }}>
                                  {valido
                                    ? <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>✓ OK</span>
                                    : <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>✗ Sem telefone</span>}
                                </td>
                              </tr>
                            );
                          })}
                          {linhasMapeadas.length > 100 && (
                            <tr><td colSpan={8} style={{ padding: 14, textAlign: "center", color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
                              + {linhasMapeadas.length - 100} linha(s) (mostrando primeiras 100)
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ════════════ ABA: CAMPANHAS ════════════ */}
          {aba === "campanhas" && (
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>Campanhas de cobrança</h3>
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>Histórico das cobranças disparadas. Atualiza em tempo real conforme o backend processa.</p>
              </div>
              {campanhas.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
                  <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Nenhuma campanha ainda</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>
                    Quando o backend <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>wolf-cobranca</code> estiver no ar e vc disparar uma campanha, ela aparece aqui.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Campanha", "Modo", "Status", "Contatos", "Enviados", "Falhas", "Criada"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campanhas.map((c, i) => (
                        <tr key={c.id} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                          <td style={{ padding: "12px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{c.nome}</td>
                          <td style={{ padding: "12px", color: "#6b7280", fontSize: 12 }}>{c.modo === "planilha" ? "📤 Planilha" : "📅 CRM"}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ background: c.status === "concluida" ? "#f0fdf4" : c.status === "rodando" ? "#fffbeb" : "#fef2f2", color: c.status === "concluida" ? "#16a34a" : c.status === "rodando" ? "#f59e0b" : "#dc2626", border: "1px solid", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: "#3b82f6", fontSize: 12, fontWeight: 700 }}>{c.total_contatos}</td>
                          <td style={{ padding: "12px", color: "#16a34a", fontSize: 12, fontWeight: 700 }}>{c.total_enviados}</td>
                          <td style={{ padding: "12px", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{c.total_falhas}</td>
                          <td style={{ padding: "12px", color: "#9ca3af", fontSize: 11 }}>{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════ MODAL DE ENVIO ════════════ */}
      {showEnvio && (
        <div onClick={() => !envioEnviando && setShowEnvio(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 16, maxWidth: 720, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 800, margin: 0 }}>📤 Disparar cobrança</h3>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>{envioContatos.length} contato(s) · fonte: {envioFonte === "crm" ? "📅 CRM" : "📤 Planilha"}</p>
              </div>
              <button onClick={() => setShowEnvio(false)} disabled={envioEnviando} style={{ background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ padding: 22, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Nome da campanha */}
              <div>
                <label style={labelStyle}>Nome da campanha</label>
                <input value={envioNomeCampanha} onChange={e => setEnvioNomeCampanha(e.target.value)} style={inputStyle} placeholder="Ex: Cobrança Janeiro" />
              </div>

              {/* Tipo */}
              <div>
                <label style={labelStyle}>Tipo de envio</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([
                    { v: "webjs", l: "📱 WhatsApp comum (texto livre)" },
                    { v: "waba",  l: "📨 WABA (template aprovado)" },
                  ] as { v: "webjs" | "waba"; l: string }[]).map(o => (
                    <button key={o.v} onClick={() => setEnvioTipo(o.v)}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: envioTipo === o.v ? "2px solid #dc2626" : "1px solid #e5e7eb", background: envioTipo === o.v ? "#fef2f2" : "#ffffff", color: envioTipo === o.v ? "#dc2626" : "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canal */}
              <div>
                <label style={labelStyle}>Canal WhatsApp</label>
                <select value={envioCanalId ?? ""} onChange={e => setEnvioCanalId(e.target.value ? parseInt(e.target.value) : null)} style={inputStyle}>
                  <option value="">Selecione um canal...</option>
                  {canais.filter(c => envioTipo === "waba" ? c.tipo === "waba" : c.tipo !== "waba").map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                  ))}
                </select>
              </div>

              {/* Mensagem WebJS */}
              {envioTipo === "webjs" && (
                <>
                  <div>
                    <label style={labelStyle}>Mensagem (use {`{{nome}}, {{valor}}, {{vencimento}}, {{plano}}`})</label>
                    <textarea value={envioMensagem} onChange={e => setEnvioMensagem(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                  {envioContatos.length > 0 && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
                      <p style={{ color: "#14532d", fontSize: 11, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.4 }}>👁️ Preview (1º contato: {envioContatos[0].nome})</p>
                      <p style={{ color: "#374151", fontSize: 13, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{previewMensagem}</p>
                    </div>
                  )}
                </>
              )}

              {/* Template WABA */}
              {envioTipo === "waba" && (
                <div>
                  <label style={labelStyle}>Template aprovado</label>
                  <select value={envioTemplateId ?? ""} onChange={e => setEnvioTemplateId(e.target.value ? parseInt(e.target.value) : null)} style={inputStyle}>
                    <option value="">Selecione um template...</option>
                    {templates.filter(t => !envioCanalId || t.canal_id === envioCanalId).map(t => (
                      <option key={t.id} value={t.id}>{t.nome_amigavel || t.meta_template_name} ({t.idioma})</option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p style={{ color: "#f59e0b", fontSize: 11, margin: "4px 0 0" }}>⚠️ Nenhum template aprovado. Crie em Chatbot → Templates.</p>
                  )}
                </div>
              )}

              {/* Delay */}
              <div>
                <label style={labelStyle}>Delay entre envios (segundos)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input type="number" min={1} max={300} value={envioDelayMin} onChange={e => setEnvioDelayMin(parseInt(e.target.value) || 30)} style={inputStyle} placeholder="Mínimo" />
                  <input type="number" min={1} max={300} value={envioDelayMax} onChange={e => setEnvioDelayMax(parseInt(e.target.value) || 60)} style={inputStyle} placeholder="Máximo" />
                </div>
                <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>💡 Recomendo 30-60s pra WebJS evitar ban. WABA pode ser mais rápido (1-3s).</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", background: "#fafbfc", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#6b7280", fontSize: 12 }}>Vão ser enviadas {envioContatos.length} mensagens.</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowEnvio(false)} disabled={envioEnviando} style={btnSecundario}>Cancelar</button>
                <button onClick={dispararCobranca} disabled={envioEnviando} style={{ ...btnPrimario, opacity: envioEnviando ? 0.7 : 1, cursor: envioEnviando ? "wait" : "pointer" }}>
                  {envioEnviando ? "⏳ Enviando..." : "🚀 Disparar agora"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL DE FEEDBACK ════════════ */}
      {feedback && (() => {
        const cores = {
          erro:    { bg: "#fef2f2", border: "#fecaca", iconBg: "#fee2e2", icon: "#dc2626", titulo: "#991b1b", botao: "#dc2626", emoji: "⚠️" },
          aviso:   { bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7", icon: "#d97706", titulo: "#92400e", botao: "#d97706", emoji: "🛡️" },
          sucesso: { bg: "#f0fdf4", border: "#bbf7d0", iconBg: "#dcfce7", icon: "#16a34a", titulo: "#14532d", botao: "#16a34a", emoji: "✅" },
          info:    { bg: "#eff6ff", border: "#bfdbfe", iconBg: "#dbeafe", icon: "#2563eb", titulo: "#1e3a8a", botao: "#2563eb", emoji: "ℹ️" },
        }[feedback.tipo];
        return (
          <div onClick={() => setFeedback(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
              <div style={{ background: cores.bg, borderBottom: `1px solid ${cores.border}`, padding: "22px 24px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: cores.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{cores.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ color: cores.titulo, fontSize: 16, fontWeight: 800, margin: "2px 0 6px" }}>{feedback.titulo}</h3>
                  <p style={{ color: "#374151", fontSize: 13, margin: 0, lineHeight: 1.55 }}>{feedback.mensagem}</p>
                </div>
              </div>
              {feedback.detalhes && feedback.detalhes.length > 0 && (
                <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, borderBottom: "1px solid #f3f4f6" }}>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>Detalhes</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {feedback.detalhes.map((d, i) => (
                      <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#374151" }}>{d}</div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ padding: "14px 24px", background: "#fafbfc", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setFeedback(null)} style={{ background: cores.botao, color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: `0 4px 12px ${cores.botao}40` }}>Entendi</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SUBCOMPONENTES ────────────────────────────────────────────────────────
function KPI({ cor, bg, icone, label, valor, sub, isMobile }: {
  cor: string; bg: string; icone: string; label: string; valor: string; sub: string; isMobile: boolean;
}) {
  return (
    <div style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderTop: `3px solid ${cor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icone}</div>
        <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      </div>
      <p style={{ color: cor, fontSize: isMobile ? 19 : 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{valor}</p>
      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>{sub}</p>
    </div>
  );
}

function formatNum(n: number): string {
  return (n || 0).toLocaleString("pt-BR");
}