"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

import Icone, { IconeEmoji } from "../../components/a2/Icone";
type Etiqueta = {
  id: number;
  nome: string;
  cor: string;
  icone: string;
  workspace_id: string;
  equipe_id?: string | null; // 👥 equipe dona da etiqueta (NULL = geral, vale pra todas)
  created_at?: string;
};
// 👥 Equipe (time/empresa dentro do workspace)
type Equipe = { id: string; nome: string; };

// Paleta de cores pré-definidas
const CORES_PADRAO = [
  "#dc2626", "#ef4444", "#f97316", "#C2410C",
  "#eab308", "#84cc16", "#059669", "#10b981",
  "#06b6d4", "#14B8A6", "#059669", "#0F766E",
  "#a855f7", "#BE185D", "#f43f5e", "#64748B",
];

// Emojis mais comuns pra etiquetas
const EMOJIS_COMUNS = [
  "🏷️", "🔥", "⭐", "💰", "🎯", "📞", "✅", "❌",
  "⚠️", "🆕", "🔔", "💎", "🚀", "📌", "🔴", "🟢",
  "🟡", "🔵", "🟣", "⚡", "💼", "🎁", "🏆", "❤️",
];

export function EtiquetasSection() {
  const { wsId, wsPronto } = useWorkspace();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  // 👥 equipes do workspace + filtro de equipe da lista
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todas");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Etiqueta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState({ nome: "", cor: "#14B8A6", icone: "🏷️", equipeId: "" });

  const IS = { width: "100%", background: "#ffffff", border: "1px solid #E6ECEA", borderRadius: 10, padding: "10px 14px", color: "#0F172A", fontSize: 14, boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" };

  const cardStyle = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

  // ═══ Carrega etiquetas ═══
  const fetchEtiquetas = async (ws: string) => {
    setLoading(true);
    const { data } = await supabase.from("etiquetas")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: true });
    setEtiquetas(data || []);
    setLoading(false);
  };

  // 👥 Carrega equipes ativas do workspace
  const fetchEquipes = async (ws: string) => {
    try {
      const { data } = await supabase.from("equipes").select("id, nome").eq("workspace_id", ws).eq("ativo", true).order("nome", { ascending: true });
      setEquipes((data as Equipe[]) || []);
    } catch (e) { console.error("Erro ao buscar equipes:", e); setEquipes([]); }
  };

  useEffect(() => {
    if (!wsPronto || !wsId) return;
    fetchEtiquetas(wsId);
    fetchEquipes(wsId);
    const ch = supabase.channel("etiquetas_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "etiquetas", filter: `workspace_id=eq.${wsId}` }, () => fetchEtiquetas(wsId))
      .on("postgres_changes", { event: "*", schema: "public", table: "equipes", filter: `workspace_id=eq.${wsId}` }, () => fetchEquipes(wsId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, wsPronto]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", cor: "#14B8A6", icone: "🏷️", equipeId: filtroEquipe !== "todas" ? filtroEquipe : "" });
    setShowForm(true);
  };

  const abrirEditar = (e: Etiqueta) => {
    setEditando(e);
    setForm({ nome: e.nome, cor: e.cor, icone: e.icone || "🏷️", equipeId: e.equipe_id || "" });
    setShowForm(true);
  };

  const cancelar = () => {
    setShowForm(false);
    setEditando(null);
    setForm({ nome: "", cor: "#14B8A6", icone: "🏷️", equipeId: "" });
  };

  const salvar = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.etiquetas) {
      alert("Você não tem permissão para gerenciar etiquetas.");
      return;
    }
    if (!form.nome.trim()) { alert("Digite o nome da etiqueta!"); return; }
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    setSalvando(true);
    try {
      let etiquetaId: number | null = editando ? editando.id : null;
      if (editando) {
        const { error } = await supabase.from("etiquetas")
          .update({ nome: form.nome.trim(), cor: form.cor, icone: form.icone })
          .eq("id", editando.id)
          .eq("workspace_id", wsId);
        if (error) { alert("Erro ao atualizar: " + error.message); setSalvando(false); return; }
      } else {
        const { data, error } = await supabase.from("etiquetas").insert([{
          nome: form.nome.trim(),
          cor: form.cor,
          icone: form.icone,
          workspace_id: wsId,
        }]).select("id").single();
        if (error) { alert("Erro ao criar: " + error.message); setSalvando(false); return; }
        etiquetaId = data?.id ?? null;
      }
      // 👥 best-effort: grava a equipe (requer coluna etiquetas.equipe_id — ver migration).
      // Se a coluna ainda não existe, ignora o erro pra não quebrar o fluxo principal.
      if (etiquetaId) {
        const { error: eqErr } = await supabase.from("etiquetas")
          .update({ equipe_id: form.equipeId || null })
          .eq("id", etiquetaId)
          .eq("workspace_id", wsId);
        if (eqErr) console.warn("[Etiquetas] equipe_id não gravado (rode migration-equipes-etiquetas-respostas.sql):", eqErr.message);
      }
      await fetchEtiquetas(wsId);
      cancelar();
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };

  const excluir = async (e: Etiqueta) => {
    if (!isDono && !isSuperAdmin && !permissoes.etiquetas) {
      alert("Você não tem permissão para excluir etiquetas.");
      return;
    }
    if (!confirm(`Excluir a etiqueta "${e.nome}"?\n\nEla será removida de todos os atendimentos que a usavam.`)) return;
    if (!wsId) { alert("Workspace não carregado. Recarregue a página."); return; }
    try {
      if (e.workspace_id && e.workspace_id !== wsId) {
        alert("Erro: etiqueta não pertence a este workspace.");
        return;
      }
      await supabase.from("atendimento_etiquetas").delete().eq("etiqueta_id", e.id);
      const { error } = await supabase.from("etiquetas").delete()
        .eq("id", e.id)
        .eq("workspace_id", wsId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchEtiquetas(wsId);
    } catch (err: any) { alert("Erro: " + err.message); }
  };

  // 👥 nome da equipe a partir do id
  const equipeNomeDe = (equipeId?: string | null): string => {
    if (!equipeId) return "";
    return equipes.find(e => e.id === equipeId)?.nome || "";
  };

  const etiquetasFiltradas = etiquetas.filter(e =>
    (!busca || e.nome.toLowerCase().includes(busca.toLowerCase())) &&
    (filtroEquipe === "todas" || (e.equipe_id || "") === filtroEquipe)
  );

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#F3F6F5", minHeight: "100vh" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={"🏷️"} tamanho={22} /></div>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Etiquetas</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>{etiquetas.length} etiqueta(s) cadastrada(s)</p>
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            color: "white", border: "none", borderRadius: 12,
            padding: "12px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
            boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
          }}>
          + Nova Etiqueta
        </button>
      </div>

      {/* ═══ BUSCA + FILTRO DE EQUIPE ═══ */}
      {(etiquetas.length > 5 || equipes.length > 0) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {etiquetas.length > 5 && (
            <input placeholder="Buscar etiqueta..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...IS, maxWidth: 360, padding: "10px 16px", fontSize: 13, borderRadius: 20 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#14B8A680"; e.currentTarget.style.boxShadow = "0 0 0 3px #14B8A620"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E6ECEA"; e.currentTarget.style.boxShadow = "none"; }}
            />
          )}
          {/* 👥 Filtro de equipe */}
          {equipes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#059669", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Equipe</span>
              <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} style={{ ...IS, width: "auto", minWidth: 180, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                <option value="todas">Todas as equipes</option>
                <option value="">Geral (sem equipe)</option>
                {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ═══ FORM NOVA/EDITAR ═══ */}
      {showForm && (
        <div style={{ ...cardStyle, padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: 0 }}>
              {editando ? "Editar Etiqueta" : "Nova Etiqueta"}
            </h2>
            <button onClick={cancelar} style={{ background: "#F3F6F5", border: "none", color: "#64748B", fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center", cursor: "pointer", width: 30, height: 30, borderRadius: 8 }}><Icone nome="x" tamanho={16} /></button>
          </div>

          {/* PRÉVIA DA ETIQUETA */}
          <div style={{ background: "#F7FAF9", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #CBD5E1" }}>
            <div style={{ background: form.cor + "15", border: `2px solid ${form.cor}`, borderRadius: 20, padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{<IconeEmoji e={form.icone} />}</span>
              <span style={{ color: form.cor, fontSize: 13, fontWeight: 700 }}>{form.nome || "Prévia da etiqueta"}</span>
            </div>
          </div>

          {/* NOME */}
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Nome *</label>
            <input placeholder="Ex: Lead Quente" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              style={IS} maxLength={40} />
          </div>

          {/* 👥 EQUIPE */}
          {equipes.length > 0 && (
            <div>
              <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Equipe</label>
              <select value={form.equipeId} onChange={e => setForm({ ...form, equipeId: e.target.value })} style={IS}>
                <option value="">Geral (todas as equipes)</option>
                {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
              <p style={{ color: "#94A3B8", fontSize: 10, margin: "4px 0 0", lineHeight: 1.4 }}>Deixe "Geral" pra a etiqueta valer pra todas as equipes, ou escolha uma equipe específica.</p>
            </div>
          )}

          {/* ÍCONE (EMOJI) */}
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Ícone (emoji)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input value={form.icone} onChange={e => setForm({ ...form, icone: e.target.value })}
                style={{ ...IS, width: 60, textAlign: "center", fontSize: 20 }} maxLength={2} />
              <span style={{ color: "#94A3B8", fontSize: 11 }}>Digite um emoji ou escolha abaixo</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
              {EMOJIS_COMUNS.map(emoji => (
                <button key={emoji} onClick={() => setForm({ ...form, icone: emoji })}
                  style={{
                    background: form.icone === emoji ? "#14B8A615" : "#F7FAF9",
                    border: `1px solid ${form.icone === emoji ? "#059669" : "#E6ECEA"}`,
                    borderRadius: 8, padding: "6px 0", fontSize: 16, cursor: "pointer",
                    transition: "all 0.1s",
                  }}>
                  {<IconeEmoji e={emoji} />}
                </button>
              ))}
            </div>
          </div>

          {/* COR */}
          <div>
            <label style={{ color: "#475569", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 10 }}>
              {CORES_PADRAO.map(cor => (
                <button key={cor} onClick={() => setForm({ ...form, cor })}
                  style={{
                    background: cor,
                    border: form.cor === cor ? "3px solid #0F172A" : "2px solid #E6ECEA",
                    borderRadius: 8, height: 34, cursor: "pointer",
                    boxShadow: form.cor === cor ? `0 0 0 2px white, 0 0 0 4px ${cor}` : "0 1px 2px rgba(0,0,0,0.1)",
                    transition: "all 0.15s",
                  }}
                  title={cor} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid #E6ECEA", cursor: "pointer", background: "#ffffff" }} />
              <input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                style={{ ...IS, maxWidth: 120, fontFamily: "monospace", padding: "6px 10px", fontSize: 12 }} maxLength={7} />
              <span style={{ color: "#94A3B8", fontSize: 10 }}>Código hex ou picker</span>
            </div>
          </div>

          {/* BOTÕES */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
            <button onClick={cancelar} style={{ background: "#ffffff", color: "#64748B", border: "1px solid #E6ECEA", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{
                background: salvando ? "#047857" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
              }}>
              {salvando ? "Salvando..." : editando ? "Atualizar" : "Criar Etiqueta"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LISTA ═══ */}
      {loading ? (
        <p style={{ color: "#64748B", fontSize: 13 }}>Carregando...</p>
      ) : etiquetasFiltradas.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 auto 16px" }}><IconeEmoji e={"🏷️"} tamanho={28} /></div>
          <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>
            {busca || filtroEquipe !== "todas" ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada ainda"}
          </h3>
          <p style={{ color: "#64748B", fontSize: 13, margin: "0 0 16px" }}>
            {busca || filtroEquipe !== "todas" ? "Tente outro termo ou equipe" : "Crie etiquetas pra organizar seus atendimentos"}
          </p>
          {!busca && filtroEquipe === "todas" && (
            <button onClick={abrirNovo} style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "12px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700,
              boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
            }}>
              + Nova Etiqueta
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {etiquetasFiltradas.map(e => (
            <div key={e.id}
              style={{
                ...cardStyle,
                padding: "14px 18px",
                borderLeft: `4px solid ${e.cor}`,
                display: "flex", alignItems: "center", gap: 12, minWidth: 240,
                transition: "all 0.15s",
              }}
              onMouseEnter={(ev) => { ev.currentTarget.style.boxShadow = `0 4px 12px ${e.cor}20`; ev.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; ev.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{
                background: e.cor + "15", borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {e.icone || "🏷️"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, display: "block" }}>{e.nome}</span>
                {equipeNomeDe(e.equipe_id) && (
                  <span style={{ display: "inline-block", marginTop: 3, background: "#a855f715", color: "#059669", fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{equipeNomeDe(e.equipe_id)}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => abrirEditar(e)} title="Editar"
                  style={{
                    background: "#14B8A610", color: "#059669",
                    border: "1px solid #14B8A630", borderRadius: 8,
                    padding: "5px 9px", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#14B8A620"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "#14B8A610"}
                ><Icone nome="editar" tamanho={15} /></button>
                <button onClick={() => excluir(e)} title="Excluir"
                  style={{
                    background: "#FEF2F2", color: "#B91C1C",
                    border: "none", borderRadius: 8,
                    padding: "5px 9px", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#fee2e2"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "#fef2f2"}
                ><Icone nome="lixeira" tamanho={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}