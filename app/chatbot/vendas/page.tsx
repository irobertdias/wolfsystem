'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorkspace } from '../../hooks/useWorkspace';
import { usePermissao } from '../../hooks/usePermissao';
import { supabase } from '../../lib/supabase';
import BkoConfig from '../../crm/configuracoes/BkoConfig';
import styles from './vendas.module.css';
type Mensagem = { tipo?: string; texto?: string; nome?: string; arquivo?: string; estado?: string; id?: string; ack?: number; em?: string; numero?: string; alvo?: string; erro?: string };
type Venda = { id: number; nome: string; plano: string; valor_plano: number; operadora: string; status_venda: string; estado_envio: string; erro: string; referencia: string; data_agendamento?: string; periodo_instalacao?: string; entregas: { numero: string; canal_id: number; concluido: boolean; partes: Mensagem[] }[]; retornos: { texto?: string; status?: string; em: string }[]; acoes: Mensagem[] };
const recibo = (m: Mensagem) => Number(m.ack) >= 3 ? '✓✓ Lido pelo destinatário' : Number(m.ack) >= 2 ? '✓✓ Entregue ao destinatário' : m.estado === 'enviado' ? '✓ Aceito pelo servidor do WhatsApp' : m.estado || 'Pendente';
export default function VendasAtendimento() {
  const { wsId, loading } = useWorkspace();
  const { isSuperAdmin } = usePermissao();
  const [abrirPiloto,setAbrirPiloto] = useState(false);
  const ws = abrirPiloto && isSuperAdmin ? 'grupoprime' : wsId;
  const [aba, setAba] = useState('envios'), [vendas, setVendas] = useState<Venda[]>([]), [pagina, setPagina] = useState(1), [total, setTotal] = useState(0);
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
  if (loading) return <main className={styles.pagina}>Carregando vendas…</main>;
  if (ws !== 'grupoprime') return <main className={styles.pagina}><h1>Vendas</h1><p>Painel disponível no piloto Grupo Prime.</p>{isSuperAdmin && <button onClick={()=>setAbrirPiloto(true)}>Abrir piloto Grupo Prime</button>} <Link href="/chatbot">Voltar ao atendimento</Link></main>;
  return <main className={styles.pagina}>
    <header className={styles.cabecalho}><div><small>GRUPO PRIME · ATENDIMENTO</small><h1>Vendas</h1><p>Pedidos, mensagens enviadas ao BKO e acompanhamento do cliente.</p></div><Link href="/chatbot">← Atendimento</Link></header>
    <nav className={styles.abas} aria-label="Vendas"><button aria-pressed={aba === 'envios'} onClick={() => setAba('envios')}>Mensagens e envios</button><button aria-pressed={aba === 'configuracao'} onClick={() => setAba('configuracao')}>Canais e BKO</button><Link href="/crm/vendas">Todas as vendas no CRM ↗</Link><Link href="/chatbot/fluxos">Configurar vendedora ↗</Link></nav>
    {aba === 'configuracao' ? <BkoConfig workspaceId={ws} /> : <>
      <div className={styles.barra}><span>{total} pedidos · atualização automática a cada 15 segundos</span><button onClick={() => void carregar()}>Atualizar</button></div>
      {erro && <p role="alert" className={styles.erro}>{erro}</p>}
      <div className={styles.grade}>
        <section className={styles.lista} aria-label="Pedidos encaminhados">{carregando ? <p>Carregando envios…</p> : !vendas.length ? <p>Nenhuma venda encaminhada neste workspace.</p> : vendas.map(v => <button key={v.id} className={styles.pedido} aria-pressed={v.id === selecionada} onClick={() => setSelecionada(v.id)}><strong>#{v.id} · {v.nome || 'Cliente'}</strong><span>{v.operadora} · {v.plano}</span><span>{v.status_venda}</span><b className={v.estado_envio === 'ENVIADO' ? styles.sucesso : styles.pendente}>{v.estado_envio === 'ENVIADO' ? '✓ Envio confirmado' : v.estado_envio}</b>{v.erro && <span className={styles.erro}>{v.erro}</span>}</button>)}
        <div className={styles.barra}><button disabled={pagina <= 1} onClick={() => setPagina(pagina-1)}>Anterior</button><span>Página {pagina}</span><button disabled={pagina*25 >= total} onClick={() => setPagina(pagina+1)}>Próxima</button></div></section>
        <section className={styles.historico} aria-label="Histórico da venda">{!venda ? <p>Selecione um pedido para ver as mensagens e os recibos.</p> : <>
          <h2>Pedido #{venda.id} · {venda.nome}</h2><p>{venda.status_venda}{venda.data_agendamento ? ` · Instalação: ${venda.data_agendamento} ${venda.periodo_instalacao || ''}` : ''}</p>
          {venda.entregas.map((e,i) => <div key={i}><h3>WhatsApp do BKO: {e.numero} · Canal {e.canal_id}</h3>{e.partes.map((m,k) => <article className={styles.mensagem} key={k}><small>{m.tipo === 'arquivo' ? '📎 Documento' : '↗ Mensagem para o BKO'} · {recibo(m)}</small>{m.texto && <p>{m.texto}</p>}{m.nome && <p>{m.arquivo ? <a href={m.arquivo} target="_blank" rel="noreferrer">{m.nome}</a> : m.nome}</p>}<details><summary>Recibo</summary><code>{m.id || 'Aguardando recibo'}{m.em ? ` · ${m.em}` : ''}{m.ack != null ? ` · ACK ${m.ack}` : ''}</code></details></article>)}</div>)}
          {!!venda.retornos.length && <h3>Respostas recebidas do BKO</h3>}{venda.retornos.map((r,i) => <article className={styles.retorno} key={i}><small>{new Date(r.em).toLocaleString('pt-BR')}</small><p>{r.texto || r.status}</p></article>)}
          {!!venda.acoes.length && <h3>Acompanhamento automático</h3>}{venda.acoes.map((m,i) => <article className={styles.mensagem} key={i}><small>{m.alvo === 'bko' ? '↗ BKO' : '↗ Cliente'} · {m.estado}</small><p>{m.texto}</p>{m.erro && <p className={styles.erro}>{m.erro}</p>}<details><summary>Recibo</summary><code>{m.id || 'Aguardando envio'}</code></details></article>)}
        </>}</section>
      </div>
    </>}
  </main>;
}
