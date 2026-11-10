"use client";
import Icone from "../../components/a2/Icone";
import { useEffect, useMemo, useState } from "react";

// Biblioteca de mídia da conversa (estilo WhatsApp): fotos/vídeos, documentos e links.
// Áudios ficam de fora de propósito. Funciona em qualquer workspace e para qualquer
// usuário que consiga abrir a conversa: usa o mesmo histórico já carregado no chat.

export type MensagemBiblioteca = {
  id?: number | string;
  de?: string | null;
  mensagem: string;
  created_at?: string | null;
  canal_id?: number | string | null;
};

type TipoMidia = "img" | "video" | "file";
export type ItemMidia = { chave: string; tipo: TipoMidia; filename: string; legenda: string; data: string | null; canalId: MensagemBiblioteca["canal_id"]; doCliente: boolean };
export type ItemLink = { chave: string; url: string; texto: string; data: string | null; doCliente: boolean };
export type AbaBiblioteca = "midia" | "docs" | "links";

const RE_MIDIA = /^\[(img|video|file):([^\]]+)\](?:\n([\s\S]*))?$/;
const RE_AUDIO = /^\[audio:[^\]]+\]/;
const RE_LINK = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const EXT_IMG = /\.(jpe?g|png|gif|webp|bmp|heic)$/i;
const EXT_VIDEO = /\.(mp4|mov|webm|3gp|mkv|avi)$/i;

function limparUrl(bruta: string) {
  // Remove pontuação final que costuma colar no link ("veja: site.com.", "(site.com)").
  const pares: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let url = bruta;
  for (;;) {
    const antes = url;
    url = url.replace(/[.,;:!?…*_~]+$/, "");
    const fecha = url.slice(-1);
    const abre = pares[fecha];
    if (abre && url.split(abre).length < url.split(fecha).length) url = url.slice(0, -1);
    if (url === antes) return url;
  }
}

export function extrairBiblioteca(mensagens: MensagemBiblioteca[]) {
  const midias: ItemMidia[] = [];
  const docs: ItemMidia[] = [];
  const links: ItemLink[] = [];
  const vistos = new Set<string>();
  mensagens.forEach((m, i) => {
    if (!m || m.de === "sistema" || typeof m.mensagem !== "string") return;
    const texto = m.mensagem;
    if (RE_AUDIO.test(texto)) return; // áudio não entra na biblioteca
    const doCliente = m.de === "cliente";
    const base = String(m.id ?? `i${i}`);
    const match = texto.match(RE_MIDIA);
    let textoLivre = texto;
    if (match) {
      let tipo = match[1] as TipoMidia;
      const filename = match[2];
      // Arquivo enviado como documento mas que é foto/vídeo continua em documentos,
      // igual ao WhatsApp. Só corrigimos o caso inverso (img/video com extensão de doc).
      if (tipo !== "file" && !EXT_IMG.test(filename) && !EXT_VIDEO.test(filename) && /\.[a-z0-9]{2,5}$/i.test(filename)) tipo = "file";
      const legenda = (match[3] || "").trim();
      const item: ItemMidia = { chave: `${base}:${filename}`, tipo, filename, legenda: legenda.length > 2000 ? "" : legenda, data: m.created_at || null, canalId: m.canal_id, doCliente };
      (tipo === "file" ? docs : midias).push(item);
      textoLivre = item.legenda;
    }
    for (const bruto of textoLivre.match(RE_LINK) || []) {
      const url = limparUrl(bruto);
      if (url.length < 8) continue;
      const chave = `${base}:${url}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      links.push({ chave, url, texto: textoLivre.trim(), data: m.created_at || null, doCliente });
    }
  });
  const recentes = <T extends { data: string | null }>(lista: T[]) =>
    lista.sort((a, b) => (Date.parse(b.data || "") || 0) - (Date.parse(a.data || "") || 0));
  return { midias: recentes(midias), docs: recentes(docs), links: recentes(links) };
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function rotuloMes(data: string | null) {
  const d = data ? new Date(data) : null;
  if (!d || isNaN(d.getTime())) return "Sem data";
  const agora = new Date();
  if (d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth()) return "Este mês";
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
function agruparPorMes<T extends { data: string | null }>(itens: T[]) {
  const grupos: { rotulo: string; itens: T[] }[] = [];
  for (const item of itens) {
    const rotulo = rotuloMes(item.data);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rotulo === rotulo) ultimo.itens.push(item);
    else grupos.push({ rotulo, itens: [item] });
  }
  return grupos;
}
function dataCurta(data: string | null) {
  const d = data ? new Date(data) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
const nomeExibicao = (filename: string) => filename.replace(/^midia_\d+_[a-z0-9]+_/i, "");
const extensao = (filename: string) => (filename.split(".").pop() || "arquivo").toUpperCase().slice(0, 5);
function iconeDoc(filename: string) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { cor: "#e5484d", rotulo: "PDF" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { cor: "#30a46c", rotulo: ext.toUpperCase() };
  if (["doc", "docx", "rtf", "odt"].includes(ext)) return { cor: "#3e63dd", rotulo: ext.toUpperCase() };
  if (["ppt", "pptx"].includes(ext)) return { cor: "#f76b15", rotulo: ext.toUpperCase() };
  if (["zip", "rar", "7z"].includes(ext)) return { cor: "#8e8c99", rotulo: ext.toUpperCase() };
  if (EXT_IMG.test(filename)) return { cor: "#8e4ec6", rotulo: ext.toUpperCase() };
  if (EXT_VIDEO.test(filename)) return { cor: "#d6409f", rotulo: ext.toUpperCase() };
  return { cor: "#64748B", rotulo: extensao(filename) };
}
function dominio(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
}
const hrefLink = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

type Props = {
  mensagens: MensagemBiblioteca[];
  urlMidia: (filename: string, canalId?: number | string | null) => string;
  aba: AbaBiblioteca;
  onAba: (aba: AbaBiblioteca) => void;
};

export function BibliotecaMidia({ mensagens, urlMidia, aba, onAba }: Props) {
  const [origem, setOrigem] = useState<"todas" | "cliente" | "enviadas">("todas");
  const [visualizando, setVisualizando] = useState<number | null>(null);
  const tudo = useMemo(() => extrairBiblioteca(mensagens), [mensagens]);
  const filtrar = <T extends { doCliente: boolean }>(lista: T[]) =>
    origem === "todas" ? lista : lista.filter(i => (origem === "cliente" ? i.doCliente : !i.doCliente));
  const midias = filtrar(tudo.midias);
  const docs = filtrar(tudo.docs);
  const links = filtrar(tudo.links);

  useEffect(() => { setVisualizando(null); }, [aba, origem]);

  const abas: { key: AbaBiblioteca; label: string; total: number }[] = [
    { key: "midia", label: "Mídia", total: midias.length },
    { key: "docs", label: "Docs", total: docs.length },
    { key: "links", label: "Links", total: links.length },
  ];
  const vazio = (texto: string) => (
    <div style={{ textAlign: "center", padding: "36px 12px", color: "#64748B", fontSize: 12.5 }}>{texto}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", background: "#F1F5F4", borderRadius: 10, padding: 3 }}>
        {abas.map(a => (
          <button key={a.key} onClick={() => onAba(a.key)}
            style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: aba === a.key ? "#ffffff" : "transparent", color: aba === a.key ? "#008069" : "#54656f", boxShadow: aba === a.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            {a.label} <span style={{ fontWeight: 600, color: "#8696a0", fontSize: 11 }}>{a.total}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {([["todas", "Todas"], ["cliente", "Recebidas"], ["enviadas", "Enviadas"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setOrigem(k)}
            style={{ border: `1px solid ${origem === k ? "#00a884" : "#E6ECEA"}`, background: origem === k ? "#e7fcf5" : "#ffffff", color: origem === k ? "#008069" : "#54656f", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {aba === "midia" && (midias.length === 0 ? vazio("Nenhuma foto ou vídeo nesta conversa.") : agruparPorMes(midias).map(g => (
        <div key={g.rotulo}>
          <p style={{ color: "#54656f", fontSize: 11, fontWeight: 700, margin: "4px 0 6px" }}>{g.rotulo}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
            {g.itens.map(item => {
              const indice = midias.indexOf(item);
              const src = urlMidia(item.filename, item.canalId);
              return (
                <button key={item.chave} onClick={() => setVisualizando(indice)} title={item.legenda || nomeExibicao(item.filename)}
                  style={{ position: "relative", aspectRatio: "1 / 1", padding: 0, border: "none", borderRadius: 4, overflow: "hidden", background: "#e9edef", cursor: "pointer" }}>
                  {item.tipo === "img"
                    ? <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                    : <video src={`${src}#t=0.5`} preload="metadata" muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />}
                  {item.tipo === "video" && (
                    <span style={{ position: "absolute", left: 4, bottom: 4, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 4, padding: "1px 5px" }}>vídeo</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )))}

      {aba === "docs" && (docs.length === 0 ? vazio("Nenhum documento nesta conversa.") : agruparPorMes(docs).map(g => (
        <div key={g.rotulo} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ color: "#54656f", fontSize: 11, fontWeight: 700, margin: "4px 0 0" }}>{g.rotulo}</p>
          {g.itens.map(item => {
            const icone = iconeDoc(item.filename);
            return (
              <a key={item.chave} href={urlMidia(item.filename, item.canalId)} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid #E6ECEA", borderRadius: 8, textDecoration: "none", background: "#ffffff" }}>
                <span style={{ width: 36, height: 42, borderRadius: 5, background: icone.cor, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, flexShrink: 0 }}>{icone.rotulo}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: "#111b21", fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeExibicao(item.filename)}</span>
                  <span style={{ display: "block", color: "#667781", fontSize: 11, marginTop: 2 }}>{extensao(item.filename)} · {dataCurta(item.data)} · {item.doCliente ? "recebido" : "enviado"}</span>
                </span>
                <span style={{ color: "#8696a0", fontSize: 16 }}>⤓</span>
              </a>
            );
          })}
        </div>
      )))}

      {aba === "links" && (links.length === 0 ? vazio("Nenhum link nesta conversa.") : agruparPorMes(links).map(g => (
        <div key={g.rotulo} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ color: "#54656f", fontSize: 11, fontWeight: 700, margin: "4px 0 0" }}>{g.rotulo}</p>
          {g.itens.map(item => (
            <a key={item.chave} href={hrefLink(item.url)} target="_blank" rel="noreferrer noopener"
              style={{ display: "flex", gap: 10, padding: "9px 10px", border: "1px solid #E6ECEA", borderRadius: 8, textDecoration: "none", background: "#ffffff" }}>
              <span style={{ width: 36, height: 36, borderRadius: 6, background: "#e7fcf5", color: "#008069", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🔗</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", color: "#111b21", fontSize: 12.5, fontWeight: 700 }}>{dominio(item.url)}</span>
                <span style={{ display: "block", color: "#027eb5", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.url}</span>
                {item.texto && item.texto !== item.url && (
                  <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", color: "#54656f", fontSize: 11, marginTop: 3, whiteSpace: "pre-wrap", wordBreak: "break-word" } as any}>{item.texto}</span>
                )}
                <span style={{ display: "block", color: "#8696a0", fontSize: 12, marginTop: 3 }}>{dataCurta(item.data)} · {item.doCliente ? "recebido" : "enviado"}</span>
              </span>
            </a>
          ))}
        </div>
      )))}

      {visualizando !== null && midias[visualizando] && (
        <Visualizador itens={midias} indice={visualizando} urlMidia={urlMidia} onIndice={setVisualizando} onFechar={() => setVisualizando(null)} />
      )}
    </div>
  );
}

function Visualizador({ itens, indice, urlMidia, onIndice, onFechar }: { itens: ItemMidia[]; indice: number; urlMidia: Props["urlMidia"]; onIndice: (i: number) => void; onFechar: () => void }) {
  const item = itens[indice];
  const src = urlMidia(item.filename, item.canalId);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      // Lista está do mais recente ao mais antigo: ← volta no tempo, → avança.
      if (e.key === "ArrowLeft" && indice < itens.length - 1) onIndice(indice + 1);
      if (e.key === "ArrowRight" && indice > 0) onIndice(indice - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, itens.length, onFechar, onIndice]);
  const seta = (lado: "esq" | "dir", ativo: boolean, acao: () => void) => (
    <button onClick={e => { e.stopPropagation(); if (ativo) acao(); }} disabled={!ativo}
      style={{ position: "absolute", top: "50%", [lado === "esq" ? "left" : "right"]: 12, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, cursor: ativo ? "pointer" : "default", opacity: ativo ? 1 : 0.25 } as any}>
      {lado === "esq" ? "‹" : "›"}
    </button>
  );
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(11,20,26,0.92)", display: "flex", flexDirection: "column" }}>
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "#e9edef" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{item.doCliente ? "Recebido" : "Enviado"} · {dataCurta(item.data)}</div>
          <div style={{ fontSize: 11, color: "#aebac1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeExibicao(item.filename)} · {itens.length - indice} de {itens.length}</div>
        </div>
        <a href={src} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Abrir / baixar" style={{ color: "#e9edef", fontSize: 18, textDecoration: "none" }}>⤓</a>
        <button onClick={onFechar} title="Fechar" style={{ background: "none", border: "none", color: "#e9edef", fontSize: 20, cursor: "pointer" }}><Icone nome="x" tamanho={16} /></button>
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 64px", minHeight: 0 }}>
        {seta("esq", indice < itens.length - 1, () => onIndice(indice + 1))}
        <div onClick={e => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%", display: "flex" }}>
          {item.tipo === "img"
            ? <img key={src} src={src} alt="" style={{ maxWidth: "100%", maxHeight: "calc(100vh - 150px)", objectFit: "contain", borderRadius: 4 }} />
            : <video key={src} src={src} controls autoPlay style={{ maxWidth: "100%", maxHeight: "calc(100vh - 150px)", borderRadius: 4 }} />}
        </div>
        {seta("dir", indice > 0, () => onIndice(indice - 1))}
      </div>
      <div onClick={e => e.stopPropagation()} style={{ minHeight: 48, padding: "10px 16px 16px", color: "#e9edef", fontSize: 13, textAlign: "center", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflowY: "auto" }}>
        {item.legenda}
      </div>
    </div>
  );
}

// Faixa de prévia para o topo do perfil, igual ao "Mídia, links e docs" do WhatsApp.
export function PreviaBiblioteca({ mensagens, urlMidia, onAbrir }: { mensagens: MensagemBiblioteca[]; urlMidia: Props["urlMidia"]; onAbrir: () => void }) {
  const { midias, docs, links } = useMemo(() => extrairBiblioteca(mensagens), [mensagens]);
  const total = midias.length + docs.length + links.length;
  return (
    <button onClick={onAbrir} style={{ width: "100%", textAlign: "left", background: "#ffffff", border: "1px solid #E6ECEA", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#54656f", fontSize: 12, fontWeight: 700 }}>Mídia, links e docs</span>
        <span style={{ color: "#8696a0", fontSize: 12, fontWeight: 600 }}>{total} ›</span>
      </span>
      {midias.length > 0 && (
        <span style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginTop: 8 }}>
          {midias.slice(0, 4).map(item => (
            <span key={item.chave} style={{ aspectRatio: "1 / 1", borderRadius: 6, overflow: "hidden", background: "#e9edef", position: "relative", display: "block" }}>
              {item.tipo === "img"
                ? <img src={urlMidia(item.filename, item.canalId)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                : <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#54656f", fontSize: 18 }}>▶</span>}
            </span>
          ))}
        </span>
      )}
      {midias.length === 0 && (
        <span style={{ display: "block", color: "#8696a0", fontSize: 11.5, marginTop: 4 }}>{docs.length} documento(s) · {links.length} link(s)</span>
      )}
    </button>
  );
}
