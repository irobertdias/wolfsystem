"use client";
import { IconeEmoji } from "../../components/a2/Icone";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Usuario = { nome: string; email: string; perfil: string; fila: string; equipe_id?: string | null; };
// 👥 Equipe (time/empresa dentro do workspace)
type Equipe = { id: string; nome: string; };

type RoletaConfig = {
  id?: number;
  workspace_id: string;
  ativa: boolean;
  tipo: "balanceada" | "ranqueada" | "aleatoria";
  usuarios: string[];
  proximo_index: number;
  respeitar_fila: boolean;
  apenas_horario_comercial: boolean;
  horario_inicio: string;
  horario_fim: string;
};

const CONFIG_PADRAO: RoletaConfig = {
  workspace_id: "",
  ativa: false,
  tipo: "balanceada",
  usuarios: [],
  proximo_index: 0,
  respeitar_fila: false,
  apenas_horario_comercial: false,
  horario_inicio: "09:00",
  horario_fim: "18:00",
};

export function RoletaSection() {
  const { wsId } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [config, setConfig] = useState<RoletaConfig>(CONFIG_PADRAO);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  // 👥 equipes do workspace + filtro de equipe pra selecionar atendentes
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [filtroEquipeUsuarios, setFiltroEquipeUsuarios] = useState<string>("todas");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const podeGerenciar = isDono || permissoes.roleta_gerenciar;

  const cardStyle = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

  const inputStyle = {
    width: "100%",
    background: "#F7FAF9",
    border: "1px solid #E6ECEA",
    borderRadius: 12,
    padding: "11px 14px",
    color: "#0F172A",
    fontSize: 14, fontWeight: 600,
    boxSizing: "border-box" as const,
    outline: "none",
  };

  const fetchTudo = async () => {
    if (!wsId) return;
    setLoading(true);

    const { data: users } = await supabase.from("usuarios_workspace").select("*").eq("workspace_id", wsId);
    setUsuarios(users || []);

    // 👥 equipes ativas do workspace
    const { data: eqs } = await supabase.from("equipes").select("id, nome").eq("workspace_id", wsId).eq("ativo", true).order("nome", { ascending: true });
    setEquipes((eqs as Equipe[]) || []);

    const { data: cfg } = await supabase.from("roleta_config").select("*").eq("workspace_id", wsId).maybeSingle();
    if (cfg) {
      setConfig({
        ...CONFIG_PADRAO,
        ...cfg,
        usuarios: Array.isArray(cfg.usuarios) ? cfg.usuarios : [],
      });
    } else {
      setConfig({ ...CONFIG_PADRAO, workspace_id: wsId });
    }
    setLoading(false);
  };

  useEffect(() => { fetchTudo(); }, [wsId]);

  const salvar = async () => {
    if (!wsId) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("roleta_config").upsert(
        {
          workspace_id: wsId,
          ativa: config.ativa,
          tipo: config.tipo,
          usuarios: config.usuarios,
          respeitar_fila: config.respeitar_fila,
          apenas_horario_comercial: config.apenas_horario_comercial,
          horario_inicio: config.horario_inicio,
          horario_fim: config.horario_fim,
          // proximo_index NÃO mexe aqui (controlado pelo backend pra não bugar o round-robin)
        },
        { onConflict: "workspace_id" }
      );
      if (error) throw error;
      alert("Configuração da roleta salva!");
    } catch (e: any) {
      alert("Erro: " + e.message);
    }
    setSalvando(false);
  };

  const toggleUsuario = (email: string) => {
    setConfig(c => ({
      ...c,
      usuarios: c.usuarios.includes(email) ? c.usuarios.filter(e => e !== email) : [...c.usuarios, email],
    }));
  };

  const resetarContador = async () => {
    if (!wsId) return;
    if (!confirm("Resetar o contador da roleta? O próximo lead irá pro primeiro atendente da lista.")) return;
    await supabase.from("roleta_config").update({ proximo_index: 0 }).eq("workspace_id", wsId);
    alert("Contador resetado!");
    fetchTudo();
  };

  // 👥 nome da equipe a partir do id
  const equipeNomeDe = (equipeId?: string | null): string => {
    if (!equipeId) return "";
    return equipes.find(e => e.id === equipeId)?.nome || "";
  };

  // 👥 atendentes visíveis na lista da roleta — filtrados pela equipe escolhida (todas = sem filtro)
  const usuariosVisiveis = usuarios.filter(u => filtroEquipeUsuarios === "todas" || (u.equipe_id || "") === filtroEquipeUsuarios);

  if (!podeGerenciar) {
    return (
      <div style={{ padding: 32, background: "#F3F6F5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, background: "#FEF2F2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 auto 16px" }}><IconeEmoji e={"🔒"} tamanho={28} /></div>
          <h2 style={{ color: "#0F172A", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Sem permissão</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0, lineHeight: 1.5 }}>Apenas dono ou usuários com permissão "Gerenciar roleta de distribuição" podem acessar.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#F3F6F5", minHeight: "100vh" }}>
        <p style={{ color: "#64748B" }}>Carregando...</p>
      </div>
    );
  }

  const usuariosSelecionados = usuarios.filter(u => config.usuarios.includes(u.email));

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, height: "100vh", overflowY: "auto", boxSizing: "border-box", background: "#F3F6F5" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeEmoji e={"🎯"} tamanho={22} /></div>
        <div>
          <h1 style={{ color: "#0F172A", fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Roleta de Distribuição</h1>
          <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0", maxWidth: 720, lineHeight: 1.5 }}>
            Distribui novos leads automaticamente entre os atendentes. Um supervisor não precisa ficar dizendo "fulano pega esse lead aí".
          </p>
        </div>
      </div>

      {/* ═══ CARD DE ATIVAÇÃO ═══ */}
      <div style={{
        ...cardStyle,
        background: config.ativa ? "#ECFDF5" : "#ffffff",
        border: `1px solid ${config.ativa ? "#A7F3D0" : "#E6ECEA"}`,
        borderLeft: `4px solid ${config.ativa ? "#059669" : "#CBD5E1"}`,
        padding: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: config.ativa ? "#16a34a15" : "#F1F5F4",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            border: `1px solid ${config.ativa ? "#16a34a40" : "#E6ECEA"}`,
          }}>
            {config.ativa ? "🟢" : "⚫"}
          </div>
          <div>
            <p style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: 0 }}>
              {config.ativa ? "Roleta ATIVA" : "Roleta desativada"}
            </p>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              {config.ativa
                ? `Cada novo lead será atribuído automaticamente a um dos ${config.usuarios.length} atendente(s) selecionado(s)`
                : "Leads entrantes ficam pendentes até que alguém os pegue manualmente"}
            </p>
          </div>
        </div>
        <button onClick={() => setConfig(c => ({ ...c, ativa: !c.ativa }))}
          style={{ width: 56, height: 30, background: config.ativa ? "#059669" : "#CBD5E1", borderRadius: 15, cursor: "pointer", border: "none", position: "relative", flexShrink: 0, transition: "background 0.2s", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ width: 24, height: 24, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: config.ativa ? 29 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </button>
      </div>

      {/* ═══ TIPO DE DISTRIBUIÇÃO ═══ */}
      <div style={{ ...cardStyle, padding: 22 }}>
        <h3 style={{ color: "#0F172A", fontSize: 14, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: "#0F766E15", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎲</span>
          Lógica de distribuição
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {[
            { key: "balanceada", titulo: "Balanceada", desc: "Vai na ordem da lista, um por um (round-robin). Ex: Ana, João, Maria, Ana, João, Maria...", cor: "#14B8A6" },
            { key: "ranqueada", titulo: "Ranqueada", desc: "Manda pro atendente com MENOS conversas ativas. Quem tá mais livre recebe.", cor: "#059669" },
            { key: "aleatoria", titulo: "Aleatória", desc: "Sorteia um atendente aleatório a cada novo lead.", cor: "#C2410C" },
          ].map(opt => {
            const ativo = config.tipo === opt.key;
            return (
              <button key={opt.key} onClick={() => setConfig(c => ({ ...c, tipo: opt.key as any }))}
                style={{
                  background: ativo ? `${opt.cor}10` : "#F7FAF9",
                  border: `2px solid ${ativo ? opt.cor : "#E6ECEA"}`,
                  borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s",
                  boxShadow: ativo ? `0 4px 12px ${opt.cor}20` : "none",
                }}>
                <p style={{ color: ativo ? opt.cor : "#0F172A", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
                  {opt.titulo}
                </p>
                <p style={{ color: "#64748B", fontSize: 11, margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ SELEÇÃO DE USUÁRIOS ═══ */}
      <div style={{ ...cardStyle, padding: 22 }}>
        <h3 style={{ color: "#0F172A", fontSize: 14, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: "#14B8A615", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>👥</span>
          Atendentes na roleta
        </h3>
        <p style={{ color: "#64748B", fontSize: 12, margin: "0 0 14px", paddingLeft: 40 }}>
          Selecione quem participa da distribuição automática. Usuários offline ainda recebem leads — cabe ao gestor ajustar a lista conforme a escala.
        </p>

        {usuarios.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", background: "#F7FAF9", borderRadius: 10, border: "1px dashed #CBD5E1" }}>
            <p style={{ color: "#64748B", fontSize: 13, margin: 0, fontWeight: 600 }}>Nenhum atendente cadastrado neste workspace.</p>
            <p style={{ color: "#94A3B8", fontSize: 11, margin: "4px 0 0" }}>Vá em CRM → Configurações → Usuários e adicione os atendentes primeiro.</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDropdown(!showDropdown)}
              style={{ ...inputStyle, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", background: "#F7FAF9" }}>
              <span style={{ color: config.usuarios.length > 0 ? "#0F172A" : "#94A3B8", fontWeight: config.usuarios.length > 0 ? 600 : 400 }}>
                {config.usuarios.length > 0 ? `✓ ${config.usuarios.length} atendente(s) na roleta` : "Clique pra selecionar atendentes..."}
              </span>
              <span style={{ color: "#94A3B8" }}>{showDropdown ? "▲" : "▼"}</span>
            </button>
            {showDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#ffffff", border: "1px solid #E6ECEA", borderRadius: 12, zIndex: 100, marginTop: 6, overflow: "hidden", maxHeight: 380, overflowY: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.04)" }}>
                {/* 👥 Filtro de equipe — afunila a lista de atendentes abaixo */}
                {equipes.length > 0 && (
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F4", background: "#F7FAF9", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 1 }}>
                    <span style={{ color: "#059669", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Equipe</span>
                    <select value={filtroEquipeUsuarios} onChange={e => setFiltroEquipeUsuarios(e.target.value)}
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, flex: 1, cursor: "pointer" }}>
                      <option value="todas">Todas as equipes</option>
                      {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                    </select>
                  </div>
                )}
                {usuariosVisiveis.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center" }}>
                    <p style={{ color: "#94A3B8", fontSize: 12, margin: 0 }}>Nenhum atendente nessa equipe.</p>
                  </div>
                ) : usuariosVisiveis.map(u => (
                  <label key={u.email}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                      cursor: "pointer", borderBottom: "1px solid #F1F5F4",
                      background: config.usuarios.includes(u.email) ? "#ECFDF5" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!config.usuarios.includes(u.email)) e.currentTarget.style.background = "#F7FAF9"; }}
                    onMouseLeave={(e) => { if (!config.usuarios.includes(u.email)) e.currentTarget.style.background = "transparent"; }}
                  >
                    <input type="checkbox" checked={config.usuarios.includes(u.email)} onChange={() => toggleUsuario(u.email)} style={{ accentColor: "#059669", width: 16, height: 16 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#0F172A", fontSize: 13, margin: 0, fontWeight: 600 }}>
                        {u.nome}
                        {equipeNomeDe(u.equipe_id) && <span style={{ marginLeft: 8, background: "#a855f715", color: "#059669", fontSize: 12, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{equipeNomeDe(u.equipe_id)}</span>}
                      </p>
                      <p style={{ color: "#94A3B8", fontSize: 11, margin: "2px 0 0" }}>
                        {u.email} · {u.perfil}{u.fila ? ` · Fila${u.fila.includes(",") ? "s" : ""}: ${u.fila.split(",").map(s => s.trim()).filter(Boolean).join(", ")}` : ""}
                      </p>
                    </div>
                  </label>
                ))}
                <div style={{ padding: 10, display: "flex", gap: 6, background: "#F7FAF9", borderTop: "1px solid #E6ECEA" }}>
                  <button onClick={() => setConfig(c => ({ ...c, usuarios: [...new Set([...c.usuarios, ...usuariosVisiveis.map(u => u.email)])] }))}
                    style={{ flex: 1, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                    {filtroEquipeUsuarios === "todas" ? "Selecionar todos" : "Selecionar a equipe"}
                  </button>
                  <button onClick={() => { const vis = new Set(usuariosVisiveis.map(u => u.email)); setConfig(c => ({ ...c, usuarios: c.usuarios.filter(e => !vis.has(e)) })); }}
                    style={{ flex: 1, background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                    {filtroEquipeUsuarios === "todas" ? "Desmarcar todos" : "Desmarcar a equipe"}
                  </button>
                  <button onClick={() => setShowDropdown(false)}
                    style={{ flex: 1, background: "#F3F6F5", color: "#64748B", borderRadius: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
            {usuariosSelecionados.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {usuariosSelecionados.map(u => (
                  <span key={u.email}
                    style={{
                      background: "#ECFDF5", color: "#059669",
                      fontSize: 11, padding: "5px 12px", borderRadius: 20,
                      border: "1px solid #A7F3D0",
                      display: "flex", alignItems: "center", gap: 6, fontWeight: 600,
                    }}>
                    {u.nome}
                    <button onClick={() => toggleUsuario(u.email)}
                      style={{ background: "none", border: "none", color: "#059669", cursor: "pointer", padding: 0, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ FILTROS AVANÇADOS ═══ */}
      <div style={{ ...cardStyle, padding: 22 }}>
        <h3 style={{ color: "#0F172A", fontSize: 14, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: "#C2410C15", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚙️</span>
          Filtros avançados
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            background: config.respeitar_fila ? "#ECFDF5" : "#F7FAF9",
            borderRadius: 12, cursor: "pointer",
            border: `1px solid ${config.respeitar_fila ? "#A7F3D0" : "#E6ECEA"}`,
            transition: "all 0.15s",
          }}>
            <input type="checkbox" checked={config.respeitar_fila} onChange={e => setConfig(c => ({ ...c, respeitar_fila: e.target.checked }))} style={{ accentColor: "#059669", width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, margin: 0 }}>Respeitar fila do lead</p>
              <p style={{ color: "#64748B", fontSize: 11, margin: "3px 0 0" }}>
                Se ativado, só distribui o lead pros atendentes que estão na MESMA fila dele (ex: lead de Vendas só vai pra atendente de Vendas).
              </p>
            </div>
          </label>

          <label style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            background: config.apenas_horario_comercial ? "#ECFDF5" : "#F7FAF9",
            borderRadius: 12, cursor: "pointer",
            border: `1px solid ${config.apenas_horario_comercial ? "#A7F3D0" : "#E6ECEA"}`,
            transition: "all 0.15s",
          }}>
            <input type="checkbox" checked={config.apenas_horario_comercial} onChange={e => setConfig(c => ({ ...c, apenas_horario_comercial: e.target.checked }))} style={{ accentColor: "#059669", width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, margin: 0 }}>Distribuir apenas em horário comercial</p>
              <p style={{ color: "#64748B", fontSize: 11, margin: "3px 0 0" }}>
                Fora do horário, leads ficam pendentes pra serem pegos manualmente depois.
              </p>
            </div>
          </label>

          {config.apenas_horario_comercial && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginLeft: 28, padding: 14, background: "#F7FAF9", borderRadius: 12 }}>
              <div>
                <label style={{ color: "#475569", fontSize: 12.5, display: "block", marginBottom: 6, fontWeight: 700, letterSpacing: 0.5 }}>Início</label>
                <input type="time" value={config.horario_inicio} onChange={e => setConfig(c => ({ ...c, horario_inicio: e.target.value }))}
                  style={{ ...inputStyle, colorScheme: "light" }} />
              </div>
              <div>
                <label style={{ color: "#475569", fontSize: 12.5, display: "block", marginBottom: 6, fontWeight: 700, letterSpacing: 0.5 }}>Fim</label>
                <input type="time" value={config.horario_fim} onChange={e => setConfig(c => ({ ...c, horario_fim: e.target.value }))}
                  style={{ ...inputStyle, colorScheme: "light" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STATUS E CONTADOR ═══ */}
      {config.tipo === "balanceada" && config.usuarios.length > 0 && (
        <div style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 12,
          padding: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#14B8A615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📍</div>
            <div>
              <p style={{ color: "#065F46", fontSize: 13, margin: 0, fontWeight: 700 }}>
                Próximo atendente: {usuarios.find(u => u.email === config.usuarios[config.proximo_index % config.usuarios.length])?.nome || "—"}
              </p>
              <p style={{ color: "#059669", fontSize: 11, margin: "3px 0 0" }}>
                Índice atual: {config.proximo_index} (posição {config.proximo_index % config.usuarios.length + 1} de {config.usuarios.length})
              </p>
            </div>
          </div>
          <button onClick={resetarContador}
            style={{
              background: "#FFF7ED", color: "#C2410C",
              border: "1px solid #fde68a", borderRadius: 10,
              padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#FFEDD5"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#FFF7ED"}>
            Resetar
          </button>
        </div>
      )}

      {/* ═══ BOTÃO SALVAR ═══ */}
      <button onClick={salvar} disabled={salvando}
        style={{
          background: salvando ? "#047857" : "linear-gradient(140deg, #10B981, #059669 60%, #047857)",
          color: "white", border: "none", borderRadius: 12,
          padding: "14px", fontSize: 14,
          cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
          alignSelf: "flex-end", minWidth: 240,
          boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
        }}>
        {salvando ? "⏳ Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}