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
type UsuarioWs = { email: string; nome: string; };

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b", "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626", INSTALADA: "#16a34a", GERADA: "#8b5cf6", REPROVADA: "#ef4444",
};

const STATUS_OPCOES = ["PENDENTE", "AGUARDANDO AUDITORIA", "CANCELADA", "INSTALADA", "GERADA", "REPROVADA"];

export default function Vendas() {
  const router = useRouter();
  const { isDono, perfil, permissoes } = usePermissao(); // 🆕 agora pega permissoes tb
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  // 🆕 FILTRO DE DATA — filtra propostas por data_proposta dentro de um range.
  // Vazio em ambos = sem filtro de data (default).
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  // 🆕 MODAL DE VISUALIZAÇÃO — readonly, abre antes de editar/excluir pra confirmar
  const [propostaVisualizando, setPropostaVisualizando] = useState<Proposta | null>(null);
  const [userEmail, setUserEmail] = useState<string>(""); // 🆕 email do user logado
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]); // 🆕 lista pra escolher vendedor no modal + mapear nomes

  // Modal edição
  const [showModal, setShowModal] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [form, setForm] = useState<Partial<Proposta>>({});
  const [salvando, setSalvando] = useState(false);

  // ✅ Só dono ou Administrador podem excluir
  const podeExcluir = isDono || perfil === "Administrador";

  // 🆕 Regra central: quem pode ver vendas de todo mundo
  //    - Dono do workspace: sempre
  //    - Perfil "Administrador": sempre
  //    - Usuário com permissão `vendas_equipe` marcada no grupo: sim
  //    - Resto (Atendente, Vendedor): só vê as próprias
  const podeVerTudo = isDono || perfil === "Administrador" || !!permissoes?.vendas_equipe;

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };

  const fetchPropostas = async (wsId: string) => {
    // 🆕 PAGINAÇÃO ATÉ 10.000 PROPOSTAS — vendas são dado crítico, mantém histórico completo.
    // Antes era query única → Supabase cortava em 1000 e workspaces com muitas vendas perdiam
    // visibilidade do histórico (importante pros últimos 6 meses pelo menos).
    // Limite alto de 10k garante histórico longo. SEM auto-limpeza — nunca mexe no banco.
    const PAGE_SIZE = 1000;
    const TOTAL_LIMITE = 10000;
    let lista: any[] = [];
    let offset = 0;
    while (offset < TOTAL_LIMITE) {
      const { data: pagina, error } = await supabase.from("proposta").select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.error("Erro fetchPropostas paginado:", error);
        break;
      }
      if (!pagina || pagina.length === 0) break;
      lista = lista.concat(pagina);
      if (pagina.length < PAGE_SIZE) break; // chegou no fim
      offset += PAGE_SIZE;
    }
    setPropostas(lista);
  };

  const fetchUsuariosWs = async (wsId: string, wsData?: any) => {
    const lista: UsuarioWs[] = [];
    const ws = wsData || (await supabase.from("workspaces").select("nome, owner_email, username, id").or(`username.eq.${wsId},id.eq.${wsId}`).maybeSingle()).data;
    if (ws?.owner_email) lista.push({ email: ws.owner_email, nome: ws.nome || "Dono" });
    const { data: subs } = await supabase.from("usuarios_workspace").select("email, nome").eq("workspace_id", wsId);
    for (const s of (subs || [])) {
      if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
        lista.push({ email: s.email, nome: s.nome || s.email });
      }
    }
    setUsuariosWs(lista);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");

      // Caminho 1: dono
      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono?.username) {
        setWorkspaceId(wsDono.username);
        await fetchPropostas(wsDono.username);
        await fetchUsuariosWs(wsDono.username, wsDono);
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
        await fetchUsuariosWs(usuarioWs.workspace_id);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${workspaceId}` }, () => fetchUsuariosWs(workspaceId))
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
      // 🔒 MULTI-TENANT: confere workspace_id no WHERE pra impedir edição de propostas de outros workspaces.
      // Antes só filtrava por id — se um vendedor descobrisse o id de uma proposta de outro cliente
      // (CPF, RG, telefone), poderia editar via DevTools.
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
      })
        .eq("id", propostaEditando.id)
        .eq("workspace_id", workspaceId);  // 🔒 MULTI-TENANT

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
    if (!workspaceId) { alert("Workspace não carregado. Recarregue a página."); return; }
    try {
      // 🔒 MULTI-TENANT CRÍTICO: confere workspace_id pra impedir delete de propostas de outros workspaces.
      // Antes, qualquer admin de qualquer workspace que descobrisse o id de uma proposta podia deletar
      // via DevTools — isso significa apagar dados de cliente real (CPF, RG, contrato) sem rastro.
      const { error } = await supabase.from("proposta").delete()
        .eq("id", p.id)
        .eq("workspace_id", workspaceId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchPropostas(workspaceId);
      alert("✅ Proposta excluída!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // 🆕 FILTRO PRINCIPAL — aplica a regra de quem pode ver o quê
  // Se o user pode ver tudo, não filtra.
  // Senão, só as onde vendedor === email do user logado.
  const propostasFiltradas = propostas
    .filter(p => podeVerTudo || (p.vendedor && p.vendedor.toLowerCase() === userEmail.toLowerCase()))
    .filter(p => filtroStatus === "todos" || p.status_venda === filtroStatus)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.cpf?.includes(busca) || nomeVendedor(p.vendedor).toLowerCase().includes(busca.toLowerCase()))
    // 🆕 Filtro de data — usa data_proposta (campo de negócio, formato YYYY-MM-DD) e não created_at (técnico).
    // Inputs vazios = sem corte. Comparação por string funciona com YYYY-MM-DD direto.
    .filter(p => {
      if (!filtroDataInicio && !filtroDataFim) return true;
      const dt = p.data_proposta || "";
      if (filtroDataInicio && dt < filtroDataInicio) return false;
      if (filtroDataFim && dt > filtroDataFim) return false;
      return true;
    });

  const totalVisivel = propostasFiltradas.length;
  const totalGeral = propostas.length;

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
                  {/* 🆕 Dropdown dinâmico (só admin/dono/com vendas_equipe pode alterar). Outros veem travado. */}
                  {podeVerTudo ? (
                    <select value={form.vendedor || ""} onChange={e => setForm({ ...form, vendedor: e.target.value })} style={inputStyle}>
                      <option value="">Selecione...</option>
                      {usuariosWs.map(u => (
                        <option key={u.email} value={u.email}>{u.nome}</option>
                      ))}
                      {/* Se a proposta antiga tem vendedor "ROBERT" (nome literal), mostra tb pra não perder */}
                      {form.vendedor && !usuariosWs.find(u => u.email?.toLowerCase() === form.vendedor?.toLowerCase()) && (
                        <option value={form.vendedor}>⚠️ {form.vendedor} (legado)</option>
                      )}
                    </select>
                  ) : (
                    <input value={nomeVendedor(form.vendedor || "")} disabled style={{ ...inputStyle, opacity: 0.6 }} />
                  )}
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
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>
            {/* 🆕 Explica quantas o user está vendo vs total */}
            {podeVerTudo
              ? `${totalGeral} proposta(s) cadastrada(s)`
              : `${totalVisivel} proposta(s) suas${totalGeral > totalVisivel ? ` · ${totalGeral - totalVisivel} de outros vendedores ocultas` : ""}`}
          </p>
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
        {/* 🆕 FILTRO DE DATA — De / Até. Filtra por data_proposta. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>📅 De:</span>
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} max={filtroDataFim || undefined}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 12, padding: "4px 0", colorScheme: "dark" }} />
          <span style={{ color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>Até:</span>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} min={filtroDataInicio || undefined}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 12, padding: "4px 0", colorScheme: "dark" }} />
        </div>
        {/* Botão Limpar Filtros — só aparece se algum filtro tá ativo */}
        {(busca || filtroStatus !== "todos" || filtroDataInicio || filtroDataFim) && (
          <button onClick={() => { setBusca(""); setFiltroStatus("todos"); setFiltroDataInicio(""); setFiltroDataFim(""); }}
            style={{ background: "#dc262622", border: "1px solid #dc262633", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
            ✕ Limpar
          </button>
        )}
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
                <p style={{ fontSize: 13, margin: 0 }}>
                  {busca || filtroStatus !== "todos"
                    ? "Nenhum resultado pros filtros"
                    : podeVerTudo
                      ? "Nenhuma proposta cadastrada ainda"
                      : "Você ainda não cadastrou nenhuma proposta"}
                </p>
              </td></tr>
            ) : propostasFiltradas.map((v, i) => (
              <tr key={v.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                <td style={{ padding: "12px 16px", color: "white", fontSize: 13, fontWeight: "bold" }}>{v.nome}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.cpf || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{nomeVendedor(v.vendedor)}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.plano || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>R$ {(v.valor_plano || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: `${statusColor[v.status_venda] || "#6b7280"}22`, color: statusColor[v.status_venda] || "#6b7280", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: "bold", whiteSpace: "nowrap" }}>{v.status_venda}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{v.data_proposta ? new Date(v.data_proposta).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 🆕 Visualizar — abre modal readonly com TODOS os campos da proposta */}
                    <button onClick={() => setPropostaVisualizando(v)} title="Visualizar" style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>👁️</button>
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
      {!podeVerTudo && (
        <p style={{ color: "#6b7280", fontSize: 11, fontStyle: "italic", margin: 0 }}>
          👤 Você só vê suas próprias propostas. Pra ver as da equipe, peça ao admin para habilitar a permissão <b>"Ver vendas da equipe"</b> no seu grupo.
        </p>
      )}

      {/* 🆕 ═══════════════════════════════════════════════════════════════
          MODAL DE VISUALIZAÇÃO — readonly. Mostra TODA a proposta sem permitir edição.
          ═══════════════════════════════════════════════════════════════
          Útil pra:
          - Conferir antes de editar (evita clicar em editar e errar campo)
          - Conferir antes de excluir (evita excluir errado)
          - Apresentar pro cliente sem risco de mudar nada acidentalmente
          - Atendentes que não tem permissão de editar mas precisam ver detalhe */}
      {propostaVisualizando && (
        <div onClick={() => setPropostaVisualizando(null)}
          style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1f2937" }}>
            {/* Header do modal */}
            <div style={{ padding: 20, borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#111", zIndex: 1 }}>
              <div>
                <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>
                  👁️ Detalhes da Proposta
                </h2>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>
                  {propostaVisualizando.nome} • #{propostaVisualizando.id}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { const p = propostaVisualizando; setPropostaVisualizando(null); abrirEditar(p); }}
                  style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>
                  ✏️ Editar
                </button>
                <button onClick={() => setPropostaVisualizando(null)}
                  style={{ background: "#1f2937", color: "white", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do modal — agrupado por seções */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Status + Valor + Vendedor (destaque no topo) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14, borderLeft: `3px solid ${statusColor[propostaVisualizando.status_venda] || "#6b7280"}` }}>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>Status</p>
                  <p style={{ color: statusColor[propostaVisualizando.status_venda] || "white", fontSize: 14, margin: "4px 0 0", fontWeight: "bold" }}>{propostaVisualizando.status_venda || "—"}</p>
                </div>
                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14, borderLeft: "3px solid #16a34a" }}>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>Valor</p>
                  <p style={{ color: "#16a34a", fontSize: 14, margin: "4px 0 0", fontWeight: "bold" }}>R$ {Number(propostaVisualizando.valor_plano || 0).toFixed(2).replace(".", ",")}</p>
                </div>
                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14, borderLeft: "3px solid #3b82f6" }}>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>Vendedor</p>
                  <p style={{ color: "white", fontSize: 14, margin: "4px 0 0", fontWeight: "bold" }}>{nomeVendedor(propostaVisualizando.vendedor)}</p>
                </div>
                <div style={{ background: "#0d0d0d", borderRadius: 8, padding: 14, borderLeft: "3px solid #8b5cf6" }}>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: "bold" }}>Data Proposta</p>
                  <p style={{ color: "white", fontSize: 14, margin: "4px 0 0", fontWeight: "bold" }}>{propostaVisualizando.data_proposta ? new Date(propostaVisualizando.data_proposta + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p>
                </div>
              </div>

              {/* Dados pessoais */}
              <ViewSection titulo="👤 Dados Pessoais" campos={[
                ["Nome", propostaVisualizando.nome],
                ["CPF", propostaVisualizando.cpf],
                ["RG", propostaVisualizando.rg],
                ["Data de Nascimento", propostaVisualizando.data_nascimento ? new Date(propostaVisualizando.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : ""],
                ["Nome da Mãe", propostaVisualizando.nome_mae],
                ["Email", propostaVisualizando.email],
              ]} />

              {/* Endereço */}
              <ViewSection titulo="📍 Endereço" campos={[
                ["Endereço", propostaVisualizando.endereco],
                ["CEP", propostaVisualizando.cep],
                ["Cidade", propostaVisualizando.cidade],
                ["Estado", propostaVisualizando.estado],
              ]} />

              {/* Contatos */}
              <ViewSection titulo="📞 Contatos" campos={[
                ["Telefone 1", propostaVisualizando.telefone1],
                ["Telefone 2", propostaVisualizando.telefone2],
                ["Telefone 3", propostaVisualizando.telefone3],
              ]} />

              {/* Plano e pagamento */}
              <ViewSection titulo="📦 Plano e Pagamento" campos={[
                ["Operadora", propostaVisualizando.operadora],
                ["Plano", propostaVisualizando.plano],
                ["Valor", propostaVisualizando.valor_plano ? `R$ ${Number(propostaVisualizando.valor_plano).toFixed(2).replace(".", ",")}` : ""],
                ["Vencimento", propostaVisualizando.vencimento],
                ["Forma de Pagamento", propostaVisualizando.forma_pagamento],
              ]} />

              {/* Datas operacionais */}
              <ViewSection titulo="📅 Datas Operacionais" campos={[
                ["Agendamento", propostaVisualizando.data_agendamento ? new Date(propostaVisualizando.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR") : ""],
                ["Período de Instalação", propostaVisualizando.periodo_instalacao],
                ["Instalação", propostaVisualizando.data_instalacao ? new Date(propostaVisualizando.data_instalacao + "T00:00:00").toLocaleDateString("pt-BR") : ""],
                ["Cancelamento", propostaVisualizando.data_cancelamento ? new Date(propostaVisualizando.data_cancelamento + "T00:00:00").toLocaleDateString("pt-BR") : ""],
                ["Cadastrada em", propostaVisualizando.created_at ? new Date(propostaVisualizando.created_at).toLocaleString("pt-BR") : ""],
              ]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🆕 Componente auxiliar — renderiza uma seção do modal de visualização.
// Mostra um título e uma grade de campos (label + valor). Se valor é vazio, mostra "—" em cinza.
// Mantém visual consistente entre todas as seções (Dados pessoais, Endereço, etc).
function ViewSection({ titulo, campos }: { titulo: string; campos: [string, any][] }) {
  // Filtra campos que tem algum valor (mostra "—" só se TUDO da seção tá vazio)
  const todosVazios = campos.every(([, v]) => !v);
  return (
    <div>
      <h3 style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</h3>
      {todosVazios ? (
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0, fontStyle: "italic" }}>Nenhuma informação cadastrada</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#0d0d0d", padding: 14, borderRadius: 8 }}>
          {campos.map(([label, valor]) => (
            <div key={label}>
              <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase" }}>{label}</p>
              <p style={{ color: valor ? "white" : "#6b7280", fontSize: 13, margin: "2px 0 0", wordBreak: "break-word" }}>
                {valor || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}