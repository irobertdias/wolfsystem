"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useModulos } from "../../hooks/useModulos";
import { usePermissao } from "../../hooks/usePermissao";

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
  fontFamily: "Arial, sans-serif",
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.93)",
  border: "1px solid rgba(226,232,240,0.95)",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(15,23,42,0.07)",
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
    const emAndamento = propostas.filter((p) => /AGUARD|PENDENT|GERAD|AUDITOR|ANALIS|PROCESS|ANDAMENTO/.test(norm(p.status_venda))).length;
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
      { key: "crm", nome: "CRM", ativo: temCRM, cor: "#16a34a" },
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

  const loadingTenant = workspaceLoading || permLoading || (!isWolfAdmin && !modulosCarregados && tenantWsIds.length === 0) || carregando;

  if (isWolfAdmin) {
    return (
      <div style={shell}>
        <Hero
          badge="Central wolf_admin"
          title="Comando Multi-Tenant"
          subtitle="Visao de dono da plataforma: clientes, workspaces, modulos, canais e movimento geral do ecossistema Wolf."
          pills={[
            `${cadastros.length} cliente(s) cadastrados`,
            `${workspaces.length} workspace(s)`,
            `${usuarios} usuario(s) vinculados`,
            `${canaisResumo.conectados}/${canaisResumo.total} canais conectados`,
          ]}
          pulse={[
            ["Receita instalada total", real(vendas.receitaMes), "#16a34a"],
            ["Clientes ativos", num(adminStats.ativos), "#2563eb"],
            ["Workspaces ativos", num(adminStats.wsAtivos), "#7c3aed"],
            ["Canais WABA/API", num(canaisResumo.waba), "#0891b2"],
          ]}
        />

        {adminCarregando ? (
          <LoadingBox text="Carregando centro de comando da plataforma..." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Section title="Plataforma" subtitle="Saude comercial e operacional do Wolf System." accent="#0f172a">
              <Metric label="Clientes ativos" value={num(adminStats.ativos)} color="#16a34a" note="autorizados e nao suspensos" />
              <Metric label="Suspensos" value={num(adminStats.suspensos)} color="#dc2626" note="bloqueio financeiro" />
              <Metric label="Workspaces ativos" value={num(adminStats.wsAtivos)} color="#2563eb" note="ambientes operacionais" />
              <Metric label="Usuarios vinculados" value={num(usuarios)} color="#7c3aed" note="usuarios_workspace" />
            </Section>

            <Section title="Planos e modulos" subtitle="Distribuicao do que esta vendido e liberado por cliente." accent="#7c3aed">
              <Metric label="Basico" value={num(adminStats.basico)} color="#16a34a" note="clientes no plano" />
              <Metric label="Intermediario" value={num(adminStats.intermediario)} color="#2563eb" note="clientes no plano" />
              <Metric label="Ultra" value={num(adminStats.ultra)} color="#7c3aed" note="clientes no plano" />
              <Metric label="Cobranca" value={num(adminStats.clientesComCobranca)} color="#dc2626" note="modulo liberado" />
              <Metric label="RH" value={num(adminStats.clientesComRH)} color="#4f46e5" note="modulo liberado" />
              <Metric label="Financeiro" value={num(adminStats.clientesComFinanceiro)} color="#d97706" note="modulo liberado" />
              <Metric label="Telefonia" value={num(adminStats.clientesComVoip)} color="#0891b2" note="modulo liberado" />
              <Metric label="API oficial" value={num(adminStats.clientesComApi)} color="#0f766e" note="disparos api" />
            </Section>

            <Section title="Operacao global" subtitle="Movimento agregado de vendas e canais de todos os tenants visiveis." accent="#16a34a">
              <Metric label="Propostas totais" value={num(propostas.length)} color="#2563eb" note="todos os workspaces" />
              <Metric label="Instaladas" value={num(vendas.instaladas)} color="#16a34a" note="status instalados" />
              <Metric label="Em andamento" value={num(vendas.emAndamento)} color="#f59e0b" note="pendentes e geradas" />
              <Metric label="Canceladas" value={num(vendas.canceladas)} color="#dc2626" note="perdas e reprovas" />
              <Metric label="Canais conectados" value={`${canaisResumo.conectados}/${canaisResumo.total}`} color="#0891b2" note="webjs + waba" />
              <Metric label="WebJS / WABA" value={`${num(canaisResumo.webjs)} / ${num(canaisResumo.waba)}`} color="#7c3aed" note="mix de conexoes" />
            </Section>

            <TenantTable rows={topTenants} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={shell}>
      <Hero
        badge="Painel vivo do workspace"
        title="Visao Geral"
        subtitle={`${tenantNome || (workspace as any)?.nome || "Workspace"} em modo operacional. A tela mostra apenas os modulos liberados no plano deste tenant e resume o que merece atencao agora.`}
        pills={[
          `Plano ${String(modulos.plano || "basico").replace("_", " ")}`,
          `${modulosAtivos.length} modulo(s) ativo(s)`,
          `${usuarios} usuario(s)`,
          `Workspace ${tenantWsIds[0] || wsId || "-"}`,
        ]}
        pulse={[
          ["Receita instalada no mes", real(vendas.receitaMes), "#16a34a"],
          ["Propostas totais", num(vendas.total), "#2563eb"],
          ["Conversao acumulada", `${vendas.conversao}%`, "#7c3aed"],
          ...(temTelefonia ? [["Canais conectados", `${canaisResumo.conectados}/${canaisResumo.total}`, "#0891b2"] as [string, string, string]] : []),
        ]}
      />

      {loadingTenant ? (
        <LoadingBox text={tenantWsIds.length === 0 && !workspaceLoading ? "Localizando dados do workspace..." : "Carregando panorama do tenant..."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <ModuleStrip items={modulosAtivos} />

          {temVendas && (
            <Section title="Vendas" subtitle="Receita, propostas e velocidade comercial do workspace." accent="#16a34a">
              <Metric label="Receita do mes" value={real(vendas.receitaMes)} color="#16a34a" note="instaladas no periodo" />
              <Metric label="Propostas totais" value={num(vendas.total)} color="#2563eb" note={`${num(vendas.criadasMes)} criada(s) no mes`} />
              <Metric label="Instaladas" value={num(vendas.instaladas)} color="#0ea5e9" note="total visivel" />
              <Metric label="Em andamento" value={num(vendas.emAndamento)} color="#f59e0b" note="pendentes, geradas, aguardando" />
              <Metric label="Canceladas" value={num(vendas.canceladas)} color="#dc2626" note="canceladas e reprovadas" />
              <Metric label="Conversao" value={`${vendas.conversao}%`} color="#7c3aed" note="instaladas sobre total" />
            </Section>
          )}

          {temCobranca && (
            <Section title="Cobranca" subtitle="Somente aparece para planos com modulo de cobranca ativo." accent="#dc2626">
              <Metric label="Em dia" value={num(cobranca.emDia)} color="#16a34a" note="sem risco imediato" />
              <Metric label="Vencendo" value={num(cobranca.vencendo)} color="#f59e0b" note="proximos 2 dias" />
              <Metric label="Atrasado" value={num(cobranca.atrasado)} color="#dc2626" note="vencimento passou" />
              <Metric label="Bloqueado" value={num(cobranca.bloqueado)} color="#7f1d1d" note="2+ dias vencido" />
            </Section>
          )}

          {(temRH || temPonto) && (
            <Section title="Pessoas e ponto" subtitle="RH e ponto respeitam separadamente os modulos do plano." accent="#4f46e5">
              {temRH && <Metric label="Funcionarios ativos" value={num(rh.ativos)} color="#4f46e5" note="na base de RH" />}
              {temRH && <Metric label="Custo da folha" value={real(rh.custoFolha)} color="#d97706" note="competencia atual" />}
              {temPonto && <Metric label="Batidas hoje" value={num(pontoHoje)} color="#0891b2" note={hojeISO()} />}
            </Section>
          )}

          {temFinanceiro && (
            <Section title="Financeiro" subtitle="Resumo do modulo financeiro liberado para este workspace." accent="#d97706">
              <Metric label="Receitas do mes" value={real(financeiro.receitas)} color="#16a34a" note="lancamentos do periodo" />
              <Metric label="Despesas do mes" value={real(financeiro.despesas)} color="#dc2626" note="lancamentos do periodo" />
              <Metric label="Saldo projetado" value={real(financeiro.saldo)} color={financeiro.saldo >= 0 ? "#16a34a" : "#dc2626"} note="receitas - despesas" />
              <Metric label="Pendencias" value={num(financeiro.pendentes)} color="#f59e0b" note="nao pagos" />
            </Section>
          )}

          {(temTelefonia || temDisparos || temIntegracoes) && (
            <Section title="Canais e automacao" subtitle="Mostra apenas recursos liberados: telefonia, disparos, API, Instagram e roleta." accent="#0891b2">
              {temTelefonia && <Metric label="Canais conectados" value={`${canaisResumo.conectados}/${canaisResumo.total}`} color="#0891b2" note="conexoes ativas" />}
              {temTelefonia && <Metric label="WebJS" value={num(canaisResumo.webjs)} color="#16a34a" note="canais QR" />}
              {temDisparos && <Metric label="WABA/API" value={num(canaisResumo.waba)} color="#2563eb" note="API oficial" />}
              {modulos.roleta && <Metric label="Roleta" value="Ativa no plano" color="#7c3aed" note="distribuicao de leads" />}
              {modulos.instagram && <Metric label="Instagram" value="Liberado" color="#db2777" note="atendimento social" />}
              {modulos.api_integracao && <Metric label="API" value="Liberada" color="#0f766e" note="integracoes externas" />}
            </Section>
          )}

          {temEquipe && (
            <Section title="Equipe" subtitle="Base administrativa do workspace." accent="#2563eb">
              <Metric label="Usuarios no workspace" value={num(usuarios)} color="#2563eb" note="logins vinculados" />
              <Metric label="Vendedores ativos" value={num(vendedoresAtivos)} color="#0ea5e9" note="com propostas vinculadas" />
            </Section>
          )}

          {!temVendas && !temCobranca && !temRH && !temPonto && !temFinanceiro && !temTelefonia && !temDisparos && !temIntegracoes && !temEquipe && (
            <div style={{ ...panel, padding: 32, textAlign: "center" }}>
              <p style={{ color: "#0f172a", fontSize: 18, fontWeight: 900, margin: 0 }}>Nenhum modulo visivel para seu usuario.</p>
              <p style={{ color: "#64748b", fontSize: 13, margin: "8px 0 0" }}>O plano ou as permissoes deste login nao liberam indicadores nesta visao.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Hero({ badge, title, subtitle, pills, pulse }: { badge: string; title: string; subtitle: string; pills: string[]; pulse: Array<[string, string, string]> }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, marginBottom: 18, border: "1px solid #dbeafe", background: "linear-gradient(135deg, #f8fafc 0%, #eefdf4 42%, #eff6ff 100%)" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 12% 20%, rgba(22,163,74,0.18), transparent 28%), radial-gradient(circle at 85% 25%, rgba(14,165,233,0.18), transparent 28%), linear-gradient(120deg, rgba(255,255,255,0.72), rgba(255,255,255,0.36))" }} />
      <div style={{ position: "relative", padding: "24px 26px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "stretch" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "rgba(15,23,42,0.06)", border: "1px solid rgba(15,23,42,0.08)", marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16a34a", boxShadow: "0 0 0 5px rgba(22,163,74,0.12)" }} />
            <span style={{ color: "#334155", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 }}>{badge}</span>
          </div>
          <h1 style={{ color: "#07111f", fontSize: 34, lineHeight: 1.05, fontWeight: 950, margin: 0, letterSpacing: -1.2 }}>{title}</h1>
          <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.55, margin: "10px 0 0", maxWidth: 780 }}>{subtitle}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {pills.map((p, i) => <Pill key={i} label={p} color={i === 0 ? "#0f172a" : i === 1 ? "#16a34a" : i === 2 ? "#2563eb" : "#64748b"} />)}
          </div>
        </div>

        <div style={{ ...panel, padding: 16, display: "grid", gap: 10 }}>
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>Pulso geral</p>
          {pulse.map(([label, value, color]) => <PulseRow key={label} label={label} value={value} color={color} />)}
        </div>
      </div>
    </div>
  );
}

function LoadingBox({ text }: { text: string }) {
  return (
    <div style={{ ...panel, padding: 44, textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, margin: "0 auto 12px", background: "linear-gradient(135deg,#16a34a,#0ea5e9)", boxShadow: "0 12px 24px rgba(14,165,233,0.18)" }} />
      <p style={{ color: "#64748b", fontSize: 13, margin: 0, fontWeight: 700 }}>{text}</p>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, background: "#ffffff", border: `1px solid ${color}22`, color, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.35 }}>
      {label}
    </span>
  );
}

function PulseRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 950 }}>{value}</span>
    </div>
  );
}

function ModuleStrip({ items }: { items: Array<{ key: string; nome: string; cor: string }> }) {
  return (
    <div style={{ ...panel, padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6, marginRight: 2 }}>Modulos liberados</span>
      {items.map((item) => (
        <span key={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 999, background: `${item.cor}10`, border: `1px solid ${item.cor}30`, color: item.cor, fontSize: 12, fontWeight: 900 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: item.cor, boxShadow: `0 0 0 4px ${item.cor}16` }} />
          {item.nome}
        </span>
      ))}
    </div>
  );
}

function Section({ title, subtitle, accent, children }: { title: string; subtitle: string; accent: string; children: React.ReactNode }) {
  return (
    <section style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: `linear-gradient(90deg, ${accent}10, rgba(255,255,255,0.9))` }}>
        <div>
          <h2 style={{ color: "#0f172a", fontSize: 16, fontWeight: 950, margin: 0, letterSpacing: -0.2 }}>{title}</h2>
          <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>{subtitle}</p>
        </div>
        <div style={{ width: 36, height: 8, borderRadius: 99, background: accent, boxShadow: `0 0 18px ${accent}66` }} />
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Metric({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, minHeight: 96, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${color}12, transparent 55%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <p style={{ color: "#64748b", fontSize: 10, fontWeight: 950, textTransform: "uppercase", letterSpacing: 0.55, margin: 0 }}>{label}</p>
        <p style={{ color, fontSize: 24, lineHeight: 1.1, fontWeight: 950, letterSpacing: -0.7, margin: "10px 0 0", wordBreak: "break-word" }}>{value}</p>
        <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, margin: "5px 0 0" }}>{note}</p>
      </div>
    </div>
  );
}

function TenantTable({ rows }: { rows: Array<{ workspace: string; vendas: number; receita: number; canais: number }> }) {
  return (
    <section style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(90deg, rgba(15,23,42,0.08), rgba(255,255,255,0.9))" }}>
        <h2 style={{ color: "#0f172a", fontSize: 16, fontWeight: 950, margin: 0 }}>Tenants em destaque</h2>
        <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>Ranking por receita instalada e volume de propostas.</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Workspace", "Propostas", "Receita instalada", "Canais"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontSize: 11, fontWeight: 950, textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 22, color: "#94a3b8", fontSize: 13 }}>Sem dados para montar ranking ainda.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.workspace} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#ffffff" : "#fbfdff" }}>
                <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13, fontWeight: 900 }}>{r.workspace}</td>
                <td style={{ padding: "12px 16px", color: "#2563eb", fontSize: 13, fontWeight: 900 }}>{num(r.vendas)}</td>
                <td style={{ padding: "12px 16px", color: "#16a34a", fontSize: 13, fontWeight: 900 }}>{real(r.receita)}</td>
                <td style={{ padding: "12px 16px", color: "#7c3aed", fontSize: 13, fontWeight: 900 }}>{num(r.canais)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

