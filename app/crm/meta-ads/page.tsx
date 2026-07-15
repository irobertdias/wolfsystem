"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import styles from "./MetaAds.module.css";

const META_BASE = process.env.NEXT_PUBLIC_META_URL || "https://meta.api.wolfgyn.com.br";
const FB_APP_ID = process.env.NEXT_PUBLIC_META_FB_APP_ID || "1014671678116787";
const GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v21.0";

type Conta = { id:string; accountId?:string; nome:string; status?:number; moeda?:string; fusoHorario?:string; };
type StatusData = { conectado:boolean; metaUsuario?:{id:string;nome:string}; contaSelecionada?:Conta|null; contas?:Conta[]; tokenExpiraEm?:string|null; atualizadoEm?:string; };
type Campanha = { id:string; nome:string; status:string; objetivo?:string|null; orcamentoDiario:number; orcamentoTotal:number; gasto:number; impressoes:number; alcance:number; cliques:number; ctr:number; cpc:number; cpm:number; frequencia:number; leads:number; formularios:number; conversas:number; compras:number; receita:number; cpl:number; custoFormulario:number; custoConversa:number; custoCompra:number; roas:number; };
type Dashboard = { conta:Conta & {saldo:number;limiteGasto:number}; resumo:Omit<Campanha,"id"|"nome"|"status"|"objetivo"|"orcamentoDiario"|"orcamentoTotal">; campanhas:Campanha[]; atualizadoEm:string; };

function mensagemErro(error:unknown, fallback:string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const periodos = [
  ["today","Hoje"], ["yesterday","Ontem"], ["last_7d","Últimos 7 dias"],
  ["last_14d","Últimos 14 dias"], ["last_30d","Últimos 30 dias"],
  ["this_month","Este mês"], ["last_month","Mês passado"],
];

function traduzStatus(status:string) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return ["Ativa", styles.statusActive];
  if (["PAUSED","CAMPAIGN_PAUSED","ADSET_PAUSED"].includes(s)) return ["Pausada", styles.statusPaused];
  if (["DISAPPROVED","WITH_ISSUES","ERROR","ARCHIVED","DELETED"].includes(s)) return ["Com problema", styles.statusError];
  return [s || "Sem status", styles.statusPaused];
}

function objetivo(valor?:string|null) {
  const mapa:Record<string,string> = { OUTCOME_LEADS:"Leads", OUTCOME_SALES:"Vendas", OUTCOME_TRAFFIC:"Tráfego", OUTCOME_ENGAGEMENT:"Engajamento", OUTCOME_AWARENESS:"Reconhecimento", OUTCOME_APP_PROMOTION:"Aplicativo", LEAD_GENERATION:"Leads", MESSAGES:"Mensagens" };
  return mapa[String(valor)] || String(valor || "—").replaceAll("_"," ");
}

export default function MetaAdsPage() {
  const { wsId, wsPronto } = useWorkspace();
  const { isDono, isSuperAdmin, perfil } = usePermissao();
  const podeConfigurar = isDono || isSuperAdmin || perfil === "Administrador";
  const [status, setStatus] = useState<StatusData|null>(null);
  const [dashboard, setDashboard] = useState<Dashboard|null>(null);
  const [periodo, setPeriodo] = useState("last_30d");
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const api = useCallback(async (path:string, init:RequestInit = {}) => {
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente no sistema.");
    const response = await fetch(`${META_BASE}/ads${path}`, {
      ...init,
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}`, ...(init.headers || {}) },
      cache:"no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.sucesso === false) throw new Error(data.erro || "Não foi possível consultar a Meta.");
    return data;
  }, []);

  const carregarDashboard = useCallback(async (forcar=false, periodoAtual=periodo) => {
    if (!wsId) return;
    setAtualizando(true); setErro("");
    try {
      const data = await api(`/dashboard?workspaceId=${encodeURIComponent(wsId)}&periodo=${periodoAtual}${forcar ? "&atualizar=1" : ""}`);
      setDashboard(data);
    } catch (e:unknown) { setErro(mensagemErro(e, "Falha ao carregar anúncios.")); setDashboard(null); }
    finally { setAtualizando(false); }
  }, [api, periodo, wsId]);

  const carregarStatus = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true); setErro("");
    try {
      const data = await api(`/status?workspaceId=${encodeURIComponent(wsId)}`);
      setStatus(data);
      if (data.conectado && data.contaSelecionada) await carregarDashboard(false);
      else setDashboard(null);
    } catch (e:unknown) { setErro(mensagemErro(e, "Falha ao verificar a conexão com a Meta.")); }
    finally { setCarregando(false); }
  }, [api, carregarDashboard, wsId]);

  useEffect(() => { if (wsPronto) carregarStatus(); }, [wsPronto, carregarStatus]);

  const conectar = () => {
    if (!podeConfigurar) { setErro("Somente o dono ou administrador pode conectar a conta de anúncios."); return; }
    setErro(""); setMensagem("");

    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}/crm/marketing/meta-ads`;
    const oauthUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    oauthUrl.search = new URLSearchParams({
      client_id: FB_APP_ID,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: "ads_read,business_management",
      state,
      display: "popup",
      auth_type: "rerequest",
    }).toString();

    const popup = window.open(oauthUrl.toString(), "wolf-meta-ads-oauth", "popup=yes,width=620,height=760,resizable=yes,scrollbars=yes");
    if (!popup) { setErro("O navegador bloqueou a janela da Meta. Libere os pop-ups para app.wolfgyn.com.br e tente novamente."); return; }

    setConectando(true);
    let finalizado = false;
    let acompanhar = 0;
    let limite = 0;
    const limpar = () => {
      window.removeEventListener("message", receber);
      if (acompanhar) window.clearInterval(acompanhar);
      if (limite) window.clearTimeout(limite);
    };
    const receber = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "wolf-meta-ads-oauth" || event.data?.state !== state) return;
      finalizado = true; limpar(); popup.close();
      if (event.data?.error || !event.data?.accessToken) {
        setConectando(false); setErro(event.data?.error || "A conexão com a Meta foi cancelada."); return;
      }
      try {
        const data = await api("/conectar", { method:"POST", body:JSON.stringify({ workspaceId:wsId, accessToken:event.data.accessToken }) });
        setMensagem(data.mensagem || "Conta Meta conectada.");
        await carregarStatus();
      } catch (e:unknown) { setErro(mensagemErro(e, "Não foi possível conectar a conta Meta.")); }
      finally { setConectando(false); }
    };
    window.addEventListener("message", receber);
    acompanhar = window.setInterval(() => {
      if (popup.closed && !finalizado) { finalizado = true; limpar(); setConectando(false); setErro("A janela da Meta foi fechada antes da conexão."); }
    }, 500);
    limite = window.setTimeout(() => {
      if (!finalizado) { finalizado = true; limpar(); popup.close(); setConectando(false); setErro("A conexão com a Meta demorou demais. Tente novamente."); }
    }, 120000);
  };

  const selecionarConta = async (accountId:string) => {
    if (!accountId) return;
    setAtualizando(true); setErro("");
    try {
      await api("/selecionar-conta", { method:"POST", body:JSON.stringify({ workspaceId:wsId, accountId }) });
      await carregarStatus();
    } catch (e:unknown) { setErro(mensagemErro(e, "Não foi possível selecionar a conta.")); }
    finally { setAtualizando(false); }
  };

  const desconectar = async () => {
    if (!confirm("Desconectar o Gerenciador de Anúncios deste workspace? Nenhuma campanha será alterada.")) return;
    try {
      await api("/desconectar", { method:"POST", body:JSON.stringify({ workspaceId:wsId }) });
      setStatus({ conectado:false }); setDashboard(null); setMensagem("Conta desconectada da Wolf.");
    } catch (e:unknown) { setErro(mensagemErro(e, "Não foi possível desconectar.")); }
  };

  const moeda = dashboard?.conta?.moeda || status?.contaSelecionada?.moeda || "BRL";
  const money = useMemo(() => new Intl.NumberFormat("pt-BR", { style:"currency", currency:moeda }), [moeda]);
  const integer = useMemo(() => new Intl.NumberFormat("pt-BR", { maximumFractionDigits:0 }), []);
  const decimal = (n:number, casas=2) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits:casas, maximumFractionDigits:casas });
  const topCampanhas = (dashboard?.campanhas || []).filter(c => c.gasto > 0).slice(0,5);
  const maiorGasto = Math.max(1, ...topCampanhas.map(c => c.gasto));

  if (carregando) return <div className={styles.loading}>Carregando Central Meta...</div>;

  return <div className={styles.page}>
    <div className={styles.header}>
      <div>
        <div className={styles.badge}>● Somente leitura</div>
        <h1 className={styles.title}>Central Meta Ads</h1>
        <p className={styles.subtitle}>Campanhas, investimento e resultados da Meta dentro da Wolf — sem alterar anúncios ou orçamentos.</p>
      </div>
      <div className={styles.actions}>
        {status?.conectado && podeConfigurar && <button className={`${styles.button} ${styles.secondary}`} onClick={conectar} disabled={conectando}>Renovar conexão</button>}
        {status?.conectado && podeConfigurar && <button className={`${styles.button} ${styles.danger}`} onClick={desconectar}>Desconectar</button>}
      </div>
    </div>

    {erro && <div className={`${styles.alert} ${styles.alertError}`}><strong>Não foi possível concluir:</strong> {erro}</div>}
    {mensagem && <div className={`${styles.alert} ${styles.alertInfo}`}>{mensagem}</div>}

    {!status?.conectado ? <div className={styles.connection}>
      <div><h2>Conecte seu Gerenciador de Anúncios</h2><p>Use o Login oficial da Meta. A Wolf solicitará acesso somente para consultar contas, campanhas e métricas. O token será criptografado no backend.</p></div>
      {podeConfigurar ? <button className={`${styles.button} ${styles.primary}`} onClick={conectar} disabled={conectando}>{conectando ? "Conectando..." : "Conectar com a Meta"}</button> : <span className={styles.badge}>Aguardando administrador</span>}
    </div> : <>
      <div className={styles.toolbar}>
        <div className={styles.account}><div className={styles.accountIcon}>M</div><div><strong>{status.contaSelecionada?.nome || "Escolha uma conta"}</strong><span>{status.metaUsuario?.nome} · {status.contaSelecionada?.id || "Nenhuma conta selecionada"}</span></div></div>
        <div className={styles.actions}>
          {(status.contas?.length || 0) > 1 && <select className={styles.selector} value={status.contaSelecionada?.id || ""} onChange={e => selecionarConta(e.target.value)} disabled={!podeConfigurar || atualizando}><option value="">Selecionar conta...</option>{status.contas?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
          <select className={styles.selector} value={periodo} onChange={e => { setPeriodo(e.target.value); carregarDashboard(false,e.target.value); }} disabled={!status.contaSelecionada}>{periodos.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button className={`${styles.button} ${styles.secondary}`} onClick={() => carregarDashboard(true)} disabled={atualizando || !status.contaSelecionada}>{atualizando ? "Atualizando..." : "Atualizar dados"}</button>
        </div>
      </div>

      {!status.contaSelecionada ? <div className={styles.empty}><strong>Escolha uma conta de anúncios</strong>Selecione acima a conta que este workspace acompanhará.</div> : dashboard ? <>
        <div className={styles.kpis}>
          <Kpi label="Investimento" value={money.format(dashboard.resumo.gasto)} note={`${integer.format(dashboard.resumo.impressoes)} impressões`} />
          <Kpi label="Leads" value={integer.format(dashboard.resumo.leads)} note={`CPL ${money.format(dashboard.resumo.cpl)}`} />
          <Kpi label={"Formul\u00e1rios"} value={integer.format(dashboard.resumo.formularios || 0)} note={`Custo ${money.format(dashboard.resumo.custoFormulario || 0)}`} />
          <Kpi label="CPA" value={money.format(dashboard.resumo.custoCompra || 0)} note={`${integer.format(dashboard.resumo.compras || 0)} compras`} />
          <Kpi label="Conversas" value={integer.format(dashboard.resumo.conversas)} note={`Custo ${money.format(dashboard.resumo.custoConversa)}`} />
          <Kpi label="Compras" value={integer.format(dashboard.resumo.compras)} note={`Custo ${money.format(dashboard.resumo.custoCompra)}`} />
          <Kpi label="Alcance" value={integer.format(dashboard.resumo.alcance)} note={`Frequência ${decimal(dashboard.resumo.frequencia)}`} />
          <Kpi label="Cliques" value={integer.format(dashboard.resumo.cliques)} note={`CTR ${decimal(dashboard.resumo.ctr)}%`} />
          <Kpi label="CPC" value={money.format(dashboard.resumo.cpc)} note={`CPM ${money.format(dashboard.resumo.cpm)}`} />
          <Kpi label="ROAS Meta" value={`${decimal(dashboard.resumo.roas)}x`} note={`Receita atribuída ${money.format(dashboard.resumo.receita)}`} />
        </div>

        <div className={styles.split}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}><h3>Campanhas</h3><span>{dashboard.campanhas.length} encontrada(s)</span></div>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Campanha</th><th>Status</th><th>Objetivo</th><th>Investimento</th><th>Leads</th><th>Formul&aacute;rios</th><th>Custo/form.</th><th>CPL</th><th>CPC</th><th>CPA</th><th>Conversas</th><th>Cliques</th><th>CTR</th><th>ROAS</th></tr></thead><tbody>
              {dashboard.campanhas.length === 0 ? <tr><td colSpan={14}><div className={styles.empty}>Nenhuma campanha encontrada neste período.</div></td></tr> : dashboard.campanhas.map(c => { const [label,statusClass]=traduzStatus(c.status); return <tr key={c.id}><td><div className={styles.campaignName} title={c.nome}>{c.nome}</div></td><td><span className={`${styles.status} ${statusClass}`}>{label}</span></td><td>{objetivo(c.objetivo)}</td><td>{money.format(c.gasto)}</td><td>{integer.format(c.leads)}</td><td>{integer.format(c.formularios || 0)}</td><td>{money.format(c.custoFormulario || 0)}</td><td>{money.format(c.cpl)}</td><td>{money.format(c.cpc)}</td><td>{money.format(c.custoCompra || 0)}</td><td>{integer.format(c.conversas)}</td><td>{integer.format(c.cliques)}</td><td>{decimal(c.ctr)}%</td><td>{decimal(c.roas)}x</td></tr>; })}
            </tbody></table></div>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHeader}><h3>Maiores investimentos</h3><span>Top 5</span></div>
            <div className={styles.bars}>{topCampanhas.length === 0 ? <div className={styles.empty}>Sem investimento no período.</div> : topCampanhas.map(c => <div className={styles.barRow} key={c.id}><div className={styles.barLabel}><strong title={c.nome}>{c.nome}</strong><span>{money.format(c.gasto)}</span></div><div className={styles.barTrack}><div className={styles.barFill} style={{width:`${Math.max(3,(c.gasto/maiorGasto)*100)}%`}} /></div></div>)}</div>
          </div>
        </div>
        <div className={styles.footerNote}>Atualizado em {new Date(dashboard.atualizadoEm).toLocaleString("pt-BR")} · dados fornecidos pela Meta</div>
      </> : <div className={styles.empty}><strong>Dados indisponíveis</strong>Use “Atualizar dados” para consultar a Meta novamente.</div>}
    </>}
  </div>;
}

function Kpi({label,value,note}:{label:string;value:string;note:string}) {
  return <div className={styles.card}><div className={styles.cardLabel}>{label}</div><div className={styles.cardValue}>{value}</div><div className={styles.cardNote}>{note}</div></div>;
}
