"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { ModuloBloqueado, useModulos } from "../../hooks/useModulos";

type Canal = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  numero?: string | null;
  workspace_id: string;
  modulos?: string[] | null;
};

type ItemJob = { original: string; numero: string; erroChecagem?: string };
type JobValidacao = {
  id: string;
  status: "aguardando" | "processando" | "concluido" | "erro";
  total: number;
  processados: number;
  comWhatsapp: ItemJob[];
  semWhatsapp: ItemJob[];
  invalidos: ItemJob[];
  erro: string | null;
  criadoEm: string;
  concluidoEm: string | null;
};
type Resultado = ItemJob & { status: "com_whatsapp" | "sem_whatsapp" | "invalido" };

const LIMITE = 500;
const MODULO_CANAL = "validacao_numeros";

function separarEntradas(texto: string) {
  const unicos = new Map<string, string>();
  String(texto || "").split(/[\n,;\t]+/).forEach((parte) => {
    const original = parte.trim();
    if (!original) return;
    const digitos = original.replace(/\D/g, "");
    const chave = digitos || original.toLowerCase();
    if (!unicos.has(chave)) unicos.set(chave, original);
  });
  return Array.from(unicos.values());
}

function resultadosDoJob(job: JobValidacao | null): Resultado[] {
  if (!job) return [];
  return [
    ...(job.comWhatsapp || []).map((item) => ({ ...item, status: "com_whatsapp" as const })),
    ...(job.semWhatsapp || []).map((item) => ({ ...item, status: "sem_whatsapp" as const })),
    ...(job.invalidos || []).map((item) => ({ ...item, status: "invalido" as const })),
  ];
}

function numeroParaCopia(item: Resultado) {
  const original = String(item.original || "").trim();
  const digitosOriginais = original.replace(/\D/g, "");
  return digitosOriginais || original || String(item.numero || "").trim();
}

export default function ValidacaoNumerosPage() {
  const router = useRouter();
  const { workspace, wsId, loading: workspaceLoading } = useWorkspace();
  const { isDono, perfil, permissoes, loading: permissaoLoading } = usePermissao();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalId, setCanalId] = useState<number | null>(null);
  const [carregandoCanais, setCarregandoCanais] = useState(false);
  const [criandoCanal, setCriandoCanal] = useState(false);
  const [texto, setTexto] = useState("");
  const [job, setJob] = useState<JobValidacao | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "validos" | "invalidos">("todos");
  const [copiado, setCopiado] = useState<"validos" | "invalidos" | null>(null);
  const [qrCanalId, setQrCanalId] = useState<number | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrAberto, setQrAberto] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);
  const [acaoCanal, setAcaoCanal] = useState<"reconectar" | "qr" | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const podeAcessar = isDono || perfil === "Administrador" || !!permissoes.disparo_enviar;
  const workspaceIds = useMemo(() => Array.from(new Set(
    [wsId, workspace?.username, workspace?.id ? String(workspace.id) : null].filter(Boolean).map(String)
  )), [wsId, workspace?.username, workspace?.id]);
  const entradas = useMemo(() => separarEntradas(texto), [texto]);
  const resultados = useMemo(() => resultadosDoJob(job), [job]);
  const validos = useMemo(() => resultados.filter((r) => r.status === "com_whatsapp"), [resultados]);
  const invalidos = useMemo(() => resultados.filter((r) => r.status !== "com_whatsapp"), [resultados]);
  const exibidos = useMemo(() => filtro === "validos" ? validos : filtro === "invalidos" ? invalidos : resultados, [filtro, resultados, validos, invalidos]);
  const canalAtual = canais.find((c) => c.id === canalId) || null;
  const canalQr = canais.find((c) => c.id === qrCanalId) || null;
  const qrWorkspaceId = canalQr?.workspace_id || wsId || "";
  const validando = !!job && !["concluido", "erro"].includes(job.status);
  const progresso = job?.total ? Math.min(100, Math.round((job.processados / job.total) * 100)) : (job?.status === "concluido" ? 100 : 0);

  const wa = useCallback(async (rota: string, body?: object) => {
    const separador = rota.indexOf("&");
    const nomeRota = separador >= 0 ? rota.slice(0, separador) : rota;
    const parametros = separador >= 0 ? rota.slice(separador + 1) : "";
    const url = "/api/whatsapp?rota=" + encodeURIComponent(nomeRota) + (parametros ? "&" + parametros : "");
    const resp = await fetch(url, body === undefined ? { cache: "no-store" } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success === false || data?.status === "erro") throw new Error(data?.error || "Falha na comunica\u00e7\u00e3o com o WhatsApp.");
    return data;
  }, []);

  const carregarCanais = useCallback(async () => {
    if (!workspaceIds.length) return;
    setCarregandoCanais(true);
    const { data, error } = await supabase.from("conexoes")
      .select("id,nome,tipo,status,numero,workspace_id,modulos")
      .in("workspace_id", workspaceIds)
      .eq("tipo", "webjs")
      .order("created_at", { ascending: false });
    setCarregandoCanais(false);
    if (error) { setErro("N\u00e3o foi poss\u00edvel carregar o canal de consulta: " + error.message); return; }
    const exclusivos = ((data || []) as Canal[]).filter((c) => Array.isArray(c.modulos) && c.modulos.includes(MODULO_CANAL));
    setCanais(exclusivos);
    setCanalId((atual) => exclusivos.some((c) => c.id === atual) ? atual : (exclusivos[0]?.id || null));
  }, [workspaceIds]);

  useEffect(() => { carregarCanais(); }, [carregarCanais]);

  useEffect(() => {
    if (!qrPolling || !qrAberto || !qrCanalId || !qrWorkspaceId) return;
    let ativo = true;
    const consultar = async () => {
      try {
        const rota = "qr-data&canalId=" + encodeURIComponent(String(qrCanalId)) + "&workspaceId=" + encodeURIComponent(qrWorkspaceId);
        const data = await wa(rota);
        if (!ativo) return;
        if (data.qr) setQrImage(data.qr);
        setQrStatus(data.status || "desconectado");
        if (data.status === "conectado") {
          setQrPolling(false);
          await supabase.from("conexoes").update({ status: "conectado", numero: data.numero || "Conectado" }).eq("id", qrCanalId).in("workspace_id", workspaceIds);
          await carregarCanais();
          window.setTimeout(() => setQrAberto(false), 900);
        }
      } catch (e) { if (ativo) setErro((e as Error).message); }
    };
    consultar();
    const timer = window.setInterval(consultar, 1500);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [qrPolling, qrAberto, qrCanalId, qrWorkspaceId, wa, carregarCanais, workspaceIds]);

  useEffect(() => {
    if (!job?.id || ["concluido", "erro"].includes(job.status) || !wsId) return;
    let ativo = true;
    const consultar = async () => {
      try {
        const rota = "validar-numeros/status&jobId=" + encodeURIComponent(job.id) + "&workspaceId=" + encodeURIComponent(wsId);
        const data = await wa(rota);
        if (ativo && data?.job) {
          setJob(data.job as JobValidacao);
          if (data.job.status === "erro") setErro(data.job.erro || "A valida\u00e7\u00e3o foi interrompida.");
        }
      } catch (e) { if (ativo) setErro((e as Error).message); }
    };
    consultar();
    const timer = window.setInterval(consultar, 1200);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [job?.id, job?.status, wsId, wa]);

  const criarCanalExclusivo = async () => {
    if (!wsId || criandoCanal) return;
    if (canais.length) { setErro("Este workspace j\u00e1 possui um canal exclusivo para valida\u00e7\u00e3o."); return; }
    setErro(""); setCriandoCanal(true);
    try {
      const { data, error } = await supabase.from("conexoes").insert([{
        workspace_id: wsId,
        nome: "Valida\u00e7\u00e3o de n\u00fameros",
        tipo: "webjs",
        status: "desconectado",
        numero: "",
        modo: "nenhum",
        ia: "gpt",
        fila: "Valida\u00e7\u00e3o de n\u00fameros",
        prompt: "",
        parar_se_atendente: true,
        modulos: [MODULO_CANAL],
      }]).select("id,nome,tipo,status,numero,workspace_id,modulos").single();
      if (error) throw error;
      const canal = data as Canal;
      await wa("canal/criar", { canalId: canal.id, workspaceId: wsId });
      setCanais([canal]); setCanalId(canal.id);
      setQrCanalId(canal.id); setQrImage(""); setQrStatus("desconectado"); setQrAberto(true); setQrPolling(true);
    } catch (e) { setErro((e as Error).message || "N\u00e3o foi poss\u00edvel criar o canal."); }
    finally { setCriandoCanal(false); }
  };

  const abrirQr = async (canal: Canal) => {
    if (!confirm("Gerar um novo QR para o canal exclusivo de valida\u00e7\u00e3o?\n\nIsto encerra a sess\u00e3o salva atual. Use somente para trocar a conta ou quando a reconex\u00e3o normal n\u00e3o funcionar.")) return;
    setErro(""); setAcaoCanal("qr"); setQrCanalId(canal.id); setQrImage(""); setQrStatus("desconectado"); setQrAberto(true); setQrPolling(false);
    try {
      await wa("resetar", { canalId: canal.id, workspaceId: canal.workspace_id });
      await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", canal.id).eq("workspace_id", canal.workspace_id);
      setQrPolling(true);
    } catch (e) { setQrAberto(false); setErro((e as Error).message); }
    finally { setAcaoCanal(null); }
  };

  const reconectarCanal = async (canal: Canal) => {
    if (acaoCanal) return;
    setErro(""); setAcaoCanal("reconectar"); setQrCanalId(canal.id); setQrImage(""); setQrStatus("reconectando"); setQrAberto(true); setQrPolling(false);
    try {
      const data = await wa("reconectar", { canalId: canal.id, workspaceId: canal.workspace_id });
      setQrStatus(data?.sessao_salva === false ? "desconectado" : "reconectando");
      setQrPolling(true);
      await carregarCanais();
    } catch (e) {
      setQrAberto(false);
      setErro((e as Error).message || "N\u00e3o foi poss\u00edvel reconectar o canal.");
    } finally { setAcaoCanal(null); }
  };

  const importarArquivo = (arquivo?: File) => {
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) { setErro("O arquivo deve ter no m\u00e1ximo 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setTexto(String(reader.result || "")); setJob(null); setErro(""); };
    reader.onerror = () => setErro("N\u00e3o foi poss\u00edvel ler o arquivo.");
    reader.readAsText(arquivo);
    if (arquivoRef.current) arquivoRef.current.value = "";
  };

  const iniciarValidacao = async () => {
    setErro(""); setJob(null); setFiltro("todos");
    if (!canalAtual || String(canalAtual.status).toLowerCase() !== "conectado") { setErro("Conecte o canal exclusivo pelo QR antes de validar."); return; }
    if (!entradas.length) { setErro("Cole ou importe pelo menos um n\u00famero."); return; }
    if (entradas.length > LIMITE) { setErro("O limite por valida\u00e7\u00e3o \u00e9 de " + LIMITE + " n\u00fameros."); return; }
    try {
      const data = await wa("validar-numeros", { workspaceId: canalAtual.workspace_id, canalId: canalAtual.id, numeros: entradas });
      if (!data?.job?.id) throw new Error("O backend n\u00e3o devolveu o identificador da valida\u00e7\u00e3o.");
      setJob(data.job as JobValidacao);
    } catch (e) { setErro((e as Error).message || "Falha ao iniciar a valida\u00e7\u00e3o."); }
  };

  const copiar = async (lista: Resultado[], tipo: "validos" | "invalidos") => {
    try {
      await navigator.clipboard.writeText(lista.map(numeroParaCopia).filter(Boolean).join("\n"));
      setCopiado(tipo);
      window.setTimeout(() => setCopiado((atual) => atual === tipo ? null : atual), 1800);
    } catch {
      setErro("Não foi possível copiar os números. Verifique a permissão da área de transferência do navegador.");
    }
  };

  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,.06)" };
  const input = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "11px 13px", color: "#0f172a", background: "#fff", fontSize: 13, boxSizing: "border-box" as const, outline: "none" };
  const button = { border: 0, borderRadius: 10, padding: "11px 16px", fontWeight: 800, cursor: "pointer", fontSize: 13 } as const;

  if (modulosCarregados && !modulos.validacao_numeros) return <ModuloBloqueado modulo="validacao_numeros" />;
  if (!workspaceLoading && !permissaoLoading && !podeAcessar) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}><section style={{ ...card, padding: 32, maxWidth: 480 }}><h1>Acesso restrito</h1><p>Seu usu&aacute;rio precisa da permiss&atilde;o de envio de disparos para acessar esta ferramenta.</p></section></main>;

  return <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "28px clamp(16px,3vw,40px)", color: "#0f172a" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 20 }}>
      <header style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => router.push("/chatbot")} style={{ ...button, background: "#fff", border: "1px solid #cbd5e1" }}>&larr; Voltar</button>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#2563eb,#06b6d4)", color: "#fff", fontSize: 22 }}>&#9989;</div>
        <div><h1 style={{ margin: 0, fontSize: 25 }}>Valida&ccedil;&atilde;o de n&uacute;meros</h1><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>Higienize listas sem enviar mensagens aos contatos.</p></div>
      </header>

      <section style={{ ...card, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div><h2 style={{ margin: "0 0 5px", fontSize: 17 }}>Canal exclusivo para consulta</h2><p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Este WhatsApp Web ser&aacute; usado somente para verificar a exist&ecirc;ncia dos n&uacute;meros.</p></div>
          {!canais.length && <button disabled={criandoCanal || carregandoCanais} onClick={criarCanalExclusivo} style={{ ...button, background: "#0f766e", color: "#fff", opacity: criandoCanal ? .6 : 1 }}>{criandoCanal ? "Criando..." : "+ Criar canal de consulta"}</button>}
        </div>
        {canais.length > 0 && <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(240px,1fr) auto", gap: 12, alignItems: "end" }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Canal
            <select value={canalId || ""} onChange={(e) => setCanalId(Number(e.target.value))} style={{ ...input, marginTop: 7 }}>
              {canais.map((c) => <option key={c.id} value={c.id}>{c.nome} - {c.status === "conectado" ? "conectado" : "desconectado"}{c.numero ? " (" + c.numero + ")" : ""}</option>)}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button disabled={!canalAtual || !!acaoCanal} onClick={() => canalAtual && reconectarCanal(canalAtual)} style={{ ...button, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", opacity: acaoCanal ? .6 : 1 }}>{acaoCanal === "reconectar" ? "Reconectando..." : "Reconectar sess\u00e3o"}</button>
            <button disabled={!canalAtual || !!acaoCanal} onClick={() => canalAtual && abrirQr(canalAtual)} style={{ ...button, color: "#0f766e", background: "#ecfdf5", border: "1px solid #99f6e4", opacity: acaoCanal ? .6 : 1 }}>Gerar novo QR</button>
            <button disabled={carregandoCanais} onClick={carregarCanais} style={{ ...button, color: "#475569", background: "#fff", border: "1px solid #cbd5e1" }}>{carregandoCanais ? "Atualizando..." : "Atualizar status"}</button>
          </div>
        </div>}
      </section>

      <section style={{ ...card, padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: "0 0 5px", fontSize: 17 }}>Lista para higieniza&ccedil;&atilde;o</h2><p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Cole um n&uacute;mero por linha ou importe CSV/TXT. Limite: {LIMITE} por consulta.</p></div><button onClick={() => arquivoRef.current?.click()} style={{ ...button, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>Importar CSV/TXT</button></div>
        <input ref={arquivoRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => importarArquivo(e.target.files?.[0])}/>
        <textarea value={texto} onChange={(e) => { setTexto(e.target.value); setJob(null); }} placeholder={"5562999999999\n5562888888888"} style={{ ...input, minHeight: 190, resize: "vertical", fontFamily: "ui-monospace,monospace" }}/>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><span style={{ color: entradas.length > LIMITE ? "#dc2626" : "#475569", fontSize: 12, fontWeight: 800 }}>{entradas.length} n&uacute;mero(s) &uacute;nico(s)</span><button disabled={validando || !entradas.length || canalAtual?.status !== "conectado"} onClick={iniciarValidacao} style={{ ...button, background: "#2563eb", color: "#fff", opacity: validando || canalAtual?.status !== "conectado" ? .55 : 1 }}>{validando ? "Validando..." : "Validar lista"}</button></div>
        {erro && <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 10, fontSize: 13 }}>{erro}</div>}
      </section>

      {job && <section style={{ ...card, padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Resultado</h2><p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Status: {job.status} - {job.processados}/{job.total} consultados</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => copiar(validos, "validos")} disabled={!validos.length} style={{ ...button, background: "#ecfdf5", color: "#047857" }}>{copiado === "validos" ? "Copiados!" : `Copiar com WhatsApp (${validos.length})`}</button><button onClick={() => copiar(invalidos, "invalidos")} disabled={!invalidos.length} style={{ ...button, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>{copiado === "invalidos" ? "Copiados!" : `Copiar sem WhatsApp / inválidos (${invalidos.length})`}</button></div></div>
        <div style={{ height: 9, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}><div style={{ height: "100%", width: progresso + "%", background: "linear-gradient(90deg,#2563eb,#06b6d4)", transition: "width .3s" }}/></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}><Resumo titulo="Com WhatsApp" valor={validos.length} cor="#059669"/><Resumo titulo="Sem WhatsApp" valor={(job.semWhatsapp || []).length} cor="#dc2626"/><Resumo titulo="Formato inv&aacute;lido" valor={(job.invalidos || []).length} cor="#d97706"/></div>
        <div style={{ display: "flex", gap: 8 }}><Filtro ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</Filtro><Filtro ativo={filtro === "validos"} onClick={() => setFiltro("validos")}>Com WhatsApp</Filtro><Filtro ativo={filtro === "invalidos"} onClick={() => setFiltro("invalidos")}>Sem WhatsApp / inv&aacute;lidos</Filtro></div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "auto", maxHeight: 430 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}><tr><th style={th}>Original</th><th style={th}>Normalizado</th><th style={th}>Resultado</th><th style={th}>Observa&ccedil;&atilde;o</th></tr></thead><tbody>{exibidos.map((r, i) => <tr key={r.status + "-" + r.numero + "-" + i}><td style={td}>{r.original}</td><td style={{ ...td, fontFamily: "ui-monospace,monospace" }}>{r.numero || "-"}</td><td style={td}><span style={{ fontWeight: 800, color: r.status === "com_whatsapp" ? "#047857" : r.status === "sem_whatsapp" ? "#b91c1c" : "#b45309" }}>{r.status === "com_whatsapp" ? "TEM WHATSAPP" : r.status === "sem_whatsapp" ? "NAO TEM WHATSAPP" : "FORMATO INVALIDO"}</span></td><td style={td}>{r.erroChecagem || "-"}</td></tr>)}</tbody></table></div>
      </section>}
    </div>

    {qrAberto && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.58)", display: "grid", placeItems: "center", zIndex: 3000, padding: 20 }}><section style={{ ...card, width: "min(440px,100%)", padding: 28, textAlign: "center" }}><h2 style={{ margin: "0 0 8px" }}>{qrStatus === "reconectando" ? "Reconectando canal de consulta" : "Conectar canal de consulta"}</h2><p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13 }}>{qrStatus === "reconectando" ? "Tentando restaurar a sess\u00e3o salva. Se ela n\u00e3o existir, o QR aparecer\u00e1 automaticamente." : qrImage ? "No WhatsApp, abra Aparelhos conectados e leia este QR." : "Preparando a conex\u00e3o e aguardando um novo c\u00f3digo QR."}</p><div style={{ minHeight: 240, display: "grid", placeItems: "center" }}>{qrStatus === "conectado" ? <div style={{ color: "#047857", fontWeight: 900, fontSize: 18 }}>&#9989; Conectado</div> : qrImage ? <img src={qrImage} alt="Codigo QR" width={230} height={230} style={{ borderRadius: 10 }}/> : <span style={{ color: "#64748b" }}>{qrStatus === "reconectando" ? "Restaurando sess\u00e3o salva..." : "Gerando c\u00f3digo QR..."}</span>}</div><div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 16 }}>{qrStatus !== "conectado" && canalQr && <button disabled={!!acaoCanal} onClick={() => abrirQr(canalQr)} style={{ ...button, background: "#ecfdf5", color: "#0f766e", border: "1px solid #99f6e4" }}>Gerar outro QR</button>}<button onClick={() => { setQrAberto(false); setQrPolling(false); }} style={{ ...button, background: "#f1f5f9", color: "#334155" }}>Fechar</button></div></section></div>}
  </main>;
}

const th = { textAlign: "left" as const, padding: "11px 12px", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11 };
const td = { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", color: "#334155" };
function Resumo({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) { return <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}><strong style={{ display: "block", color: cor, fontSize: 24 }}>{valor}</strong><span style={{ color: "#64748b", fontSize: 11 }}>{titulo}</span></div>; }
function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} style={{ border: "1px solid " + (ativo ? "#2563eb" : "#cbd5e1"), background: ativo ? "#eff6ff" : "#fff", color: ativo ? "#1d4ed8" : "#475569", borderRadius: 999, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{children}</button>; }
