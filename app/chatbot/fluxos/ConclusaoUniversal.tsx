"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Rota = { ativo: boolean; remetente: string; contatos: { nome: string; numero: string; fila_nome?: string }[] };
const caixa = { padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 12, lineHeight: 1.7 };
export default function ConclusaoUniversal({ dados: d, onChange: u, workspaceId }: { dados: Record<string, any>; onChange: (v: Record<string, any>) => void; workspaceId?: string | null }) {
  const [rota, setRota] = useState<Rota | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (workspaceId !== 'grupoprime') return;
    let cancelado = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch('/api/workspace/configuracoes/bko?workspaceId=grupoprime&fluxoId=27', { headers: { Authorization: `Bearer ${session?.access_token || ''}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
        const j = await r.json();
        if (!r.ok || !j.success) throw Error(j.error || 'Não foi possível consultar a configuração BKO.');
        const canal = j.canais?.find((c: { id: number }) => Number(c.id) === Number(j.config.canal_id));
        if (!cancelado) setRota({ ativo: j.config.ativo, remetente: canal?.nome || 'Canal não encontrado', contatos: j.config.contatos || [] });
      } catch (e) { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível consultar o BKO.'); }
    })();
    return () => { cancelado = true; };
  }, [workspaceId]);
  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ ...caixa, background: '#f0fdf4', border: '1px solid #bbf7d0' }}><strong>Conclusão automática da venda</strong><br />Após a escolha do plano, cadastro confirmado e documentos, o motor executa as ações marcadas. Não é necessário finalizar a venda manualmente.</div>
    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}><input type="checkbox" checked={d.crm !== false} onChange={e => u({ crm: e.target.checked, ...(!e.target.checked ? { whatsapp: false } : {}) })} /><span><strong>Cadastrar a venda no CRM</strong><br /><small>Salvar plano, preço, dados, documentos e observações. Retomadas reutilizam o mesmo pedido.</small></span></label>
    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}><input type="checkbox" disabled={d.crm === false} checked={d.crm !== false && d.whatsapp !== false} onChange={e => u({ whatsapp: e.target.checked })} /><span><strong>Enviar pelo WhatsApp após cadastrar no CRM</strong><br /><small>Encaminhar a venda e seus arquivos pelo BKO configurado, com controle de recibos e retomada.</small></span></label>
    <div style={caixa}><strong>Status inicial no CRM</strong><br />AGUARDANDO AUDITORIA<br /><small>As opções deste bloco são aplicadas às próximas vendas.</small></div>
    <div style={caixa}><strong>WhatsApp configurado · Nio</strong>{rota ? <><p>BKO: <strong>{rota.ativo ? 'Ativado' : 'Desativado nas configurações'}</strong><br />Remetente: {rota.remetente}</p>{rota.contatos.map((c, i) => <p key={i}>📱 {c.nome}: <strong>{c.numero}</strong>{c.fila_nome ? ` · ${c.fila_nome}` : ''}</p>)}</> : <p>{erro || (workspaceId === 'grupoprime' ? 'Consultando configuração BKO…' : 'Encaminhamento disponível no piloto @grupoprime.')}</p>}<a href="/chatbot/vendas" target="_blank" rel="noreferrer">Abrir painel de vendas e canais BKO</a></div>
  </div>;
}
