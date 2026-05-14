"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import {
  CAMPOS_FIXOS_MAP,
  STATUS_OPCOES,
  montarCamposUnificados,
  type CampoUnificado,
  type ConfigCampoPadrao,
  type CampoCustom,
} from "../../lib/campos_proposta_definicao";

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
  dados_customizados?: Record<string, any>;
};
type UsuarioWs = { email: string; nome: string; };

const statusColor: Record<string, string> = {
  PENDENTE: "#f59e0b", "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626", INSTALADA: "#16a34a", GERADA: "#8b5cf6", REPROVADA: "#ef4444",
};

export default function Vendas() {
  const router = useRouter();
  const { isDono, perfil, permissoes } = usePermissao();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [propostaVisualizando, setPropostaVisualizando] = useState<Proposta | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);

  // 🆕 Campos unificados (config aplicada)
  const [camposUnificados, setCamposUnificados] = useState<CampoUnificado[]>([]);

  // Modal edição
  const [showModal, setShowModal] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [dadosCustomizadosEdit, setDadosCustomizadosEdit] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const podeExcluir = isDono || perfil === "Administrador";
  const podeEditarCamposCustom = isDono || perfil === "Administrador";
  const podeVerTudo = isDono || perfil === "Administrador" || !!permissoes?.vendas_equipe;

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };

  const fetchPropostas = async (wsId: string) => {
    const PAGE_SIZE = 1000;
    const TOTAL_LIMITE = 10000;
    let lista: any[] = [];
    let offset = 0;
    while (offset < TOTAL_LIMITE) {
      const { data: pagina, error } = await supabase.from("proposta").select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) { console.error("Erro fetchPropostas paginado:", error); break; }
      if (!pagina || pagina.length === 0) break;
      lista = lista.concat(pagina);
      if (pagina.length < PAGE_SIZE) break;
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

  // 🆕 Busca config + customs unificados
  const fetchCamposUnificados = async (wsId: string) => {
    const [respConfig, respCustom] = await Promise.all([
      supabase.from("proposta_campos_padrao_config")
        .select("*")
        .eq("workspace_id", wsId),
      supabase.from("proposta_campos_customizados")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
    ]);
    const configs: ConfigCampoPadrao[] = (respConfig.data || []).map((c: any) => ({
      id: c.id, campo_slug: c.campo_slug, label_custom: c.label_custom,
      obrigatorio: c.obrigatorio, visivel: c.visivel, ordem: c.ordem,
    }));
    const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
      id: c.id, slug: c.slug, label: c.label, tipo: c.tipo,
      obrigatorio: c.obrigatorio, ordem: c.ordem,
      opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
      placeholder: c.placeholder, ativo: c.ativo,
    }));
    // Mostra TODOS no modal (mesmo os ocultos no form), mas marca visibilidade
    setCamposUnificados(montarCamposUnificados(configs, customs).filter(c => c.visivel));
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserEmail(user.email || "");

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono?.username) {
        setWorkspaceId(wsDono.username);
        await fetchPropostas(wsDono.username);
        await fetchUsuariosWs(wsDono.username, wsDono);
        await fetchCamposUnificados(wsDono.username);
        setLoading(false);
        return;
      }
      const { data: usuarioWs } = await supabase.from("usuarios_workspace")
        .select("workspace_id").eq("email", user.email)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (usuarioWs?.workspace_id) {
        setWorkspaceId(usuarioWs.workspace_id);
        await fetchPropostas(usuarioWs.workspace_id);
        await fetchUsuariosWs(usuarioWs.workspace_id);
        await fetchCamposUnificados(usuarioWs.workspace_id);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel("proposta_rt_" + workspaceId)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta", filter: `workspace_id=eq.${workspaceId}` }, () => fetchPropostas(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${workspaceId}` }, () => fetchUsuariosWs(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_campos_customizados", filter: `workspace_id=eq.${workspaceId}` }, () => fetchCamposUnificados(workspaceId))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_campos_padrao_config", filter: `workspace_id=eq.${workspaceId}` }, () => fetchCamposUnificados(workspaceId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  const abrirEditar = (p: Proposta) => {
    setPropostaEditando(p);
    // Carrega form com TODAS as colunas
    setForm({ ...p });
    // Carrega dados custom
    const dadosIniciais: Record<string, any> = {};
    for (const c of camposUnificados) {
      if (c.origem === "custom") {
        const v = p.dados_customizados?.[c.slug];
        dadosIniciais[c.slug] = v !== undefined ? v : (c.tipo === "checkbox" ? false : "");
      }
    }
    setDadosCustomizadosEdit(dadosIniciais);
    setShowModal(true);
  };

  const salvar = async () => {
    if (!propostaEditando) return;

    // Valida obrigatórios
    for (const c of camposUnificados) {
      if (!c.obrigatorio) continue;
      const v = c.origem === "fixo" ? form[c.slug] : dadosCustomizadosEdit[c.slug];
      const vazio = c.tipo === "checkbox" ? v !== true : (v === undefined || v === null || String(v).trim() === "");
      if (vazio) { alert(`O campo "${c.label}" é obrigatório.`); return; }
    }

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
        dados_customizados: dadosCustomizadosEdit,
      })
        .eq("id", propostaEditando.id)
        .eq("workspace_id", workspaceId);

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
    if (!workspaceId) { alert("Workspace não carregado."); return; }
    try {
      const { error } = await supabase.from("proposta").delete()
        .eq("id", p.id).eq("workspace_id", workspaceId);
      if (error) { alert("Erro ao excluir: " + error.message); return; }
      await fetchPropostas(workspaceId);
      alert("✅ Proposta excluída!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Renderização dinâmica de cada campo NO MODAL DE EDIÇÃO
  // ═══════════════════════════════════════════════════════════════════
  const renderCampoModal = (c: CampoUnificado) => {
    const labelComObr = `${c.label}${c.obrigatorio ? " *" : ""}`;
    const lab = <label style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>{labelComObr}</label>;

    if (c.origem === "fixo") {
      const val = form[c.slug] ?? "";
      const set = (v: any) => setForm({ ...form, [c.slug]: v });

      // Vendedor
      if (c.tipo === "vendedor") {
        return (
          <div>{lab}
            {podeVerTudo ? (
              <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {usuariosWs.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                {val && !usuariosWs.find(u => u.email?.toLowerCase() === String(val).toLowerCase()) && (
                  <option value={val}>⚠️ {val} (legado)</option>
                )}
              </select>
            ) : (
              <input value={nomeVendedor(val)} disabled style={{ ...inputStyle, opacity: 0.6 }} />
            )}
          </div>
        );
      }

      if (c.tipo === "data") return <div>{lab}<input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "email") return <div>{lab}<input type="email" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "numero") return <div>{lab}<input type="number" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "moeda") return <div>{lab}<input type="number" step="0.01" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "telefone") return <div>{lab}<input type="tel" placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
      if (c.tipo === "dropdown") {
        const prefixoVenc = c.slug === "vencimento";
        return (
          <div>{lab}
            <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              {(c.opcoes || []).map(op => <option key={op} value={op}>{prefixoVenc ? `Dia ${op}` : op}</option>)}
            </select>
          </div>
        );
      }
      return <div>{lab}<input placeholder={c.placeholder || ""} value={val} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    }

    // CUSTOM
    const val = dadosCustomizadosEdit[c.slug];
    const set = (v: any) => setDadosCustomizadosEdit(prev => ({ ...prev, [c.slug]: v }));

    if (c.tipo === "textarea") return <div>{lab}<textarea placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "Arial, sans-serif" }} /></div>;
    if (c.tipo === "numero") return <div>{lab}<input type="number" placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "moeda") return <div>{lab}<input type="number" step="0.01" placeholder={c.placeholder || "0,00"} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "data") return <div>{lab}<input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "dropdown") return (
      <div>{lab}<select value={val || ""} onChange={e => set(e.target.value)} style={inputStyle}>
        <option value="">Selecione...</option>
        {(c.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
      </select></div>
    );
    if (c.tipo === "checkbox") return (
      <div>{lab}
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#1f2937", borderRadius: 8, border: "1px solid #374151", cursor: "pointer" }}>
          <input type="checkbox" checked={val === true} onChange={e => set(e.target.checked)} style={{ accentColor: "#16a34a", width: 16, height: 16 }} />
          <span style={{ color: "white", fontSize: 13 }}>{val === true ? "Sim" : "Não"}</span>
        </label>
      </div>
    );
    return <div>{lab}<input placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
  };

  const propostasFiltradas = propostas
    .filter(p => podeVerTudo || (p.vendedor && p.vendedor.toLowerCase() === userEmail.toLowerCase()))
    .filter(p => filtroStatus === "todos" || p.status_venda === filtroStatus)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.cpf?.includes(busca) || nomeVendedor(p.vendedor).toLowerCase().includes(busca.toLowerCase()))
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

            {/* 🆕 Renderização dinâmica — todos os campos respeitando ordem/config */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {camposUnificados.map(c => (
                <div key={`${c.origem}-${c.slug}`} style={c.larguraTotal || c.tipo === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                  {renderCampoModal(c)}
                </div>
              ))}
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
            {podeVerTudo
              ? `${totalGeral} proposta(s) cadastrada(s)`
              : `${totalVisivel} proposta(s) suas${totalGeral > totalVisivel ? ` · ${totalGeral - totalVisivel} de outros vendedores ocultas` : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {podeEditarCamposCustom && (
            <button onClick={() => router.push("/crm/editor-proposta")} title="Configurar campos da proposta"
              style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f744", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
              🛠️ Editar Campos
            </button>
          )}
          <button onClick={() => router.push("/crm/proposta")} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            📋 Nova Proposta
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome, CPF, vendedor..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360, padding: "8px 14px" }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 220, padding: "8px 14px" }}>
          <option value="todos">Todos os status</option>
          {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>📅 De:</span>
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} max={filtroDataFim || undefined}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 12, padding: "4px 0", colorScheme: "dark" }} />
          <span style={{ color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>Até:</span>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} min={filtroDataInicio || undefined}
            style={{ background: "transparent", border: "none", color: "white", fontSize: 12, padding: "4px 0", colorScheme: "dark" }} />
        </div>
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
                  {busca || filtroStatus !== "todos" ? "Nenhum resultado pros filtros" : podeVerTudo ? "Nenhuma proposta cadastrada ainda" : "Você ainda não cadastrou nenhuma proposta"}
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
        <p style={{ color: "#6b7280", fontSize: 11, fontStyle: "italic", margin: 0 }}>🔒 Apenas o dono do workspace ou administrador podem excluir propostas.</p>
      )}
      {!podeVerTudo && (
        <p style={{ color: "#6b7280", fontSize: 11, fontStyle: "italic", margin: 0 }}>👤 Você só vê suas próprias propostas. Pra ver as da equipe, peça ao admin para habilitar <b>"Ver vendas da equipe"</b>.</p>
      )}

      {/* MODAL DE VISUALIZAÇÃO — dinâmico também */}
      {propostaVisualizando && (
        <div onClick={() => setPropostaVisualizando(null)}
          style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1f2937" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#111", zIndex: 1 }}>
              <div>
                <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>👁️ Detalhes da Proposta</h2>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{propostaVisualizando.nome} • #{propostaVisualizando.id}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { const p = propostaVisualizando; setPropostaVisualizando(null); abrirEditar(p); }}
                  style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>✏️ Editar</button>
                <button onClick={() => setPropostaVisualizando(null)}
                  style={{ background: "#1f2937", color: "white", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>✕ Fechar</button>
              </div>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Destaques no topo (sempre) */}
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
              </div>

              {/* 🆕 Lista de TODOS os campos visíveis em ordem (fixos + custom) */}
              <ViewSection
                titulo="📋 Informações"
                campos={camposUnificados
                  .filter(c => c.slug !== "status_venda" && c.slug !== "valor_plano" && c.slug !== "vendedor") // já mostrados no topo
                  .map(c => {
                    let v = c.origem === "fixo" ? (propostaVisualizando as any)[c.slug] : propostaVisualizando.dados_customizados?.[c.slug];
                    if (c.tipo === "checkbox") v = v === true ? "Sim" : v === false ? "Não" : "";
                    else if (c.tipo === "moeda" && v) v = `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
                    else if (c.tipo === "data" && v) v = new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
                    else if (c.tipo === "vendedor" && v) v = nomeVendedor(v);
                    return [c.label, v] as [string, any];
                  })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewSection({ titulo, campos }: { titulo: string; campos: [string, any][] }) {
  const todosVazios = campos.every(([, v]) => !v && v !== false);
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
              <p style={{ color: valor || valor === false ? "white" : "#6b7280", fontSize: 13, margin: "2px 0 0", wordBreak: "break-word" }}>
                {valor !== "" && valor !== null && valor !== undefined ? String(valor) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}