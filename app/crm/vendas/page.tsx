"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";

type Proposta = {
  id: number; created_at: string; data_proposta: string; nome: string;
  cpf?: string; rg?: string; data_nascimento?: string; nome_mae?: string;
  email?: string; endereco?: string; cep?: string; cidade?: string; estado?: string;
  telefone1?: string; telefone2?: string; telefone3?: string;
  vencimento?: string; forma_pagamento?: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora: string; plano: string; workspace_id: string;
  data_agendamento?: string; periodo_instalacao?: string;
  data_instalacao?: string; data_cancelamento?: string;
};

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b", "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626", INSTALADA: "#16a34a", GERADA: "#8b5cf6", REPROVADA: "#ef4444",
};

const STATUS_OPCOES = ["PENDENTE", "AGUARDANDO AUDITORIA", "CANCELADA", "INSTALADA", "GERADA", "REPROVADA"];

export default function Vendas() {
  const router = useRouter();
  const { isDono, perfil } = usePermissao();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Modal edição
  const [showModal, setShowModal] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [form, setForm] = useState<Partial<Proposta>>({});
  const [salvando, setSalvando] = useState(false);

  // ✅ Só dono ou Administrador podem excluir
  const podeExcluir = isDono || perfil === "Administrador";

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  const fetchPropostas = async (wsId: string) => {
    const { data } = await supabase.from("proposta").select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setPropostas(data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      // Caminho 1: dono
      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono?.username) {
        setWorkspaceId(wsDono.username);
        await fetchPropostas(wsDono.username);
        setLoading(false);
        return;
      }

      // Caminho 2: sub-usuário
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("workspace_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usuarioWs?.workspace_id) {
        setWorkspaceId(usuarioWs.workspace_id);
        await fetchPropostas(usuarioWs.workspace_id);
      }
      setLoading(false);
    };
    init();
  }, []);

  // Realtime
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("proposta_rt_" + workspaceId)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta", filter: `workspace_id=eq.${workspaceId}` }, () => fetchPropostas(workspaceId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  const abrirEditar = (p: Proposta) => {
    setPropostaEditando(p);
    setForm({ ...p });
    setShowModal(true);
  };

  const salvar = async () => {
    if (!propostaEditando) return;
    if (!form.nome || !form.telefone1) { alert("Nome e Telefone 1 são obrigatórios!"); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from("proposta").update({
        data_proposta: form.data_proposta,
        nome: form.nome,
        cpf: form.cpf,
        rg: form.rg,
        data_nascimento: form.data_nascimento,
        nome_mae: form.nome_mae,
        email: form.email,
        endereco: form.endereco,
        cep: form.cep,
        cidade: form.cidade,
        estado: form.estado,
        telefone1: form.telefone1,
        telefone2: form.telefone2,
        telefone3: form.telefone3,
        vencimento: form.vencimento,
        forma_pagamento: form.forma_pagamento,
        plano: form.plano,
        valor_plano: form.valor_plano ? Number(form.valor_plano) : null,
        data_agendamento: form.data_agendamento,
        periodo_instalacao: form.periodo_instalacao,
        vendedor: form.vendedor,
        status_venda: form.status_venda,
        data_instalacao: form.data_instalacao,
        data_cancelamento: form.data_cancelamento,
        operadora: form.operadora,
      }).eq("id", propostaEditando.id);

      if (error) { alert("Erro ao salvar: " + error.message); setSalvando(false); return; }
      await fetchPropostas(workspaceId);
      setShowModal(false);
      setPropostaEditando(null);
      alert("✅ Proposta atualizada!");
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };

  const excluir = async (p: Proposta) => {
    if (!podeExcluir) { alert("Você não tem permissão para excluir!"); return; }
    if (!confirm(`⚠️ Excluir a proposta de ${p.nome}?\n\nEsta ação NÃO pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from("proposta").delete().eq("id", p.id);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchPropostas(workspaceId);
      alert("✅ Proposta excluída!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  const propostasFiltradas = propostas
    .filter(p => filtroStatus === "todos" || p.status_venda === filtroStatus)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.cpf?.includes(busca) || p.vendedor?.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* MODAL EDITAR */}
      {showModal && propostaEditando && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 28, width: "100%", maxWidth: 820, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 18, maxHeight: "90vh", overflowY: "auto" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>✏️ Editar Proposta #{propostaEditando.id}</h2>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            {/* DADOS DA PROPOSTA */}
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>📋 Dados da Proposta</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data</label>
                  <input type="date" value={form.data_proposta || ""} onChange={e => setForm({ ...form, data_proposta: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Operadora</label>
                  <input value={form.operadora || ""} onChange={e => setForm({ ...form, operadora: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Vendedor</label>
                  <input value={form.vendedor || ""} onChange={e => setForm({ ...form, vendedor: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* DADOS PESSOAIS */}
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>👤 Dados Pessoais</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label>
                  <input value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>CPF</label>
                  <input value={form.cpf || ""} onChange={e => setForm({ ...form, cpf: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>RG</label>
                  <input value={form.rg || ""} onChange={e => setForm({ ...form, rg: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Nascimento</label>
                  <input type="date" value={form.data_nascimento || ""} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome da Mãe</label>
                  <input value={form.nome_mae || ""} onChange={e => setForm({ ...form, nome_mae: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail</label>
                  <input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* ENDEREÇO */}
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>📍 Endereço</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>CEP</label>
                  <input value={form.cep || ""} onChange={e => setForm({ ...form, cep: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Cidade</label>
                  <input value={form.cidade || ""} onChange={e => setForm({ ...form, cidade: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>UF</label>
                  <input value={form.estado || ""} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Endereço Completo</label>
                  <input value={form.endereco || ""} onChange={e => setForm({ ...form, endereco: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* CONTATO */}
            <div>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>📱 Contato</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone 1 *</label>
                  <input value={form.telefone1 || ""} onChange={e => setForm({ ...form, telefone1: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone 2</label>
                  <input value={form.telefone2 || ""} onChange={e => setForm({ ...form, telefone2: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone 3</label>
                  <input value={form.telefone3 || ""} onChange={e => setForm({ ...form, telefone3: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* PLANO */}
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>💳 Plano e Pagamento</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Plano</label>
                  <input value={form.plano || ""} onChange={e => setForm({ ...form, plano: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Valor (R$)</label>
                  <input type="number" step="0.01" value={form.valor_plano || 0} onChange={e => setForm({ ...form, valor_plano: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Vencimento</label>
                  <select value={form.vencimento || ""} onChange={e => setForm({ ...form, vencimento: e.target.value })} style={inputStyle}>
                    <option value="">Selecione</option>
                    {["1", "5", "7", "10", "15"].map(d => <option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Pagamento</label>
                  <select value={form.forma_pagamento || ""} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })} style={inputStyle}>
                    <option value="">Selecione</option>
                    <option value="Boleto Bancário">Boleto</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AGENDAMENTO E STATUS */}
            <div>
              <p style={{ color: "#dc2626", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>📅 Status e Agendamento</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Status</label>
                  <select value={form.status_venda || ""} onChange={e => setForm({ ...form, status_venda: e.target.value })} style={inputStyle}>
                    {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Agendamento</label>
                  <input type="date" value={form.data_agendamento || ""} onChange={e => setForm({ ...form, data_agendamento: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Período</label>
                  <select value={form.periodo_instalacao || ""} onChange={e => setForm({ ...form, periodo_instalacao: e.target.value })} style={inputStyle}>
                    <option value="">Selecione</option>
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Instalação</label>
                  <input type="date" value={form.data_instalacao || ""} onChange={e => setForm({ ...form, data_instalacao: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Data Cancelamento</label>
                  <input type="date" value={form.data_cancelamento || ""} onChange={e => setForm({ ...form, data_cancelamento: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #1f2937", paddingTop: 16 }}>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} style={{ background: salvando ? "#15803d" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                {salvando ? "Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>💰 Vendas</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{propostas.length} proposta(s) cadastrada(s)</p>
        </div>
        <button onClick={() => router.push("/crm/proposta")} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
          📋 Nova Proposta
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome, CPF, vendedor..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360, padding: "8px 14px" }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 220, padding: "8px 14px" }}>
          <option value="todos">Todos os status</option>
          {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* TABELA */}
      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0d0d0d" }}>
              {["Cliente", "CPF", "Vendedor", "Plano", "Valor", "Status", "Data", "Ações"].map(h => (
                <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 32, color: "#6b7280", textAlign: "center" }}>Carregando...</td></tr>
            ) : propostasFiltradas.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 48, color: "#6b7280", textAlign: "center" }}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>💰</p>
                <p style={{ fontSize: 13, margin: 0 }}>{busca || filtroStatus !== "todos" ? "Nenhum resultado pros filtros" : "Nenhuma proposta cadastrada ainda"}</p>
              </td></tr>
            ) : propostasFiltradas.map((v, i) => (
              <tr key={v.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "12px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{v.nome}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.cpf || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.vendedor || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.plano || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>R$ {(v.valor_plano || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: `${statusColor[v.status_venda] || "#6b7280"}22`, color: statusColor[v.status_venda] || "#6b7280", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: "bold", whiteSpace: "nowrap" }}>{v.status_venda}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.data_proposta ? new Date(v.data_proposta).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(v)} title="Editar" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                    {podeExcluir && (
                      <button onClick={() => excluir(v)} title="Excluir" style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!podeExcluir && propostas.length > 0 && (
        <p style={{ color: "#6b7280", fontSize: 11, fontStyle: "italic", margin: 0 }}>
          🔒 Apenas o dono do workspace ou administrador podem excluir propostas.
        </p>
      )}
    </div>
  );
}