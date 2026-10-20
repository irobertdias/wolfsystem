'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ConfigBko } from '../../lib/bko-grupoprime';
type Canal={id:number;nome:string;tipo:string;status:string};
type Envio={id:number;status:string;estado:string;erro:string;referencia:string};
export default function BkoConfig({workspaceId}:{workspaceId:string}) {
  const [config,setConfig]=useState<ConfigBko>({ativo:false,canal_id:null,contatos:[]});
  const [canais,setCanais]=useState<Canal[]>([]),[envios,setEnvios]=useState<Envio[]>([]);
  const [filas,setFilas]=useState<{id:number;nome:string}[]>([]);
  const [pronto,setPronto]=useState(false),[fluxoAtivo,setFluxoAtivo]=useState(false),[wabaPronto,setWabaPronto]=useState(false);
  const [erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[ocupado,setOcupado]=useState(true);
  async function requisicao(method='GET',body?:unknown){const {data:{session}}=await supabase.auth.getSession();const r=await fetch(`/api/workspace/configuracoes/bko?workspaceId=${encodeURIComponent(workspaceId)}`,{method,headers:{Authorization:`Bearer ${session?.access_token||''}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Não foi possível carregar o BKO.');return j;}
  async function carregar(){setOcupado(true);setErro('');try{const j=await requisicao();setConfig({...j.config,modo:"por_canal"});setCanais(j.canais);setFilas(j.filas||[]);setEnvios(j.envios);setPronto(j.servidor_pronto);setFluxoAtivo(j.fluxo_ativo);setWabaPronto(j.waba_pronto);}catch(e){setErro((e as Error).message);}finally{setOcupado(false);}}
  useEffect(()=>{void carregar();},[workspaceId]);
  async function salvar(){setOcupado(true);setAviso('');setErro('');try{if(config.ativo&&!pronto)throw Error('Instale a atualização de encaminhamento por canal no servidor antes de ativar os envios.');await requisicao('PATCH',{workspaceId,config});setAviso('Configuração salva.');}catch(e){setErro((e as Error).message);}finally{setOcupado(false);}}
  async function retentar(id:number){setOcupado(true);setErro('');try{await requisicao('PATCH',{workspaceId,acao:'retentar',proposta_id:id});await carregar();setAviso('Partes pendentes liberadas para nova tentativa.');}catch(e){setErro((e as Error).message);}finally{setOcupado(false);}}
  const input={padding:10,border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',color:'#0f172a',minWidth:0};
  return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:22,color:'#1e293b'}}>
    <h2 style={{margin:'0 0 8px',fontSize:17}}>Retorno de vendas pelo WhatsApp do BKO</h2>
    <p style={{fontSize:13,color:'#475569'}}>Após o cadastro confirmado e os documentos salvos, um único BKO recebe o resumo da venda, RG frente e verso e comprovante de endereço. Cada canal de entrada tem seu BKO definido abaixo: canal A envia para X, canal B envia para Y. Os dados e documentos permanecem salvos no CRM.</p>
    <p role="status" style={{fontSize:13,color:pronto?'#166534':'#92400e'}}>{pronto?'Servidor BKO disponível.':'Instale a atualização do envio automático no servidor WhatsApp.'} {!fluxoAtivo&&'O vendedor está pausado; salvar esta configuração não o reativa.'}</p>
    {erro&&<p role="alert" style={{color:'#b91c1c'}}>{erro}</p>}{aviso&&<p role="status" style={{color:'#166534'}}>{aviso}</p>}
    <label style={{display:'block',margin:'16px 0'}}><input type="checkbox" checked={config.ativo} disabled={ocupado} onChange={e=>setConfig({...config,ativo:e.target.checked})}/> Encaminhar vendas automaticamente para o BKO</label>
    <label style={{display:'grid',gap:6,fontSize:13}}>Canal usado para enviar e receber os retornos
      <select style={input} disabled={ocupado} value={config.canal_id||''} onChange={e=>setConfig({...config,canal_id:e.target.value?Number(e.target.value):null})}><option value="">Selecione uma conexão</option>{canais.map(c=><option key={c.id} value={c.id}>{c.nome} — {c.tipo} — {c.status}</option>)}</select>
    </label>
    {canais.find(c=>c.id===config.canal_id)?.tipo==='waba'&&<p style={{fontSize:13,color:'#92400e'}}>{!wabaPronto&&'A integração da API oficial ainda precisa ser configurada no servidor. '}Para usar a API oficial, cada BKO deve enviar uma mensagem a esse canal para iniciar o atendimento. Sem conversa ativa, os documentos aguardam na fila.</p>}
    <div style={{display:'grid',gap:10,margin:'16px 0'}}>{config.contatos.map((c,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,border:'1px solid #e2e8f0',borderRadius:10,padding:14}}>
      <strong style={{gridColumn:'1 / -1'}}>Regra {i+1} · Canal de entrada → BKO responsável</strong>
      <label style={{display:'grid',gap:6,fontSize:13}}>Canal que recebe os leads
        <select style={input} disabled={ocupado} value={c.canal_trafego_id||''} onChange={e=>setConfig({...config,contatos:config.contatos.map((x,n)=>n===i?{...x,canal_trafego_id:e.target.value?Number(e.target.value):null}:x)})}><option value="">Selecione o canal de entrada</option>{canais.map(canal=><option key={canal.id} value={canal.id}>{canal.nome} — {canal.tipo}</option>)}</select>
      </label>
      <label style={{display:'grid',gap:6,fontSize:13}}>Fila de origem
        <select style={input} disabled={ocupado} value={c.fila_nome||''} onChange={e=>setConfig({...config,contatos:config.contatos.map((x,n)=>n===i?{...x,fila_nome:e.target.value}:x)})}><option value="">Selecione a fila</option>{filas.map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}</select>
      </label>
      <input style={input} aria-label={`Nome do BKO ${i+1}`} placeholder="Nome do BKO" disabled={ocupado} value={c.nome} maxLength={80} onChange={e=>setConfig({...config,contatos:config.contatos.map((x,n)=>n===i?{...x,nome:e.target.value}:x)})}/>
      <input style={input} aria-label={`WhatsApp do BKO ${i+1}`} placeholder="DDD + WhatsApp" type="tel" disabled={ocupado} value={c.numero} onChange={e=>setConfig({...config,contatos:config.contatos.map((x,n)=>n===i?{...x,numero:e.target.value}:x)})}/>
      <button type="button" disabled={ocupado} onClick={()=>setConfig({...config,contatos:config.contatos.filter((_,n)=>n!==i)})}>Remover</button>
    </div>)}</div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" disabled={ocupado||config.contatos.length>=5} onClick={()=>setConfig({...config,contatos:[...config.contatos,{nome:'',numero:''}]})}>Adicionar regra ({config.contatos.length}/5)</button><button type="button" disabled={ocupado} onClick={salvar} style={{background:'#166534',color:'#fff',border:0,borderRadius:8,padding:'10px 18px'}}>Salvar BKO</button><button type="button" disabled={ocupado} onClick={carregar}>Atualizar situação</button></div>
    <p style={{fontSize:13}}>Cada canal pode ter uma única regra. Sem regra correspondente, a venda permanece no CRM e não é enviada a outro BKO. A fila selecionada deve corresponder à fila configurada no canal de entrada.</p>
    <div style={{background:'#f1f5f9',padding:14,borderRadius:10,marginTop:18,fontSize:13,lineHeight:1.6}}>
      <strong>Como o BKO responde</strong><br/>Use “Responder” na mensagem da venda e envie: CPF REPROVADO, APROVADO, GERADA, AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE ou CANCELADA.<br/>
      Também é possível escrever a referência BKO da venda junto do status. Para agendar, acrescente em linhas separadas: DATA: DD/MM/AAAA e PERIODO: MANHÃ ou TARDE.<br/>“APROVADO” atualiza para APROVADA. Retornos sem venda identificada ou enviados por outros números não alteram o CRM.
    </div>
    {!!envios.length&&<div style={{marginTop:18}}><h3 style={{fontSize:14}}>Últimos encaminhamentos</h3>{envios.map(e=><div key={e.id} style={{borderTop:'1px solid #e2e8f0',padding:'10px 0',fontSize:13}}>Venda #{e.id} · {e.status} · BKO: {e.estado}{e.erro&&<p style={{color:'#b91c1c'}}>{e.erro}</p>}{e.estado==='REVISAR'&&<p>O sistema retoma automaticamente as partes ainda não enviadas. Entregas sem confirmação permanecem em verificação para evitar duplicatas.</p>}</div>)}</div>}
  </section>;
}
