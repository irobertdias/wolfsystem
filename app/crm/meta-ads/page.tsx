"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { ModuloBloqueado, useModulos } from "../../hooks/useModulos";
import MetaSettings from "./MetaSettings";
import { Alertas, Campanhas, Comparativo, InstagramPanel, VisaoGeral } from "./MetaDashboardViews";
import { Dashboard, ganhou, InstagramDashboard, n, noIntervalo, objetivo, PADRAO, PERIODOS, Preferencias, Proposta, RegraAlerta, StatusData } from "./metaTypes";
import styles from "./MetaAds.module.css";

const META_BASE=process.env.NEXT_PUBLIC_META_URL||"https://meta.api.wolfgyn.com.br";
const FB_APP_ID=process.env.NEXT_PUBLIC_META_FB_APP_ID||"1014671678116787";
const GRAPH_VERSION=process.env.NEXT_PUBLIC_META_GRAPH_VERSION||"v21.0";
function erroTexto(e:unknown,f:string){return e instanceof Error&&e.message?e.message:f;}

export default function MetaAdsPage(){
  const{wsId,wsPronto}=useWorkspace();
  const{isDono,isSuperAdmin,perfil}=usePermissao();
  const podeConfigurar=isDono||isSuperAdmin||perfil==="Administrador";
  const{modulos,carregado:modulosCarregados}=useModulos();
  const[status,setStatus]=useState<StatusData|null>(null);
  const[dashboard,setDashboard]=useState<Dashboard|null>(null);
  const[instagram,setInstagram]=useState<InstagramDashboard|null>(null);
  const[preferencias,setPreferencias]=useState<Preferencias>(PADRAO);
  const[propostas,setPropostas]=useState<Proposta[]>([]);
  const[periodo,setPeriodo]=useState("last_30d");
  const[aba,setAba]=useState<"visao"|"comparativo"|"campanhas"|"instagram">("visao");
  const[campanhaId,setCampanhaId]=useState("todas");
  const[configurando,setConfigurando]=useState(false);
  const[alertasAbertos,setAlertasAbertos]=useState<RegraAlerta[]>([]);
  const[carregando,setCarregando]=useState(true);
  const[atualizando,setAtualizando]=useState(false);
  const[conectando,setConectando]=useState("");
  const[erro,setErro]=useState("");
  const[mensagem,setMensagem]=useState("");

  const api=useCallback(async(path:string,init:RequestInit={})=>{
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw new Error("Sua sessão expirou. Entre novamente.");
    const response=await fetch(META_BASE+"/ads"+path,{...init,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,...(init.headers||{})},cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.sucesso===false)throw new Error(data.erro||"Não foi possível consultar a Meta.");
    return data;
  },[]);

  const carregarPropostas=useCallback(async()=>{
    if(!wsId)return;
    const desde=new Date();desde.setMonth(desde.getMonth()-13);
    const{data}=await supabase.from("proposta").select("created_at,data_proposta,status_venda,valor_plano").eq("workspace_id",wsId).gte("created_at",desde.toISOString()).limit(10000);
    setPropostas((data||[])as Proposta[]);
  },[wsId]);

  const carregarInstagram=useCallback(async(p=periodo)=>{
    if(!wsId)return;
    try{setInstagram(await api("/instagram/dashboard?workspaceId="+encodeURIComponent(wsId)+"&periodo="+p));}
    catch(e:unknown){setInstagram(null);if(aba==="instagram")setErro(erroTexto(e,"Falha ao consultar o Instagram."));}
  },[aba,api,periodo,wsId]);

  const carregarDashboard=useCallback(async(forcar=false,p=periodo)=>{
    if(!wsId)return;setAtualizando(true);setErro("");
    try{const data=await api("/dashboard?workspaceId="+encodeURIComponent(wsId)+"&periodo="+p+(forcar?"&atualizar=1":""));setDashboard(data);if(status?.instagram?.conectado)await carregarInstagram(p);}
    catch(e:unknown){setErro(erroTexto(e,"Falha ao carregar anúncios."));setDashboard(null);}
    finally{setAtualizando(false);}
  },[api,carregarInstagram,periodo,status?.instagram?.conectado,wsId]);

  const carregarStatus=useCallback(async()=>{
    if(!wsId)return;setCarregando(true);setErro("");
    try{
      const[dadosStatus,dadosPrefs]=await Promise.all([api("/status?workspaceId="+encodeURIComponent(wsId)),api("/preferencias?workspaceId="+encodeURIComponent(wsId))]);
      setStatus(dadosStatus);setPreferencias(dadosPrefs.preferencias||PADRAO);await carregarPropostas();
      if(dadosStatus.conectado&&dadosStatus.contaSelecionada)setDashboard(await api("/dashboard?workspaceId="+encodeURIComponent(wsId)+"&periodo="+periodo));
      if(dadosStatus.instagram?.conectado)try{setInstagram(await api("/instagram/dashboard?workspaceId="+encodeURIComponent(wsId)+"&periodo="+periodo));}catch{setInstagram(null);}
    }catch(e:unknown){setErro(erroTexto(e,"Falha ao verificar a conexão com a Meta."));}
    finally{setCarregando(false);}
  },[api,carregarPropostas,periodo,wsId]);

  useEffect(()=>{if(wsPronto&&modulosCarregados&&modulos.meta_ads)carregarStatus();},[wsPronto,modulosCarregados,modulos.meta_ads,carregarStatus]);

  const abrirOAuth=(tipo:"ads"|"instagram")=>{
    if(!podeConfigurar){setErro("Somente o dono ou administrador pode conectar contas.");return;}
    const state=crypto.randomUUID(),redirectUri=window.location.origin+"/crm/marketing/meta-ads";
    const scope=tipo==="instagram"?"ads_read,business_management,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights":"ads_read,business_management";
    const url=new URL("https://www.facebook.com/"+GRAPH_VERSION+"/dialog/oauth");
    url.search=new URLSearchParams({client_id:FB_APP_ID,redirect_uri:redirectUri,response_type:"token",scope,state,display:"popup",auth_type:"rerequest"}).toString();
    const popup=window.open(url.toString(),"wolf-meta-"+tipo,"popup=yes,width=640,height=780,resizable=yes,scrollbars=yes");
    if(!popup){setErro("O navegador bloqueou a janela da Meta. Libere os pop-ups.");return;}
    setConectando(tipo);setErro("");setMensagem("");let encerrado=false;
    const finalizar=()=>{window.removeEventListener("message",receber);window.clearInterval(intervalo);window.clearTimeout(limite);};
    const receber=async(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.data?.type!=="wolf-meta-ads-oauth"||event.data?.state!==state)return;
      encerrado=true;finalizar();popup.close();
      if(event.data?.error||!event.data?.accessToken){setConectando("");setErro(event.data?.error||"A conexão foi cancelada.");return;}
      try{const endpoint=tipo==="instagram"?"/instagram/conectar":"/conectar";const data=await api(endpoint,{method:"POST",body:JSON.stringify({workspaceId:wsId,accessToken:event.data.accessToken})});setMensagem(data.mensagem||"Conta conectada.");await carregarStatus();}
      catch(e:unknown){setErro(erroTexto(e,"Não foi possível conectar a conta."));}
      finally{setConectando("");}
    };
    window.addEventListener("message",receber);
    const intervalo=window.setInterval(()=>{if(popup.closed&&!encerrado){encerrado=true;finalizar();setConectando("");}},500);
    const limite=window.setTimeout(()=>{if(!encerrado){encerrado=true;finalizar();popup.close();setConectando("");setErro("A conexão demorou demais.");}},120000);
  };

  const selecionar=async(tipo:"ads"|"instagram",id:string)=>{
    if(!id)return;setAtualizando(true);
    try{const path=tipo==="ads"?"/selecionar-conta":"/instagram/selecionar";const chave=tipo==="ads"?"accountId":"instagramUserId";await api(path,{method:"POST",body:JSON.stringify({workspaceId:wsId,[chave]:id})});await carregarStatus();}
    catch(e:unknown){setErro(erroTexto(e,"Não foi possível selecionar a conta."));}finally{setAtualizando(false);}
  };
  const desconectar=async(tipo:"ads"|"instagram")=>{
    if(!confirm("Desconectar "+(tipo==="ads"?"o Gerenciador de Anúncios":"o Instagram")+" deste workspace?"))return;
    try{await api(tipo==="ads"?"/desconectar":"/instagram/desconectar",{method:"POST",body:JSON.stringify({workspaceId:wsId})});setMensagem("Conta desconectada.");await carregarStatus();}
    catch(e:unknown){setErro(erroTexto(e,"Não foi possível desconectar."));}
  };
  const salvarPreferencias=async()=>{try{const data=await api("/preferencias",{method:"PUT",body:JSON.stringify({workspaceId:wsId,preferencias})});setPreferencias(data.preferencias);setConfigurando(false);setMensagem(data.mensagem);}catch(e:unknown){setErro(erroTexto(e,"Não foi possível salvar as preferências."));}};

  const moeda=dashboard?.conta?.moeda||status?.contaSelecionada?.moeda||"BRL";
  const money=useMemo(()=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:moeda}),[moeda]);
  const inteiro=useMemo(()=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}),[]);
  const formatar=(v:number,t:string)=>t==="moeda"?money.format(v||0):t==="percentual"?n(v).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%":t==="vezes"?n(v).toLocaleString("pt-BR",{maximumFractionDigits:2})+"x":t==="decimal"?n(v).toLocaleString("pt-BR",{maximumFractionDigits:2}):inteiro.format(v||0);
  const campanha=dashboard?.campanhas.find(c=>c.id===campanhaId),resumoExibido=campanha||dashboard?.resumo;

  const propostasResumo=useMemo(()=>{
    if(!dashboard)return{atual:0,anterior:0,vendas:0,receita:0,variacao:0};
    const data=(p:Proposta)=>p.data_proposta||p.created_at;
    const atual=propostas.filter(p=>noIntervalo(data(p),dashboard.periodo.atual)),anterior=propostas.filter(p=>noIntervalo(data(p),dashboard.periodo.anterior)),vendas=atual.filter(p=>ganhou(p.status_venda));
    return{atual:atual.length,anterior:anterior.length,vendas:vendas.length,receita:vendas.reduce((t,p)=>t+n(p.valor_plano),0),variacao:anterior.length?((atual.length-anterior.length)/anterior.length)*100:null};
  },[dashboard,propostas]);

  const mensal=useMemo(()=>dashboard?.serieMensal.map(item=>{const prefix=String(item.data).slice(0,7),props=propostas.filter(p=>String(p.data_proposta||p.created_at||"").slice(0,7)===prefix),vendas=props.filter(p=>ganhou(p.status_venda));return{...item,mes:new Date(item.data+"T12:00:00").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}),propostas:props.length,vendasCrm:vendas.length,receitaCrm:vendas.reduce((t,p)=>t+n(p.valor_plano),0)};})||[],[dashboard,propostas]);

  useEffect(()=>{
    if(!dashboard||!preferencias.regrasAlerta.length){setAlertasAbertos([]);return;}
    const regras=preferencias.regrasAlerta.filter(r=>{if(!r.ativo)return false;const v=n((dashboard.resumo as unknown as Record<string,number>)[r.metrica]);return r.operador==="maior"?v>r.valor:r.operador==="menor"?v<r.valor:r.operador==="maior_igual"?v>=r.valor:v<=r.valor;});
    setAlertasAbertos(regras);
    if(regras.length&&preferencias.somAtivo&&wsId){const chave="meta-alertas-"+wsId+"-"+new Date().toISOString().slice(0,10)+"-"+regras.map(r=>r.id).join("-");if(!localStorage.getItem(chave))try{const Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx(),osc=ctx.createOscillator(),ganho=ctx.createGain();osc.frequency.value=regras.some(r=>r.nivel==="critico")?310:regras.some(r=>r.nivel==="sucesso")?740:520;ganho.gain.setValueAtTime(.12,ctx.currentTime);ganho.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.55);osc.connect(ganho);ganho.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.55);localStorage.setItem(chave,"1");}catch{}}
  },[dashboard,preferencias.regrasAlerta,preferencias.somAtivo,wsId]);

  const exportar=()=>{
    if(!dashboard)return;const lista=campanha?[campanha]:dashboard.campanhas,cab=["Campanha","Status","Objetivo","Investimento","Leads","Formulários","Conversas","Compras","Receita atribuída","CPL","Custo conversa","CPA","CPC","CTR","ROAS"];
    const linhas=lista.map(c=>[c.nome,c.status,objetivo(c.objetivo),c.gasto,c.leads,c.formularios,c.conversas,c.compras,c.receita,c.cpl,c.custoConversa,c.custoCompra,c.cpc,c.ctr,c.roas]);
    const csv="\uFEFF"+[cab,...linhas].map(l=>l.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(";")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="relatorio-meta-"+(campanha?.nome||"todas-campanhas").replace(/[^\w-]+/g,"-")+".csv";a.click();URL.revokeObjectURL(a.href);
  };

  if(!modulosCarregados)return<div className={styles.loading}>Verificando acesso...</div>;
  if(!modulos.meta_ads)return<ModuloBloqueado modulo="meta_ads"/>;
  if(carregando)return<div className={styles.loading}>Preparando sua Central Meta...</div>;

  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.readOnly}>● Somente leitura</span><h1>Central Meta ADS</h1><p>Entenda anúncios, resultados comerciais e Instagram em uma visão simples.</p></div><div className={styles.actions}>{status?.conectado&&<button className={styles.secondary} onClick={()=>carregarDashboard(true)} disabled={atualizando}>{atualizando?"Atualizando...":"↻ Atualizar"}</button>}{podeConfigurar&&<button className={styles.secondary} onClick={()=>setConfigurando(true)}>⚙ Personalizar e alertas</button>}</div></header>
    {erro&&<div className={[styles.notice,styles.noticeError].join(" ")}><b>Atenção:</b> {erro}</div>}{mensagem&&<div className={[styles.notice,styles.noticeOk].join(" ")}>{mensagem}</div>}
    {preferencias.popupAtivo&&alertasAbertos.length>0&&<Alertas regras={alertasAbertos} resumo={dashboard?.resumo} money={money} fechar={()=>setAlertasAbertos([])}/>}
    {!status?.conectado?<section className={styles.connectBox}><div><h2>Conecte o Gerenciador de Anúncios</h2><p>A Wolf consulta campanhas e métricas sem alterar anúncios, públicos ou orçamentos.</p></div>{podeConfigurar?<button className={styles.primary} onClick={()=>abrirOAuth("ads")} disabled={!!conectando}>{conectando==="ads"?"Conectando...":"Conectar com a Meta"}</button>:<span>Aguardando administrador</span>}</section>:<>
      <div className={styles.toolbar}><div className={styles.account}><div className={styles.metaIcon}>M</div><div><b>{status.contaSelecionada?.nome||"Escolha uma conta"}</b><small>{status.metaUsuario?.nome} · {status.contaSelecionada?.id}</small></div></div><div className={styles.actions}>{(status.contas?.length||0)>1&&<select value={status.contaSelecionada?.id||""} onChange={e=>selecionar("ads",e.target.value)}><option value="">Conta de anúncios...</option>{status.contas?.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}<select value={periodo} onChange={e=>{setPeriodo(e.target.value);carregarDashboard(false,e.target.value);}}>{PERIODOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div></div>
      <nav className={styles.tabs}>{([["visao","Visão geral"],["comparativo","Comparativo"],["campanhas","Campanhas e relatório"],["instagram","Instagram"]]as const).map(([id,label])=><button key={id} className={aba===id?styles.tabActive:""} onClick={()=>setAba(id)}>{label}{id==="instagram"&&!status.instagram?.conectado&&<em>Opcional</em>}</button>)}</nav>
      {!status.contaSelecionada?<div className={styles.empty}>Escolha uma conta de anúncios para começar.</div>:dashboard&&resumoExibido?<>
        {aba!=="instagram"&&<div className={styles.campaignFilter}><label>Dados exibidos</label><select value={campanhaId} onChange={e=>setCampanhaId(e.target.value)}><option value="todas">Todas as campanhas somadas</option>{dashboard.campanhas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>{campanha&&<span>Indicadores e relatório mostram somente esta campanha.</span>}</div>}
        {aba==="visao"&&<VisaoGeral resumo={resumoExibido} anterior={campanha?undefined:dashboard.comparacao.anterior} variacoes={campanha?{}:dashboard.comparacao.variacoes} prefs={preferencias} money={money} inteiro={inteiro} formatar={formatar} diaria={dashboard.serieDiaria} campanhas={dashboard.campanhas} propostas={propostasResumo}/>}
        {aba==="comparativo"&&<Comparativo mensal={mensal} money={money} resumo={dashboard.resumo} anterior={dashboard.comparacao.anterior} variacoes={dashboard.comparacao.variacoes} propostas={propostasResumo}/>}
        {aba==="campanhas"&&<Campanhas campanhas={campanha?[campanha]:dashboard.campanhas} money={money} inteiro={inteiro} exportar={exportar}/>}
        {aba==="instagram"&&<InstagramPanel status={status} dados={instagram} podeConfigurar={podeConfigurar} conectando={conectando==="instagram"} atualizar={()=>carregarInstagram(periodo)} conectar={()=>abrirOAuth("instagram")} selecionar={id=>selecionar("instagram",id)} desconectar={()=>desconectar("instagram")} inteiro={inteiro}/>}
        <footer className={styles.footer}>Atualizado em {new Date(dashboard.atualizadoEm).toLocaleString("pt-BR")} · anúncios fornecidos pela Meta · propostas e vendas identificadas como dados do CRM Wolf</footer>
      </>:<div className={styles.empty}>Atualize os dados para abrir o painel.</div>}
    </>}
    {configurando&&<MetaSettings prefs={preferencias} setPrefs={setPreferencias} salvar={salvarPreferencias} fechar={()=>setConfigurando(false)}/>}
  </div>;
}
declare global{interface Window{webkitAudioContext:typeof AudioContext;}}
