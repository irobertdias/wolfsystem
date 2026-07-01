"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type RespostaRapida = {
  id?: number;
  atalho: string;
  mensagem: string;
  workspace_id?: string;
  equipe_id?: string | null;
  midia_url?: string | null;   // 🆕 URL pública no Supabase Storage (isolada por workspace)
  midia_nome?: string | null;  // 🆕 nome original do arquivo (pra exibir na lista)
};
// 👥 Equipe (time/empresa dentro do workspace)
type Equipe = { id: string; nome: string; };

export function RespostasRapidasSection() {
  const { workspace, wsId } = useWorkspace();
  const [respostas, setRespostas] = useState<RespostaRapida[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ atalho: "", mensagem: "", equipeId: "" });
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // 🆕 mídia pré-anexada na resposta rápida
  const midiaInputRef = useRef<HTMLInputElement>(null);
  const [midiaArquivo, setMidiaArquivo] = useState<File | null>(null);
  const [midiaPreview, setMidiaPreview] = useState<string>("");
  const [uploadandoMidia, setUploadandoMidia] = useState(false);

  const IS = { width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  // 🔒 MULTI-TENANT FIX: padronizar a chave de workspace usada em TODAS as queries
  // (fetch, insert, delete). Antes, salvava com `wsId` e buscava com `workspace.username
  // || workspace.id.toString()` — bugado pra workspaces com username diferente do id.
  // Agora a fórmula é única e consistente.
  const wsKey = (): string | null => {
    return workspace?.username || workspace?.id?.toString() || wsId || null;
  };

  // 🆕 Upload de mídia pro Supabase Storage
  // Bucket: "respostas-rapidas-midia" (crie no Supabase Storage se não existir)
  // Estrutura: /{workspace_id}/{timestamp}_{nome_original}
  // 🔒 MULTI-TENANT: pasta isolada por workspace_id — arquivo de um workspace
  //    nunca fica acessível pra outro porque o path inclui o wsId como prefixo.
  const uploadMidia = async (file: File): Promise<{ url: string; nome: string } | null> => {
    const ws = wsKey();
    if (!ws) return null;
    const ext = file.name.split(".").pop() || "";
    const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ws}/${Date.now()}_${nomeSeguro}`;
    setUploadandoMidia(true);
    try {
      const { error } = await supabase.storage
        .from("respostas-rapidas-midia")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) { alert("Erro ao fazer upload da mídia: " + error.message); return null; }
      const { data: urlData } = supabase.storage
        .from("respostas-rapidas-midia")
        .getPublicUrl(path);
      return { url: urlData.publicUrl, nome: file.name };
    } catch (e: any) {
      alert("Erro no upload: " + (e?.message || "desconhecido"));
      return null;
    } finally {
      setUploadandoMidia(false);
    }
  };

  // 🆕 Limpa mídia selecionada no formulário
  const limparMidia = () => {
    setMidiaArquivo(null);
    if (midiaPreview) URL.revokeObjectURL(midiaPreview);
    setMidiaPreview("");
    if (midiaInputRef.current) midiaInputRef.current.value = "";
  };

  // 🆕 Ao selecionar arquivo no input
  const handleMidiaSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const limiteMB = file.type.startsWith("video/") ? 16 : file.type.startsWith("image/") ? 5 : 100;
    if (file.size > limiteMB * 1024 * 1024) {
      alert(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${limiteMB}MB.`);
      if (midiaInputRef.current) midiaInputRef.current.value = "";
      return;
    }
    setMidiaArquivo(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setMidiaPreview(URL.createObjectURL(file));
    } else {
      setMidiaPreview("");
    }
  };

  const fetchRespostas = async () => {
    const ws = wsKey();
    if (!ws) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("respostas_rapidas")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("[RespostasRapidas] erro no fetch:", error.message);
        setRespostas([]);
      } else {
        setRespostas(data || []);
      }
    } catch (e) {
      console.error("[RespostasRapidas] exceção no fetch:", e);
      setRespostas([]);
    }
    setCarregando(false);
  };

  // 👥 Carrega equipes ativas do workspace (mesma fonte das outras telas: wsId)
  const fetchEquipes = async () => {
    if (!wsId) return;
    try {
      const { data } = await supabase.from("equipes").select("id, nome").eq("workspace_id", wsId).eq("ativo", true).order("nome", { ascending: true });
      setEquipes((data as Equipe[]) || []);
    } catch (e) { console.error("Erro ao buscar equipes:", e); setEquipes([]); }
  };

  useEffect(() => { fetchRespostas(); fetchEquipes(); }, [workspace, wsId]);

  const salvar = async () => {
    if (!form.atalho.trim() && !midiaArquivo) { alert("Preencha pelo menos o atalho!"); return; }
    if (form.atalho.trim() && !form.atalho.startsWith("/")) { alert("O atalho deve começar com /"); return; }
    if (!form.atalho.trim()) { alert("Preencha o atalho!"); return; }
    if (!form.mensagem.trim() && !midiaArquivo) { alert("Preencha a mensagem ou selecione uma mídia!"); return; }
    const ws = wsKey();
    if (!ws) { alert("Workspace não carregado. Recarregue a página."); return; }

    setSalvando(true);
    try {
      // 🆕 Se tiver mídia, faz upload pro Supabase Storage primeiro
      let midiaUrl: string | null = null;
      let midiaNome: string | null = null;
      if (midiaArquivo) {
        const resultado = await uploadMidia(midiaArquivo);
        if (!resultado) { setSalvando(false); return; } // erro já alertado dentro de uploadMidia
        midiaUrl = resultado.url;
        midiaNome = resultado.nome;
      }

      const { error } = await supabase.from("respostas_rapidas").insert([{
        atalho: form.atalho.trim(),
        mensagem: form.mensagem.trim(),
        workspace_id: ws,
        equipe_id: form.equipeId || null,
        midia_url: midiaUrl,
        midia_nome: midiaNome,
      }]);
      if (error) {
        alert("Erro ao salvar: " + error.message);
        // 🆕 Se o insert falhou mas o upload já aconteceu, remove o arquivo do Storage
        if (midiaUrl) {
          const pathNoStorage = midiaUrl.split("/respostas-rapidas-midia/")[1];
          if (pathNoStorage) await supabase.storage.from("respostas-rapidas-midia").remove([pathNoStorage]);
        }
      } else {
        await fetchRespostas();
        setForm({ atalho: "", mensagem: "", equipeId: "" });
        limparMidia();
        setShowForm(false);
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message || "desconhecido"));
    }
    setSalvando(false);
  };

  const remover = async (r: RespostaRapida) => {
    if (!confirm(`Remover atalho ${r.atalho}?`)) return;
    if (!r.id) {
      setRespostas(respostas.filter(x => x.atalho !== r.atalho));
      return;
    }
    const ws = wsKey();
    if (!ws) { alert("Workspace não carregado. Recarregue a página."); return; }

    const { error } = await supabase.from("respostas_rapidas").delete()
      .eq("id", r.id)
      .eq("workspace_id", ws);
    if (error) { alert("Erro ao remover: " + error.message); return; }

    // 🆕 Remove o arquivo do Storage se existia mídia anexada
    if (r.midia_url) {
      const pathNoStorage = r.midia_url.split("/respostas-rapidas-midia/")[1];
      if (pathNoStorage) {
        await supabase.storage.from("respostas-rapidas-midia").remove([pathNoStorage]);
      }
    }

    await fetchRespostas();
  };

  // 👥 nome da equipe a partir do id
  const equipeNomeDe = (equipeId?: string | null): string => {
    if (!equipeId) return "";
    return equipes.find(e => e.id === equipeId)?.nome || "";
  };

  // 👥 respostas filtradas pela equipe escolhida
  const respostasFiltradas = respostas.filter(r => filtroEquipe === "todas" || (r.equipe_id || "") === filtroEquipe);

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#f8fafc", minHeight: "100vh" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(245,158,11,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>⚡</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Respostas Rápidas</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0" }}>
              Digite <code style={{ background: "#f3f4f6", color: "#3b82f6", padding: "1px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>/</code> no chat para usar
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
          + Nova Resposta
        </button>
      </div>

      {/* ═══ FILTRO DE EQUIPE ═══ */}
      {equipes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#a855f7", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>👥 Equipe</span>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} style={{ ...IS, width: "auto", minWidth: 200, cursor: "pointer" }}>
            <option value="todas">Todas as equipes</option>
            <option value="">⚪ Geral (sem equipe)</option>
            {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
          </select>
        </div>
      )}

      {/* ═══ FORM ═══ */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#3b82f615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>➕</div>
            <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Nova Resposta Rápida</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
            <div>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Atalho *</label>
              <input placeholder="/oi" value={form.atalho} onChange={e => setForm({ ...form, atalho: e.target.value })} style={{ ...IS, fontFamily: "monospace", fontWeight: 600 }} />
            </div>
            <div>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Mensagem *</label>
              <input placeholder="Olá! Como posso te ajudar?" value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} style={IS} />
            </div>
          </div>
          {/* 🆕 MÍDIA */}
          <div>
            <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
              📎 Mídia (opcional — imagem, vídeo, áudio ou documento)
            </label>
            <input
              ref={midiaInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              onChange={handleMidiaSelecionada}
              style={{ display: "none" }}
            />
            {!midiaArquivo ? (
              <button type="button" onClick={() => midiaInputRef.current?.click()}
                style={{
                  background: "#f8fafc", border: "2px dashed #e5e7eb", borderRadius: 10,
                  padding: "14px 20px", cursor: "pointer", color: "#6b7280", fontSize: 13,
                  fontWeight: 600, width: "100%", textAlign: "center" as const, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}>
                📎 Clique para anexar uma mídia
              </button>
            ) : (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#f8fafc", display: "flex", alignItems: "center", gap: 12 }}>
                {/* Preview: imagem inline, outros como ícone */}
                {midiaPreview && midiaArquivo.type.startsWith("image/") ? (
                  <img src={midiaPreview} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                ) : midiaPreview && midiaArquivo.type.startsWith("video/") ? (
                  <video src={midiaPreview} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} muted />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#e0e7ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                    {midiaArquivo.type.startsWith("audio/") ? "🎵" : "📄"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{midiaArquivo.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{(midiaArquivo.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button type="button" onClick={limparMidia}
                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                  ✕ Remover
                </button>
              </div>
            )}
            <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Imagem: máx 5MB · Vídeo/Áudio: máx 16MB · Documento: máx 100MB</p>
          </div>

          {/* 👥 EQUIPE */}
          {equipes.length > 0 && (
            <div>
              <label style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>👥 Equipe</label>
              <select value={form.equipeId} onChange={e => setForm({ ...form, equipeId: e.target.value })} style={IS}>
                <option value="">⚪ Geral (todas as equipes)</option>
                {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Deixe "Geral" pra valer pra todas as equipes, ou escolha uma equipe específica.</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            <button onClick={() => { setShowForm(false); setForm({ atalho: "", mensagem: "", equipeId: "" }); limparMidia(); }}
              style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando || uploadandoMidia}
              style={{
                background: (salvando || uploadandoMidia) ? "#2563eb" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 12, cursor: "pointer", fontWeight: 700,
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}>
              {uploadandoMidia ? "⏳ Enviando mídia..." : salvando ? "⏳ Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LISTA ═══ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {carregando ? (
          <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 13 }}>⏳ Carregando...</p>
          </div>
        ) : respostasFiltradas.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, margin: "0 auto 16px",
              boxShadow: "0 12px 24px rgba(245,158,11,0.25)",
            }}>
              <span style={{ filter: "saturate(0) brightness(2)" }}>⚡</span>
            </div>
            <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
              {filtroEquipe !== "todas" ? "Nenhuma resposta nessa equipe" : "Nenhuma resposta rápida cadastrada ainda"}
            </h3>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Clique em <b>+ Nova Resposta</b> pra criar a primeira</p>
          </div>
        ) : respostasFiltradas.map((r, i) => (
          <div key={r.id || i}
            style={{
              ...cardStyle,
              padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 16,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <span style={{
              background: "#3b82f615",
              color: "#3b82f6",
              border: "1px solid #3b82f630",
              fontSize: 12, padding: "5px 12px",
              borderRadius: 8, fontWeight: 700,
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}>
              {r.atalho}
            </span>
            <p style={{ color: "#4b5563", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
            {/* 🆕 preview de mídia anexada */}
            {r.midia_url && (
              <a href={r.midia_url} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}
                title={r.midia_nome || "Mídia anexada"}>
                {r.midia_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
                  <img src={r.midia_url} alt={r.midia_nome || "imagem"} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                ) : r.midia_url.match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                  <span style={{ fontSize: 24 }} title={r.midia_nome || "vídeo"}>🎬</span>
                ) : r.midia_url.match(/\.(mp3|ogg|wav|m4a|oga)(\?|$)/i) ? (
                  <span style={{ fontSize: 24 }} title={r.midia_nome || "áudio"}>🎵</span>
                ) : (
                  <span style={{ fontSize: 24 }} title={r.midia_nome || "documento"}>📄</span>
                )}
                <span style={{ fontSize: 10, color: "#6b7280", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {r.midia_nome || "mídia"}
                </span>
              </a>
            )}
            {equipeNomeDe(r.equipe_id) && (
              <span style={{ background: "#a855f715", color: "#a855f7", border: "1px solid #a855f730", fontSize: 11, padding: "4px 10px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>👥 {equipeNomeDe(r.equipe_id)}</span>
            )}
            <button onClick={() => remover(r)}
              style={{
                background: "#fef2f2", color: "#dc2626",
                border: "1px solid #fecaca", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fef2f2"}>
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}