"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "./MetaAds.module.css";
import { Campanha, CORES, Insight, InstagramDashboard, METRICAS, n, objetivo, Preferencias, RegraAlerta, Serie, StatusData } from "./metaTypes";

export function VisaoGeral({resumo,anterior,variacoes,prefs,money,inteiro,formatar,diaria,campanhas,propostas}:{resumo:Insight;anterior?:Insight;variacoes:Record<string,number|null>;prefs:Preferencias;money:Intl.NumberFormat;inteiro:Intl.NumberFormat;formatar:(v:number,t:string)=>string;diaria:Serie[];campanhas:Campanha[];propostas:{atual:number;vendas:number;receita:number;variacao:number|null}}){
  const visiveis=METRICAS.filter(m=>prefs.metricasVisiveis.includes(m.key));
  const pie=campanhas.filter(c=>c.gasto>0).slice(0,6).map(c=>({name:c.nome,value:c.gasto}));
  return <>
    <section className={styles.kpis}>
      {visiveis.map(m=><Kpi key={m.key} label={m.label} value={formatar(n(resumo[m.key as keyof Insight]),m.tipo)} note={m.note} variacao={anterior?variacoes[m.key]:undefined} inverso={"inverso" in m&&m.inverso}/>)}
      <Kpi label="Propostas no CRM" value={inteiro.format(propostas.atual)} note="Registradas na Wolf no período" variacao={propostas.variacao}/>
      <Kpi label="Vendas no CRM" value={inteiro.format(propostas.vendas)} note={"Valor dos planos: "+money.format(propostas.receita)}/>
    </section>
    <div className={styles.chartGrid}>
      {prefs.graficosVisiveis.includes("evolucao")&&<ChartCard title="Evolução diária" subtitle="Investimento, leads e conversas ao longo do período" wide><ResponsiveContainer width="100%" height={300}><LineChart data={diaria}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5"/><XAxis dataKey="data" tickFormatter={d=>String(d).slice(5)} fontSize={10}/><YAxis yAxisId="left" fontSize={10}/><YAxis yAxisId="right" orientation="right" fontSize={10}/><Tooltip formatter={(v,name)=>[name==="Investimento"?money.format(n(v)):inteiro.format(n(v)),name]}/><Legend/><Line yAxisId="left" type="monotone" dataKey="gasto" name="Investimento" stroke="#2563eb" strokeWidth={3} dot={false}/><Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#16a34a" strokeWidth={2}/><Line yAxisId="right" type="monotone" dataKey="conversas" name="Conversas" stroke="#7c3aed" strokeWidth={2}/></LineChart></ResponsiveContainer></ChartCard>}
      {prefs.graficosVisiveis.includes("distribuicao")&&<ChartCard title="Onde o dinheiro foi investido" subtitle="Participação das principais campanhas"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={100} paddingAngle={2}>{pie.map((_,i)=><Cell key={i} fill={CORES[i%CORES.length]}/>)}</Pie><Tooltip formatter={v=>money.format(n(v))}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ResponsiveContainer></ChartCard>}
      {prefs.graficosVisiveis.includes("funil")&&<ChartCard title="Funil de resultados" subtitle="Da visualização até a compra"><ResponsiveContainer width="100%" height={280}><BarChart layout="vertical" data={[{nome:"Impressões",valor:resumo.impressoes},{nome:"Cliques",valor:resumo.cliques},{nome:"Leads",valor:resumo.leads},{nome:"Conversas",valor:resumo.conversas},{nome:"Compras",valor:resumo.compras}]}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5"/><XAxis type="number" fontSize={10}/><YAxis dataKey="nome" type="category" width={78} fontSize={10}/><Tooltip formatter={v=>inteiro.format(n(v))}/><Bar dataKey="valor" fill="#7c3aed" radius={[0,8,8,0]}/></BarChart></ResponsiveContainer></ChartCard>}
    </div>
  </>;
}

export function Comparativo({mensal,money,resumo,anterior,variacoes,propostas}:{mensal:Serie[];money:Intl.NumberFormat;resumo:Insight;anterior:Insight;variacoes:Record<string,number|null>;propostas:{atual:number;anterior:number;vendas:number}}){
  return <div className={styles.stack}>
    <section className={styles.comparisonStrip}>
      <Compare label="Investimento" atual={money.format(resumo.gasto)} anterior={money.format(anterior.gasto)} variacao={variacoes.gasto}/>
      <Compare label="Leads" atual={String(resumo.leads)} anterior={String(anterior.leads)} variacao={variacoes.leads}/>
      <Compare label="Conversas" atual={String(resumo.conversas)} anterior={String(anterior.conversas)} variacao={variacoes.conversas}/>
      <Compare label="CPL" atual={money.format(resumo.cpl)} anterior={money.format(anterior.cpl)} variacao={variacoes.cpl} inverso/>
      <Compare label="Propostas CRM" atual={String(propostas.atual)} anterior={String(propostas.anterior)} variacao={propostas.anterior?((propostas.atual-propostas.anterior)/propostas.anterior)*100:null}/>
      <Compare label="Vendas CRM" atual={String(propostas.vendas)} anterior="—" variacao={null}/>
    </section>
    <ChartCard title="Comparação mês a mês" subtitle="Investimento, leads, propostas e vendas do CRM" wide><ResponsiveContainer width="100%" height={390}><BarChart data={mensal}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5"/><XAxis dataKey="mes" fontSize={10}/><YAxis yAxisId="money" fontSize={10}/><YAxis yAxisId="count" orientation="right" fontSize={10}/><Tooltip formatter={(v,name)=>[name==="Investimento"?money.format(n(v)):n(v).toLocaleString("pt-BR"),name]}/><Legend/><Bar yAxisId="money" dataKey="gasto" name="Investimento" fill="#2563eb" radius={[5,5,0,0]}/><Bar yAxisId="count" dataKey="leads" name="Leads Meta" fill="#16a34a"/><Bar yAxisId="count" dataKey="propostas" name="Propostas CRM" fill="#7c3aed"/><Bar yAxisId="count" dataKey="vendasCrm" name="Vendas CRM" fill="#f59e0b"/></BarChart></ResponsiveContainer></ChartCard>
    <ChartCard title="Eficiência ao longo dos meses" subtitle="Quanto custou gerar cada resultado" wide><ResponsiveContainer width="100%" height={320}><LineChart data={mensal}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5"/><XAxis dataKey="mes" fontSize={10}/><YAxis fontSize={10}/><Tooltip formatter={v=>money.format(n(v))}/><Legend/><Line type="monotone" dataKey="cpl" name="Custo por lead" stroke="#dc2626" strokeWidth={3}/><Line type="monotone" dataKey="custoConversa" name="Custo por conversa" stroke="#7c3aed" strokeWidth={3}/><Line type="monotone" dataKey="custoCompra" name="CPA" stroke="#f59e0b" strokeWidth={3}/></LineChart></ResponsiveContainer></ChartCard>
  </div>;
}

function statusCampanha(valor:string){
  const s=String(valor||"").toUpperCase();
  if(s==="ACTIVE")return["Ativa",styles.statusActive];
  if(["PAUSED","CAMPAIGN_PAUSED","ADSET_PAUSED"].includes(s))return["Pausada",styles.statusPaused];
  if(["DISAPPROVED","WITH_ISSUES","ERROR","ARCHIVED","DELETED"].includes(s))return["Com problema",styles.statusError];
  return[s||"Sem status",styles.statusPaused];
}
export function Campanhas({campanhas,money,inteiro,exportar}:{campanhas:Campanha[];money:Intl.NumberFormat;inteiro:Intl.NumberFormat;exportar:()=>void}){
  return <section className={styles.panel}><div className={styles.panelHead}><div><h3>Relatório por campanha</h3><p>Use o filtro acima para gerar um relatório individual.</p></div><button className={styles.primary} onClick={exportar}>Baixar CSV</button></div><div className={styles.tableWrap}><table><thead><tr><th>Campanha</th><th>Status</th><th>Objetivo</th><th>Investimento</th><th>Leads</th><th>Formulários</th><th>Conversas</th><th>CPL</th><th>Custo/conversa</th><th>CPA</th><th>CPC</th><th>CTR</th><th>ROAS</th></tr></thead><tbody>{campanhas.map(c=>{const[st,cls]=statusCampanha(c.status);return <tr key={c.id}><td><b title={c.nome}>{c.nome}</b></td><td><span className={[styles.status,cls].join(" ")}>{st}</span></td><td>{objetivo(c.objetivo)}</td><td>{money.format(c.gasto)}</td><td>{inteiro.format(c.leads)}</td><td>{inteiro.format(c.formularios)}</td><td>{inteiro.format(c.conversas)}</td><td>{money.format(c.cpl)}</td><td>{money.format(c.custoConversa)}</td><td>{money.format(c.custoCompra)}</td><td>{money.format(c.cpc)}</td><td>{c.ctr.toLocaleString("pt-BR",{maximumFractionDigits:2})}%</td><td>{c.roas.toLocaleString("pt-BR",{maximumFractionDigits:2})}x</td></tr>})}</tbody></table></div></section>;
}

export function InstagramPanel({status,dados,podeConfigurar,conectando,atualizar,conectar,selecionar,desconectar,inteiro}:{status:StatusData;dados:InstagramDashboard|null;podeConfigurar:boolean;conectando:boolean;atualizar:()=>void;conectar:()=>void;selecionar:(id:string)=>void;desconectar:()=>void;inteiro:Intl.NumberFormat}){
  if(!status.instagram?.conectado)return <section className={styles.instagramConnect}><div className={styles.instagramLogo}>◎</div><div><h2>Insights do Instagram</h2><p>Opcional. Conecte um perfil profissional ligado a uma Página do Facebook para acompanhar seguidores, visualizações, alcance, interações e publicações.</p><small>Requer aprovação das permissões instagram_basic, instagram_manage_insights, pages_show_list e pages_read_engagement.</small></div>{podeConfigurar&&<button className={styles.instagramButton} onClick={conectar} disabled={conectando}>{conectando?"Conectando...":"Conectar Instagram"}</button>}</section>;
  return <div className={styles.stack}>
    <div className={styles.instagramHead}><div className={styles.account}>{status.instagram.foto?<img src={status.instagram.foto} alt=""/>:<div className={styles.instagramLogo}>◎</div>}<div><b>@{status.instagram.username}</b><small>{status.instagram.nome}</small></div></div><div className={styles.actions}>{(status.contasInstagram?.length||0)>1&&<select value={status.instagram.id||""} onChange={e=>selecionar(e.target.value)}>{status.contasInstagram?.map(c=><option key={c.id} value={c.id}>@{c.username}</option>)}</select>}<button className={styles.secondary} onClick={atualizar}>Atualizar</button>{podeConfigurar&&<button className={styles.danger} onClick={desconectar}>Desconectar</button>}</div></div>
    {!dados?<div className={styles.empty}>Não foi possível carregar os insights. Renove a conexão e confirme as permissões do Instagram.</div>:<>
      <section className={styles.kpis}><Kpi label="Seguidores" value={inteiro.format(n(dados.perfil.seguidores))} note={"Crescimento registrado: "+(dados.crescimentoSeguidores>=0?"+":"")+inteiro.format(dados.crescimentoSeguidores)}/><Kpi label="Visualizações" value={inteiro.format(n(dados.resumo.views))} note="No período"/><Kpi label="Alcance" value={inteiro.format(n(dados.resumo.reach))} note="Contas alcançadas"/><Kpi label="Contas engajadas" value={inteiro.format(n(dados.resumo.accounts_engaged))} note="Pessoas que interagiram"/><Kpi label="Interações" value={inteiro.format(n(dados.resumo.total_interactions))} note="Curtidas, comentários e ações"/><Kpi label="Visitas ao perfil" value={inteiro.format(n(dados.resumo.profile_views))} note="Visualizações do perfil"/></section>
      <ChartCard title="Alcance do Instagram" subtitle="Histórico disponível a partir da conexão" wide><ResponsiveContainer width="100%" height={320}><AreaChart data={dados.serieDiaria}><CartesianGrid strokeDasharray="3 3" stroke="#eee"/><XAxis dataKey="data" tickFormatter={d=>String(d).slice(5)} fontSize={10}/><YAxis fontSize={10}/><Tooltip/><Legend/><Area type="monotone" dataKey="views" name="Visualizações" stroke="#e1306c" fill="#fce7f3"/><Area type="monotone" dataKey="reach" name="Alcance" stroke="#7c3aed" fill="#ede9fe"/></AreaChart></ResponsiveContainer></ChartCard>
      <section className={styles.panel}><div className={styles.panelHead}><div><h3>Publicações recentes</h3><p>Desempenho orgânico no período selecionado.</p></div></div><div className={styles.mediaGrid}>{dados.publicacoes.map(post=><a key={post.id} href={post.link||"#"} target="_blank" rel="noreferrer" className={styles.mediaCard}>{post.midia?<img src={post.midia} alt="Publicação"/>:<div className={styles.mediaFallback}>◎</div>}<div><b>{post.tipo}</b><p>{post.legenda||"Sem legenda"}</p><span>♥ {inteiro.format(post.curtidas)} · 💬 {inteiro.format(post.comentarios)}</span></div></a>)}</div></section>
    </>}
  </div>;
}

export function Alertas({regras,resumo,money,fechar}:{regras:RegraAlerta[];resumo?:Insight;money:Intl.NumberFormat;fechar:()=>void}){
  const monetarias=["gasto","receita","cpl","custoFormulario","custoConversa","custoCompra","cpc","cpm"];
  return <div className={styles.alertCenter}><div><b>🔔 Atenção ao desempenho</b><span>{regras.length} regra(s) atingida(s)</span></div><div className={styles.alertList}>{regras.map(r=><div key={r.id} className={styles["level_"+r.nivel]}><strong>{r.nome}</strong><span>Valor atual: {monetarias.includes(r.metrica)?money.format(n(resumo?.[r.metrica as keyof Insight])):n(resumo?.[r.metrica as keyof Insight]).toLocaleString("pt-BR",{maximumFractionDigits:2})}</span></div>)}</div><button onClick={fechar}>Entendi</button></div>;
}
export function Kpi({label,value,note,variacao,inverso=false}:{label:string;value:string;note:string;variacao?:number|null;inverso?:boolean}){
  const bom=variacao!=null&&(inverso?variacao<=0:variacao>=0);
  return <div className={styles.kpi}><span>{label}</span><strong>{value}</strong><small>{note}</small>{variacao!==undefined&&<em className={variacao===null?styles.neutral:bom?styles.up:styles.down}>{variacao===null?"Novo":(variacao>=0?"↑ ":"↓ ")+Math.abs(variacao).toLocaleString("pt-BR",{maximumFractionDigits:1})+"% vs. anterior"}</em>}</div>;
}
function Compare({label,atual,anterior,variacao,inverso=false}:{label:string;atual:string;anterior:string;variacao:number|null;inverso?:boolean}){
  const bom=variacao!=null&&(inverso?variacao<=0:variacao>=0);
  return <div><span>{label}</span><strong>{atual}</strong><small>Anterior: {anterior}</small><em className={variacao===null?styles.neutral:bom?styles.up:styles.down}>{variacao===null?"Sem base":(variacao>=0?"+":"")+variacao.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"}</em></div>;
}
function ChartCard({title,subtitle,children,wide=false}:{title:string;subtitle:string;children:React.ReactNode;wide?:boolean}){
  return <section className={[styles.chartCard,wide?styles.wide:""].join(" ")}><div><h3>{title}</h3><p>{subtitle}</p></div>{children}</section>;
}
