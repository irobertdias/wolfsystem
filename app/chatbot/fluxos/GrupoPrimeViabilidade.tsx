'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type Consulta = {
  cep: string; status: string; cidade: string | null; uf: string | null; mensagem: string;
  candidatos: { cidade: string; uf: string }[];
  planos: null | { tabela: string; pessoa_fisica: Plano[]; pessoa_juridica: Plano[] };
};
type Plano = { id: string; nome: string; velocidade_mbps: number; mensalidade: number; mensalidade_cartao: number | null };

export default function GrupoPrimeViabilidade({ onPreparado }: { onPreparado: (id: number) => Promise<void> }) {
  const [cep, setCep] = useState('');
  const [resultado, setResultado] = useState<Consulta | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  async function headers(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }
  async function consultar(cidade = '', uf = '') {
    setOcupado(true); setErro(''); setResultado(null);
    try {
      const params = new URLSearchParams({ cep, cidade, uf });
      const response = await fetch(`/api/viabilidade/grupoprime?${params}`, { headers: await headers(), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha na consulta');
      setResultado(data);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro na consulta'); }
    finally { setOcupado(false); }
  }
  async function preparar() {
    setOcupado(true); setErro(''); setAviso('');
    try {
      const response = await fetch('/api/viabilidade/grupoprime/vendedor', { method: 'POST', headers: await headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao preparar vendedor');
      setAviso('Rascunho preparado. Configure a chave IA, a fila humana e a conexão de tráfego antes de ativar.');
      await onPreparado(data.id);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao preparar vendedor'); }
    finally { setOcupado(false); }
  }
  return <section style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20, marginBottom: 22 }}>
    <h2 style={{ margin: '0 0 8px', color: '#166534', fontSize: 18 }}>Grupo Prime · Nio · Viabilidade por CEP</h2>
    <p style={{ color: '#475569', fontSize: 13 }}>Consulte a cidade e os planos PF/PJ. A base VTAL de 2024/2025 indica pré-viabilidade; o imóvel exige confirmação técnica.</p>
    <form onSubmit={e => { e.preventDefault(); void consultar(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <input aria-label="CEP de instalação" placeholder="00000-000" value={cep} onChange={e => { setCep(e.target.value); setResultado(null); }} maxLength={9} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 10, color: '#0f172a' }} />
      <button disabled={ocupado} type="submit" style={{ background: '#166534', color: 'white', border: 0, borderRadius: 8, padding: '10px 18px', cursor: 'pointer' }}>Consultar CEP</button>
      <button disabled={ocupado} type="button" onClick={() => void preparar()} style={{ background: '#ede9fe', color: '#5b21b6', border: 0, borderRadius: 8, padding: '10px 18px', cursor: 'pointer' }}>Preparar vendedor IA</button>
    </form>
    {ocupado && <p role="status" style={{ color: '#475569' }}>Processando…</p>}
    {erro && <p role="alert" style={{ color: '#b91c1c' }}>{erro}</p>}
    {aviso && <p role="status" style={{ color: '#166534' }}>{aviso}</p>}
    {resultado && <div style={{ color: '#334155', fontSize: 13, marginTop: 12 }}>
      <b>{resultado.cidade ? `${resultado.cidade}/${resultado.uf}` : 'Cidade a confirmar'}</b>
      <p>{resultado.mensagem}</p>
      {resultado.status === 'cidade_ambigua' && resultado.candidatos.map(local => <button key={`${local.uf}:${local.cidade}`} onClick={() => void consultar(local.cidade, local.uf)} disabled={ocupado} style={{ margin: 4, padding: 8 }}>Confirmar {local.cidade}/{local.uf}</button>)}
      {resultado.planos && <>
        <p>Tabela {resultado.planos.tabela}. Valores conforme material comercial fornecido.</p>
        {([['Pessoa física', resultado.planos.pessoa_fisica], ['Pessoa jurídica', resultado.planos.pessoa_juridica]] as const).map(([titulo, planos]) => <div key={titulo} style={{ marginTop: 10 }}>
          <b>{titulo}</b>
          {planos.map(plano => <p key={plano.id} style={{ margin: '5px 0' }}>{plano.nome} · {plano.velocidade_mbps} Mega · {plano.mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês{plano.mensalidade_cartao !== null ? ` (${plano.mensalidade_cartao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês no cartão)` : ''}</p>)}
        </div>)}
      </>}
    </div>}
  </section>;
}
