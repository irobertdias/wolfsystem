"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import styles from "./page.module.css";

type StatusFiltro = "todos" | "assinados" | "pendentes" | "expirados" | "problemas";
type Contrato = {
  id: string;
  canal_id: number;
  numero: string;
  fluxo_id?: number | null;
  status: string;
  nome_signatario: string;
  cpf_ultimos4?: string | null;
  email_signatario?: string | null;
  contrato_nome: string;
  contrato_hash_original: string;
  contrato_hash_assinado?: string | null;
  biometria_status: string;
  otp_confirmado_em?: string | null;
  consentimento_versao?: string | null;
  assinatura_em?: string | null;
  ip_assinatura?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  auditoria_hmac?: string | null;
  expira_em: string;
  concluida_em?: string | null;
  created_at: string;
};
type Resumo = { total: number; assinados: number; pendentes: number; expirados: number; problemas: number };
type Paginacao = { pagina: number; limite: number; total: number; paginas: number };

const STATUS: Record<string, { label: string; className: string }> = {
  concluida: { label: "Assinado", className: styles.statusSigned },
  pendente: { label: "Pendente", className: styles.statusPending },
  expirada: { label: "Expirado", className: styles.statusExpired },
  recusada: { label: "Recusado", className: styles.statusProblem },
  revogada: { label: "Revogado", className: styles.statusProblem },
  erro: { label: "Erro", className: styles.statusProblem },
};

function dataHora(valor?: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}
function curto(valor?: string | null, tamanho = 18) {
  if (!valor) return "—";
  return valor.length <= tamanho ? valor : `${valor.slice(0, tamanho)}…`;
}

export default function ContratosPage() {
  const router = useRouter();
  const { permissoes, isDono, isSuperAdmin, perfil, workspaceId, loading: permissaoCarregando } = usePermissao();
  const permitido = isSuperAdmin || isDono || perfil === "Administrador" || permissoes.contratos_acessar;
  const [resumo, setResumo] = useState<Resumo>({ total: 0, assinados: 0, pendentes: 0, expirados: 0, problemas: 0 });
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [paginacao, setPaginacao] = useState<Paginacao>({ pagina: 1, limite: 25, total: 0, paginas: 1 });
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<Contrato | null>(null);
  const [baixando, setBaixando] = useState("");

  useEffect(() => {
    if (!permissaoCarregando && !permitido) router.replace("/crm/visao");
  }, [permissaoCarregando, permitido, router]);

  const requisicao = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Falha ao consultar contratos" }));
      throw new Error(data.error || "Falha ao consultar contratos");
    }
    return response;
  }, []);

  const carregar = useCallback(async (pagina = 1, silencioso = false) => {
    if (!workspaceId || !permitido) return;
    silencioso ? setAtualizando(true) : setCarregando(true);
    setErro("");
    try {
      const query = new URLSearchParams({
        workspaceId,
        pagina: String(pagina),
        limite: "25",
        status: filtro,
      });
      if (buscaAplicada) query.set("busca", buscaAplicada);
      const response = await requisicao(`/api/contratos?${query.toString()}`);
      const data = await response.json();
      setResumo(data.resumo || { total: 0, assinados: 0, pendentes: 0, expirados: 0, problemas: 0 });
      setContratos(data.contratos || []);
      setPaginacao(data.paginacao || { pagina: 1, limite: 25, total: 0, paginas: 1 });
    } catch (e: any) {
      setErro(e.message || "Não foi possível carregar os contratos");
      setContratos([]);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [buscaAplicada, filtro, permitido, requisicao, workspaceId]);

  useEffect(() => { void carregar(1); }, [carregar]);

  const cards = useMemo(() => [
    { key: "todos" as const, icon: "📄", label: "Contratos gerados", value: resumo.total, note: "Todos os documentos", color: "blue" },
    { key: "assinados" as const, icon: "✅", label: "Assinados", value: resumo.assinados, note: "Concluídos com auditoria", color: "green" },
    { key: "pendentes" as const, icon: "🕒", label: "Pendentes", value: resumo.pendentes, note: "Aguardando o cliente", color: "amber" },
    { key: "expirados" as const, icon: "⌛", label: "Expirados", value: resumo.expirados, note: "Link fora da validade", color: "slate" },
    { key: "problemas" as const, icon: "⚠️", label: "Recusados / erros", value: resumo.problemas, note: "Precisam de atenção", color: "red" },
  ], [resumo]);

  async function baixar(contrato: Contrato) {
    setBaixando(contrato.id);
    setErro("");
    try {
      const response = await requisicao(`/api/contratos/${contrato.id}/arquivo?workspaceId=${encodeURIComponent(workspaceId)}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `assinado_${contrato.contrato_nome || contrato.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      setErro(e.message || "Não foi possível baixar o PDF");
    } finally {
      setBaixando("");
    }
  }

  if (permissaoCarregando || (carregando && !workspaceId)) {
    return <div className={styles.loadingPage}><div className={styles.spinner}/><span>Carregando módulo Contratos…</span></div>;
  }
  if (!permitido) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>WOLF CONTRATOS</span>
          <h1>Contratos e assinaturas</h1>
          <p>Acompanhe cada documento, assinatura eletrônica e evidência do seu workspace.</p>
        </div>
        <button className={styles.refreshButton} onClick={() => carregar(paginacao.pagina, true)} disabled={atualizando}>
          <span className={atualizando ? styles.spin : ""}>↻</span> {atualizando ? "Atualizando" : "Atualizar"}
        </button>
      </header>

      <section className={styles.cards} aria-label="Resumo dos contratos">
        {cards.map(card => (
          <button key={card.key} className={`${styles.kpi} ${styles[`kpi_${card.color}`]} ${filtro === card.key ? styles.kpiActive : ""}`} onClick={() => { setFiltro(card.key); setSelecionado(null); }}>
            <span className={styles.kpiIcon}>{card.icon}</span>
            <span><small>{card.label}</small><strong>{card.value.toLocaleString("pt-BR")}</strong><em>{card.note}</em></span>
          </button>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <span>⌕</span>
            <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setBuscaAplicada(busca.trim()); }} placeholder="Buscar por cliente, telefone ou documento" />
            {(busca || buscaAplicada) && <button onClick={() => { setBusca(""); setBuscaAplicada(""); }}>×</button>}
          </div>
          <button className={styles.searchButton} onClick={() => setBuscaAplicada(busca.trim())}>Buscar</button>
          <span className={styles.resultCount}>{paginacao.total.toLocaleString("pt-BR")} resultado(s)</span>
        </div>

        {erro && <div className={styles.alert}><span>!</span>{erro}<button onClick={() => setErro("")}>×</button></div>}

        {carregando ? (
          <div className={styles.loadingTable}><div className={styles.spinner}/><span>Consultando contratos…</span></div>
        ) : contratos.length === 0 ? (
          <div className={styles.empty}><div>📄</div><h2>Nenhum contrato encontrado</h2><p>Os contratos criados pelo bloco Assinatura Wolf aparecerão aqui automaticamente.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Cliente / documento</th><th>Status</th><th>Criado</th><th>Assinatura</th><th>Validação</th><th></th></tr></thead>
              <tbody>{contratos.map(contrato => {
                const estado = STATUS[contrato.status] || { label: contrato.status, className: styles.statusExpired };
                return <tr key={contrato.id}>
                  <td><div className={styles.person}><span>{contrato.nome_signatario?.slice(0,1).toUpperCase() || "?"}</span><div><b>{contrato.nome_signatario}</b><small>{contrato.contrato_nome}</small><em>{contrato.numero}{contrato.cpf_ultimos4 ? ` · CPF final ${contrato.cpf_ultimos4}` : ""}</em></div></div></td>
                  <td><span className={`${styles.status} ${estado.className}`}>{estado.label}</span></td>
                  <td><b className={styles.date}>{dataHora(contrato.created_at)}</b><small className={styles.subdate}>Canal {contrato.canal_id}</small></td>
                  <td><b className={styles.date}>{dataHora(contrato.assinatura_em)}</b><small className={styles.subdate}>{contrato.status === "concluida" ? "OTP confirmado" : `Expira ${dataHora(contrato.expira_em)}`}</small></td>
                  <td><span className={styles.evidence}>{contrato.biometria_status === "selfie_evidencia" ? "Selfie evidência" : "Aguardando"}</span></td>
                  <td><div className={styles.actions}><button onClick={() => setSelecionado(contrato)}>Detalhes</button>{contrato.status === "concluida" && <button className={styles.download} onClick={() => baixar(contrato)} disabled={baixando === contrato.id}>{baixando === contrato.id ? "Baixando…" : "Baixar PDF"}</button>}</div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}

        {paginacao.paginas > 1 && <div className={styles.pagination}><button disabled={paginacao.pagina <= 1} onClick={() => carregar(paginacao.pagina - 1)}>← Anterior</button><span>Página <b>{paginacao.pagina}</b> de {paginacao.paginas}</span><button disabled={paginacao.pagina >= paginacao.paginas} onClick={() => carregar(paginacao.pagina + 1)}>Próxima →</button></div>}
      </section>

      <footer className={styles.footer}>Documentos privados · acesso por workspace e permissão · hashes SHA-256 e auditoria Wolf</footer>

      {selecionado && <div className={styles.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget) setSelecionado(null); }}><section className={styles.modal} role="dialog" aria-modal="true"><header><div><span>TRILHA DE AUDITORIA</span><h2>{selecionado.nome_signatario}</h2><p>{selecionado.contrato_nome}</p></div><button onClick={() => setSelecionado(null)}>×</button></header><div className={styles.auditGrid}><Audit label="Situação" value={(STATUS[selecionado.status] || { label: selecionado.status }).label}/><Audit label="Identificador" value={selecionado.id}/><Audit label="Telefone" value={selecionado.numero}/><Audit label="CPF" value={selecionado.cpf_ultimos4 ? `Final ${selecionado.cpf_ultimos4}` : "Não informado"}/><Audit label="Criado em" value={dataHora(selecionado.created_at)}/><Audit label="Assinado em" value={dataHora(selecionado.assinatura_em)}/><Audit label="OTP" value={selecionado.otp_confirmado_em ? `Confirmado em ${dataHora(selecionado.otp_confirmado_em)}` : "Ainda não confirmado"}/><Audit label="Identidade" value={selecionado.biometria_status === "selfie_evidencia" ? "Selfie preservada como evidência" : "Não verificada"}/><Audit label="IP da assinatura" value={selecionado.ip_assinatura || "Não disponível"}/><Audit label="Consentimento" value={selecionado.consentimento_versao || "—"}/><Audit label="Hash do original" value={curto(selecionado.contrato_hash_original, 28)} mono/><Audit label="Hash do assinado" value={curto(selecionado.contrato_hash_assinado, 28)} mono/><Audit label="HMAC da auditoria" value={curto(selecionado.auditoria_hmac, 28)} mono/></div><div className={styles.modalNote}>A selfie é evidência de identidade e não é apresentada como biometria facial verificada. O PDF assinado contém a assinatura legível e o certificado completo.</div><footer><button onClick={() => setSelecionado(null)}>Fechar</button>{selecionado.status === "concluida" && <button className={styles.download} onClick={() => baixar(selecionado)} disabled={baixando === selecionado.id}>{baixando === selecionado.id ? "Baixando…" : "Baixar contrato assinado"}</button>}</footer></section></div>}
    </main>
  );
}

function Audit({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className={styles.auditItem}><small>{label}</small><b className={mono ? styles.mono : ""} title={value}>{value}</b></div>;
}