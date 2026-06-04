"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ⚠️ Só este email tem acesso à tela de clientes
const ADMIN_EMAIL = "robert.dias@live.com";

type Cadastro = {
  id: number; created_at: string; nome: string; empresa: string;
  email: string; whatsapp: string; plano: string; autorizado: boolean;
  username: string; workspace_id?: string;
  usuarios_liberados?: number; conexoes_liberadas?: number;
  permite_webjs?: boolean; permite_waba?: boolean; permite_instagram?: boolean;
  modulo_roleta?: boolean; modulo_disparos_web?: boolean; modulo_disparos_api?: boolean;
  modulo_voip?: boolean; modulo_api_integracao?: boolean; modulo_instagram?: boolean;
  modulo_cobranca?: boolean;
  modulo_equipes?: boolean;
  modulo_funil_avancado?: boolean;
  modulo_rh?: boolean;
  modulo_bater_ponto?: boolean;
  modulo_financeiro?: boolean;
  financeiro_opcoes?: Record<string, boolean> | null;
  ia?: string; senha?: string; user_id?: string;
  // 🆕 CAMPOS DE COBRANÇA
  dia_vencimento?: number | null;
  valor_mensalidade?: number | null;
  proximo_vencimento?: string | null; // 'YYYY-MM-DD'
  status_pagamento?: string | null;   // ativo|pendente|atrasado|bloqueado|suspenso
  ultimo_pagamento_em?: string | null;
  bloqueio_postergado_ate?: string | null; // 🆕 v3 — desbloqueio em confiança até essa data
};

type SubUsuario = {
  id: number; nome: string; email: string; perfil: string;
  fila: string; status: string; grupo_id?: number; workspace_id: string;
};

type Grupo = { id: number; nome: string; };

// 🆕 Type do histórico de pagamentos
type Pagamento = {
  id: number;
  cadastro_id: number;
  mes_referencia: string;
  valor: number;
  data_pagamento: string;
  forma_pagamento: string;
  observacao: string | null;
  marcado_por: string;
  created_at: string;
};

// 💰 Telas do módulo Financeiro (espelha o menu de financeiro/layolt.tsx)
const FIN_GRUPOS: { nome: string; itens: { key: string; label: string; icone: string }[] }[] = [
  { nome: "Visão Geral", itens: [
    { key: "dashboard", label: "Dashboard", icone: "📊" },
    { key: "indicadores", label: "Indicadores", icone: "📈" },
  ]},
  { nome: "Movimentações", itens: [
    { key: "contas_receber", label: "Contas a Receber", icone: "📥" },
    { key: "contas_pagar", label: "Contas a Pagar", icone: "📤" },
    { key: "caixa", label: "Lançamentos / Caixa", icone: "💵" },
    { key: "transferencias", label: "Transferências", icone: "🔄" },
  ]},
  { nome: "Bancos", itens: [
    { key: "contas_bancarias", label: "Contas bancárias", icone: "🏦" },
    { key: "conciliacao", label: "Conciliação", icone: "🔁" },
    { key: "extrato", label: "Importar extrato (OFX)", icone: "📑" },
    { key: "integracao_banco", label: "Integração bancária", icone: "🔌" },
  ]},
  { nome: "Notas & Documentos", itens: [
    { key: "emitir_nota", label: "Emitir NF-e", icone: "🧾" },
    { key: "notas_recebidas", label: "Notas recebidas", icone: "📨" },
    { key: "boletos", label: "Boletos", icone: "🎫" },
  ]},
  { nome: "Cadastros", itens: [
    { key: "plano_contas", label: "Plano de Contas", icone: "🏷️" },
    { key: "centros_custo", label: "Centros de Custo", icone: "🎯" },
    { key: "contatos", label: "Clientes / Fornecedores", icone: "🧑‍🤝‍🧑" },
    { key: "formas_pagamento", label: "Formas de Pagamento", icone: "💳" },
  ]},
  { nome: "Relatórios", itens: [
    { key: "dre", label: "DRE", icone: "📈" },
    { key: "fluxo_caixa", label: "Fluxo de Caixa", icone: "🌊" },
    { key: "relatorios", label: "Relatórios", icone: "📊" },
  ]},
  { nome: "Configurações", itens: [
    { key: "config", label: "Configurações", icone: "⚙️" },
  ]},
];
const FIN_OPCOES_KEYS = FIN_GRUPOS.flatMap((g) => g.itens.map((i) => i.key));
const todasFinOpcoes = (v: boolean): Record<string, boolean> => FIN_OPCOES_KEYS.reduce((a, k) => { a[k] = v; return a; }, {} as Record<string, boolean>);

const planoPresets: Record<string, {
  usuarios: number; conexoes: number;
  webjs: boolean; waba: boolean; instagram: boolean;
  modulo_roleta: boolean; modulo_disparos_web: boolean; modulo_disparos_api: boolean;
  modulo_voip: boolean; modulo_api_integracao: boolean; modulo_instagram: boolean;
  modulo_cobranca: boolean; modulo_equipes: boolean; modulo_funil_avancado: boolean;
  modulo_rh: boolean; modulo_bater_ponto: boolean;
  modulo_financeiro: boolean;
}> = {
  basico: {
    usuarios: 5, conexoes: 1,
    webjs: true, waba: false, instagram: false,
    modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
    modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
    modulo_rh: false, modulo_bater_ponto: false,
    modulo_financeiro: false,
  },
  intermediario: {
    usuarios: 15, conexoes: 3,
    webjs: true, waba: true, instagram: false,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: true, modulo_instagram: false,
    modulo_cobranca: false, modulo_equipes: true, modulo_funil_avancado: true,
    modulo_rh: false, modulo_bater_ponto: false,
    modulo_financeiro: false,
  },
  ultra: {
    usuarios: 50, conexoes: 10,
    webjs: true, waba: true, instagram: true,
    modulo_roleta: true, modulo_disparos_web: true, modulo_disparos_api: true,
    modulo_voip: true, modulo_api_integracao: true, modulo_instagram: true,
    modulo_cobranca: true, modulo_equipes: true, modulo_funil_avancado: true,
    modulo_rh: true, modulo_bater_ponto: true,
    modulo_financeiro: true,
  },
};

// 🆕 ═══ Helpers de cobrança ═══

function calcularDiasAteVencimento(proximoVencimento: string | null | undefined): number | null {
  if (!proximoVencimento) return null;
  const hoje = new Date();
  const venc = new Date(proximoVencimento + "T00:00:00");
  const a = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusCobranca(c: Cadastro): {
  fase: "sem_config" | "em_dia" | "vence_breve" | "vence_hoje" | "atrasado" | "bloqueado" | "suspenso" | "confianca";
  label: string;
  cor: string;
  bg: string;
  borda: string;
  icone: string;
  dias: number | null;
} {
  if (c.status_pagamento === "suspenso") {
    return { fase: "suspenso", label: "Suspenso", cor: "#6b7280", bg: "#f3f4f6", borda: "#e5e7eb", icone: "⏸️", dias: null };
  }

  // 🆕 v3: Postergação ativa (desbloqueio em confiança) — tem prioridade visual
  if (c.bloqueio_postergado_ate) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ate = new Date(c.bloqueio_postergado_ate + "T00:00:00");
    const diasRestantes = Math.round((ate.getTime() - hoje.getTime()) / 86400000);
    if (diasRestantes >= 0) {
      return {
        fase: "confianca",
        label: diasRestantes === 0 ? "Confiança termina hoje" : `Confiança ${diasRestantes}d`,
        cor: "#7c3aed", bg: "#f5f3ff", borda: "#ddd6fe", icone: "🤝",
        dias: diasRestantes,
      };
    }
  }

  if (!c.dia_vencimento || !c.proximo_vencimento) {
    return { fase: "sem_config", label: "Sem cobrança", cor: "#9ca3af", bg: "#f9fafb", borda: "#e5e7eb", icone: "○", dias: null };
  }

  const dias = calcularDiasAteVencimento(c.proximo_vencimento);
  if (dias === null) return { fase: "sem_config", label: "Sem cobrança", cor: "#9ca3af", bg: "#f9fafb", borda: "#e5e7eb", icone: "○", dias: null };

  if (dias <= -2) return { fase: "bloqueado", label: `Bloqueado ${Math.abs(dias)}d`, cor: "#7f1d1d", bg: "#fef2f2", borda: "#fecaca", icone: "🔒", dias };
  if (dias < 0) return { fase: "atrasado", label: `Atrasado ${Math.abs(dias)}d`, cor: "#dc2626", bg: "#fef2f2", borda: "#fecaca", icone: "🔴", dias };
  if (dias === 0) return { fase: "vence_hoje", label: "Vence hoje", cor: "#dc2626", bg: "#fffbeb", borda: "#fde68a", icone: "⚠️", dias };
  if (dias <= 2) return { fase: "vence_breve", label: `Vence em ${dias}d`, cor: "#f59e0b", bg: "#fffbeb", borda: "#fde68a", icone: "🟡", dias };
  return { fase: "em_dia", label: `Em dia (${dias}d)`, cor: "#16a34a", bg: "#f0fdf4", borda: "#bbf7d0", icone: "🟢", dias };
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("pt-BR");
  } catch { return iso; }
}

function formatarReais(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// 🆕 Calcula data do PRÓXIMO vencimento (a partir de hoje) baseado no dia escolhido
function proximaDataVencimentoSugerida(diaVenc: number): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  // Tenta este mês
  const ultimoDiaEsseMes = new Date(ano, mes + 1, 0).getDate();
  let proxima = new Date(ano, mes, Math.min(diaVenc, ultimoDiaEsseMes));
  if (proxima <= hoje) {
    // Vai pro próximo mês
    const ultimoDiaProxMes = new Date(ano, mes + 2, 0).getDate();
    proxima = new Date(ano, mes + 1, Math.min(diaVenc, ultimoDiaProxMes));
  }
  return proxima.toISOString().slice(0, 10);
}

// 🆕 Avança 1 mês mantendo o dia (ajusta se não existir no próximo mês)
function avancarUmMes(dataIso: string): string {
  const d = new Date(dataIso + "T00:00:00");
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const dia = d.getDate();
  const ultimoDiaProxMes = new Date(ano, mes + 2, 0).getDate();
  const nova = new Date(ano, mes + 1, Math.min(dia, ultimoDiaProxMes));
  return nova.toISOString().slice(0, 10);
}

export default function Clientes() {
  const router = useRouter();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loadingCadastros, setLoadingCadastros] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [showModalCliente, setShowModalCliente] = useState(false);
  const [showModalDetalhe, setShowModalDetalhe] = useState(false);
  const [cadastroSelecionado, setCadastroSelecionado] = useState<Cadastro | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [permissaoLoading, setPermissaoLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState("");

  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [subUsuariosMap, setSubUsuariosMap] = useState<Record<string, SubUsuario[]>>({});
  const [gruposMap, setGruposMap] = useState<Record<string, Grupo[]>>({});
  const [carregandoSubs, setCarregandoSubs] = useState<Set<string>>(new Set());

  // 🆕 Histórico de pagamentos (carregado sob demanda no modal de detalhe)
  const [pagamentosHist, setPagamentosHist] = useState<Pagamento[]>([]);
  const [carregandoPagamentos, setCarregandoPagamentos] = useState(false);

  // 🆕 Modal "Marcar como pago"
  const [showModalPagamento, setShowModalPagamento] = useState(false);
  const [formPagamento, setFormPagamento] = useState({
    valor: "",
    data_pagamento: new Date().toISOString().slice(0, 10),
    forma_pagamento: "pix" as "pix" | "boleto" | "cartao" | "dinheiro" | "transferencia" | "outro",
    observacao: "",
  });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // 🆕 v3: modal de desbloqueio em confiança
  const [showModalConfianca, setShowModalConfianca] = useState(false);
  const [diasConfianca, setDiasConfianca] = useState<number>(7);

  const [formCadastro, setFormCadastro] = useState<Partial<Cadastro>>({
    nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
    username: "",
    usuarios_liberados: 5, conexoes_liberadas: 1,
    permite_webjs: true, permite_waba: false, permite_instagram: false,
    modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
    modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
    modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
    modulo_rh: false, modulo_bater_ponto: false,
    modulo_financeiro: false, financeiro_opcoes: {},
    ia: "gpt", autorizado: false, senha: "",
    // 🆕 cobrança
    dia_vencimento: null, valor_mensalidade: null, proximo_vencimento: null,
    status_pagamento: "ativo",
    bloqueio_postergado_ate: null,
  });

  // 🎨 ESTILOS
  const inputStyle = {
    width: "100%", background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 14,
    boxSizing: "border-box" as const, outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const inputSm = { ...inputStyle, padding: "9px 12px", fontSize: 13 };
  const cardStyle = {
    background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };
  const labelStyle = {
    color: "#6b7280", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: 0.5,
    display: "block" as const, marginBottom: 6,
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setEmailUsuario(user.email || "");
      const admin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setTemAcesso(!!admin);
      setPermissaoLoading(false);
    })();
  }, []);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const fetchCadastros = async () => {
    setLoadingCadastros(true);
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoadingCadastros(false);
  };

  useEffect(() => {
    if (!temAcesso) return;
    fetchCadastros();
    const ch = supabase.channel("cadastros_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "cadastros" }, () => fetchCadastros())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => fetchCadastros())
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos" }, () => {
        if (cadastroSelecionado) carregarPagamentos(cadastroSelecionado.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace" }, () => {
        expandidas.forEach(username => carregarSubUsuarios(username));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [temAcesso, expandidas, cadastroSelecionado]);

  const carregarSubUsuarios = async (username: string) => {
    if (!username) return;
    setCarregandoSubs(prev => new Set(prev).add(username));
    try {
      const [resSubs, resGrupos] = await Promise.all([
        supabase.from("usuarios_workspace").select("*").eq("workspace_id", username).order("created_at", { ascending: false }),
        supabase.from("grupos_permissao").select("id, nome").eq("workspace_id", username),
      ]);
      setSubUsuariosMap(prev => ({ ...prev, [username]: resSubs.data || [] }));
      setGruposMap(prev => ({ ...prev, [username]: resGrupos.data || [] }));
    } catch (e) { console.error(e); }
    setCarregandoSubs(prev => { const n = new Set(prev); n.delete(username); return n; });
  };

  // 🆕 Carrega histórico de pagamentos do cliente
  const carregarPagamentos = async (cadastroId: number) => {
    setCarregandoPagamentos(true);
    try {
      const { data } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("cadastro_id", cadastroId)
        .order("data_pagamento", { ascending: false })
        .limit(24);
      setPagamentosHist(data || []);
    } catch (e) { console.error(e); }
    setCarregandoPagamentos(false);
  };

  const toggleExpandir = (username: string) => {
    if (!username) { alert("Este cliente não tem workspace configurado."); return; }
    setExpandidas(prev => {
      const n = new Set(prev);
      if (n.has(username)) n.delete(username);
      else { n.add(username); if (!subUsuariosMap[username]) carregarSubUsuarios(username); }
      return n;
    });
  };

  const autorizarCadastro = async (c: Cadastro) => {
    try {
      await supabase.from("cadastros").update({ autorizado: true }).eq("id", c.id);
      await fetchCadastros();
    } catch { alert("Erro ao autorizar!"); }
  };

  const desautorizarCadastro = async (c: Cadastro) => {
    if (!confirm(`Desautorizar ${c.nome}?`)) return;
    await supabase.from("cadastros").update({ autorizado: false }).eq("id", c.id);
    await fetchCadastros();
  };

  // 🆕 Suspender manualmente
  const suspenderCliente = async (c: Cadastro) => {
    if (!confirm(`⏸️ Suspender ${c.nome}?\n\nEle e todos sub-usuários vão ver tela de bloqueio imediatamente. Você pode liberar a qualquer momento.`)) return;
    await supabase.from("cadastros").update({ status_pagamento: "suspenso" }).eq("id", c.id);
    await fetchCadastros();
    setCadastroSelecionado(prev => prev ? { ...prev, status_pagamento: "suspenso" } : prev);
    alert("✅ Cliente suspenso!");
  };

  // 🆕 Liberar (volta pra ativo SEM marcar pagamento)
  const liberarCliente = async (c: Cadastro) => {
    if (!confirm(`▶️ Liberar ${c.nome}?\n\nEle volta a ter acesso normal. ATENÇÃO: isso NÃO registra pagamento — só libera. Se quer registrar o pagamento, use "Marcar como Pago".`)) return;
    await supabase.from("cadastros").update({ status_pagamento: "ativo" }).eq("id", c.id);
    await fetchCadastros();
    setCadastroSelecionado(prev => prev ? { ...prev, status_pagamento: "ativo" } : prev);
    alert("✅ Cliente liberado!");
  };

  const excluirCadastro = async (c: Cadastro) => {
    if (!confirm(`⚠️ ATENÇÃO: Isso vai apagar PERMANENTEMENTE:\n\n• A conta de login de ${c.email}\n• O workspace "${c.empresa || c.nome}"\n• Todas as conexões, fluxos, atendimentos e mensagens\n\nEsta ação NÃO pode ser desfeita.\n\nTem certeza?`)) return;
    const token = await getToken();
    if (!token) { alert("Sessão expirou. Faça login novamente."); return; }
    try {
      const resp = await fetch("/api/admin/cliente", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: c.email }),
      });
      const result = await resp.json();
      if (!result.success) { alert("Erro ao excluir: " + (result.error || "desconhecido")); return; }
      await fetchCadastros();
      setShowModalDetalhe(false);
      alert("✅ Cliente excluído completamente!");
    } catch (e: any) { alert("Erro ao excluir: " + e.message); }
  };

  // 🆕 Abre modal "Marcar como pago" pré-preenchido
  const abrirMarcarPago = (c: Cadastro) => {
    setCadastroSelecionado(c);
    setFormPagamento({
      valor: c.valor_mensalidade != null ? String(c.valor_mensalidade).replace(".", ",") : "",
      data_pagamento: new Date().toISOString().slice(0, 10),
      forma_pagamento: "pix",
      observacao: "",
    });
    setShowModalPagamento(true);
  };

  // 🆕 Salva pagamento + avança próximo vencimento
  const salvarPagamento = async () => {
    if (!cadastroSelecionado) return;
    const valorNum = parseFloat(formPagamento.valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) { alert("Valor inválido."); return; }
    if (!formPagamento.data_pagamento) { alert("Data do pagamento obrigatória."); return; }

    setSalvandoPagamento(true);
    try {
      // 1) Insere no histórico
      const mesRef = formPagamento.data_pagamento.slice(0, 7) + "-01"; // mês referência = mês do pagamento
      const { error: errIns } = await supabase.from("pagamentos").insert([{
        cadastro_id: cadastroSelecionado.id,
        mes_referencia: mesRef,
        valor: valorNum,
        data_pagamento: formPagamento.data_pagamento,
        forma_pagamento: formPagamento.forma_pagamento,
        observacao: formPagamento.observacao || null,
        marcado_por: emailUsuario,
      }]);
      if (errIns) { alert("Erro ao registrar pagamento: " + errIns.message); setSalvandoPagamento(false); return; }

      // 2) Calcula próximo vencimento
      let novoVencimento: string;
      if (cadastroSelecionado.proximo_vencimento) {
        // Já tinha → avança 1 mês a partir do venc atual
        novoVencimento = avancarUmMes(cadastroSelecionado.proximo_vencimento);
      } else if (cadastroSelecionado.dia_vencimento) {
        // Não tinha venc mas tem dia → calcula próximo
        novoVencimento = proximaDataVencimentoSugerida(cadastroSelecionado.dia_vencimento);
      } else {
        // Sem dia configurado → não atualiza vencimento, só registra pagamento
        novoVencimento = "";
      }

      // 3) Atualiza cadastro — limpa postergação (cliente pagou, não precisa mais)
      const updates: any = {
        status_pagamento: "ativo",
        ultimo_pagamento_em: new Date().toISOString(),
        bloqueio_postergado_ate: null, // 🆕 v3
      };
      if (novoVencimento) updates.proximo_vencimento = novoVencimento;

      const { error: errUpd } = await supabase.from("cadastros").update(updates).eq("id", cadastroSelecionado.id);
      if (errUpd) { alert("Erro ao atualizar cliente: " + errUpd.message); setSalvandoPagamento(false); return; }

      await fetchCadastros();
      await carregarPagamentos(cadastroSelecionado.id);
      setCadastroSelecionado(prev => prev ? { ...prev, ...updates } : prev);
      setShowModalPagamento(false);
      alert(`✅ Pagamento registrado!${novoVencimento ? `\n\nPróximo vencimento: ${formatarData(novoVencimento)}` : ""}`);
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
    setSalvandoPagamento(false);
  };

  // ═══ 🆕 v3: Desbloqueio em confiança ═══
  const darConfianca = async (dias: number) => {
    if (!cadastroSelecionado) return;
    if (dias < 1 || dias > 90) { alert("Dias deve estar entre 1 e 90."); return; }
    const hoje = new Date();
    const ate = new Date(hoje.getTime() + dias * 86400000);
    const ateIso = ate.toISOString().slice(0, 10);

    const { error } = await supabase.from("cadastros").update({
      bloqueio_postergado_ate: ateIso,
      status_pagamento: "ativo", // volta ativo enquanto a confiança vigora
    }).eq("id", cadastroSelecionado.id);

    if (error) { alert("Erro: " + error.message); return; }

    await fetchCadastros();
    setCadastroSelecionado(prev => prev ? { ...prev, bloqueio_postergado_ate: ateIso, status_pagamento: "ativo" } : prev);
    setFormCadastro(prev => ({ ...prev, bloqueio_postergado_ate: ateIso, status_pagamento: "ativo" }));
    alert(`✅ Desbloqueado em confiança por ${dias} dia(s)!\nVolta a bloquear automaticamente em ${ate.toLocaleDateString("pt-BR")}.`);
  };

  const removerConfianca = async () => {
    if (!cadastroSelecionado) return;
    if (!confirm("Remover postergação? O bloqueio automático volta a valer.")) return;

    const { error } = await supabase.from("cadastros").update({
      bloqueio_postergado_ate: null,
    }).eq("id", cadastroSelecionado.id);

    if (error) { alert("Erro: " + error.message); return; }

    await fetchCadastros();
    setCadastroSelecionado(prev => prev ? { ...prev, bloqueio_postergado_ate: null } : prev);
    setFormCadastro(prev => ({ ...prev, bloqueio_postergado_ate: null }));
    alert("✅ Postergação removida.");
  };

  const abrirNovo = () => {
    setFormCadastro({
      nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
      username: "",
      usuarios_liberados: 5, conexoes_liberadas: 1,
      permite_webjs: true, permite_waba: false, permite_instagram: false,
      modulo_roleta: false, modulo_disparos_web: false, modulo_disparos_api: false,
      modulo_voip: false, modulo_api_integracao: false, modulo_instagram: false,
      modulo_cobranca: false, modulo_equipes: false, modulo_funil_avancado: false,
      modulo_rh: false, modulo_bater_ponto: false,
      modulo_financeiro: false, financeiro_opcoes: {},
      ia: "gpt", autorizado: false, senha: "",
      dia_vencimento: null, valor_mensalidade: null, proximo_vencimento: null,
      status_pagamento: "ativo",
      bloqueio_postergado_ate: null,
    });
    setCadastroSelecionado(null);
    setShowModalCliente(true);
  };

  const abrirEditar = (c: Cadastro) => {
    setFormCadastro({ ...c });
    setCadastroSelecionado(c);
    setShowModalCliente(true);
    setShowModalDetalhe(false);
  };

  // 🆕 Abre modal de detalhe E carrega histórico
  const abrirDetalhe = (c: Cadastro) => {
    setCadastroSelecionado(c);
    setShowModalDetalhe(true);
    carregarPagamentos(c.id);
  };

  const aplicarPresetPlano = (plano: string) => {
    const preset = planoPresets[plano];
    if (preset) {
      setFormCadastro(prev => ({
        ...prev,
        plano,
        usuarios_liberados: preset.usuarios,
        conexoes_liberadas: preset.conexoes,
        permite_webjs: preset.webjs,
        permite_waba: preset.waba,
        permite_instagram: preset.instagram,
        modulo_roleta: preset.modulo_roleta,
        modulo_disparos_web: preset.modulo_disparos_web,
        modulo_disparos_api: preset.modulo_disparos_api,
        modulo_voip: preset.modulo_voip,
        modulo_api_integracao: preset.modulo_api_integracao,
        modulo_instagram: preset.modulo_instagram,
        modulo_cobranca: preset.modulo_cobranca,
        modulo_equipes: preset.modulo_equipes,
        modulo_funil_avancado: preset.modulo_funil_avancado,
        modulo_rh: preset.modulo_rh,
        modulo_bater_ponto: preset.modulo_bater_ponto,
        modulo_financeiro: preset.modulo_financeiro,
        financeiro_opcoes: preset.modulo_financeiro ? todasFinOpcoes(true) : {},
      }));
    } else {
      setFormCadastro(prev => ({ ...prev, plano }));
    }
  };

  const toggleFinanceiroMaster = () => setFormCadastro((prev) => {
    const novo = !prev.modulo_financeiro;
    const temOpc = prev.financeiro_opcoes && Object.keys(prev.financeiro_opcoes).length > 0;
    return { ...prev, modulo_financeiro: novo, financeiro_opcoes: novo ? (temOpc ? prev.financeiro_opcoes : todasFinOpcoes(true)) : (prev.financeiro_opcoes || {}) };
  });
  const setTodasFin = (v: boolean) => setFormCadastro((prev) => ({ ...prev, financeiro_opcoes: todasFinOpcoes(v) }));
  const toggleFinOpcao = (key: string) => setFormCadastro((prev) => ({ ...prev, financeiro_opcoes: { ...(prev.financeiro_opcoes || {}), [key]: !((prev.financeiro_opcoes || {})[key]) } }));

  const salvarCadastro = async () => {
    if (!formCadastro.nome || !formCadastro.email) { alert("Nome e email são obrigatórios!"); return; }
    setSalvandoCliente(true);
    try {
      // 🆕 Auto-calcula proximo_vencimento se tem dia mas não tem data
      let proximoVenc = formCadastro.proximo_vencimento;
      if (formCadastro.dia_vencimento && !proximoVenc) {
        proximoVenc = proximaDataVencimentoSugerida(formCadastro.dia_vencimento);
      }

      if (cadastroSelecionado) {
        const { error } = await supabase.from("cadastros").update({
          nome: formCadastro.nome, empresa: formCadastro.empresa,
          whatsapp: formCadastro.whatsapp, plano: formCadastro.plano,
          usuarios_liberados: formCadastro.usuarios_liberados,
          conexoes_liberadas: formCadastro.conexoes_liberadas,
          permite_webjs: formCadastro.permite_webjs,
          permite_waba: formCadastro.permite_waba,
          permite_instagram: formCadastro.permite_instagram,
          modulo_roleta: !!formCadastro.modulo_roleta,
          modulo_disparos_web: !!formCadastro.modulo_disparos_web,
          modulo_disparos_api: !!formCadastro.modulo_disparos_api,
          modulo_voip: !!formCadastro.modulo_voip,
          modulo_api_integracao: !!formCadastro.modulo_api_integracao,
          modulo_instagram: !!formCadastro.modulo_instagram,
          modulo_cobranca: !!formCadastro.modulo_cobranca,
          modulo_equipes: !!formCadastro.modulo_equipes,
          modulo_funil_avancado: !!formCadastro.modulo_funil_avancado,
          modulo_rh: !!formCadastro.modulo_rh,
          modulo_bater_ponto: !!formCadastro.modulo_bater_ponto,
          modulo_financeiro: !!formCadastro.modulo_financeiro,
          financeiro_opcoes: formCadastro.financeiro_opcoes || {},
          ia: formCadastro.ia, autorizado: formCadastro.autorizado,
          // 🆕 cobrança
          dia_vencimento: formCadastro.dia_vencimento || null,
          valor_mensalidade: formCadastro.valor_mensalidade || null,
          proximo_vencimento: proximoVenc || null,
          status_pagamento: formCadastro.status_pagamento || "ativo",
          bloqueio_postergado_ate: formCadastro.bloqueio_postergado_ate || null,
        }).eq("id", cadastroSelecionado.id);
        if (error) { alert("Erro ao salvar: " + error.message); setSalvandoCliente(false); return; }
        alert("✅ Cliente atualizado!");
      } else {
        if (!formCadastro.senha || formCadastro.senha.length < 6) { alert("Senha obrigatória (mínimo 6 caracteres)"); setSalvandoCliente(false); return; }
        if (!formCadastro.username || !/^[a-z0-9_]{3,30}$/.test(formCadastro.username)) {
          alert("Username inválido. Use letras minúsculas, números e _ (3 a 30 caracteres)");
          setSalvandoCliente(false); return;
        }
        const token = await getToken();
        if (!token) { alert("Sessão expirou."); setSalvandoCliente(false); return; }
        const resp = await fetch("/api/admin/cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ ...formCadastro, proximo_vencimento: proximoVenc || null }),
        });
        const result = await resp.json();
        if (!result.success) {
          if (result.error === "email_exists") alert("❌ Este e-mail já está cadastrado!");
          else if (result.error === "username_exists") alert("❌ Este username já está em uso!");
          else alert("Erro: " + result.error);
          setSalvandoCliente(false);
          return;
        }
        alert("✅ Cliente criado! O cliente já pode fazer login com o email e senha.");
      }
      await fetchCadastros();
      setShowModalCliente(false);
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoCliente(false);
  };

  const Toggle = ({ value, onChange, label, desc, color = "#16a34a" }: { value: boolean; onChange: () => void; label: string; desc?: string; color?: string }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: value ? `${color}10` : "#f9fafb",
      borderRadius: 10, padding: "12px 16px",
      border: `1px solid ${value ? `${color}40` : "#e5e7eb"}`,
      transition: "all 0.15s",
    }}>
      <div>
        <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{label}</p>
        {desc && <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0 0" }}>{desc}</p>}
      </div>
      <button onClick={onChange}
        style={{
          width: 44, height: 24,
          background: value ? color : "#d1d5db",
          borderRadius: 12, cursor: "pointer", border: "none",
          position: "relative", flexShrink: 0, transition: "background 0.2s",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
        }}>
        <div style={{
          width: 18, height: 18, background: "white", borderRadius: "50%",
          position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );

  const BadgeModulo = ({ ativo, icone, label, cor }: { ativo: boolean; icone: string; label: string; cor: string }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: ativo ? `${cor}15` : "#f3f4f6",
      color: ativo ? cor : "#9ca3af",
      border: `1px solid ${ativo ? `${cor}40` : "#e5e7eb"}`,
      fontSize: 10, padding: "3px 10px", borderRadius: 10, fontWeight: 700,
      opacity: ativo ? 1 : 0.5,
    }} title={label}>
      {icone} {label}
    </span>
  );

  // 🆕 Stats com novos filtros
  const cadastrosFiltrados = cadastros
    .filter(c => {
      if (filtroStatus === "todos") return true;
      if (filtroStatus === "ativos") return c.autorizado && c.status_pagamento !== "suspenso";
      if (filtroStatus === "pendentes") return !c.autorizado;
      if (filtroStatus === "atrasados") {
        const st = getStatusCobranca(c);
        return st.fase === "atrasado" || st.fase === "vence_hoje";
      }
      if (filtroStatus === "bloqueados") {
        const st = getStatusCobranca(c);
        return st.fase === "bloqueado" || st.fase === "suspenso";
      }
      return true;
    })
    .filter(c => !buscaCliente || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.email?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.empresa?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.whatsapp?.includes(buscaCliente));

  // 🆕 Contadores pra os stats novos
  const qtdAtrasados = cadastros.filter(c => {
    const st = getStatusCobranca(c);
    return st.fase === "atrasado" || st.fase === "vence_hoje";
  }).length;
  const qtdBloqueados = cadastros.filter(c => {
    const st = getStatusCobranca(c);
    return st.fase === "bloqueado" || st.fase === "suspenso";
  }).length;

  if (permissaoLoading) {
    return <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>Carregando...</div>;
  }

  if (!temAcesso) {
    return (
      <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
        }}>
          <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
        </div>
        <h2 style={{ color: "#1f2937", fontSize: 20, fontWeight: 700, margin: 0 }}>Acesso Restrito</h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0, textAlign: "center" }}>Esta área é exclusiva do administrador master do sistema.</p>
        <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Logado como: <b>{emailUsuario}</b></p>
        <button onClick={() => router.push("/crm")}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 8,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          ← Voltar ao CRM
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL CRIAR/EDITAR
      ═══════════════════════════════════════════════════════════════ */}
      {showModalCliente && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 740, display: "flex", flexDirection: "column", gap: 20, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: 0 }}>{cadastroSelecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente Wolf"}</h2>
              <button onClick={() => setShowModalCliente(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Dados pessoais */}
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>👤 Dados Pessoais</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>Nome *</label><input placeholder="Nome completo" value={formCadastro.nome || ""} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} style={inputSm} /></div>
                <div><label style={labelStyle}>Empresa</label><input placeholder="Nome da empresa" value={formCadastro.empresa || ""} onChange={e => setFormCadastro({ ...formCadastro, empresa: e.target.value })} style={inputSm} /></div>
                <div>
                  <label style={labelStyle}>
                    Email * {cadastroSelecionado && <span style={{ color: "#9ca3af", textTransform: "none", fontWeight: 500 }}>(não pode mudar)</span>}
                  </label>
                  <input placeholder="email@empresa.com" value={formCadastro.email || ""} onChange={e => setFormCadastro({ ...formCadastro, email: e.target.value })} style={{ ...inputSm, background: cadastroSelecionado ? "#f3f4f6" : "#ffffff", color: cadastroSelecionado ? "#6b7280" : "#1f2937" }} disabled={!!cadastroSelecionado} />
                </div>
                <div><label style={labelStyle}>WhatsApp</label><input placeholder="(62) 99999-9999" value={formCadastro.whatsapp || ""} onChange={e => setFormCadastro({ ...formCadastro, whatsapp: e.target.value })} style={inputSm} /></div>
                {!cadastroSelecionado && (
                  <>
                    <div>
                      <label style={labelStyle}>Username *</label>
                      <input placeholder="ex: abc_company" value={formCadastro.username || ""}
                        onChange={e => setFormCadastro({ ...formCadastro, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                        style={{ ...inputSm, fontFamily: "monospace" }} maxLength={30} />
                      <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0" }}>a-z, 0-9, _ — 3 a 30 chars</p>
                    </div>
                    <div>
                      <label style={labelStyle}>Senha *</label>
                      <input type="password" placeholder="Senha de acesso (mín 6)" value={formCadastro.senha || ""} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} style={inputSm} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Plano */}
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>📦 Plano</p>
              <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
                {[
                  { key: "basico", label: "Básico", color: "#16a34a", usuarios: 5, conexoes: 1, preco: "R$ 444,27" },
                  { key: "intermediario", label: "Intermediário", color: "#3b82f6", usuarios: 15, conexoes: 3, preco: "R$ 744,27" },
                  { key: "ultra", label: "Ultra", color: "#8b5cf6", usuarios: 50, conexoes: 10, preco: "R$ 1.044,27" },
                ].map(p => {
                  const ativo = formCadastro.plano === p.key;
                  return (
                    <button key={p.key} onClick={() => aplicarPresetPlano(p.key)}
                      style={{
                        flex: 1,
                        background: ativo ? `${p.color}10` : "#f9fafb",
                        border: `2px solid ${ativo ? p.color : "#e5e7eb"}`,
                        borderRadius: 12, padding: "14px 10px",
                        cursor: "pointer", textAlign: "center",
                        transition: "all 0.15s",
                        boxShadow: ativo ? `0 4px 12px ${p.color}25` : "none",
                      }}>
                      <p style={{ color: ativo ? p.color : "#1f2937", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{p.label}</p>
                      <p style={{ color: ativo ? p.color : "#374151", fontSize: 12, margin: "0 0 4px", fontWeight: 700 }}>{p.preco}</p>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{p.usuarios} usuários · {p.conexoes} conexões</p>
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "10px 0 0", fontStyle: "italic" }}>
                💡 Ao selecionar o plano, os limites e módulos abaixo são preenchidos automaticamente. Você pode ajustar individualmente.
              </p>
            </div>

            {/* 🆕 SEÇÃO COBRANÇA */}
            <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", border: "1px solid #fcd34d", borderRadius: 12, padding: 18 }}>
              <p style={{ color: "#92400e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>💰 Cobrança Automática</p>
              <p style={{ color: "#78350f", fontSize: 11, margin: "0 0 14px", lineHeight: 1.4 }}>
                Pré-pago. Cliente paga antes de usar. 2 dias antes do venc o sistema começa a mostrar popup; 2 dias após vence, bloqueia.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>📅 Dia do vencimento</label>
                  <select value={formCadastro.dia_vencimento || ""} onChange={e => {
                    const dia = e.target.value ? parseInt(e.target.value) : null;
                    setFormCadastro(prev => ({
                      ...prev,
                      dia_vencimento: dia,
                      // Auto-recalcula próximo venc se ainda não tem
                      proximo_vencimento: dia && !prev.proximo_vencimento ? proximaDataVencimentoSugerida(dia) : prev.proximo_vencimento,
                    }));
                  }} style={inputSm}>
                    <option value="">— Sem cobrança automática —</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Dia {d} de cada mês</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>💵 Valor mensal (R$)</label>
                  <input type="text" placeholder="999,90" value={formCadastro.valor_mensalidade != null ? String(formCadastro.valor_mensalidade).replace(".", ",") : ""}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9,.]/g, "").replace(",", ".");
                      const num = v ? parseFloat(v) : null;
                      setFormCadastro({ ...formCadastro, valor_mensalidade: (num && !isNaN(num)) ? num : null });
                    }} style={inputSm} />
                  <p style={{ color: "#78350f", fontSize: 10, margin: "4px 0 0", fontStyle: "italic" }}>Permite valor diferente por cliente (pra descontos)</p>
                </div>
                <div>
                  <label style={labelStyle}>📆 Próximo vencimento</label>
                  <input type="date" value={formCadastro.proximo_vencimento || ""}
                    onChange={e => setFormCadastro({ ...formCadastro, proximo_vencimento: e.target.value || null })}
                    style={inputSm} />
                  <p style={{ color: "#78350f", fontSize: 10, margin: "4px 0 0", fontStyle: "italic" }}>Auto-preenche ao escolher o dia</p>
                </div>
              </div>
            </div>

            {/* 🆕 v3 — CONTROLE DE PAGAMENTO (só em modo edit) */}
            {cadastroSelecionado && (() => {
              const st = getStatusCobranca(cadastroSelecionado);
              const ehSuspenso = cadastroSelecionado.status_pagamento === "suspenso";
              const temConfianca = !!cadastroSelecionado.bloqueio_postergado_ate;
              return (
                <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", border: "1px solid #ddd6fe", borderRadius: 12, padding: 18 }}>
                  <p style={{ color: "#6d28d9", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>⚙️ Controle de Pagamento</p>
                  <p style={{ color: "#5b21b6", fontSize: 11, margin: "0 0 14px", lineHeight: 1.4 }}>
                    Ações rápidas pra cobrar, bloquear ou dar tolerância ao cliente.
                  </p>

                  {/* Status atual */}
                  <div style={{ background: "white", borderRadius: 10, padding: 12, marginBottom: 14, border: `1px solid ${st.borda}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Status atual</p>
                        <p style={{ color: st.cor, fontSize: 14, fontWeight: 800, margin: "2px 0 0" }}>{st.icone} {st.label}</p>
                      </div>
                      {temConfianca && (
                        <button onClick={removerConfianca}
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                          ✕ Remover postergação
                        </button>
                      )}
                    </div>
                    {temConfianca && (
                      <p style={{ color: "#7c3aed", fontSize: 11, margin: "8px 0 0", fontStyle: "italic" }}>
                        🤝 Cliente em confiança até <b>{formatarData(cadastroSelecionado.bloqueio_postergado_ate)}</b>. Bloqueio automático suspenso até lá.
                      </p>
                    )}
                  </div>

                  {/* 3 botões principais */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
                    {/* 💰 MARCAR PAGO */}
                    <button onClick={() => { abrirMarcarPago(cadastroSelecionado); setShowModalCliente(false); }}
                      style={{ background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "11px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 18 }}>💰</span>
                      <span>Marcar como Pago</span>
                    </button>

                    {/* 🔒 BLOQUEAR */}
                    {ehSuspenso ? (
                      <button onClick={() => liberarCliente(cadastroSelecionado)}
                        style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 10, padding: "11px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 18 }}>▶️</span>
                        <span>Liberar</span>
                      </button>
                    ) : (
                      <button onClick={() => suspenderCliente(cadastroSelecionado)}
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "11px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 18 }}>🔒</span>
                        <span>Bloquear por falta de pagamento</span>
                      </button>
                    )}

                    {/* 🤝 CONFIANÇA */}
                    <button onClick={() => setShowModalConfianca(true)}
                      style={{ background: temConfianca ? "#f5f3ff" : "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)", color: temConfianca ? "#7c3aed" : "white", border: temConfianca ? "1px solid #ddd6fe" : "none", borderRadius: 10, padding: "11px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: temConfianca ? "none" : "0 4px 12px rgba(139,92,246,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 18 }}>🤝</span>
                      <span>{temConfianca ? "Alterar confiança" : "Desbloquear por X dias"}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Limites Personalizados */}
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>⚙️ Limites Personalizados</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>👥 Usuários Liberados</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 3, 5, 7, 10, 15, 20, 50].map(n => {
                      const ativo = formCadastro.usuarios_liberados === n;
                      return (
                        <button key={n} onClick={() => setFormCadastro({ ...formCadastro, usuarios_liberados: n })}
                          style={{
                            background: ativo ? "#f59e0b" : "#f9fafb",
                            color: ativo ? "white" : "#6b7280",
                            border: `1px solid ${ativo ? "#f59e0b" : "#e5e7eb"}`,
                            borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                            boxShadow: ativo ? "0 2px 6px rgba(245,158,11,0.3)" : "none",
                          }}>{n}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>📱 Conexões Liberadas</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 5, 10, 15, 20].map(n => {
                      const ativo = formCadastro.conexoes_liberadas === n;
                      return (
                        <button key={n} onClick={() => setFormCadastro({ ...formCadastro, conexoes_liberadas: n })}
                          style={{
                            background: ativo ? "#3b82f6" : "#f9fafb",
                            color: ativo ? "white" : "#6b7280",
                            border: `1px solid ${ativo ? "#3b82f6" : "#e5e7eb"}`,
                            borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                            boxShadow: ativo ? "0 2px 6px rgba(59,130,246,0.3)" : "none",
                          }}>{n}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de Conexão permitidos */}
            <div>
              <p style={{ color: "#ec4899", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>🔌 Tipos de Conexão Permitidos</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Toggle value={!!formCadastro.permite_webjs} onChange={() => setFormCadastro({ ...formCadastro, permite_webjs: !formCadastro.permite_webjs })} label="📱 WhatsApp Web (QR Code)" desc="Conexão via QR Code — gratuita" color="#16a34a" />
                <Toggle value={!!formCadastro.permite_waba} onChange={() => setFormCadastro({ ...formCadastro, permite_waba: !formCadastro.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp Business" color="#3b82f6" />
                <Toggle value={!!formCadastro.permite_instagram} onChange={() => setFormCadastro({ ...formCadastro, permite_instagram: !formCadastro.permite_instagram })} label="📸 Instagram Direct" desc="Mensagens do Instagram Direct" color="#ec4899" />
              </div>
            </div>

            {/* MÓDULOS LIBERADOS */}
            <div>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>🎁 Módulos Liberados</p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 12px", fontStyle: "italic" }}>
                Controle quais módulos o cliente pode acessar. Módulos não liberados aparecem no menu mas mostram tela de upsell ao clicar.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                <Toggle value={!!formCadastro.modulo_roleta} onChange={() => setFormCadastro({ ...formCadastro, modulo_roleta: !formCadastro.modulo_roleta })} label="🎯 Roleta de Distribuição" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_web} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_web: !formCadastro.modulo_disparos_web })} label="📤 Disparos Web" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_disparos_api} onChange={() => setFormCadastro({ ...formCadastro, modulo_disparos_api: !formCadastro.modulo_disparos_api })} label="📨 Disparos API" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_voip} onChange={() => setFormCadastro({ ...formCadastro, modulo_voip: !formCadastro.modulo_voip })} label="📞 Ligações VOIP" desc="Apenas Ultra" color="#8b5cf6" />
                <Toggle value={!!formCadastro.modulo_api_integracao} onChange={() => setFormCadastro({ ...formCadastro, modulo_api_integracao: !formCadastro.modulo_api_integracao })} label="🔌 API de Integração" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_instagram} onChange={() => setFormCadastro({ ...formCadastro, modulo_instagram: !formCadastro.modulo_instagram })} label="📸 Instagram Direct (Módulo)" desc="Apenas Ultra" color="#ec4899" />
                <Toggle value={!!formCadastro.modulo_equipes} onChange={() => setFormCadastro({ ...formCadastro, modulo_equipes: !formCadastro.modulo_equipes })} label="👥 Equipes Multi-time" desc="Intermediário, Ultra" color="#a855f7" />
                <Toggle value={!!formCadastro.modulo_funil_avancado} onChange={() => setFormCadastro({ ...formCadastro, modulo_funil_avancado: !formCadastro.modulo_funil_avancado })} label="📊 Funil Avançado" desc="Intermediário, Ultra" color="#3b82f6" />
                <Toggle value={!!formCadastro.modulo_cobranca} onChange={() => setFormCadastro({ ...formCadastro, modulo_cobranca: !formCadastro.modulo_cobranca })} label="💰 Cobrança Automatizada" desc="Apenas Ultra" color="#dc2626" />
                <Toggle value={!!formCadastro.modulo_rh} onChange={() => setFormCadastro({ ...formCadastro, modulo_rh: !formCadastro.modulo_rh })} label="🧑‍💼 RH — Recursos Humanos" desc="Gestão de pessoas, folha, férias" color="#4f46e5" />
                <Toggle value={!!formCadastro.modulo_bater_ponto} onChange={() => setFormCadastro({ ...formCadastro, modulo_bater_ponto: !formCadastro.modulo_bater_ponto })} label="🕐 Bater Ponto" desc="Ponto com selfie e GPS" color="#0891b2" />
                <Toggle value={!!formCadastro.modulo_financeiro} onChange={toggleFinanceiroMaster} label="💰 Financeiro" desc="Caixa, contas, DRE, notas, conciliação" color="#d97706" />
                {formCadastro.modulo_financeiro && (
                  <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5 }}>Telas liberadas no Financeiro</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => setTodasFin(true)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #d97706", background: "#fff", color: "#b45309", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Marcar todas</button>
                        <button type="button" onClick={() => setTodasFin(false)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Limpar</button>
                      </div>
                    </div>
                    {FIN_GRUPOS.map((g) => (
                      <div key={g.nome} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#b45309", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>{g.nome}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {g.itens.map((it) => {
                            const on = !!(formCadastro.financeiro_opcoes || {})[it.key];
                            return (
                              <button key={it.key} type="button" onClick={() => toggleFinOpcao(it.key)} style={{ padding: "5px 10px", borderRadius: 8, border: on ? "1px solid #d97706" : "1px solid #e5e7eb", background: on ? "#fef3c7" : "#fff", color: on ? "#92400e" : "#9ca3af", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                                {it.icone} {it.label}{on ? " ✓" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Toggle value={!!formCadastro.autorizado} onChange={() => setFormCadastro({ ...formCadastro, autorizado: !formCadastro.autorizado })} label="✅ Autorizado — Permitir acesso ao sistema" color="#16a34a" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setShowModalCliente(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarCadastro} disabled={salvandoCliente}
                style={{
                  background: salvandoCliente ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>
                {salvandoCliente ? "Salvando..." : cadastroSelecionado ? "💾 Salvar" : "➕ Criar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          🆕 MODAL "MARCAR COMO PAGO"
      ═══════════════════════════════════════════════════════════════ */}
      {showModalPagamento && cadastroSelecionado && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#16a34a", fontSize: 18, fontWeight: 700, margin: 0 }}>💰 Marcar como Pago</h2>
              <button onClick={() => setShowModalPagamento(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
              <p style={{ color: "#15803d", fontSize: 12, margin: 0, fontWeight: 700 }}>{cadastroSelecionado.nome}</p>
              <p style={{ color: "#16a34a", fontSize: 11, margin: "2px 0 0" }}>{cadastroSelecionado.email}</p>
              {cadastroSelecionado.proximo_vencimento && (
                <p style={{ color: "#15803d", fontSize: 11, margin: "6px 0 0" }}>
                  Vencimento atual: <b>{formatarData(cadastroSelecionado.proximo_vencimento)}</b>
                  {" → "}próximo: <b>{formatarData(avancarUmMes(cadastroSelecionado.proximo_vencimento))}</b>
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>💵 Valor pago *</label>
              <input type="text" placeholder="999,90" value={formPagamento.valor}
                onChange={e => setFormPagamento({ ...formPagamento, valor: e.target.value.replace(/[^0-9,.]/g, "") })}
                style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>📅 Data pagamento *</label>
                <input type="date" value={formPagamento.data_pagamento}
                  onChange={e => setFormPagamento({ ...formPagamento, data_pagamento: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>💳 Forma</label>
                <select value={formPagamento.forma_pagamento}
                  onChange={e => setFormPagamento({ ...formPagamento, forma_pagamento: e.target.value as any })}
                  style={inputStyle}>
                  <option value="pix">💸 PIX</option>
                  <option value="boleto">🧾 Boleto</option>
                  <option value="cartao">💳 Cartão</option>
                  <option value="dinheiro">💵 Dinheiro</option>
                  <option value="transferencia">🏦 Transferência</option>
                  <option value="outro">📋 Outro</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>📝 Observação (opcional)</label>
              <input placeholder="Ex: Desconto promocional, pago via terceiro, etc" value={formPagamento.observacao}
                onChange={e => setFormPagamento({ ...formPagamento, observacao: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              <button onClick={() => setShowModalPagamento(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarPagamento} disabled={salvandoPagamento}
                style={{
                  background: salvandoPagamento ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>{salvandoPagamento ? "Registrando..." : "✅ Registrar Pagamento"}</button>
            </div>
          </div>
        </div>
      )}

{/* ═══════════════════════════════════════════════════════════════
          🆕 v3 — MODAL "DESBLOQUEIO EM CONFIANÇA"
      ═══════════════════════════════════════════════════════════════ */}
      {showModalConfianca && cadastroSelecionado && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#7c3aed", fontSize: 18, fontWeight: 700, margin: 0 }}>🤝 Desbloqueio em Confiança</h2>
              <button onClick={() => setShowModalConfianca(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: 12 }}>
              <p style={{ color: "#5b21b6", fontSize: 12, margin: 0, fontWeight: 700 }}>{cadastroSelecionado.nome}</p>
              <p style={{ color: "#7c3aed", fontSize: 11, margin: "2px 0 0" }}>{cadastroSelecionado.email}</p>
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12 }}>
              <p style={{ color: "#92400e", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                ⚠️ <b>Como funciona:</b> o vencimento <b>NÃO muda</b>. O sistema só suspende o bloqueio automático por X dias.
                Se o cliente pagar antes, a confiança é removida sozinha. Se não pagar até a data, o bloqueio volta automaticamente.
              </p>
            </div>
            <div>
              <label style={labelStyle}>📅 Quantos dias de confiança?</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[3, 5, 7, 10, 15, 30].map(d => (
                  <button key={d} onClick={() => setDiasConfianca(d)}
                    style={{
                      flex: 1, minWidth: 60,
                      background: diasConfianca === d ? "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)" : "#f9fafb",
                      color: diasConfianca === d ? "white" : "#6b7280",
                      border: diasConfianca === d ? "none" : "1px solid #e5e7eb",
                      borderRadius: 10, padding: "8px 0", fontSize: 13, cursor: "pointer", fontWeight: 700,
                      boxShadow: diasConfianca === d ? "0 4px 12px rgba(139,92,246,0.3)" : "none",
                    }}>{d}d</button>
                ))}
              </div>
              <input type="number" min={1} max={90} value={diasConfianca}
                onChange={e => setDiasConfianca(parseInt(e.target.value) || 0)}
                placeholder="Ou digite outro valor (1-90)"
                style={inputStyle} />
            </div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
              <p style={{ color: "#15803d", fontSize: 11, margin: 0 }}>
                🗓️ Bloqueio automático volta em: <b>{new Date(Date.now() + diasConfianca * 86400000).toLocaleDateString("pt-BR")}</b>
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              <button onClick={() => setShowModalConfianca(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={async () => { await darConfianca(diasConfianca); setShowModalConfianca(false); }}
                disabled={diasConfianca < 1 || diasConfianca > 90}
                style={{
                  background: (diasConfianca < 1 || diasConfianca > 90) ? "#a78bfa" : "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                }}>🤝 Dar {diasConfianca}d de confiança</button>
            </div>
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════════
          MODAL DETALHE
      ═══════════════════════════════════════════════════════════════ */}
      {showModalDetalhe && cadastroSelecionado && (() => {
        const stCobranca = getStatusCobranca(cadastroSelecionado);
        return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...cardStyle, padding: 28, width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 18, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: cadastroSelecionado.autorizado
                    ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
                    : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                  boxShadow: cadastroSelecionado.autorizado ? "0 8px 20px rgba(22,163,74,0.25)" : "0 8px 20px rgba(245,158,11,0.25)",
                }}>
                  <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
                </div>
                <div>
                  <h2 style={{ color: "#1f2937", fontSize: 20, fontWeight: 700, margin: 0 }}>{cadastroSelecionado.nome}</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 6px 0" }}>{cadastroSelecionado.empresa || "Sem empresa"}{cadastroSelecionado.username && ` · @${cadastroSelecionado.username}`}</p>
                  <span style={{
                    background: cadastroSelecionado.autorizado ? "#f0fdf4" : "#fffbeb",
                    color: cadastroSelecionado.autorizado ? "#16a34a" : "#f59e0b",
                    border: `1px solid ${cadastroSelecionado.autorizado ? "#bbf7d0" : "#fde68a"}`,
                    fontSize: 11, padding: "3px 12px", borderRadius: 20, fontWeight: 700,
                  }}>{cadastroSelecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                </div>
              </div>
              <button onClick={() => setShowModalDetalhe(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {[{ label: "Email", value: cadastroSelecionado.email, icon: "✉️" }, { label: "WhatsApp", value: cadastroSelecionado.whatsapp, icon: "📱" }, { label: "Plano", value: cadastroSelecionado.plano, icon: "📦" }, { label: "IA", value: cadastroSelecionado.ia, icon: "🤖" }].filter(i => i.value).map(info => (
                <div key={info.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                  <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px 0" }}>{info.icon} {info.label}</p>
                  <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: 0 }}>{info.value}</p>
                </div>
              ))}
            </div>

            {/* 🆕 CARD DE COBRANÇA */}
            <div style={{ background: stCobranca.bg, border: `1px solid ${stCobranca.borda}`, borderLeft: `4px solid ${stCobranca.cor}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                <p style={{ color: stCobranca.cor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>💰 Cobrança</p>
                <span style={{ background: "white", color: stCobranca.cor, border: `1px solid ${stCobranca.borda}`, fontSize: 12, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>
                  {stCobranca.icone} {stCobranca.label}
                </span>
              </div>

              {cadastroSelecionado.dia_vencimento ? (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "white", border: `1px solid ${stCobranca.borda}`, borderRadius: 10, padding: 10, textAlign: "center" }}>
                    <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>📅 Dia venc</p>
                    <p style={{ color: stCobranca.cor, fontSize: 18, fontWeight: 800, margin: "2px 0 0" }}>{cadastroSelecionado.dia_vencimento}</p>
                  </div>
                  <div style={{ background: "white", border: `1px solid ${stCobranca.borda}`, borderRadius: 10, padding: 10, textAlign: "center" }}>
                    <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>💵 Mensal</p>
                    <p style={{ color: stCobranca.cor, fontSize: 14, fontWeight: 800, margin: "2px 0 0" }}>{formatarReais(cadastroSelecionado.valor_mensalidade)}</p>
                  </div>
                  <div style={{ background: "white", border: `1px solid ${stCobranca.borda}`, borderRadius: 10, padding: 10, textAlign: "center", gridColumn: isMobile ? "span 2" : "auto" }}>
                    <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>📆 Próximo</p>
                    <p style={{ color: stCobranca.cor, fontSize: 13, fontWeight: 800, margin: "2px 0 0" }}>{formatarData(cadastroSelecionado.proximo_vencimento)}</p>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 14px", fontStyle: "italic" }}>
                  Cliente sem cobrança automática configurada. Edite pra definir dia e valor.
                </p>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { abrirMarcarPago(cadastroSelecionado); setShowModalDetalhe(false); }}
                  style={{ flex: 1, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)", whiteSpace: "nowrap" }}>
                  💰 Marcar como Pago
                </button>
                {cadastroSelecionado.status_pagamento === "suspenso" ? (
                  <button onClick={() => liberarCliente(cadastroSelecionado)}
                    style={{ flex: 1, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                    ▶️ Liberar
                  </button>
                ) : (
                  <button onClick={() => suspenderCliente(cadastroSelecionado)}
                    style={{ flex: 1, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                    ⏸️ Suspender
                  </button>
                )}
              </div>
            </div>

            {/* 🆕 HISTÓRICO DE PAGAMENTOS */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <p style={{ color: "#1f2937", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>📜 Histórico de Pagamentos</p>
              {carregandoPagamentos ? (
                <p style={{ color: "#9ca3af", fontSize: 12, margin: 0, fontStyle: "italic" }}>Carregando...</p>
              ) : pagamentosHist.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 12, margin: 0, fontStyle: "italic" }}>
                  Nenhum pagamento registrado ainda. Use o botão "Marcar como Pago" acima.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#ffffff" }}>
                        {["Data", "Mês ref", "Valor", "Forma", "Obs"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", color: "#6b7280", fontSize: 10, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagamentosHist.map(p => (
                        <tr key={p.id} style={{ borderTop: "1px solid #f3f4f6", background: "#ffffff" }}>
                          <td style={{ padding: "8px 10px", color: "#1f2937", fontWeight: 600 }}>{formatarData(p.data_pagamento)}</td>
                          <td style={{ padding: "8px 10px", color: "#6b7280" }}>
                            {new Date(p.mes_referencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#16a34a", fontWeight: 700 }}>{formatarReais(Number(p.valor))}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{p.forma_pagamento}</span>
                          </td>
                          <td style={{ padding: "8px 10px", color: "#6b7280", fontSize: 11 }}>{p.observacao || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>⚙️ Limites do Plano</p>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1, textAlign: "center", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, borderTop: "3px solid #f59e0b" }}>
                  <p style={{ color: "#f59e0b", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{cadastroSelecionado.usuarios_liberados || 1}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>👥 Usuários</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, borderTop: "3px solid #3b82f6" }}>
                  <p style={{ color: "#3b82f6", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{cadastroSelecionado.conexoes_liberadas || 1}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>📱 Conexões</p>
                </div>
              </div>
            </div>

            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>🎁 Módulos Liberados</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_roleta} icone="🎯" label="Roleta" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_web} icone="📤" label="Disparos Web" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_disparos_api} icone="📨" label="Disparos API" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_voip} icone="📞" label="VOIP" cor="#8b5cf6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_api_integracao} icone="🔌" label="API Integração" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_instagram} icone="📸" label="Instagram" cor="#ec4899" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_equipes} icone="👥" label="Equipes" cor="#a855f7" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_funil_avancado} icone="📊" label="Funil Avançado" cor="#3b82f6" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_cobranca} icone="💰" label="Cobrança" cor="#dc2626" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_rh} icone="🧑‍💼" label="RH" cor="#4f46e5" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_bater_ponto} icone="🕐" label="Bater Ponto" cor="#0891b2" />
                <BadgeModulo ativo={!!cadastroSelecionado.modulo_financeiro} icone="💰" label="Financeiro" cor="#d97706" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!cadastroSelecionado.autorizado
                ? <button onClick={() => { autorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }}
                    style={{ flex: 1, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", color: "white", border: "none", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
                    ✅ Autorizar Acesso
                  </button>
                : <button onClick={() => { desautorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }}
                    style={{ flex: 1, background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                    🚫 Desautorizar
                  </button>
              }
              <button onClick={() => abrirEditar(cadastroSelecionado)}
                style={{ flex: 1, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                ✏️ Editar
              </button>
              <button onClick={() => excluirCadastro(cadastroSelecionado)}
                style={{ flex: 1, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      )})()}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(139,92,246,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Clientes Wolf System</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0 0" }}>
              <b style={{ color: "#16a34a" }}>{cadastros.filter(c => c.autorizado).length}</b> ativos · <b style={{ color: "#f59e0b" }}>{cadastros.filter(c => !c.autorizado).length}</b> pendentes · <b>{cadastros.length}</b> total
            </p>
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
          }}>
          + Novo Cliente
        </button>
      </div>

      {/* ═══ STATS (com 2 cards novos de cobrança) ═══ */}
      <div style={{ display: "flex", gap: isMobile ? 10 : 16, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: cadastros.length, color: "#8b5cf6", icon: "📊" },
          { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a", icon: "✅" },
          { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳" },
          { label: "Em Atraso", value: qtdAtrasados, color: "#dc2626", icon: "🔴" },
          { label: "Bloqueados", value: qtdBloqueados, color: "#7f1d1d", icon: "🔒" },
        ].map(card => (
          <div key={card.label}
            style={{
              flex: isMobile ? "1 1 calc(50% - 5px)" : 1, minWidth: isMobile ? 0 : 120,
              ...cardStyle,
              padding: isMobile ? 14 : 20,
              borderTop: `3px solid ${card.color}`,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${card.color}20`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {card.icon}
              </div>
              <p style={{ color: "#6b7280", fontSize: isMobile ? 10 : 11, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.label}</p>
            </div>
            <p style={{ color: card.color, fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ BUSCA E FILTROS (com 2 filtros novos) ═══ */}
      <div style={{ display: "flex", gap: 12, alignItems: isMobile ? "stretch" : "center", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <input placeholder="🔍 Buscar por nome, email, empresa, WhatsApp..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
          style={{ ...inputStyle, maxWidth: isMobile ? "100%" : 400, padding: "9px 14px", fontSize: 13, borderRadius: 20 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "todos", label: "Todos", color: "#8b5cf6" },
            { key: "ativos", label: "✅ Ativos", color: "#16a34a" },
            { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" },
            { key: "atrasados", label: "🔴 Em Atraso", color: "#dc2626" },
            { key: "bloqueados", label: "🔒 Bloqueados", color: "#7f1d1d" },
          ].map(f => {
            const ativo = filtroStatus === f.key;
            return (
              <button key={f.key} onClick={() => setFiltroStatus(f.key)}
                style={{
                  flex: isMobile ? 1 : "0 0 auto", padding: "8px 18px",
                  borderRadius: 10, border: `1px solid ${ativo ? `${f.color}50` : "#e5e7eb"}`,
                  cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: ativo ? `${f.color}15` : "#ffffff",
                  color: ativo ? f.color : "#6b7280",
                  boxShadow: ativo ? `0 2px 8px ${f.color}25` : "none",
                  transition: "all 0.15s",
                }}>{f.label}</button>
            );
          })}
        </div>
      </div>

      {/* ═══ LISTA / TABELA (com coluna 💰 Cobrança) ═══ */}
      {loadingCadastros ? <p style={{ color: "#6b7280" }}>Carregando...</p> : cadastrosFiltrados.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(139,92,246,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🏢</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px 0" }}>Nenhum cliente encontrado</h3>
          <button onClick={abrirNovo}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 12,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            + Novo Cliente
          </button>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1300 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["", "Cliente", "Plano", "👥", "📱", "Conexões", "🎁 Módulos", "💰 Cobrança", "Status", "Ações"].map((h, i) => (
                  <th key={i} style={{ padding: "13px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cadastrosFiltrados.map((c, i) => {
                const username = c.username || "";
                const expandida = expandidas.has(username);
                const subs = subUsuariosMap[username] || [];
                const grupos = gruposMap[username] || [];
                const carregando = carregandoSubs.has(username);
                const stCobranca = getStatusCobranca(c);

                return (
                  <>
                    <tr key={c.id}
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        background: expandida ? "#f0fdf4" : (i % 2 === 0 ? "#ffffff" : "#fafbfc"),
                        transition: "background 0.1s",
                      }}>
                      <td style={{ padding: "14px 10px 14px 16px", width: 30 }}>
                        <button onClick={() => toggleExpandir(username)} disabled={!username}
                          style={{ background: "none", border: "none", color: expandida ? "#16a34a" : "#9ca3af", cursor: username ? "pointer" : "not-allowed", fontSize: 14, opacity: username ? 1 : 0.3, fontWeight: 700 }}
                          title={username ? (expandida ? "Ocultar sub-usuários" : "Ver sub-usuários") : "Cliente sem workspace"}>
                          {expandida ? "▼" : "▶"}
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>
                          <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{c.nome}</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0" }}>{c.email}</p>
                          {c.empresa && <p style={{ color: "#9ca3af", fontSize: 10, margin: "2px 0 0" }}>{c.empresa}{c.username && ` · @${c.username}`}</p>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: c.plano === "ultra" ? "#f3e8ff" : c.plano === "intermediario" ? "#eff6ff" : "#f0fdf4",
                          color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a",
                          border: `1px solid ${c.plano === "ultra" ? "#ddd6fe" : c.plano === "intermediario" ? "#bfdbfe" : "#bbf7d0"}`,
                          fontSize: 11, padding: "3px 12px", borderRadius: 10, fontWeight: 700,
                        }}>
                          {c.plano === "intermediario" ? "Intermediário" : c.plano === "ultra" ? "Ultra" : "Básico"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", fontSize: 12, padding: "3px 12px", borderRadius: 10, fontWeight: 700 }}>{c.usuarios_liberados || 1}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 12, padding: "3px 12px", borderRadius: 10, fontWeight: 700 }}>{c.conexoes_liberadas || 1}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {c.permite_webjs && <span style={{ fontSize: 14 }} title="WhatsApp Web">📱</span>}
                          {c.permite_waba && <span style={{ fontSize: 14 }} title="API Meta">🔗</span>}
                          {c.permite_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {c.modulo_roleta && <span style={{ fontSize: 14 }} title="Roleta">🎯</span>}
                          {c.modulo_disparos_web && <span style={{ fontSize: 14 }} title="Disparos Web">📤</span>}
                          {c.modulo_disparos_api && <span style={{ fontSize: 14 }} title="Disparos API">📨</span>}
                          {c.modulo_voip && <span style={{ fontSize: 14 }} title="Ligações VOIP">📞</span>}
                          {c.modulo_api_integracao && <span style={{ fontSize: 14 }} title="API Integração">🔌</span>}
                          {c.modulo_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}
                          {c.modulo_equipes && <span style={{ fontSize: 14 }} title="Equipes Multi-time">👥</span>}
                          {c.modulo_funil_avancado && <span style={{ fontSize: 14 }} title="Funil Avançado">📊</span>}
                          {c.modulo_cobranca && <span style={{ fontSize: 14 }} title="Cobrança">💰</span>}
                          {c.modulo_rh && <span style={{ fontSize: 14 }} title="RH">🧑‍💼</span>}
                          {c.modulo_bater_ponto && <span style={{ fontSize: 14 }} title="Bater Ponto">🕐</span>}
                          {c.modulo_financeiro && <span style={{ fontSize: 14 }} title="Financeiro">💰</span>}
                          {!c.modulo_roleta && !c.modulo_disparos_web && !c.modulo_disparos_api && !c.modulo_voip && !c.modulo_api_integracao && !c.modulo_instagram && !c.modulo_equipes && !c.modulo_funil_avancado && !c.modulo_cobranca && !c.modulo_rh && !c.modulo_bater_ponto && !c.modulo_financeiro && <span style={{ color: "#d1d5db", fontSize: 11, fontStyle: "italic" }}>nenhum</span>}
                        </div>
                      </td>

                      {/* 🆕 COLUNA DE COBRANÇA */}
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: stCobranca.bg, color: stCobranca.cor, border: `1px solid ${stCobranca.borda}`,
                          fontSize: 10, padding: "3px 10px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap",
                        }} title={c.proximo_vencimento ? `Próx. venc: ${formatarData(c.proximo_vencimento)}` : "Sem cobrança configurada"}>
                          {stCobranca.icone} {stCobranca.label}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: c.autorizado ? "#f0fdf4" : "#fffbeb",
                          color: c.autorizado ? "#16a34a" : "#f59e0b",
                          border: `1px solid ${c.autorizado ? "#bbf7d0" : "#fde68a"}`,
                          fontSize: 11, padding: "3px 12px", borderRadius: 12, fontWeight: 700,
                        }}>
                          {c.autorizado ? "✅ Ativo" : "⏳ Pendente"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => abrirDetalhe(c)}
                            style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>👁️</button>
                          <button onClick={() => abrirMarcarPago(c)} title="Marcar como pago"
                            style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>💰</button>
                          {!c.autorizado
                            ? <button onClick={() => autorizarCadastro(c)}
                                style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>✅</button>
                            : <button onClick={() => desautorizarCadastro(c)}
                                style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🚫</button>
                          }
                          <button onClick={() => abrirEditar(c)}
                            style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                          <button onClick={() => excluirCadastro(c)}
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>

                    {/* LINHA EXPANDIDA — SUB-USUÁRIOS */}
                    {expandida && (
                      <tr key={`${c.id}-expandido`} style={{ background: "#f0fdf4" }}>
                        <td colSpan={10} style={{ padding: "0 24px 18px 50px" }}>
                          <div style={{ borderLeft: "3px solid #16a34a", paddingLeft: 18, paddingTop: 10 }}>
                            <p style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
                              👥 Sub-usuários do workspace <span style={{ fontFamily: "monospace" }}>@{username}</span>
                            </p>

                            {carregando ? (
                              <p style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>Carregando...</p>
                            ) : subs.length === 0 ? (
                              <p style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic", margin: "8px 0" }}>
                                Nenhum sub-usuário cadastrado neste workspace ainda
                              </p>
                            ) : (
                              <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginTop: 6 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ background: "#f9fafb" }}>
                                      {["Nome", "Email", "Perfil", "Fila", "Grupo", "Status"].map(h => (
                                        <th key={h} style={{ padding: "9px 12px", color: "#6b7280", fontSize: 10, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subs.map(s => (
                                      <tr key={s.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                        <td style={{ padding: "9px 12px", color: "#1f2937", fontSize: 12, fontWeight: 600 }}>{s.nome}</td>
                                        <td style={{ padding: "9px 12px", color: "#6b7280", fontSize: 12 }}>{s.email}</td>
                                        <td style={{ padding: "9px 12px" }}>
                                          <span style={{
                                            background: s.perfil === "Administrador" ? "#fffbeb" : s.perfil === "Supervisor" ? "#f3e8ff" : "#eff6ff",
                                            color: s.perfil === "Administrador" ? "#f59e0b" : s.perfil === "Supervisor" ? "#8b5cf6" : "#3b82f6",
                                            border: `1px solid ${s.perfil === "Administrador" ? "#fde68a" : s.perfil === "Supervisor" ? "#ddd6fe" : "#bfdbfe"}`,
                                            padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                                          }}>{s.perfil}</span>
                                        </td>
                                        <td style={{ padding: "9px 12px", color: "#6b7280", fontSize: 12 }}>{s.fila || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                                        <td style={{ padding: "9px 12px" }}>
                                          {s.grupo_id ? (
                                            <span style={{ background: "#f3e8ff", color: "#8b5cf6", border: "1px solid #ddd6fe", padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                                              {grupos.find(g => g.id === s.grupo_id)?.nome || "—"}
                                            </span>
                                          ) : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                                        </td>
                                        <td style={{ padding: "9px 12px" }}>
                                          <span style={{
                                            background: s.status === "online" ? "#f0fdf4" : "#f3f4f6",
                                            color: s.status === "online" ? "#16a34a" : "#6b7280",
                                            border: `1px solid ${s.status === "online" ? "#bbf7d0" : "#e5e7eb"}`,
                                            padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                                          }}>
                                            {s.status === "online" ? "🟢 Online" : "⚫ Offline"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}