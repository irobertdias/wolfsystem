"use client";
import { PERFIS_UNIVERSAIS, configurarNicho, perfilUniversal } from '../../lib/atendimento-universal';
type Props={tipo:'assistente_universal'|'nicho_atendimento';dados:Record<string,any>;onChange:(dados:Record<string,any>)=>void};
const input={width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,fontSize:12,boxSizing:'border-box' as const};
export default function ConfiguracaoUniversal({tipo,dados:d,onChange:u}:Props){
 const campo=(label:string,chave:string,multilinha=false)=><label style={{display:'grid',gap:5,fontSize:12,color:'#334155'}}>{label}{multilinha?<textarea style={input} rows={4} value={d[chave]||''} onChange={e=>u({[chave]:e.target.value})}/>:<input style={input} value={d[chave]||''} onChange={e=>u({[chave]:e.target.value})}/>}</label>;
 const perfil=perfilUniversal(d.nicho);
 return <div style={{display:'grid',gap:14}}>
  <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:12,fontSize:12,lineHeight:1.6}}><strong>Nova base universal · Configuração inicial</strong><br/>Prepare e salve este fluxo como rascunho. A execução dos novos blocos será implementada e testada na próxima etapa.</div>
  {tipo==='assistente_universal'?<>
   {campo('Nome do assistente','nome')}{campo('Empresa ou estabelecimento','empresa')}
   <label style={{display:'grid',gap:5,fontSize:12}}>Papel no atendimento<select style={input} value={d.papel||'vendas'} onChange={e=>u({papel:e.target.value})}><option value="vendas">Vendas e orientação</option><option value="atendimento">Atendimento e suporte</option><option value="agendamento">Agendamento</option></select></label>
   <label style={{display:'grid',gap:5,fontSize:12}}>Tom da conversa<select style={input} value={d.tom||'acolhedor'} onChange={e=>u({tom:e.target.value})}><option value="acolhedor">Acolhedor e objetivo</option><option value="consultivo">Consultivo</option><option value="formal">Formal</option></select></label>
   {campo('Apresentação personalizada','apresentacao',true)}{campo('Regras gerais da empresa','regras',true)}
   <div style={{padding:12,background:'#f8fafc',borderRadius:8,fontSize:12,lineHeight:1.7}}><strong>Comportamento comum a todos os nichos</strong><ul style={{paddingLeft:18,marginBottom:0}}><li>Aproveitar os dados já enviados e retomar do ponto pendente.</li><li>Responder a dúvidas sem reiniciar o atendimento.</li><li>Usar preços, estoque, cobertura e agenda de fontes configuradas.</li><li>Confirmar o resumo antes de registrar ou reservar.</li><li>Tratar objeções com informações reais e respeitar o encerramento.</li></ul></div>
   <div style={{padding:12,background:'#f0fdf4',borderRadius:8,fontSize:12,lineHeight:1.7}}><strong>Documentos: receber, extrair e conferir</strong><p>O original deve ser salvo antes da leitura. Falha de OCR ou baixa confiança significa leitura inconclusiva, nunca documento inválido. Sem inventar dados ou afirmar identidade validada.</p><p style={{marginBottom:0}}>Os arquivos e as pendências seguem para a equipe responsável. A leitura não aprova identidade, crédito, cobertura ou contrato.</p></div>
   <div style={{borderTop:'1px solid #e2e8f0',paddingTop:12,fontSize:12,lineHeight:1.7}}><strong>Prévia da abertura</strong><p>{d.apresentacao||`Olá! Sou ${d.nome||'[nome do assistente]'}, assistente virtual da ${d.empresa||'[empresa]'}. Vou ajudar você por aqui. Como posso te ajudar hoje?`}</p></div>
  </>:<>
   <label style={{display:'grid',gap:5,fontSize:12}}>Nicho deste atendimento<select style={input} value={d.nicho||''} onChange={e=>u(configurarNicho(e.target.value))}><option value="">Selecione um nicho</option>{Object.entries(PERFIS_UNIVERSAIS).map(([id,p])=><option key={id} value={id}>{p.nome}</option>)}</select></label>
   {perfil&&<>
    {campo('Objetivo específico','objetivo',true)}
    <label style={{display:'grid',gap:5,fontSize:12}}>Dados a coletar, na ordem desejada<textarea rows={6} style={input} value={(Array.isArray(d.campos)?d.campos:[]).join('\n')} onChange={e=>u({campos:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)})}/><small>Um campo por linha. Esta é a configuração inicial; a validação de cada campo virá na próxima etapa.</small></label>
    {campo('Fontes de informação: catálogo, agenda, APIs ou sistema integrado','fontes',true)}{campo('Regras específicas deste nicho','regras',true)}
    <div style={{padding:12,background:'#f8fafc',borderRadius:8,fontSize:12,lineHeight:1.7}}><strong>Capacidades previstas</strong><p>{perfil.acoes.join(' · ')}</p><strong>Documentos sugeridos, quando necessários</strong><p>{perfil.documentos.length?perfil.documentos.join(' · '):'Este perfil não exige documentos por padrão.'}</p><p style={{marginBottom:0}}>Somente este perfil será associado ao assistente conectado. Trocar o nicho restaura os campos sugeridos do novo perfil; os dados não são misturados.</p></div>
   </>}
  </>}
 </div>;
}
