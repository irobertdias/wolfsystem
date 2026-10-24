'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AtendimentoShell from '../AtendimentoShell';
import { useModulos } from '../../hooks/useModulos';
import { useWorkspace } from '../../hooks/useWorkspace';
import { usePermissao } from '../../hooks/usePermissao';
import { supabase } from '../../lib/supabase';
import BkoConfig from '../../crm/configuracoes/BkoConfig';
import styles from './vendas.module.css';
type Mensagem = { tipo?: string; texto?: string; nome?: string; arquivo?: string; estado?: string; id?: string; ack?: number; em?: string; numero?: string; alvo?: string; erro?: string };
type Venda = { id: number; nome: string; plano: string; valor_plano: number; operadora: string; status_venda: string; estado_envio: string; erro: string; referencia: string; data_agendamento?: string; periodo_instalacao?: string; entregas: { numero: string; canal_id: number; concluido: boolean; partes: Mensagem[] }[]; retornos: { texto?: string; status?: string; em: string }[]; acoes: Mensagem[] };
const recibo = (m: Mensagem) => Number(m.ack) >= 3 ? '✓✓ Lido pelo destinatário' : Number(m.ack) >= 2 ? '✓✓ Entregue ao destinatário' : m.estado === 'enviado' ? '✓ Aceito pelo servidor do WhatsApp' : m.estado || 'Pendente';
function VendasAtendimento() {
  const { wsId, workspace, loading } = useWorkspace();
  const { modulos, carregado: modulosProntos } = useModulos();
  const searchParams=useSearchParams();
  const { isSuperAdmin,isDono,permissoes } = usePermissao();
  const [workspaceAdmin,setWorkspaceAdmin]=useState('');
  const [opcoesWorkspace,setOpcoesWorkspace]=useState<{username:string;nome:string}[]>([]);
  const ws = isSuperAdmin && workspaceAdmin ? workspaceAdmin : wsId;
  useEffect(()=>{if(isSuperAdmin)void supabase.from('workspaces').select('username,nome').order('nome').then(r=>setOpcoesWorkspace(r.data||[]));},[isSuperAdmin]);
  const aba=searchParams.get('aba')==='configuracoes'?'configuracao':'envios';
  const [vendas, setVendas] = useState<Venda[]>([]), [pagina, setPagina] = useState(1), [total, setTotal] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null), [erro, setErro] = useState(''), [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async (signal?: AbortSignal) => {
    if (!ws) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/workspace/vendas?workspaceId=${encodeURIComponent(ws)}&pagina=${pagina}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` }, signal, cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw Error(j.error || 'Falha ao consultar vendas.');
      if (!signal?.aborted) { setVendas(j.vendas); setTotal(j.total); setErro(''); }
    } catch (e) { if (!signal?.aborted) setErro(e instanceof Error ? e.message : 'Falha ao carregar.'); }
    finally { if (!signal?.aborted) setCarregando(false); }
  }, [ws, pagina]);
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); const timer = setInterval(() => void carregar(controller.signal), 15000); return () => { controller.abort(); clearInterval(timer); }; }, [carregar]);
  const venda = vendas.find(v => v.id === selecionada);
  if (loading || !modulosProntos) return <main className={styles.pagina}>Carregando vendas…</main>;
  if(!modulos.vendedor_ia&&!isSuperAdmin)return <main className={styles.pagina}><p>O módulo de IA não está liberado neste workspace.</p></main>;
  return <main className={styles.pagina}>
    <header className={styles.cabecalho}><div><small>{opcoesWorkspace.find(w=>w.username===ws)?.nome||workspace?.nome||ws}</small><h1>{aba==='configuracao'?'Configurações de vendas':'Vendas enviadas'}</h1><p>{aba==='configuracao'?'Canais, destinatários, mensagens e retornos do BKO.':'Acompanhe as mensagens de cada pedido e a confirmação de entrega.'}</p></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>{isSuperAdmin&&<select aria-label="Workspace do painel de vendas" value={ws} onChange={e=>{setWorkspaceAdmin(e.target.value);setSelecionada(null);setPagina(1);setVendas([]);}}>{opcoesWorkspace.map(w=><option key={w.username} value={w.username}>{w.nome}</option>)}</select>}<Link href="/crm/vendas">Abrir vendas no CRM ↗</Link><Link href="/chatbot/fluxos">Editor de fluxos ↗</Link></div></header>
    {aba === 'configuracao' ? <div className={styles.configuracao}>{isSuperAdmin||isDono||permissoes.configuracoes_workspace?<BkoConfig key={ws} workspaceId={ws} />:<p>Você não tem permissão para configurar o BKO.</p>}</div> : <>
      <div className={styles.barra}><span>{total} pedidos · atualização automática a cada 15 segundos</span><button onClick={() => void carregar()}>Atualizar</button></div>
      {erro && <p role="alert" className={styles.erro}>{erro}</p>}
      <div className={styles.grade}>
        <section className={styles.lista} aria-label="Pedidos encaminhados">{carregando ? <p>Carregando envios…</p> : !vendas.length ? <p>Nenhuma venda encaminhada neste workspace.</p> : vendas.map(v => <button key={v.id} className={styles.pedido} aria-pressed={v.id === selecionada} onClick={() => setSelecionada(v.id)}><strong>#{v.id} · {v.nome || 'Cliente'}</strong><span>{v.operadora} · {v.plano}</span><span>{v.status_venda}</span><b className={v.estado_envio === 'ENVIADO' ? styles.sucesso : styles.pendente}>{v.estado_envio === 'ENVIADO' ? '✓ Envio confirmado' : v.estado_envio}</b>{v.erro && <span className={styles.erro}>{v.erro}</span>}</button>)}
        <div className={styles.barra}><button disabled={pagina <= 1} onClick={() => setPagina(pagina-1)}>Anterior</button><span>Página {pagina}</span><button disabled={pagina*25 >= total} onClick={() => setPagina(pagina+1)}>Próxima</button></div></section>
        <section className={styles.historico} aria-label="Histórico da venda">{!venda ? <p>Selecione um pedido para ver as mensagens e os recibos.</p> : <>
          <h2>Pedido #{venda.id} · {venda.nome}</h2><p>{venda.status_venda}{venda.data_agendamento ? ` · Instalação: ${venda.data_agendamento} ${venda.periodo_instalacao || ''}` : ''}</p>
          {venda.entregas.map((e,i) => <div key={i}><h3>WhatsApp do BKO: {e.numero} · Canal {e.canal_id}</h3>{e.partes.map((m,k) => <article className={styles.mensagem} key={k}><small>{m.tipo === 'arquivo' ? '📎 Documento' : '↗ Mensagem para o BKO'} · {recibo(m)}</small>{m.texto && <div className={styles.corpoMensagem}>{formatarMensagem(m.texto)}</div>}{m.nome && <p>{m.arquivo ? <ArquivoVenda url={m.arquivo} nome={m.nome} /> : m.nome}</p>}<details><summary>Recibo</summary><code>{m.id || 'Aguardando recibo'}{m.em ? ` · ${m.em}` : ''}{m.ack != null ? ` · ACK ${m.ack}` : ''}</code></details></article>)}</div>)}
          {!!venda.retornos.length && <h3>Respostas recebidas do BKO</h3>}{venda.retornos.map((r,i) => <article className={styles.retorno} key={i}><small>{new Date(r.em).toLocaleString('pt-BR')}</small><div className={styles.corpoMensagem}>{formatarMensagem(r.texto || r.status || "")}</div></article>)}
          {!!venda.acoes.length && <h3>Acompanhamento automático</h3>}{venda.acoes.map((m,i) => <article className={styles.mensagem} key={i}><small>{m.alvo === 'bko' ? '↗ BKO' : '↗ Cliente'} · {m.estado}</small><p>{m.texto}</p>{m.erro && <p className={styles.erro}>{m.erro}</p>}<details><summary>Recibo</summary><code>{m.id || 'Aguardando envio'}</code></details></article>)}
        </>}</section>
      </div>
    </>}
  </main>;
}

export default function PaginaVendas(){return <Suspense fallback={<p>Carregando vendas…</p>}><AtendimentoShell><VendasAtendimento/></AtendimentoShell></Suspense>;}

function formatarMensagem(texto:string){return texto.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g).map((p,i)=>p.startsWith('*')&&p.endsWith('*')?<strong key={i}>{p.slice(1,-1)}</strong>:p.startsWith('_')&&p.endsWith('_')?<em key={i}>{p.slice(1,-1)}</em>:p.startsWith('~')&&p.endsWith('~')?<s key={i}>{p.slice(1,-1)}</s>:p);}
function ArquivoVenda({url,nome}:{url:string;nome:string}){const [imagem,setImagem]=useState(''),[erro,setErro]=useState('');useEffect(()=>{let ativo=true,obj='';(async()=>{try{if(!url.startsWith('/api/documentos-clientes/arquivo?'))return;const {data:{session}}=await supabase.auth.getSession();const r=await fetch(url,{headers:{Authorization:'Bearer '+session?.access_token}});if(!r.ok)throw Error('Arquivo indisponível');const blob=await r.blob();if(ativo){obj=URL.createObjectURL(blob);setImagem(obj);}}catch(e){if(ativo)setErro((e as Error).message);}})();return()=>{ativo=false;if(obj)URL.revokeObjectURL(obj);};},[url]);return <span style={{display:'grid',gap:8}}>{imagem?/\.(?:jpg|jpeg|png|webp)$/i.test(nome)?<a href={imagem} target="_blank" rel="noreferrer"><img src={imagem} alt={nome} style={{display:'block',maxWidth:260,maxHeight:240,objectFit:'contain',borderRadius:9}}/></a>:null:null}{imagem?<a href={imagem} download={nome}>📎 {nome}</a>:<span>📎 {nome} {erro||' · carregando…'}</span>}</span>;}
