"use client";

import styles from "./MetaAds.module.css";
import { GRAFICOS, METRICAS, Preferencias, RegraAlerta } from "./metaTypes";

export default function MetaSettings({prefs,setPrefs,salvar,fechar}:{prefs:Preferencias;setPrefs:(p:Preferencias)=>void;salvar:()=>void;fechar:()=>void}){
  const toggle=(campo:"metricasVisiveis"|"graficosVisiveis",key:string)=>setPrefs({...prefs,[campo]:prefs[campo].includes(key)?prefs[campo].filter(x=>x!==key):[...prefs[campo],key]});
  const alterar=(i:number,patch:Partial<RegraAlerta>)=>setPrefs({...prefs,regrasAlerta:prefs.regrasAlerta.map((r,j)=>j===i?{...r,...patch}:r)});
  const adicionar=()=>setPrefs({...prefs,regrasAlerta:[...prefs.regrasAlerta,{id:crypto.randomUUID(),nome:"Novo alerta",metrica:"cpl",operador:"maior",valor:50,nivel:"atencao",ativo:true}]});
  const alertaveis=["gasto","leads","formularios","conversas","compras","receita","cpl","custoFormulario","custoConversa","custoCompra","roas","ctr","cpc","cpm","frequencia"];
  return <div className={styles.modalBackdrop}><div className={styles.modal}>
    <div className={styles.modalHead}><div><h2>Personalizar este workspace</h2><p>Cada cliente escolhe seus indicadores, gráficos e alertas.</p></div><button onClick={fechar}>×</button></div>
    <div className={styles.modalBody}>
      <h3>Indicadores da visão geral</h3>
      <div className={styles.checkGrid}>{METRICAS.map(m=><label key={m.key}><input type="checkbox" checked={prefs.metricasVisiveis.includes(m.key)} onChange={()=>toggle("metricasVisiveis",m.key)}/><span><b>{m.label}</b><small>{m.note}</small></span></label>)}</div>
      <h3>Gráficos visíveis</h3>
      <div className={styles.checkGrid}>{GRAFICOS.map(g=><label key={g.key}><input type="checkbox" checked={prefs.graficosVisiveis.includes(g.key)} onChange={()=>toggle("graficosVisiveis",g.key)}/><span><b>{g.label}</b></span></label>)}</div>
      <div className={styles.toggleRow}><label><input type="checkbox" checked={prefs.popupAtivo} onChange={e=>setPrefs({...prefs,popupAtivo:e.target.checked})}/> Mostrar popup de atenção</label><label><input type="checkbox" checked={prefs.somAtivo} onChange={e=>setPrefs({...prefs,somAtivo:e.target.checked})}/> Tocar som quando uma regra disparar</label></div>
      <div className={styles.ruleTitle}><h3>Regras de alerta</h3><button className={styles.secondary} onClick={adicionar}>+ Adicionar regra</button></div>
      <div className={styles.rules}>{prefs.regrasAlerta.map((r,i)=><div className={styles.rule} key={r.id}>
        <input type="checkbox" checked={r.ativo} onChange={e=>alterar(i,{ativo:e.target.checked})}/>
        <input className={styles.ruleName} value={r.nome} onChange={e=>alterar(i,{nome:e.target.value})}/>
        <select value={r.metrica} onChange={e=>alterar(i,{metrica:e.target.value})}>{METRICAS.filter(m=>alertaveis.includes(m.key)).map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select>
        <select value={r.operador} onChange={e=>alterar(i,{operador:e.target.value as RegraAlerta["operador"]})}><option value="maior">maior que</option><option value="menor">menor que</option><option value="maior_igual">maior ou igual</option><option value="menor_igual">menor ou igual</option></select>
        <input type="number" value={r.valor} onChange={e=>alterar(i,{valor:Number(e.target.value)})}/>
        <select value={r.nivel} onChange={e=>alterar(i,{nivel:e.target.value as RegraAlerta["nivel"]})}><option value="sucesso">Sucesso</option><option value="atencao">Atenção</option><option value="critico">Crítico</option></select>
        <button className={styles.remove} onClick={()=>setPrefs({...prefs,regrasAlerta:prefs.regrasAlerta.filter((_,j)=>j!==i)})}>×</button>
      </div>)}</div>
    </div>
    <div className={styles.modalFoot}><button className={styles.secondary} onClick={fechar}>Cancelar</button><button className={styles.primary} onClick={salvar}>Salvar para este workspace</button></div>
  </div></div>;
}
