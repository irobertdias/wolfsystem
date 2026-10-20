"use client";
import { useEffect, useId, useRef, useState } from "react";
import { lerPdfAssinado, nomePdfAssinado } from "../../lib/contrato-pdf";
import styles from "./page.module.css";

type Props = {
  contrato: { id: string; contrato_nome: string; nome_signatario: string };
  workspaceId: string;
  requisicao: (url: string, init?: RequestInit) => Promise<Response>;
  onFechar: () => void;
};
export default function VisualizadorContrato({ contrato, workspaceId, requisicao, onFechar }: Props) {
  const tituloId = useId();
  const fecharRef = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    let objectUrl = "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    setUrl(""); setErro("");
    void (async () => {
      try {
        const response = await requisicao(`/api/contratos/${encodeURIComponent(contrato.id)}/arquivo?workspaceId=${encodeURIComponent(workspaceId)}&visualizar=1`, { signal: controller.signal });
        const blob = await lerPdfAssinado(response);
        if (!ativo) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (error) {
        if (ativo) setErro(controller.signal.aborted ? "O servidor demorou para abrir o PDF. Tente novamente." : error instanceof Error ? error.message : "Não foi possível abrir o contrato assinado.");
      } finally { clearTimeout(timer); }
    })();
    return () => { ativo = false; clearTimeout(timer); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [contrato.id, workspaceId, requisicao, tentativa]);
  useEffect(() => {
    const anterior = document.activeElement;
    fecharRef.current?.focus({ preventScroll: true });
    return () => { if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true }); };
  }, []);
  return <div className={`${styles.modalBackdrop} ${styles.pdfBackdrop}`} onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}
    onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onFechar(); } }}>
    <section className={styles.pdfModal} role="dialog" aria-modal="true" aria-labelledby={tituloId}>
      <header className={styles.pdfHeader}>
        <div><span>DOCUMENTO ASSINADO</span><h2 id={tituloId}>{contrato.contrato_nome}</h2><p>{contrato.nome_signatario}</p></div>
        <button ref={fecharRef} type="button" onClick={onFechar} aria-label="Fechar visualização">×</button>
      </header>
      <div className={styles.pdfBody}>
        {erro ? <div className={styles.pdfMessage} role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>
          : !url ? <div className={styles.pdfMessage} role="status"><div className={styles.spinner}/><p>Carregando contrato assinado…</p></div>
          : <iframe className={styles.pdfFrame} src={`${url}#view=FitH`} title={`Contrato assinado: ${contrato.contrato_nome}`} />}
      </div>
      <footer className={styles.pdfFooter}>
        <span>Se o PDF não aparecer neste navegador, abra em outra aba ou baixe o arquivo.</span>
        <div>{url && <><a href={url} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a><a href={url} download={nomePdfAssinado(contrato.contrato_nome)} className={styles.download}>Baixar PDF assinado</a></>}<button type="button" onClick={onFechar}>Fechar</button></div>
      </footer>
    </section>
  </div>;
}
