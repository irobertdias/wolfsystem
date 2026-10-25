'use client';
import AjudaCampo from '../../components/AjudaCampo';
type Props={dados:Record<string,any>;onChange:(dados:Record<string,any>)=>void};
export default function LembretesUniversais({dados,onChange}:Props){
 const c=dados.lembretes_inteligentes||{},minutos=Array.isArray(c.minutos)?c.minutos:[20,60,120,'',''];
 const alterar=(patch:Record<string,any>)=>onChange({lembretes_inteligentes:{...c,...patch}});
 const valido=minutos.length===5&&minutos.every((v:any,i:number)=>Number(v)>0&&(!i||Number(v)>Number(minutos[i-1])));
 const input={padding:9,border:'1px solid #cbd5e1',borderRadius:8,width:'100%',boxSizing:'border-box' as const};
 return <section style={{padding:14,border:'1px solid #cbd5e1',borderRadius:10,display:'grid',gap:12,fontSize:12}}>
  <strong>Lembretes inteligentes e retorno agendado <AjudaCampo texto="Esta configuração pertence ao assistente deste workspace e vale para qualquer nicho. Mensagens novas zeram a contagem. Encerramento, bloqueio, atendimento humano ou venda concluída impedem os lembretes."/></strong>
  <label><input type="checkbox" checked={c.ativo===true} onChange={e=>alterar({ativo:e.target.checked})}/> Ativar lembretes inteligentes</label>
  <p style={{margin:0,lineHeight:1.6}}>Configure os cinco momentos em <strong>minutos desde a última resposta normal enviada ao cliente</strong>. Os horários são cumulativos: 20, 60 e 120 significam 20 minutos, 1 hora e 2 horas de espera. No quinto envio sem resposta, o atendimento é finalizado.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:9}}>{Array.from({length:5},(_,i)=><label key={i}>{i+1}º lembrete (min)<input type="number" min={1} max={525600} style={input} value={minutos[i]??''} onChange={e=>{const next=[...minutos];next[i]=e.target.value===''?'':Number(e.target.value);alterar({minutos:next});}}/></label>)}</div>
  {c.ativo===true&&!valido&&<p role="alert" style={{margin:0,color:'#b91c1c'}}>Preencha cinco horários positivos e crescentes antes de publicar o fluxo.</p>}
  <label>Fuso para o horário pedido pelo cliente <AjudaCampo texto="O retorno é salvo no banco e continua válido após reiniciar o serviço. Enquanto aguarda esse horário, os lembretes por silêncio ficam suspensos. Se o pedido não informar um horário compreensível, a IA pergunta somente o dia/horário." exemplo="Cliente: me chama amanhã às 15h. O motor agenda para as 15h deste fuso."/><select style={input} value={c.fuso||'America/Sao_Paulo'} onChange={e=>alterar({fuso:e.target.value})}><option value="America/Sao_Paulo">Brasília (São Paulo)</option><option value="America/Manaus">Manaus</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Rio_Branco">Rio Branco</option><option value="America/Noronha">Fernando de Noronha</option></select></label>
 </section>;
}
