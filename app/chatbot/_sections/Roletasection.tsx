"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Usuario = { nome: string; email: string; perfil: string; fila: string; };

type RoletaConfig = {
  id?: number;
  workspace_id: string;
  ativa: boolean;
  tipo: "balanceada" | "ranqueada" | "aleatoria";
  usuarios: string[];  // array de emails
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

export default function RoletaSection() {
  const { wsId } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [config, setConfig] = useState<RoletaConfig>(CONFIG_PADRAO);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Permissão pra gerenciar roleta — dono, admin ou supervisor com flag
  const podeGerenciar = isDono || permissoes.roleta_gerenciar;

  const fetchTudo = async () => {
    if (!wsId) return;
    setLoading(true);

    // Busca usuários do workspace (atendentes, supervisores, admins)
    const { data: users } = await supabase.from("usuarios_workspace").select("*").eq("workspace_id", wsId);
    setUsuarios(users || []);

    // Busca config da roleta
    const { data: cfg } = await supabase.from("roleta_config").select("*").eq("workspace_id", wsId).maybeSingle();
    if (cfg) {
      setConfig({
        ...CONFIG_PADRAO,
        ...cfg,
        usuarios: Array.isArray(cfg.usuarios) ? cfg.usuarios : [],
      });
    } else {
      // Primeira vez — cria config padrão
      setConfig({ ...CONFIG_PADRAO, workspace_id: wsId });
    }
    setLoading(false);
  };

  useEffect(() => { fetchTudo(); }, [wsId]);

  const salvar = async () => {
    if (!wsId) return;
    setSalvando(true);
    try {
      // Upsert: atualiza se existir, cria se não
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
      alert("✅ Configuração da roleta salva!");
    } catch (e: any) {
      alert("❌ Erro: " + e.message);
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
    alert("✅ Contador resetado!");
    fetchTudo();
  };

  if (!podeGerenciar) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <h2 style={{ color: "white", fontSize: 18 }}>🔒 Sem permissão</h2>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Apenas dono ou usuários com permissão "Gerenciar roleta de distribuição" podem acessar.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#9ca3af" }}>Carregando...</p></div>;
  }

  const usuariosSelecionados = usuarios.filter(u => config.usuarios.includes(u.email));

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🎯 Roleta de Distribuição</h1>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
          Distribui novos leads automaticamente entre os atendentes. Um supervisor não precisa ficar dizendo "fulano pega esse lead aí".
        </p>
      </div>

      {/* CARD DE ATIVAÇÃO */}
      <div style={{ background: config.ativa ? "#16a34a11" : "#1f2937", border: `1px solid ${config.ativa ? "#16a34a55" : "#374151"}`, borderRadius: 12, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>
            {config.ativa ? "🟢 Roleta ATIVA" : "⚫ Roleta desativada"}
          </p>
          <p style={{ color: "#9ca3af", fontSize: 12, margin: "4px 0 0" }}>
            {config.ativa
              ? `Cada novo lead será atribuído automaticamente a um dos ${config.usuarios.length} atendente(s) selecionado(s)`
              : "Leads entrantes ficam pendentes até que alguém os pegue manualmente"}
          </p>
        </div>
        <button onClick={() => setConfig(c => ({ ...c, ativa: !c.ativa }))}
          style={{ width: 56, height: 30, background: config.ativa ? "#16a34a" : "#374151", borderRadius: 15, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 24, height: 24, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: config.ativa ? 29 : 3, transition: "left 0.2s" }} />
        </button>
      </div>

      {/* TIPO DE DISTRIBUIÇÃO */}
      <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: "0 0 16px" }}>🎲 Lógica de distribuição</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { key: "balanceada", titulo: "⚖️ Balanceada", desc: "Vai na ordem da lista, um por um (round-robin). Ex: Ana, João, Maria, Ana, João, Maria..." },
            { key: "ranqueada", titulo: "📊 Ranqueada", desc: "Manda pro atendente com MENOS conversas ativas. Quem tá mais livre recebe." },
            { key: "aleatoria", titulo: "🎲 Aleatória", desc: "Sorteia um atendente aleatório a cada novo lead." },
          ].map(opt => (
            <button key={opt.key} onClick={() => setConfig(c => ({ ...c, tipo: opt.key as any }))}
              style={{ background: config.tipo === opt.key ? "#16a34a22" : "#1f2937", border: `2px solid ${config.tipo === opt.key ? "#16a34a" : "#374151"}`, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left" }}>
              <p style={{ color: config.tipo === opt.key ? "#16a34a" : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 6px" }}>
                {opt.titulo}
              </p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, lineHeight: 1.4 }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* SELEÇÃO DE USUÁRIOS */}
      <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: "0 0 6px" }}>👥 Atendentes na roleta</h3>
        <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 14px" }}>
          Selecione quem participa da distribuição automática. Usuários offline ainda recebem leads — cabe ao gestor ajustar a lista conforme a escala.
        </p>

        {usuarios.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", background: "#1f2937", borderRadius: 8 }}>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Nenhum atendente cadastrado neste workspace.</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>Vá em CRM → Configurações → Usuários e adicione os atendentes primeiro.</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDropdown(!showDropdown)}
              style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
              <span style={{ color: config.usuarios.length > 0 ? "white" : "#6b7280" }}>
                {config.usuarios.length > 0 ? `✓ ${config.usuarios.length} atendente(s) na roleta` : "Clique pra selecionar atendentes..."}
              </span>
              <span style={{ color: "#6b7280" }}>{showDropdown ? "▲" : "▼"}</span>
            </button>
            {showDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, zIndex: 100, marginTop: 4, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                {usuarios.map(u => (
                  <label key={u.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #374151", background: config.usuarios.includes(u.email) ? "#16a34a11" : "transparent" }}>
                    <input type="checkbox" checked={config.usuarios.includes(u.email)} onChange={() => toggleUsuario(u.email)} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: "bold" }}>{u.nome}</p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>
                        {u.email} • {u.perfil}{u.fila ? ` • Fila: ${u.fila}` : ""}
                      </p>
                    </div>
                  </label>
                ))}
                <div style={{ padding: 10, display: "flex", gap: 6, background: "#0d0d0d" }}>
                  <button onClick={() => setConfig(c => ({ ...c, usuarios: usuarios.map(u => u.email) }))}
                    style={{ flex: 1, background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a44", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                    Selecionar todos
                  </button>
                  <button onClick={() => setConfig(c => ({ ...c, usuarios: [] }))}
                    style={{ flex: 1, background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                    Desmarcar todos
                  </button>
                  <button onClick={() => setShowDropdown(false)}
                    style={{ flex: 1, background: "#1f2937", color: "white", border: "1px solid #374151", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
            {usuariosSelecionados.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {usuariosSelecionados.map(u => (
                  <span key={u.email} style={{ background: "#16a34a22", color: "#16a34a", fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid #16a34a33", display: "flex", alignItems: "center", gap: 6 }}>
                    ✓ {u.nome}
                    <button onClick={() => toggleUsuario(u.email)} style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", padding: 0, fontSize: 12 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTROS AVANÇADOS */}
      <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: "0 0 16px" }}>⚙️ Filtros avançados</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#1f2937", borderRadius: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={config.respeitar_fila} onChange={e => setConfig(c => ({ ...c, respeitar_fila: e.target.checked }))} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>Respeitar fila do lead</p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>
                Se ativado, só distribui o lead pros atendentes que estão na MESMA fila dele (ex: lead de Vendas só vai pra atendente de Vendas).
              </p>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#1f2937", borderRadius: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={config.apenas_horario_comercial} onChange={e => setConfig(c => ({ ...c, apenas_horario_comercial: e.target.checked }))} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>Distribuir apenas em horário comercial</p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>
                Fora do horário, leads ficam pendentes pra serem pegos manualmente depois.
              </p>
            </div>
          </label>

          {config.apenas_horario_comercial && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginLeft: 36 }}>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Início</label>
                <input type="time" value={config.horario_inicio} onChange={e => setConfig(c => ({ ...c, horario_inicio: e.target.value }))}
                  style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Fim</label>
                <input type="time" value={config.horario_fim} onChange={e => setConfig(c => ({ ...c, horario_fim: e.target.value }))}
                  style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS E CONTADOR */}
      {config.tipo === "balanceada" && config.usuarios.length > 0 && (
        <div style={{ background: "#3b82f611", border: "1px solid #3b82f633", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#3b82f6", fontSize: 12, margin: 0, fontWeight: "bold" }}>
              📍 Próximo atendente: {
                usuarios.find(u => u.email === config.usuarios[config.proximo_index % config.usuarios.length])?.nome || "—"
              }
            </p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>
              Índice atual: {config.proximo_index} (posição {config.proximo_index % config.usuarios.length + 1} de {config.usuarios.length})
            </p>
          </div>
          <button onClick={resetarContador}
            style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
            🔄 Resetar
          </button>
        </div>
      )}

      {/* BOTÃO SALVAR */}
      <button onClick={salvar} disabled={salvando}
        style={{ background: salvando ? "#047857" : "#16a34a", color: "white", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, cursor: salvando ? "not-allowed" : "pointer", fontWeight: "bold", alignSelf: "flex-end", minWidth: 220 }}>
        {salvando ? "⏳ Salvando..." : "💾 Salvar configurações"}
      </button>
    </div>
  );
}