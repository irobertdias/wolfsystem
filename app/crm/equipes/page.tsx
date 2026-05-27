"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

// ═══════════════════════════════════════════════════════════════════
// 👥 PÁGINA DE EQUIPES — CRUD + atribuição de vendedores
// ═══════════════════════════════════════════════════════════════════

type Equipe = {
  id: string;
  workspace_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
};

type EquipeEnriquecida = Equipe & {
  qtdUsuarios: number;
  qtdPropostas: number;
};

type UsuarioWs = {
  email: string;
  nome: string;
  equipe_id: string | null;
};

export default function EquipesPage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { isDono, perfil, isSuperAdmin } = usePermissao();
  const podeEditar = isDono || isSuperAdmin || perfil === "Administrador";

  const [equipes, setEquipes] = useState<EquipeEnriquecida[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioWs[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Modal nova/editar equipe
  const [modalAberto, setModalAberto] = useState(false);
  const [equipeEditando, setEquipeEditando] = useState<EquipeEnriquecida | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });

  // Busca usuário
  const [buscaUsuario, setBuscaUsuario] = useState("");

  // 🎨 ESTILOS LIGHT TECH (mesmo padrão das outras páginas)
  const inputStyle = {
    width: "100%", background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: 10, padding: "9px 12px", color: "#1f2937", fontSize: 13,
    boxSizing: "border-box" as const, outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const fetchTudo = async () => {
    if (!workspace?.username) return;
    setLoading(true);
    try {
      const [respEqs, respUsers, respProps] = await Promise.all([
        supabase.from("equipes")
          .select("*")
          .eq("workspace_id", workspace.username)
          .eq("ativo", true)
          .order("nome", { ascending: true }),
        supabase.from("usuarios_workspace")
          .select("email, nome, equipe_id")
          .eq("workspace_id", workspace.username),
        supabase.from("proposta")
          .select("equipe_id")
          .eq("workspace_id", workspace.username),
      ]);

      const eqs = (respEqs.data || []) as Equipe[];
      const users = (respUsers.data || []) as UsuarioWs[];
      const props = (respProps.data || []) as { equipe_id: string | null }[];

      const enriched: EquipeEnriquecida[] = eqs.map(eq => ({
        ...eq,
        qtdUsuarios: users.filter(u => u.equipe_id === eq.id).length,
        qtdPropostas: props.filter(p => p.equipe_id === eq.id).length,
      }));

      setEquipes(enriched);
      setUsuarios(users);
    } catch (e) {
      console.error("[Equipes] erro fetch:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTudo(); }, [workspace]);

  // Realtime
  useEffect(() => {
    if (!workspace?.username) return;
    const ch = supabase.channel("equipes_page_rt_" + workspace.username)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipes",
        filter: `workspace_id=eq.${workspace.username}` }, () => fetchTudo())
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace",
        filter: `workspace_id=eq.${workspace.username}` }, () => fetchTudo())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspace]);

  const abrirNova = () => {
    setEquipeEditando(null);
    setForm({ nome: "", descricao: "" });
    setModalAberto(true);
  };

  const abrirEditar = (eq: EquipeEnriquecida) => {
    setEquipeEditando(eq);
    setForm({ nome: eq.nome, descricao: eq.descricao || "" });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { alert("Nome da equipe é obrigatório."); return; }
    if (!workspace?.username) return;

    setSalvando(true);
    try {
      if (equipeEditando) {
        const { error } = await supabase.from("equipes").update({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
        }).eq("id", equipeEditando.id).eq("workspace_id", workspace.username);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipes").insert([{
          workspace_id: workspace.username,
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
        }]);
        if (error) throw error;
      }
      setModalAberto(false);
      await fetchTudo();
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  const desativar = async (eq: EquipeEnriquecida) => {
    const msg = eq.qtdUsuarios > 0 || eq.qtdPropostas > 0
      ? `Desativar a equipe "${eq.nome}"?\n\nEla tem ${eq.qtdUsuarios} vendedor(es) e ${eq.qtdPropostas} proposta(s) atrelada(s).\n\nOs dados não serão apagados — só que essa equipe deixa de aparecer nos filtros e seleção, e seus vendedores ficam "sem equipe" até serem reatribuídos.`
      : `Desativar a equipe "${eq.nome}"?`;
    if (!confirm(msg)) return;
    if (!workspace?.username) return;

    try {
      // Desassocia os usuários antes (proposta mantém equipe_id histórico)
      await supabase.from("usuarios_workspace")
        .update({ equipe_id: null })
        .eq("equipe_id", eq.id)
        .eq("workspace_id", workspace.username);
      // Marca a equipe como inativa
      const { error } = await supabase.from("equipes")
        .update({ ativo: false })
        .eq("id", eq.id)
        .eq("workspace_id", workspace.username);
      if (error) throw error;
      await fetchTudo();
    } catch (e: any) {
      alert("Erro ao desativar: " + e.message);
    }
  };

  const moverUsuario = async (email: string, equipeId: string | null) => {
    if (!workspace?.username) return;
    const { error } = await supabase.from("usuarios_workspace")
      .update({ equipe_id: equipeId })
      .eq("email", email)
      .eq("workspace_id", workspace.username);
    if (error) { alert("Erro ao mover: " + error.message); return; }
    await fetchTudo();
  };

  const usuariosFiltrados = usuarios.filter(u =>
    !buscaUsuario ||
    u.nome?.toLowerCase().includes(buscaUsuario.toLowerCase()) ||
    u.email?.toLowerCase().includes(buscaUsuario.toLowerCase())
  );

  // Mapa id → nome pra mostrar nome da equipe do usuário rapidinho
  const mapaEquipes = new Map<string, string>(equipes.map(e => [e.id, e.nome]));

  // ═══ Sem permissão ═══
  if (!podeEditar) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 12px 24px rgba(239,68,68,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>
            Só o dono ou administrador do workspace pode gerenciar equipes.
          </p>
          <button onClick={() => router.back()}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>← Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ═══ MODAL CRIAR/EDITAR EQUIPE ═══ */}
      {modalAberto && (
        <div onClick={() => setModalAberto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              ...cardStyle, width: "100%", maxWidth: 480,
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.08)",
            }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👥</div>
                <h2 style={{ color: "#1f2937", fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {equipeEditando ? "Editar Equipe" : "Nova Equipe"}
                </h2>
              </div>
              <button onClick={() => setModalAberto(false)}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5, fontWeight: 700 }}>
                  Nome da equipe <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input value={form.nome} autoFocus
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder='Ex: "Equipe Comercial", "Time Norte", "Filial Goiânia"'
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5, fontWeight: 700 }}>
                  Descrição (opcional)
                </label>
                <textarea value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Pra que serve essa equipe, quem coordena, etc."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button onClick={() => setModalAberto(false)}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{
                  background: salvando ? "#7e22ce" : "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
                }}>
                {salvando ? "⏳ Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(168,85,247,0.25)",
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>👥</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              Equipes
            </h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "3px 0 0", maxWidth: 720, lineHeight: 1.5 }}>
              Organize seus vendedores em equipes/empresas. Cada vendedor pertence a uma equipe, e as propostas dele entram automaticamente nessa equipe.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/crm/vendas")}
            style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            ← Voltar para Vendas
          </button>
          <button onClick={abrirNova}
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
            }}>
            ➕ Nova Equipe
          </button>
        </div>
      </div>

      {/* ═══ LISTA DE EQUIPES ═══ */}
      <div>
        <h2 style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
          📋 Equipes do workspace
        </h2>
        {loading ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            ⏳ Carregando...
          </div>
        ) : equipes.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, margin: "0 auto 14px",
              boxShadow: "0 12px 24px rgba(168,85,247,0.25)",
            }}>
              <span style={{ filter: "saturate(0) brightness(2)" }}>👥</span>
            </div>
            <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
              Nenhuma equipe criada ainda
            </p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 16px" }}>
              Crie sua primeira equipe pra começar a organizar os vendedores.
            </p>
            <button onClick={abrirNova}
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>➕ Criar primeira equipe</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {equipes.map(eq => (
              <div key={eq.id} style={{
                ...cardStyle, padding: 16,
                borderLeft: "3px solid #a855f7",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: 0, wordBreak: "break-word" }}>
                      {eq.nome}
                    </h3>
                    {eq.descricao && (
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", lineHeight: 1.5 }}>
                        {eq.descricao}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(eq)} title="Editar"
                      style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                    <button onClick={() => desativar(eq)} title="Desativar equipe"
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <p style={{ color: "#9ca3af", fontSize: 9, margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Vendedores</p>
                    <p style={{ color: "#1f2937", fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>{eq.qtdUsuarios}</p>
                  </div>
                  <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <p style={{ color: "#15803d", fontSize: 9, margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Propostas</p>
                    <p style={{ color: "#16a34a", fontSize: 18, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>{eq.qtdPropostas}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ ATRIBUIÇÃO DE USUÁRIOS ═══ */}
      <div>
        <h2 style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
          🎯 Atribuir vendedores às equipes
        </h2>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
            <input value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)}
              placeholder="🔍 Buscar vendedor por nome ou e-mail..."
              style={{ ...inputStyle, borderRadius: 20 }} />
          </div>
          {usuarios.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
              Nenhum vendedor cadastrado ainda neste workspace.
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {usuariosFiltrados.map(u => (
                <div key={u.email}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderTop: "1px solid #f3f4f6", gap: 12, flexWrap: "wrap",
                  }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ color: "#1f2937", fontSize: 13, margin: 0, fontWeight: 700 }}>{u.nome || "(sem nome)"}</p>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0", fontFamily: "monospace" }}>{u.email}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {u.equipe_id ? (
                      <span style={{
                        background: "#f3e8ff", color: "#a855f7", border: "1px solid #ddd6fe",
                        padding: "3px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                      }}>👥 {mapaEquipes.get(u.equipe_id) || "—"}</span>
                    ) : (
                      <span style={{
                        background: "#f9fafb", color: "#9ca3af", border: "1px solid #e5e7eb",
                        padding: "3px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                      }}>Sem equipe</span>
                    )}
                    <select
                      value={u.equipe_id || ""}
                      onChange={e => moverUsuario(u.email, e.target.value || null)}
                      style={{ ...inputStyle, minWidth: 180, padding: "6px 10px", fontSize: 12 }}>
                      <option value="">Sem equipe</option>
                      {equipes.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {usuariosFiltrados.length === 0 && (
                <div style={{ padding: 28, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                  Nenhum vendedor encontrado pra "{buscaUsuario}".
                </div>
              )}
            </div>
          )}
        </div>
        <p style={{ color: "#9ca3af", fontSize: 11, margin: "10px 0 0", fontStyle: "italic" }}>
          💡 Quando um vendedor muda de equipe, as próximas propostas dele já entram na equipe nova. As propostas antigas mantêm a equipe original (histórico preservado).
        </p>
      </div>
    </div>
  );
}