"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { vocabularioDoWorkspace } from "../../lib/vertical-workspace";
import { useModulos } from "../../hooks/useModulos";
import { usePermissao } from "../../hooks/usePermissao";
import { useRouter } from "next/navigation";
import Icone from "../../components/a2/Icone";

type Proposta = {
  workspace_id?: string | null;
  status_venda: string | null;
  valor_plano: number | null;
  vendedor: string | null;
  created_at: string | null;
  data_proposta?: string | null;
  proximo_vencimento: string | null;
  status_pagamento: string | null;
};

type FuncRow = { status: string | null; salario: number | null };
type FolhaRow = { competencia: string | null; base: number | null; comissao: number | null };
type Lancamento = { tipo: string | null; valor: number | null; status: string | null; vencimento: string | null; pago_em?: string | null };
type Canal = { id: number; tipo: string | null; status: string | null; nome: string | null; workspace_id?: string | null };
type Cadastro = {
  id?: number;
  nome?: string | null;
  empresa?: string | null;
  email?: string | null;
  plano?: string | null;
  autorizado?: boolean | null;
  status_pagamento?: string | null;
  usuarios_liberados?: number | null;
  valor_mensalidade?: number | null;
  conexoes_liberadas?: number | null;
  modulo_cobranca?: boolean | null;
  modulo_rh?: boolean | null;
  modulo_bater_ponto?: boolean | null;
  modulo_financeiro?: boolean | null;
  modulo_voip?: boolean | null;
  modulo_disparos_web?: boolean | null;
  modulo_disparos_api?: boolean | null;
  created_at?: string | null;
};
type WorkspaceRow = { id?: number; username?: string | null; nome?: string | null; owner_email?: string | null; ativo?: boolean | null };

const real = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => (v || 0).toLocaleString("pt-BR");

const compAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const norm = (v: any) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();


function addWsId(lista: string[], valor: any) {
  const v = String(valor ?? "").trim();
  if (v && !lista.includes(v)) lista.push(v);
}

async function resolverTenantAtual(userEmail?: string | null, userId?: string | null, fallbackWsId?: string, fallbackWorkspace?: any) {
  const wsIds: string[] = [];
  let nome = fallbackWorkspace?.nome || "";
  let ownerEmail = fallbackWorkspace?.owner_email || "";
  let principalWsId = String(fallbackWsId || fallbackWorkspace?.username || "").trim();

  addWsId(wsIds, fallbackWsId);
  addWsId(wsIds, fallbackWorkspace?.username);
  addWsId(wsIds, fallbackWorkspace?.id);

  if (userId) {
    const { data: wsDono } = await supabase
      .from("workspaces")
      .select("id, username, nome, owner_email")
      .eq("owner_id", userId)
      .maybeSingle();
    if (wsDono) {
      principalWsId = String(wsDono.username || wsDono.id || principalWsId).trim();
      addWsId(wsIds, wsDono.username);
      addWsId(wsIds, wsDono.id);
      nome = wsDono.nome || nome;
      ownerEmail = wsDono.owner_email || ownerEmail;
    }
  }

  if (userEmail) {
    const { data: usuarioWs } = await supabase
      .from("usuarios_workspace")
      .select("workspace_id")
      .eq("email", userEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (usuarioWs?.workspace_id) {
      principalWsId = String(usuarioWs.workspace_id || principalWsId).trim();
      addWsId(wsIds, usuarioWs.workspace_id);
      const idRaw = String(usuarioWs.workspace_id);
      const filtro = /^\d+$/.test(idRaw) ? `username.eq.${idRaw},id.eq.${idRaw}` : `username.eq.${idRaw}`;
      const { data: wsSub } = await supabase
        .from("workspaces")
        .select("id, username, nome, owner_email")
        .or(filtro)
        .maybeSingle();
      if (wsSub) {
        addWsId(wsIds, wsSub.username);
        addWsId(wsIds, wsSub.id);
        nome = wsSub.nome || nome;
        ownerEmail = wsSub.owner_email || ownerEmail;
      }
    }
  }

  if (principalWsId) addWsId(wsIds, principalWsId);
  return { wsIds: [...new Set(wsIds)], principalWsId, nome, ownerEmail };
}

async function buscarPropostasTenant(principalWsId: string, wsIds: string[]) {
  const PAGE_SIZE = 1000;
  const TOTAL_LIMITE = 20000;
  const buscar = async (modo: "principal" | "todos") => {
    const lista: any[] = [];
    let offset = 0;
    while (offset < TOTAL_LIMITE) {
      let query = supabase
        .from("proposta")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      query = modo === "principal" && principalWsId
        ? query.eq("workspace_id", principalWsId)
        : query.in("workspace_id", wsIds);

      const { data, error } = await query;
      if (error) {
        console.warn("visao propostas:", modo, error);
        break;
      }
      if (!data || data.length === 0) break;
      lista.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return lista;
  };

  const principal = await buscar("principal");
  if (principal.length > 0 || wsIds.length <= 1) return principal;
  return buscar("todos");
}

async function buscarPorWorkspaceComFallback(tabela: string, select: string, principalWsId: string, wsIds: string[], opts?: { order?: string; ascending?: boolean; countHead?: boolean; gteCampo?: string; gteValor?: string }) {
  const montar = (modo: "principal" | "todos") => {
    let q: any = opts?.countHead
      ? supabase.from(tabela).select(select, { count: "exact", head: true })
      : supabase.from(tabela).select(select);

    q = modo === "principal" && principalWsId
      ? q.eq("workspace_id", principalWsId)
      : q.in("workspace_id", wsIds);

    if (opts?.gteCampo && opts.gteValor) q = q.gte(opts.gteCampo, opts.gteValor);
    if (opts?.order) q = q.order(opts.order, { ascending: opts.ascending ?? true });
    return q;
  };

  const principal = await montar("principal");
  const principalData = principal.data || [];
  if (opts?.countHead) {
    if ((principal.count || 0) > 0 || wsIds.length <= 1) return principal;
  } else if (principalData.length > 0 || wsIds.length <= 1) {
    return principal;
  }

  return montar("todos");
}

const statusConectado = (status: any) => /CONECT|CONNECTED|OPEN|ATIV|ACTIVE|READY|ONLINE/.test(norm(status));

function idsDeWorkspaces(lista: WorkspaceRow[]) {
  const ids: string[] = [];
  for (const ws of lista) {
    addWsId(ids, ws.username);
    addWsId(ids, ws.id);
  }
  return ids;
}

async function buscarPaginasPorWorkspaces(tabela: string, select: string, wsIds: string[], opts?: { order?: string; ascending?: boolean; limite?: number }) {
  if (wsIds.length === 0) return [];
  const PAGE_SIZE = 1000;
  const TOTAL_LIMITE = opts?.limite || 30000;
  const lista: any[] = [];
  let offset = 0;

  while (offset < TOTAL_LIMITE) {
    let query = supabase
      .from(tabela)
      .select(select)
      .in("workspace_id", wsIds)
      .range(offset, offset + PAGE_SIZE - 1);

    if (opts?.order) query = query.order(opts.order, { ascending: opts.ascending ?? true });

    const { data, error } = await query;
    if (error) {
      console.warn(`visao admin ${tabela}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    lista.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return lista;
}

async function buscarVisaoGlobalAdmin() {
  const { data: sessionResp } = await supabase.auth.getSession();
  const token = sessionResp.session?.access_token;
  if (!token) throw new Error("Sessão do admin não encontrada");

  const resp = await fetch("/api/admin/cliente?acao=visao-global", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    throw new Error(json?.error || "Falha ao carregar visão global");
  }
  return json;
}

function diasAteVenc(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

const shell: React.CSSProperties = {
  minHeight: "100%",
  color: "#0f172a",
  fontFamily: "var(--font-wolf), system-ui, sans-serif",
};

export default function VisaoGeralPage() {
  const { wsId, workspace, loading: workspaceLoading } = useWorkspace();
  const { modulos, carregado: modulosCarregados } = useModulos();
  const { isDono, isSuperAdmin, perfil, permissoes, loading: permLoading } = usePermissao();

  const [carregando, setCarregando] = useState(true);
  const [adminCarregando, setAdminCarregando] = useState(true);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [funcs, setFuncs] = useState<FuncRow[]>([]);
  const [folha, setFolha] = useState<FolhaRow[]>([]);
  const [pontoHoje, setPontoHoje] = useState(0);
  const [usuarios, setUsuarios] = useState(0);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [tenantWsIds, setTenantWsIds] = useState<string[]>([]);
  const [tenantNome, setTenantNome] = useState("");

  const workspaceUsername = String((workspace as any)?.username || wsId || "").toLowerCase();
  const workspaceNome = String((workspace as any)?.nome || "");
  const isWolfAdmin = isSuperAdmin || workspaceUsername === "wolf_admin" || workspaceNome.toLowerCase() === "wolf_admin";

  const podeVerTudo = isSuperAdmin || isDono || perfil === "Administrador";
  const temCRM = isWolfAdmin || isSuperAdmin || isDono || perfil === "Administrador" || !!(permissoes as any).crm_acessar || !!permissoes.dashboard || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe;
  const temVendas = temCRM && (podeVerTudo || !!permissoes.dashboard || !!permissoes.vendas_proprio || !!permissoes.vendas_equipe || isWolfAdmin);
  const temEquipe = podeVerTudo || !!permissoes.usuarios_gerenciar || !!permissoes.grupos_permissao || isWolfAdmin;
  const temCobranca = (isSuperAdmin || !!modulos.cobranca) && (podeVerTudo || !!permissoes.cobranca);
  const temRH = (isSuperAdmin || !!modulos.rh) && (podeVerTudo || !!permissoes.rh || !!permissoes.rh_dashboard);
  const temPonto = (isSuperAdmin || !!modulos.bater_ponto) && (podeVerTudo || !!permissoes.bater_ponto);
  const temFinanceiro = (isSuperAdmin || !!modulos.financeiro) && (podeVerTudo || !!permissoes.financeiro_acessar || !!permissoes.fin_dashboard);
  const temTelefonia = (isSuperAdmin || !!modulos.voip) && (podeVerTudo || !!(permissoes as any).telefonia_acessar || !!permissoes.voip_usar);
  const temDisparos = isSuperAdmin || !!modulos.disparos_web || !!modulos.disparos_api;
  const temIntegracoes = isSuperAdmin || !!modulos.api_integracao || !!modulos.instagram || !!modulos.roleta;

  useEffect(() => {
    if (workspaceLoading || permLoading) return;
    if (!isWolfAdmin) return;

    let cancelado = false;
    (async () => {
      setAdminCarregando(true);
      const resumo = await buscarVisaoGlobalAdmin();

      if (cancelado) return;
      setCadastros((resumo.cadastros || []) as Cadastro[]);
      setWorkspaces((resumo.workspaces || []) as WorkspaceRow[]);
      setPropostas((resumo.propostas || []) as Proposta[]);
      setCanais((resumo.conexoes || []) as Canal[]);
      setUsuarios((resumo.usuarios || []).length);
      setAdminCarregando(false);
      setCarregando(false);
    })().catch((e) => {
      console.error("visao wolf_admin:", e);
      if (!cancelado) {
        setAdminCarregando(false);
        setCarregando(false);
      }
    });

    return () => { cancelado = true; };
  }, [workspaceLoading, permLoading, isWolfAdmin]);

  useEffect(() => {
    if (workspaceLoading || permLoading) return;
    if (isWolfAdmin) return;

    let cancelado = false;
    (async () => {
      setCarregando(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      const ctx = await resolverTenantAtual(user?.email, user?.id, wsId, workspace);
      if (cancelado) return;

      setTenantWsIds(ctx.wsIds);
      setTenantNome(ctx.nome || (workspace as any)?.nome || "");

      if (ctx.wsIds.length === 0 && !ctx.principalWsId) {
        setPropostas([]);
        setUsuarios(0);
        setFuncs([]);
        setFolha([]);
        setPontoHoje(0);
        setLancamentos([]);
        setCanais([]);
        setCarregando(false);
        return;
      }

      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);

      const basePromises: Promise<any>[] = [
        buscarPropostasTenant(ctx.principalWsId, ctx.wsIds),
        buscarPorWorkspaceComFallback("usuarios_workspace", "email, nome, workspace_id", ctx.principalWsId, ctx.wsIds),
      ];

      const extras: Array<{ key: string; promise: Promise<any> }> = [];
      if (temRH || temPonto) {
        extras.push({ key: "funcs", promise: buscarPorWorkspaceComFallback("funcionarios", "status, salario, workspace_id", ctx.principalWsId, ctx.wsIds) });
        extras.push({ key: "folha", promise: buscarPorWorkspaceComFallback("folha_itens", "competencia, base, comissao, workspace_id", ctx.principalWsId, ctx.wsIds) });
      }
      if (temPonto) {
        extras.push({
          key: "ponto",
          promise: buscarPorWorkspaceComFallback("ponto_registros", "id", ctx.principalWsId, ctx.wsIds, { countHead: true, gteCampo: "data_hora", gteValor: inicioDia.toISOString() }),
        });
      }
      if (temFinanceiro) {
        extras.push({
          key: "fin",
          promise: buscarPorWorkspaceComFallback("fin_lancamentos", "tipo, valor, status, vencimento, pago_em, workspace_id", ctx.principalWsId, ctx.wsIds),
        });
      }
      if (temTelefonia || temDisparos || temIntegracoes) {
        extras.push({
          key: "canais",
          promise: buscarPorWorkspaceComFallback("conexoes", "id, tipo, status, nome, numero, workspace_id", ctx.principalWsId, ctx.wsIds, { order: "created_at", ascending: false }),
        });
      }

      const [prop, usr] = await Promise.all(basePromises);
      const extraResults = await Promise.all(extras.map((e) => e.promise.catch((error) => ({ error }))));
      const byKey: Record<string, any> = {};
      extras.forEach((e, i) => { byKey[e.key] = extraResults[i]; });

      if (cancelado) return;
      const usuariosSubs = (usr.data || []) as Array<{ email?: string | null }>;
      const emails = new Set(usuariosSubs.map((u) => String(u.email || "").toLowerCase()).filter(Boolean));
      if (ctx.ownerEmail) emails.add(String(ctx.ownerEmail).toLowerCase());

      setPropostas((Array.isArray(prop) ? prop : prop.data || []) as Proposta[]);
      setUsuarios(emails.size);
      setFuncs((byKey.funcs?.data || []) as FuncRow[]);
      setFolha((byKey.folha?.data || []) as FolhaRow[]);
      setPontoHoje(byKey.ponto?.count || 0);
      setLancamentos((byKey.fin?.data || []) as Lancamento[]);
      setCanais((byKey.canais?.data || []) as Canal[]);
      setCarregando(false);
    })().catch((e) => {
      console.error("visao tenant:", e);
      if (!cancelado) setCarregando(false);
    });

    return () => { cancelado = true; };
  }, [wsId, workspaceLoading, modulosCarregados, permLoading, isWolfAdmin, temRH, temPonto, temFinanceiro, temTelefonia, temDisparos, temIntegracoes, workspace]);

  const vendas = useMemo(() => {
    const comp = compAtual();
    const noMes = (iso: string | null | undefined) => (iso || "").slice(0, 7) === comp;
    const instaladas = propostas.filter((p) => /INSTALAD|ATIVAD|CONCLUID|FINALIZAD/.test(norm(p.status_venda)) && !/CANCEL|REPROV|CHURN/.test(norm(p.status_venda)));
    const criadasMes = propostas.filter((p) => noMes(p.data_proposta || p.created_at));
    const instaladasMes = instaladas.filter((p) => noMes(p.data_proposta || p.created_at));
    const receitaMes = instaladasMes.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0);
    const emAndamento = propostas.filter((p) => /AGUARD|PENDENT|GERAD|AUDITOR|ANALIS|PROCESS|ANDAMENTO|DIGITAD|SIMULA/.test(norm(p.status_venda))).length;
    const canceladas = propostas.filter((p) => /CANCEL|REPROV|CHURN|FRAUDE|PERDID|NEGAD|RECUSAD/.test(norm(p.status_venda))).length;
    const conversao = propostas.length ? Math.round((instaladas.length / propostas.length) * 100) : 0;
    return { receitaMes, total: propostas.length, criadasMes: criadasMes.length, instaladas: instaladas.length, emAndamento, canceladas, conversao };
  }, [propostas]);

  const cobranca = useMemo(() => {
    let emDia = 0, vencendo = 0, atrasado = 0, bloqueado = 0;
    propostas.forEach((p) => {
      if (norm(p.status_pagamento) === "SUSPENSO") return;
      const d = diasAteVenc(p.proximo_vencimento);
      if (d === null) return;
      if (d <= -2) bloqueado++;
      else if (d < 0) atrasado++;
      else if (d <= 2) vencendo++;
      else emDia++;
    });
    return { emDia, vencendo, atrasado, bloqueado };
  }, [propostas]);

  const rh = useMemo(() => {
    const ativos = funcs.filter((f) => norm(f.status) !== "DESLIGADO").length;
    const comp = compAtual();
    const custoFolha = folha
      .filter((i) => (i.competencia || "") === comp)
      .reduce((s, i) => s + (Number(i.base) || 0) + (Number(i.comissao) || 0), 0);
    return { ativos, custoFolha };
  }, [funcs, folha]);

  const financeiro = useMemo(() => {
    const mes = compAtual();
    const doMes = lancamentos.filter((l) => (l.vencimento || l.pago_em || "").slice(0, 7) === mes);
    const receitas = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const despesas = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const pendentes = lancamentos.filter((l) => norm(l.status) !== "PAGO").length;
    return { receitas, despesas, saldo: receitas - despesas, pendentes };
  }, [lancamentos]);

  const canaisResumo = useMemo(() => {
    const conectados = canais.filter((c) => statusConectado(c.status)).length;
    const webjs = canais.filter((c) => norm(c.tipo) === "WEBJS").length;
    const waba = canais.filter((c) => /WABA|API|OFICIAL|META/.test(norm(c.tipo))).length;
    return { total: canais.length, conectados, webjs, waba };
  }, [canais]);

  const vendedoresAtivos = useMemo(() => {
    const set = new Set(propostas.map((p) => (p.vendedor || "").trim()).filter(Boolean));
    return set.size;
  }, [propostas]);

  const modulosAtivos = useMemo(() => {
    const items = [
      { key: "crm", nome: "CRM", ativo: temCRM, cor: "#059669" },
      { key: "cobranca", nome: "Cobranca", ativo: temCobranca, cor: "#dc2626" },
      { key: "rh", nome: "RH", ativo: temRH, cor: "#4f46e5" },
      { key: "ponto", nome: "Ponto", ativo: temPonto, cor: "#0891b2" },
      { key: "financeiro", nome: "Financeiro", ativo: temFinanceiro, cor: "#d97706" },
      { key: "telefonia", nome: "Telefonia", ativo: temTelefonia, cor: "#0f766e" },
      { key: "disparos", nome: "Disparos", ativo: temDisparos, cor: "#7c3aed" },
      { key: "integracoes", nome: "Integracoes", ativo: temIntegracoes, cor: "#2563eb" },
    ];
    return items.filter((i) => i.ativo);
  }, [temCRM, temCobranca, temRH, temPonto, temFinanceiro, temTelefonia, temDisparos, temIntegracoes]);

  const adminStats = useMemo(() => {
    const ativos = cadastros.filter((c) => c.autorizado !== false && norm(c.status_pagamento) !== "SUSPENSO").length;
    const suspensos = cadastros.filter((c) => norm(c.status_pagamento) === "SUSPENSO").length;
    const basico = cadastros.filter((c) => norm(c.plano) === "BASICO").length;
    const intermediario = cadastros.filter((c) => norm(c.plano) === "INTERMEDIARIO").length;
    const ultra = cadastros.filter((c) => norm(c.plano) === "ULTRA").length;
    const wsAtivos = workspaces.filter((w) => w.ativo !== false).length;
    const clientesComCobranca = cadastros.filter((c) => c.modulo_cobranca).length;
    const clientesComRH = cadastros.filter((c) => c.modulo_rh).length;
    const clientesComFinanceiro = cadastros.filter((c) => c.modulo_financeiro).length;
    const clientesComVoip = cadastros.filter((c) => c.modulo_voip).length;
    const clientesComApi = cadastros.filter((c) => c.modulo_disparos_api).length;
    return { ativos, suspensos, basico, intermediario, ultra, wsAtivos, clientesComCobranca, clientesComRH, clientesComFinanceiro, clientesComVoip, clientesComApi };
  }, [cadastros, workspaces]);

  const topTenants = useMemo(() => {
    const mapa = new Map<string, { workspace: string; vendas: number; receita: number; canais: number }>();
    for (const p of propostas) {
      const key = p.workspace_id || "sem_workspace";
      const atual = mapa.get(key) || { workspace: key, vendas: 0, receita: 0, canais: 0 };
      atual.vendas += 1;
      if (/INSTALAD|ATIVAD|CONCLUID|FINALIZAD/.test(norm(p.status_venda))) atual.receita += Number(p.valor_plano || 0);
      mapa.set(key, atual);
    }
    for (const c of canais) {
      const key = c.workspace_id || "sem_workspace";
      const atual = mapa.get(key) || { workspace: key, vendas: 0, receita: 0, canais: 0 };
      atual.canais += 1;
      mapa.set(key, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.receita - a.receita || b.vendas - a.vendas).slice(0, 8);
  }, [propostas, canais]);

  // ─── Dados extras do visual A2: nome do usuário, fila de atendimento e conversas do dia ───
  const router = useRouter();
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [aguardandoTotal, setAguardandoTotal] = useState(0);
  const [conversasHoje, setConversasHoje] = useState<number | null>(null);
  const [conversasOntem, setConversasOntem] = useState(0);
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(7);
  const podeVerChat = isSuperAdmin || isDono || perfil === "Administrador" || !!permissoes.chat_proprio || !!permissoes.chat_todos;
  // Orçamentos comerciais da Wolf (só o admin da plataforma vê).
  const [orcamentos, setOrcamentos] = useState<OrcamentoWolf[]>([]);

  useEffect(() => {
    if (!isWolfAdmin || !isSuperAdmin) return;
    let cancelado = false;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await fetch("/api/orcamentos", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => null);
      if (!cancelado && j?.success) setOrcamentos(j.orcamentos || []);
    })().catch((e) => console.warn("visao orcamentos:", e));
    return () => { cancelado = true; };
  }, [isWolfAdmin, isSuperAdmin]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user || cancelado) return;
      let nome = String((user.user_metadata as any)?.nome || "");
      const { data: uw } = await supabase.from("usuarios_workspace").select("nome").eq("email", user.email || "").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (uw?.nome) nome = uw.nome;
      if (!cancelado) setNomeUsuario(nome || String(user.email || "").split("@")[0]);
    })().catch(() => {});
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (isWolfAdmin || !podeVerChat || tenantWsIds.length === 0) return;
    let cancelado = false;
    (async () => {
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
      const inicioOntem = new Date(inicioHoje.getTime() - 86400000);
      const [pend, hoje, ontem] = await Promise.all([
        supabase.from("atendimentos").select("id, nome, numero, mensagem, atendente, status, created_at, ultima_mensagem_em")
          .in("workspace_id", tenantWsIds).eq("status", "pendente").order("ultima_mensagem_em", { ascending: true }).limit(200),
        supabase.from("atendimentos").select("id", { count: "exact", head: true }).in("workspace_id", tenantWsIds).gte("created_at", inicioHoje.toISOString()),
        supabase.from("atendimentos").select("id", { count: "exact", head: true }).in("workspace_id", tenantWsIds).gte("created_at", inicioOntem.toISOString()).lt("created_at", inicioHoje.toISOString()),
      ]);
      if (cancelado) return;
      // Mesma regra da tela de Atendimento: aguardando = pendente, sem BOT e sem atendente real.
      const esperando = ((pend.data || []) as FilaItem[]).filter((a) => !a.atendente || a.atendente === "Humano");
      setAguardandoTotal(esperando.length);
      setFila(esperando.slice(0, 5));
      setConversasHoje(hoje.count || 0);
      setConversasOntem(ontem.count || 0);
    })().catch((e) => console.warn("visao fila:", e));
    return () => { cancelado = true; };
  }, [isWolfAdmin, podeVerChat, tenantWsIds]);

  // Vendas por período (gráfico): propostas criadas, agrupadas em barras.
  const grafico = useMemo(() => montarGrafico(propostas, periodo), [propostas, periodo]);

  const comparativoMes = useMemo(() => {
    const d = new Date();
    const atual = compAtual();
    const ant = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const anterior = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, "0")}`;
    const mesAnt = propostas.filter((p) => (p.data_proposta || p.created_at || "").slice(0, 7) === anterior).length;
    const mesAtual = propostas.filter((p) => (p.data_proposta || p.created_at || "").slice(0, 7) === atual).length;
    return { mesAnt, mesAtual, nomeAnterior: ant.toLocaleDateString("pt-BR", { month: "long" }) };
  }, [propostas]);

  const loadingTenant = workspaceLoading || permLoading || (!isWolfAdmin && !modulosCarregados && tenantWsIds.length === 0) || carregando;
  const primeiroNome = (nomeUsuario || "").trim().split(/\s+/)[0] || "";
  const saudacao = saudacaoDoHorario();
  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dataHojeFmt = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);
  const voc = vocabularioDoWorkspace(wsId);

  if (isWolfAdmin) {
    // Números do negócio Wolf: clientes, receita recorrente e orçamentos comerciais.
    const comp = compAtual();
    const ativos = cadastros.filter((c) => c.autorizado !== false && norm(c.status_pagamento) !== "SUSPENSO");
    const mrr = ativos.reduce((s, c) => s + (Number(c.valor_mensalidade) || 0), 0);
    const comValor = ativos.filter((c) => Number(c.valor_mensalidade) > 0).length;
    const ticket = comValor ? mrr / comValor : 0;
    const novosMes = cadastros.filter((c) => (c.created_at || "").slice(0, 7) === comp).length;
    const orcMes = orcamentos.filter((o) => (o.created_at || "").slice(0, 7) === comp);
    const aceitos = orcamentos.filter((o) => o.status === "aceito");
    const aceitosMes = aceitos.filter((o) => (o.aceito_em || o.created_at || "").slice(0, 7) === comp);
    const visualizados = orcamentos.filter((o) => o.status === "aceito" || !!o.visualizado_em || o.status === "visualizado");
    const pendentes = orcamentos.filter((o) => o.status === "enviado" || o.status === "visualizado");
    const taxaAceite = orcamentos.length ? Math.round((aceitos.length / orcamentos.length) * 100) : 0;
    const mrrAceitoMes = aceitosMes.reduce((s, o) => s + (Number(o.mensalidade) || 0), 0);
    const graficoOrc = montarGraficoDatas(orcamentos.map((o) => o.created_at), periodo);
    const statusOrc: Record<string, { label: string; cor: string }> = {
      aceito: { label: "Aceito", cor: "#047857" },
      visualizado: { label: "Visualizado", cor: "#C2410C" },
      enviado: { label: "Enviado", cor: "#475569" },
      expirado: { label: "Expirado", cor: "#94A3B8" },
      recusado: { label: "Recusado", cor: "#DC2626" },
      cancelado: { label: "Cancelado", cor: "#94A3B8" },
    };
    return (
      <div style={shell}>
        <HeroA2
          status={`Plataforma online · ${canaisResumo.conectados} de ${canaisResumo.total} canais conectados`}
          titulo={`${saudacao}${primeiroNome ? `, ${primeiroNome}` : ""}`}
          resumo={`${dataHojeFmt} · ${num(ativos.length)} clientes ativos · ${real(mrr)} de receita mensal${pendentes.length ? ` · ${num(pendentes.length)} orçamento(s) aguardando resposta` : ""}`}
          acoes={[
            { label: "Clientes", onClick: () => router.push("/crm/clientes") },
            { label: "+ Novo orçamento", onClick: () => router.push("/crm/orcamentos"), principal: true },
          ]}
        />
        <FaixaKpis itens={[
          { icone: "usuarios", label: "Clientes ativos", valor: num(ativos.length), pill: novosMes ? `+${novosMes} novo(s) no mês` : adminStats.suspensos ? `${adminStats.suspensos} suspenso(s)` : "nenhum suspenso", tom: !novosMes && adminStats.suspensos ? "laranja" : "verde" },
          { icone: "dinheiro", label: "Receita mensal", valor: real(mrr), pill: comValor ? `ticket médio ${real(ticket)}` : "cadastre a mensalidade dos clientes", tom: "verde" },
          { icone: "documento", label: "Orçamentos no mês", valor: num(orcMes.length), barra: taxaAceite, barraLabel: `${taxaAceite}% aceitos` },
          { icone: "relogio", label: "Aguardando resposta", valor: num(pendentes.length), pill: pendentes.length ? "orçamentos enviados em aberto" : "nenhum em aberto", tom: pendentes.length ? "laranja" : "verde", alerta: true },
        ]} />

        {adminCarregando ? <LoadingBox text="Carregando a visão da plataforma..." /> : (
          <>
            <div className="a2-visao-grade">
              <GraficoVendas grafico={graficoOrc} periodo={periodo} setPeriodo={setPeriodo} titulo="Orçamentos enviados" unidade={["orçamento", "orçamentos"]} />
              <CartaoLista
                titulo="Últimos orçamentos"
                link={{ label: "Ver todos →", onClick: () => router.push("/crm/orcamentos") }}
                vazio="Nenhum orçamento enviado ainda."
                itens={orcamentos.slice(0, 5).map((o) => ({
                  chave: String(o.id),
                  iniciais: iniciais(o.cliente_nome || "?"),
                  titulo: o.cliente_nome || "Cliente",
                  sub: `${real(Number(o.mensalidade) || 0)}/mês · ${statusOrc[o.status]?.label || o.status}`,
                  dir: tempoCurto(minutosDesde(o.created_at)),
                  destaque: o.status === "visualizado",
                  onClick: () => router.push("/crm/orcamentos"),
                }))}
              />
            </div>
            <FaixaFunil itens={[
              { label: "Orçamentos enviados", valor: orcamentos.length, base: orcamentos.length, cor: "#A7F3D0" },
              { label: "Abertos pelo cliente", valor: visualizados.length, base: orcamentos.length, cor: "#34D399" },
              { label: "Aguardando resposta", valor: pendentes.length, base: orcamentos.length, cor: "#059669" },
            ]} final={{ label: "Orçamentos aceitos", valor: aceitos.length, nota: aceitosMes.length ? `${real(mrrAceitoMes)}/mês fechados neste mês` : `Taxa de aceite de ${taxaAceite}%` }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 22 }}>
              <Section title="Planos e módulos" subtitle="O que está vendido e liberado por cliente.">
                <Metric label="Básico" value={num(adminStats.basico)} color="#10B981" note="clientes no plano" />
                <Metric label="Intermediário" value={num(adminStats.intermediario)} color="#059669" note="clientes no plano" />
                <Metric label="Ultra" value={num(adminStats.ultra)} color="#065F46" note="clientes no plano" />
                <Metric label="Cobrança" value={num(adminStats.clientesComCobranca)} color="#059669" note="módulo liberado" />
                <Metric label="RH" value={num(adminStats.clientesComRH)} color="#059669" note="módulo liberado" />
                <Metric label="Financeiro" value={num(adminStats.clientesComFinanceiro)} color="#d97706" note="módulo liberado" />
                <Metric label="Telefonia" value={num(adminStats.clientesComVoip)} color="#059669" note="módulo liberado" />
                <Metric label="API oficial" value={num(adminStats.clientesComApi)} color="#059669" note="disparos via API" />
              </Section>
              <Section title="Uso da plataforma" subtitle="Ambientes, pessoas e conexões dos seus clientes.">
                <Metric label="Workspaces ativos" value={num(adminStats.wsAtivos)} color="#059669" note={`${num(workspaces.length)} no total`} />
                <Metric label="Usuários vinculados" value={num(usuarios)} color="#059669" note="logins dos clientes" />
                <Metric label="Canais conectados" value={`${canaisResumo.conectados}/${canaisResumo.total}`} color="#059669" note="WhatsApp e API" />
                <Metric label="API oficial" value={num(canaisResumo.waba)} color="#059669" note="canais na API da Meta" />
              </Section>
              <TabelaClientes linhas={cadastros} />
            </div>
          </>
        )}
      </div>
    );
  }

  const variacaoHoje = conversasHoje !== null && conversasOntem > 0 ? Math.round(((conversasHoje - conversasOntem) / conversasOntem) * 100) : null;
  const variacaoMes = comparativoMes.mesAnt > 0 ? Math.round(((comparativoMes.mesAtual - comparativoMes.mesAnt) / comparativoMes.mesAnt) * 100) : null;
  const esperandoMuito = fila.filter((a) => minutosDesde(a.ultima_mensagem_em || a.created_at) > 10).length;
  const resumoHero = [
    podeVerChat ? `você tem ${num(aguardandoTotal)} conversa(s) esperando` : "",
    temVendas ? `${num(vendas.emAndamento)} proposta(s) em andamento` : "",
  ].filter(Boolean).join(" e ");

  return (
    <div style={shell}>
      <HeroA2
        status={`Operação online${temTelefonia || temDisparos || temIntegracoes ? ` · ${canaisResumo.conectados} canal(is) conectado(s)` : ""}`}
        titulo={`${saudacao}${primeiroNome ? `, ${primeiroNome}` : ""}`}
        resumo={`${dataHojeFmt}${resumoHero ? ` · ${resumoHero}` : ""}`}
        acoes={[
          ...(podeVerChat ? [{ label: "Abrir atendimento", onClick: () => router.push("/chatbot") }] : []),
          ...(temVendas ? [{ label: "+ Nova venda", onClick: () => router.push("/crm/funil"), principal: true }] : []),
        ]}
      />

      {loadingTenant ? (
        <div style={{ marginTop: 22 }}><LoadingBox text={tenantWsIds.length === 0 && !workspaceLoading ? "Localizando dados do workspace..." : "Carregando sua visão geral..."} /></div>
      ) : (
        <>
          <FaixaKpis itens={[
            podeVerChat
              ? { icone: "chat", label: "Conversas hoje", valor: num(conversasHoje || 0), pill: variacaoHoje === null ? "hoje" : `${variacaoHoje >= 0 ? "↑" : "↓"} ${Math.abs(variacaoHoje)}% vs ontem`, tom: variacaoHoje !== null && variacaoHoje < 0 ? "laranja" : "verde" }
              : { icone: "documento", label: "Propostas totais", valor: num(vendas.total), pill: `${num(vendas.criadasMes)} no mês`, tom: "verde" },
            { icone: "check", label: "Vendas no mês", valor: num(comparativoMes.mesAtual), pill: variacaoMes === null ? `${num(vendas.instaladas)} ${voc.concluidasMin}` : `${variacaoMes >= 0 ? "↑" : "↓"} ${Math.abs(variacaoMes)}% vs ${comparativoMes.nomeAnterior}`, tom: variacaoMes !== null && variacaoMes < 0 ? "laranja" : "verde" },
            { icone: "grafico", label: voc.receitaConcluida === "Receita instalada" ? "Receita do mês" : `${voc.receitaConcluida} no mês`, valor: real(vendas.receitaMes), barra: vendas.conversao, barraLabel: `${vendas.conversao}%` },
            podeVerChat
              ? { icone: "relogio", label: "Aguardando resposta", valor: num(aguardandoTotal), pill: esperandoMuito ? `${esperandoMuito} há mais de 10 min` : "ninguém esperando muito", tom: esperandoMuito ? "laranja" : "verde", alerta: true }
              : { icone: "relogio", label: "Em andamento", valor: num(vendas.emAndamento), pill: "propostas abertas", tom: "laranja", alerta: true },
          ]} />

          <div className="a2-visao-grade">
            {temVendas
              ? <GraficoVendas grafico={grafico} periodo={periodo} setPeriodo={setPeriodo} titulo="Vendas" />
              : <div style={{ ...card, gridColumn: "span 2", padding: 26, color: "#64748B" }}>O gráfico de vendas aparece quando o CRM está liberado para o seu usuário.</div>}
            {podeVerChat ? (
              <CartaoLista
                titulo="Na fila agora"
                link={{ label: "Abrir atendimento →", onClick: () => router.push("/chatbot") }}
                vazio="Ninguém esperando. Tudo em dia!"
                itens={fila.map((a, i) => {
                  const min = minutosDesde(a.ultima_mensagem_em || a.created_at);
                  return {
                    chave: String(a.id),
                    iniciais: iniciais(a.nome || a.numero || "?"),
                    titulo: a.nome || a.numero || "Contato",
                    sub: resumoMensagem(a.mensagem),
                    dir: tempoCurto(min),
                    destaque: i === 0 && min > 10,
                    onClick: () => router.push("/chatbot"),
                  };
                })}
              />
            ) : (
              <CartaoLista titulo="Módulos liberados" vazio="Nenhum módulo liberado." itens={modulosAtivos.map((m) => ({ chave: m.key, iniciais: m.nome.slice(0, 2).toUpperCase(), titulo: m.nome, sub: "ativo no plano", dir: "" }))} />
            )}
          </div>

          {temVendas && (
            <FaixaFunil itens={[
              { label: "Propostas totais", valor: vendas.total, base: vendas.total, cor: "#A7F3D0" },
              { label: "Criadas no mês", valor: vendas.criadasMes, base: vendas.total, cor: "#34D399" },
              { label: "Em andamento", valor: vendas.emAndamento, base: vendas.total, cor: "#059669" },
            ]} final={{ label: voc.concluidas, valor: vendas.instaladas, nota: `Conversão de ${vendas.conversao}% no total` }} />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 22 }}>
            {temCobranca && (
              <Section title="Cobrança" subtitle="Situação dos vencimentos dos seus clientes.">
                <Metric label="Em dia" value={num(cobranca.emDia)} color="#059669" note="sem risco imediato" />
                <Metric label="Vencendo" value={num(cobranca.vencendo)} color="#f59e0b" note="próximos 2 dias" />
                <Metric label="Atrasado" value={num(cobranca.atrasado)} color="#dc2626" note="vencimento passou" />
                <Metric label="Bloqueado" value={num(cobranca.bloqueado)} color="#7f1d1d" note="2+ dias vencido" />
              </Section>
            )}
            {(temRH || temPonto) && (
              <Section title="Pessoas e ponto" subtitle="Equipe, folha e batidas de hoje.">
                {temRH && <Metric label="Funcionários ativos" value={num(rh.ativos)} color="#059669" note="na base de RH" />}
                {temRH && <Metric label="Custo da folha" value={real(rh.custoFolha)} color="#d97706" note="competência atual" />}
                {temPonto && <Metric label="Batidas hoje" value={num(pontoHoje)} color="#059669" note={hojeISO().split("-").reverse().join("/")} />}
              </Section>
            )}
            {temFinanceiro && (
              <Section title="Financeiro" subtitle="Receitas e despesas do mês.">
                <Metric label="Receitas do mês" value={real(financeiro.receitas)} color="#059669" note="lançamentos do período" />
                <Metric label="Despesas do mês" value={real(financeiro.despesas)} color="#dc2626" note="lançamentos do período" />
                <Metric label="Saldo projetado" value={real(financeiro.saldo)} color={financeiro.saldo >= 0 ? "#059669" : "#dc2626"} note="receitas menos despesas" />
                <Metric label="Pendências" value={num(financeiro.pendentes)} color="#f59e0b" note="não pagos" />
              </Section>
            )}
            {(temTelefonia || temDisparos || temIntegracoes) && (
              <Section title="Canais e automação" subtitle="Conexões e recursos liberados no plano.">
                {temTelefonia && <Metric label="Canais conectados" value={`${canaisResumo.conectados}/${canaisResumo.total}`} color="#059669" note="conexões ativas" />}
                {temTelefonia && <Metric label="WhatsApp Web" value={num(canaisResumo.webjs)} color="#059669" note="canais por QR code" />}
                {temDisparos && <Metric label="API oficial" value={num(canaisResumo.waba)} color="#059669" note="WhatsApp Business API" />}
                {modulos.roleta && <Metric label="Roleta" value="Ativa" color="#059669" note="distribuição de leads" />}
                {modulos.instagram && <Metric label="Instagram" value="Liberado" color="#059669" note="atendimento no Direct" />}
                {modulos.api_integracao && <Metric label="API" value="Liberada" color="#059669" note="integrações externas" />}
              </Section>
            )}
            {temEquipe && (
              <Section title="Equipe" subtitle="Quem usa o sistema neste workspace.">
                <Metric label="Usuários no workspace" value={num(usuarios)} color="#059669" note="logins vinculados" />
                <Metric label="Vendedores ativos" value={num(vendedoresAtivos)} color="#059669" note="com propostas vinculadas" />
              </Section>
            )}
            {!temVendas && !temCobranca && !temRH && !temPonto && !temFinanceiro && !temTelefonia && !temDisparos && !temIntegracoes && !temEquipe && !podeVerChat && (
              <div style={{ ...card, padding: 32, textAlign: "center" }}>
                <p style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>Nenhum módulo visível para seu usuário.</p>
                <p style={{ color: "#64748B", fontSize: 13, margin: "8px 0 0" }}>O plano ou as permissões deste login não liberam indicadores nesta visão.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Auxiliares ───────────────────────────────────────────────────────────
type OrcamentoWolf = { id: string | number; numero?: string | null; cliente_nome: string | null; status: string; mensalidade: number | null; configuracao?: number | null; created_at: string; visualizado_em?: string | null; aceito_em?: string | null };

function TabelaClientes({ linhas }: { linhas: Cadastro[] }) {
  const situacao = (c: Cadastro) => {
    if (norm(c.status_pagamento) === "SUSPENSO") return { label: "Suspenso", bg: "#FEF2F2", fg: "#B91C1C" };
    if (c.autorizado === false) return { label: "Pendente", bg: "#FFF7ED", fg: "#C2410C" };
    return { label: "Ativo", bg: "#ECFDF5", fg: "#047857" };
  };
  const plano = (p?: string | null) => ({ BASICO: "Básico", INTERMEDIARIO: "Intermediário", ULTRA: "Ultra" } as Record<string, string>)[norm(p)] || (p || "—");
  const ordenadas = [...linhas].sort((a, b) => (Number(b.valor_mensalidade) || 0) - (Number(a.valor_mensalidade) || 0));
  return (
    <section style={{ ...card, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px 14px" }}>
        <h2 style={{ color: "#0F172A", fontSize: 17, fontWeight: 800, margin: 0 }}>Seus clientes</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>Ordenados pela mensalidade.</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {["Cliente", "Plano", "Mensalidade", "Usuários", "Situação"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 24px", color: "#64748B", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #EEF2F1", background: "#F7FAF9" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 22, color: "#94A3B8", fontSize: 13 }}>Nenhum cliente cadastrado ainda.</td></tr>
            ) : ordenadas.map((c, i) => {
              const s = situacao(c);
              return (
                <tr key={c.id ?? i} style={{ borderTop: "1px solid #EEF2F1" }}>
                  <td style={{ padding: "13px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 36, height: 36, borderRadius: 11, background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{iniciais(c.empresa || c.nome || "?")}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#0F172A", fontSize: 14, fontWeight: 700 }}>{c.empresa || c.nome || "—"}</div>
                        <div style={{ color: "#94A3B8", fontSize: 12 }}>{c.email || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 24px", color: "#334155", fontSize: 14, fontWeight: 600 }}>{plano(c.plano)}</td>
                  <td style={{ padding: "13px 24px", color: "#047857", fontSize: 14, fontWeight: 700 }}>{Number(c.valor_mensalidade) > 0 ? real(Number(c.valor_mensalidade)) : "—"}</td>
                  <td style={{ padding: "13px 24px", color: "#334155", fontSize: 14 }}>{num(Number(c.usuarios_liberados) || 0)}</td>
                  <td style={{ padding: "13px 24px" }}><span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{s.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type FilaItem = { id: number; nome: string | null; numero: string | null; mensagem: string | null; atendente: string | null; status: string | null; created_at: string; ultima_mensagem_em?: string | null };
type Grafico = { barras: Array<{ label: string; valor: number }>; total: number; melhor: number };

function saudacaoDoHorario() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function minutosDesde(iso?: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.round((Date.now() - t) / 60000));
}

function tempoCurto(min: number) {
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}

function iniciais(t: string) {
  const p = String(t).replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

function resumoMensagem(m?: string | null) {
  const t = String(m || "").replace(/\s+/g, " ").trim();
  if (!t) return "Nova conversa";
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function montarGrafico(propostas: Proposta[], periodo: 7 | 30 | 90): Grafico {
  return montarGraficoDatas(propostas.map((p) => p.data_proposta || p.created_at), periodo);
}

function montarGraficoDatas(datas: Array<string | null | undefined>, periodo: 7 | 30 | 90): Grafico {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const passo = periodo === 7 ? 1 : periodo === 30 ? 5 : 7;
  const qtd = periodo === 7 ? 7 : periodo === 30 ? 6 : 13;
  const barras: Array<{ label: string; valor: number; ini: number; fim: number }> = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const fim = new Date(hoje.getTime() - i * passo * 86400000 + 86400000);
    const ini = new Date(fim.getTime() - passo * 86400000);
    const label = periodo === 7 ? DIAS[ini.getDay()] : ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    barras.push({ label, valor: 0, ini: ini.getTime(), fim: fim.getTime() });
  }
  for (const iso of datas) {
    if (!iso) continue;
    const t = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso).getTime();
    const b = barras.find((x) => t >= x.ini && t < x.fim);
    if (b) b.valor++;
  }
  const total = barras.reduce((s, b) => s + b.valor, 0);
  let melhor = 0;
  barras.forEach((b, i) => { if (b.valor > barras[melhor].valor) melhor = i; });
  return { barras: barras.map(({ label, valor }) => ({ label, valor })), total, melhor };
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 32px -14px rgba(16,24,40,.12)",
};

function HeroA2({ status, titulo, resumo, acoes }: { status: string; titulo: string; resumo: string; acoes: Array<{ label: string; onClick: () => void; principal?: boolean }> }) {
  return (
    <section className="a2-visao-hero">
      <div aria-hidden="true" style={{ position: "absolute", right: -80, top: -120, width: 420, height: 420, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
      <div aria-hidden="true" style={{ position: "absolute", right: 180, bottom: -160, width: 320, height: 320, borderRadius: "50%", background: "rgba(110,231,183,.14)" }} />
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6EE7B7", boxShadow: "0 0 0 3px rgba(110,231,183,.25)" }} />{status}
          </span>
          <h1 style={{ margin: "6px 0 0", fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: "#fff" }}>{titulo}</h1>
          <span style={{ color: "rgba(255,255,255,.82)", fontSize: 15 }}>{resumo}</span>
        </div>
        {acoes.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {acoes.map((a) => (
              <button key={a.label} onClick={a.onClick} style={a.principal
                ? { height: 44, borderRadius: 12, border: 0, background: "#FFFFFF", color: "#065F46", fontSize: 14, fontWeight: 800, padding: "0 18px", cursor: "pointer", boxShadow: "0 10px 24px -10px rgba(2,44,34,.6)" }
                : { height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.12)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, padding: "0 16px", cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type Kpi = { icone: string; label: string; valor: string; pill?: string; tom?: "verde" | "laranja"; barra?: number; barraLabel?: string; alerta?: boolean };

function FaixaKpis({ itens }: { itens: Kpi[] }) {
  return (
    <section aria-label="Indicadores" className="a2-visao-kpis">
      {itens.map((k) => {
        const laranja = k.tom === "laranja";
        return (
          <div key={k.label} className="a2-visao-kpi">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: k.alerta && laranja ? "#FFF7ED" : "#ECFDF5", color: k.alerta && laranja ? "#EA580C" : "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nome={k.icone} tamanho={17} espessura={2} />
              </span>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={k.valor}>{k.valor}</span>
            {typeof k.barra === "number" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#EEF2F1" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, k.barra))}%`, height: 8, borderRadius: 99, background: "linear-gradient(90deg, #34D399, #059669)", boxShadow: "0 2px 6px rgba(5,150,105,.4)" }} />
                </div>
                <span style={{ color: "#64748B", fontSize: 12, fontWeight: 700 }} title="Conversão">{k.barraLabel}</span>
              </div>
            ) : k.pill ? (
              <span style={{ alignSelf: "flex-start", background: laranja ? "#FFF7ED" : "#ECFDF5", color: laranja ? "#C2410C" : "#047857", borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>{k.pill}</span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function GraficoVendas({ grafico, periodo, setPeriodo, titulo, unidade = ["venda", "vendas"] }: { grafico: Grafico; periodo: 7 | 30 | 90; setPeriodo: (p: 7 | 30 | 90) => void; titulo: string; unidade?: [string, string] }) {
  const max = Math.max(1, ...grafico.barras.map((b) => b.valor));
  const nomePeriodo = periodo === 7 ? "da semana" : periodo === 30 ? "dos últimos 30 dias" : "dos últimos 90 dias";
  const melhor = grafico.barras[grafico.melhor];
  return (
    <div style={{ ...card, gridColumn: "span 2", padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }} className="a2-visao-grafico">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>{titulo} {nomePeriodo}</h2>
          <span style={{ color: "#64748B", fontSize: 13 }}>
            {num(grafico.total)} {grafico.total === 1 ? unidade[0] : unidade[1]}{grafico.total > 0 && melhor ? ` · melhor ${periodo === 7 ? "dia" : "período"}: ${melhor.label}` : ""}
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "#F3F6F5", padding: 4, borderRadius: 12 }}>
          {([7, 30, 90] as const).map((p) => (
            <button key={p} onClick={() => setPeriodo(p)} style={{ border: 0, background: periodo === p ? "#FFFFFF" : "transparent", borderRadius: 9, padding: "7px 13px", fontSize: 13, fontWeight: periodo === p ? 700 : 600, color: periodo === p ? "#0F172A" : "#64748B", cursor: "pointer", boxShadow: periodo === p ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>{p} dias</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: grafico.barras.length > 8 ? 8 : 16, height: 240, paddingTop: 34 }}>
        {grafico.barras.map((b, i) => {
          const destaque = grafico.total > 0 && i === grafico.melhor;
          const h = grafico.total > 0 ? Math.max(6, Math.round((b.valor / max) * 100)) : 6;
          return (
            <div key={i} title={`${b.label}: ${b.valor}`} style={{ position: "relative", flex: 1, height: `${h}%`, borderRadius: 12, background: destaque ? "linear-gradient(180deg, #34D399 0%, #059669 55%, #047857 100%)" : "#E3F5EC", boxShadow: destaque ? "0 14px 28px -10px rgba(5,150,105,.6)" : "none", transition: "height .35s ease" }}>
              {destaque && (
                <span style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", background: "#0F172A", color: "#FFFFFF", borderRadius: 8, padding: "4px 9px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 6px 14px -6px rgba(15,23,42,.6)" }}>{b.valor} {b.valor === 1 ? unidade[0] : unidade[1]}</span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: grafico.barras.length > 8 ? 8 : 16, color: "#94A3B8", fontSize: grafico.barras.length > 8 ? 11 : 12.5, fontWeight: 600 }}>
        {grafico.barras.map((b, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", color: grafico.total > 0 && i === grafico.melhor ? "#047857" : undefined, fontWeight: grafico.total > 0 && i === grafico.melhor ? 800 : 600 }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

type ItemLista = { chave: string; iniciais: string; titulo: string; sub: string; dir: string; destaque?: boolean; onClick?: () => void };

function CartaoLista({ titulo, link, itens, vazio }: { titulo: string; link?: { label: string; onClick: () => void }; itens: ItemLista[]; vazio: string }) {
  return (
    <div style={{ ...card, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>{titulo}</h2>
        {link && <button onClick={link.onClick} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "#047857", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>{link.label}</button>}
      </div>
      {itens.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 0", color: "#64748B", fontSize: 13.5, textAlign: "center" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="check" tamanho={20} espessura={2.2} /></span>
          {vazio}
        </div>
      ) : itens.map((it) => (
        <div key={it.chave} onClick={it.onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: it.destaque ? "#FFF7ED" : "transparent", cursor: it.onClick ? "pointer" : "default" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: it.destaque ? "#FFFFFF" : "#ECFDF5", color: it.destaque ? "#C2410C" : "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, boxShadow: it.destaque ? "0 2px 6px rgba(194,65,12,.15)" : "none" }}>{it.iniciais}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.titulo}</span>
            <span style={{ color: "#64748B", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</span>
          </div>
          {it.dir && <span style={{ color: it.destaque ? "#C2410C" : "#64748B", fontSize: 12, fontWeight: it.destaque ? 800 : 600, whiteSpace: "nowrap" }}>{it.dir}</span>}
        </div>
      ))}
    </div>
  );
}

function FaixaFunil({ itens, final }: { itens: Array<{ label: string; valor: number; base: number; cor: string }>; final: { label: string; valor: number; nota: string } }) {
  return (
    <section aria-label="Funil" className="a2-visao-funil">
      {itens.map((it) => (
        <div key={it.label} style={{ ...card, borderRadius: 18, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: it.cor }} /><span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{it.label}</span></div>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#0F172A" }}>{num(it.valor)}</span>
          <div style={{ height: 6, borderRadius: 99, background: "#EEF2F1" }}><div style={{ width: `${it.base ? Math.round((it.valor / it.base) * 100) : 0}%`, height: 6, borderRadius: 99, background: it.cor }} /></div>
        </div>
      ))}
      <div style={{ background: "linear-gradient(140deg, #059669, #065F46)", color: "#FFFFFF", borderRadius: 18, padding: "20px 22px", boxShadow: "0 16px 32px -14px rgba(6,95,70,.6)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FFFFFF" }} /><span style={{ color: "rgba(255,255,255,.85)", fontSize: 13, fontWeight: 600 }}>{final.label}</span></div>
        <span style={{ fontSize: 26, fontWeight: 800 }}>{num(final.valor)}</span>
        <span style={{ color: "rgba(255,255,255,.85)", fontSize: 12.5, fontWeight: 600 }}>{final.nota}</span>
      </div>
    </section>
  );
}

function LoadingBox({ text }: { text: string }) {
  return (
    <div style={{ ...card, padding: 44, textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, margin: "0 auto 12px", background: "linear-gradient(140deg, #10B981, #059669)", boxShadow: "0 12px 24px -8px rgba(5,150,105,0.5)" }} />
      <p style={{ color: "#64748B", fontSize: 13, margin: 0, fontWeight: 600 }}>{text}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ ...card, padding: "22px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ color: "#0F172A", fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>{subtitle}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Metric({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <div style={{ background: "#F7FAF9", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ color: "#64748B", fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ color: "#0F172A", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", wordBreak: "break-word" }}>{value}</span>
      <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 500 }}>{note}</span>
    </div>
  );
}

function TenantTable({ rows }: { rows: Array<{ workspace: string; vendas: number; receita: number; canais: number }> }) {
  return (
    <section style={{ ...card, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px 14px" }}>
        <h2 style={{ color: "#0F172A", fontSize: 17, fontWeight: 800, margin: 0 }}>Ranking de workspaces</h2>
        <p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>Por receita instalada e volume de propostas.</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead>
            <tr>
              {["Workspace", "Propostas", "Receita instalada", "Canais"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 24px", color: "#64748B", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #EEF2F1", background: "#F7FAF9" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 22, color: "#94A3B8", fontSize: 13 }}>Sem dados para montar o ranking ainda.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.workspace} style={{ borderTop: "1px solid #EEF2F1" }}>
                <td style={{ padding: "13px 24px", color: "#0F172A", fontSize: 14, fontWeight: 700 }}>{r.workspace}</td>
                <td style={{ padding: "13px 24px", color: "#334155", fontSize: 14 }}>{num(r.vendas)}</td>
                <td style={{ padding: "13px 24px", color: "#047857", fontSize: 14, fontWeight: 700 }}>{real(r.receita)}</td>
                <td style={{ padding: "13px 24px", color: "#334155", fontSize: 14 }}>{num(r.canais)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
