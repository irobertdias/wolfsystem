"use client";
import { useState, useEffect, type ReactNode } from "react";
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
  PENDENTE: "#f59e0b",
  "AGUARDANDO AUDITORIA": "#3b82f6",
  CANCELADA: "#dc2626",
  INSTALADA: "#16a34a",
  GERADA: "#8b5cf6",
  REPROVADA: "#ef4444",
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

  const [camposUnificados, setCamposUnificados] = useState<CampoUnificado[]>([]);
  const [slugsNaLista, setSlugsNaLista] = useState<Set<string>>(new Set());

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Modal edição
  const [showModal, setShowModal] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [dadosCustomizadosEdit, setDadosCustomizadosEdit] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const podeExcluir = isDono || perfil === "Administrador";
  const podeEditarCamposCustom = isDono || perfil === "Administrador";
  const podeVerTudo = isDono || perfil === "Administrador" || !!permissoes?.vendas_equipe;

  // 🎨 ESTILOS LIGHT TECH
  const inputStyle = {
    width: "100%", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "9px 12px", color: "#1f2937", fontSize: 13, boxSizing: "border-box" as const,
    outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };

  // ═══ Renderização dinâmica de cada célula da tabela (respeita config do Editor) ═══
  const renderCelulaTabela = (c: CampoUnificado, v: Proposta): ReactNode => {
    const raw = c.origem === "fixo"
      ? (v as any)[c.slug]
      : v.dados_customizados?.[c.slug];

    // Estilizações especiais por slug (mantêm visual original)
    if (c.slug === "status_venda") {
      const cor = statusColor[raw] || "#6b7280";
      return raw ? (
        <span style={{
          background: `${cor}15`, color: cor, border: `1px solid ${cor}40`,
          padding: "3px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
        }}>{raw}</span>
      ) : <span style={{ color: "#d1d5db" }}>—</span>;
    }
    if (c.slug === "valor_plano") {
      return (
        <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 800, letterSpacing: -0.2, whiteSpace: "nowrap" }}>
          R$ {Number(raw || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    if (c.slug === "vendedor") {
      return <span style={{ color: "#4b5563", fontSize: 12 }}>{nomeVendedor(raw)}</span>;
    }
    if (c.slug === "nome") {
      return <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{raw || <span style={{ color: "#d1d5db" }}>—</span>}</span>;
    }
    if (c.slug === "cpf") {
      return <span style={{ color: "#6b7280", fontSize: 12, fontFamily: "monospace" }}>{raw || <span style={{ color: "#d1d5db" }}>—</span>}</span>;
    }

    // Vazios genéricos
    if (raw === undefined || raw === null || raw === "") {
      return <span style={{ color: "#d1d5db" }}>—</span>;
    }

    // Formatação por tipo
    if (c.tipo === "data") {
      try {
        return <span style={{ color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(raw + "T00:00:00").toLocaleDateString("pt-BR")}
        </span>;
      } catch { return <span style={{ color: "#4b5563", fontSize: 12 }}>{String(raw)}</span>; }
    }
    if (c.tipo === "moeda") {
      return <span style={{ color: "#4b5563", fontSize: 12, whiteSpace: "nowrap" }}>
        R$ {Number(raw).toFixed(2).replace(".", ",")}
      </span>;
    }
    if (c.tipo === "checkbox") {
      return <span style={{ color: raw === true ? "#16a34a" : "#9ca3af", fontSize: 12, fontWeight: 600 }}>
        {raw === true ? "✓ Sim" : "Não"}
      </span>;
    }
    if (c.slug === "vencimento") {
      return <span style={{ color: "#4b5563", fontSize: 12 }}>Dia {String(raw)}</span>;
    }

    return <span style={{ color: "#4b5563", fontSize: 12 }}>{String(raw)}</span>;
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
      opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" && c.opcoes ? JSON.parse(c.opcoes) : null),
      placeholder_custom: c.placeholder_custom,
    }));
    const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
      id: c.id, slug: c.slug, label: c.label, tipo: c.tipo,
      obrigatorio: c.obrigatorio, ordem: c.ordem,
      opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
      placeholder: c.placeholder, ativo: c.ativo,
    }));

    // 📊 Slugs marcados pelo editor pra aparecer na tabela principal
    const slugs = new Set<string>();
    for (const c of (respConfig.data || [])) {
      if (c.mostrar_na_lista) slugs.add(c.campo_slug);
    }
    for (const c of (respCustom.data || [])) {
      if (c.mostrar_na_lista) slugs.add(c.slug);
    }
    setSlugsNaLista(slugs);

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
    setForm({ ...p });
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
    for (const c of camposUnificados) {
      if (!c.obrigatorio) continue;
      const v = c.origem === "fixo" ? form[c.slug] : dadosCustomizadosEdit[c.slug];
      const vazio = c.tipo === "checkbox" ? v !== true : (v === undefined || v === null || String(v).trim() === "");
      if (vazio) { alert(`O campo "${c.label}" é obrigatório.`); return; }
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from("proposta").update({
        data_proposta: form.data_proposta, nome: form.nome, cpf: form.cpf, rg: form.rg,
        data_nascimento: form.data_nascimento, nome_mae: form.nome_mae, email: form.email,
        endereco: form.endereco, cep: form.cep, cidade: form.cidade, estado: form.estado,
        telefone1: form.telefone1, telefone2: form.telefone2, telefone3: form.telefone3,
        vencimento: form.vencimento, forma_pagamento: form.forma_pagamento, plano: form.plano,
        valor_plano: form.valor_plano ? Number(form.valor_plano) : null,
        data_agendamento: form.data_agendamento, periodo_instalacao: form.periodo_instalacao,
        vendedor: form.vendedor, status_venda: form.status_venda,
        data_instalacao: form.data_instalacao, data_cancelamento: form.data_cancelamento,
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

  // ═══ Renderização dinâmica de campos no modal ═══
  const renderCampoModal = (c: CampoUnificado) => {
    const labelComObr = (
      <>
        {c.label}
        {c.obrigatorio && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
      </>
    );
    const lab = (
      <label style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5, fontWeight: 700 }}>
        {labelComObr}
      </label>
    );

    if (c.origem === "fixo") {
      const val = form[c.slug] ?? "";
      const set = (v: any) => setForm({ ...form, [c.slug]: v });

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
              <input value={nomeVendedor(val)} disabled style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }} />
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

    if (c.tipo === "textarea") return <div>{lab}<textarea placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} /></div>;
    if (c.tipo === "numero") return <div>{lab}<input type="number" placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "moeda") return <div>{lab}<input type="number" step="0.01" placeholder={c.placeholder || "0,00"} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "data") return <div>{lab}<input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} /></div>;
    if (c.tipo === "dropdown") return (
      <div>{lab}<select value={val || ""} onChange={e => set(e.target.value)} style={inputStyle}>
        <option value="">Selecione...</option>
        {(c.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
      </select></div>
    );
    if (c.tipo === "checkbox") {
      const marcado = val === true;
      return (
        <div>{lab}
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 14px",
            background: marcado ? "#f0fdf4" : "#ffffff",
            borderRadius: 10,
            border: `1px solid ${marcado ? "#bbf7d0" : "#e5e7eb"}`,
            cursor: "pointer",
            transition: "all 0.15s",
          }}>
            <input type="checkbox" checked={marcado} onChange={e => set(e.target.checked)} style={{ accentColor: "#16a34a", width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ color: marcado ? "#16a34a" : "#6b7280", fontSize: 13, fontWeight: 600 }}>{marcado ? "Sim" : "Não"}</span>
          </label>
        </div>
      );
    }
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

  // 📊 Colunas a renderizar na tabela:
  //    - se o editor marcou pelo menos 1 campo, usa apenas os marcados
  //    - se ninguém marcou nada (workspace recém-migrado), cai nos 7 clássicos
  const COLUNAS_LEGADO = ["nome", "cpf", "vendedor", "plano", "valor_plano", "status_venda", "data_proposta"];
  const colunasTabela = slugsNaLista.size > 0
    ? camposUnificados.filter(c => slugsNaLista.has(c.slug))
    : camposUnificados.filter(c => COLUNAS_LEGADO.includes(c.slug));

  const totalVisivel = propostasFiltradas.length;
  const totalGeral = propostas.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ═══ MODAL EDITAR ═══ */}
      {showModal && propostaEditando && (
        <div onClick={() => { setShowModal(false); setPropostaEditando(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              ...cardStyle,
              width: "100%", maxWidth: 860, maxHeight: "92vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.08)",
            }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✏️</div>
                <h2 style={{ color: "#1f2937", fontSize: 17, fontWeight: 700, margin: 0 }}>Editar Proposta <span style={{ color: "#9ca3af", fontWeight: 500 }}>#{propostaEditando.id}</span></h2>
              </div>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }}
                style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                {camposUnificados.map(c => (
                  <div key={`${c.origem}-${c.slug}`} style={c.larguraTotal || c.tipo === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                    {renderCampoModal(c)}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button onClick={() => { setShowModal(false); setPropostaEditando(null); }}
                style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{
                  background: salvando ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "10px 28px", fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}>
                {salvando ? "⏳ Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 8px 20px rgba(22,163,74,0.25)",
            flexShrink: 0,
          }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>💰</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Vendas</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>
              {podeVerTudo
                ? <><b style={{ color: "#16a34a" }}>{totalGeral}</b> proposta(s) cadastrada(s)</>
                : <><b style={{ color: "#16a34a" }}>{totalVisivel}</b> proposta(s) suas{totalGeral > totalVisivel ? <> · {totalGeral - totalVisivel} de outros vendedores ocultas</> : ""}</>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {podeEditarCamposCustom && (
            <button onClick={() => router.push("/crm/editor-proposta")} title="Configurar campos da proposta"
              style={{
                flex: isMobile ? 1 : "0 0 auto",
                background: "#f3e8ff", color: "#a855f7", border: "1px solid #ddd6fe",
                borderRadius: 10, padding: "10px 18px", fontSize: 13,
                cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
              }}>
              🛠️ Editar Campos
            </button>
          )}
          <button onClick={() => router.push("/crm/proposta")}
            style={{
              flex: isMobile ? 1 : "0 0 auto",
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "10px 22px", fontSize: 13, cursor: "pointer", fontWeight: 700,
              whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            📋 Nova Proposta
          </button>
        </div>
      </div>

      {/* ═══ FILTROS ═══ */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome, CPF, vendedor..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360, flex: "1 1 200px", borderRadius: 20 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
          <option value="todos">Status: Todos</option>
          {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "5px 12px" }}>
          <span style={{ color: "#6b7280", fontSize: 11, whiteSpace: "nowrap", fontWeight: 600 }}>📅 De:</span>
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} max={filtroDataFim || undefined}
            style={{ background: "transparent", border: "none", color: "#1f2937", fontSize: 12, padding: "5px 0", outline: "none", fontWeight: 600 }} />
          <span style={{ color: "#6b7280", fontSize: 11, whiteSpace: "nowrap", fontWeight: 600 }}>Até:</span>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} min={filtroDataInicio || undefined}
            style={{ background: "transparent", border: "none", color: "#1f2937", fontSize: 12, padding: "5px 0", outline: "none", fontWeight: 600 }} />
        </div>
        {(busca || filtroStatus !== "todos" || filtroDataInicio || filtroDataFim) && (
          <button onClick={() => { setBusca(""); setFiltroStatus("todos"); setFiltroDataInicio(""); setFiltroDataFim(""); }}
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* ═══ TABELA ═══ */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 720 : "auto" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {colunasTabela.map(c => (
                  <th key={`th-${c.origem}-${c.slug}`}
                    style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                    {c.label}
                  </th>
                ))}
                <th key="th-acoes"
                  style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colunasTabela.length + 1} style={{ padding: 32, color: "#6b7280", textAlign: "center", fontSize: 13 }}>⏳ Carregando...</td></tr>
              ) : propostasFiltradas.length === 0 ? (
                <tr><td colSpan={colunasTabela.length + 1} style={{ padding: 48, textAlign: "center" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 18,
                    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, margin: "0 auto 14px",
                    boxShadow: "0 12px 24px rgba(22,163,74,0.25)",
                  }}>
                    <span style={{ filter: "saturate(0) brightness(2)" }}>💰</span>
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                    {busca || filtroStatus !== "todos" ? "Nenhum resultado pros filtros" : podeVerTudo ? "Nenhuma proposta cadastrada ainda" : "Você ainda não cadastrou nenhuma proposta"}
                  </p>
                </td></tr>
              ) : propostasFiltradas.map((v, i) => {
                return (
                  <tr key={v.id}
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      background: i % 2 === 0 ? "#ffffff" : "#fafbfc",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfc"}
                  >
                    {colunasTabela.map(c => (
                      <td key={`td-${c.origem}-${c.slug}`} style={{ padding: "12px 16px" }}>
                        {renderCelulaTabela(c, v)}
                      </td>
                    ))}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setPropostaVisualizando(v)} title="Visualizar"
                          style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>👁️</button>
                        <button onClick={() => abrirEditar(v)} title="Editar"
                          style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                        {podeExcluir && (
                          <button onClick={() => excluir(v)} title="Excluir"
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avisos rodapé */}
      {!podeExcluir && propostas.length > 0 && (
        <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>🔒 Apenas o dono do workspace ou administrador podem excluir propostas.</p>
      )}
      {!podeVerTudo && (
        <p style={{ color: "#9ca3af", fontSize: 11, fontStyle: "italic", margin: 0 }}>👤 Você só vê suas próprias propostas. Pra ver as da equipe, peça ao admin para habilitar <b style={{ color: "#6b7280" }}>"Ver vendas da equipe"</b>.</p>
      )}

      {/* ═══ MODAL DE VISUALIZAÇÃO ═══ */}
      {propostaVisualizando && (
        <div onClick={() => setPropostaVisualizando(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              ...cardStyle,
              width: "100%", maxWidth: 760, maxHeight: "92vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.08)",
            }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👁️</div>
                <div>
                  <h2 style={{ color: "#1f2937", fontSize: 17, fontWeight: 700, margin: 0 }}>Detalhes da Proposta</h2>
                  <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>{propostaVisualizando.nome} <span style={{ color: "#d1d5db" }}>·</span> #{propostaVisualizando.id}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { const p = propostaVisualizando; setPropostaVisualizando(null); abrirEditar(p); }}
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                    color: "white", border: "none", borderRadius: 10,
                    padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                  }}>✏️ Editar</button>
                <button onClick={() => setPropostaVisualizando(null)}
                  style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>✕ Fechar</button>
              </div>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Destaques no topo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{
                  background: "#f9fafb", borderRadius: 12, padding: 14,
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${statusColor[propostaVisualizando.status_venda] || "#6b7280"}`,
                }}>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Status</p>
                  <p style={{ color: statusColor[propostaVisualizando.status_venda] || "#1f2937", fontSize: 14, margin: "5px 0 0", fontWeight: 700 }}>{propostaVisualizando.status_venda || "—"}</p>
                </div>
                <div style={{
                  background: "#f0fdf4", borderRadius: 12, padding: 14,
                  border: "1px solid #bbf7d0",
                  borderLeft: "4px solid #16a34a",
                }}>
                  <p style={{ color: "#15803d", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Valor</p>
                  <p style={{ color: "#16a34a", fontSize: 16, margin: "5px 0 0", fontWeight: 800, letterSpacing: -0.3 }}>R$ {Number(propostaVisualizando.valor_plano || 0).toFixed(2).replace(".", ",")}</p>
                </div>
                <div style={{
                  background: "#eff6ff", borderRadius: 12, padding: 14,
                  border: "1px solid #bfdbfe",
                  borderLeft: "4px solid #3b82f6",
                }}>
                  <p style={{ color: "#1e40af", fontSize: 10, margin: 0, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Vendedor</p>
                  <p style={{ color: "#1e40af", fontSize: 14, margin: "5px 0 0", fontWeight: 700 }}>{nomeVendedor(propostaVisualizando.vendedor)}</p>
                </div>
              </div>

              <ViewSection
                titulo="📋 Informações"
                campos={camposUnificados
                  .filter(c => c.slug !== "status_venda" && c.slug !== "valor_plano" && c.slug !== "vendedor")
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
      <h3 style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</h3>
      {todosVazios ? (
        <p style={{ color: "#9ca3af", fontSize: 12, margin: 0, fontStyle: "italic" }}>Nenhuma informação cadastrada</p>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14, background: "#f9fafb", padding: 16, borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}>
          {campos.map(([label, valor]) => (
            <div key={label}>
              <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 }}>{label}</p>
              <p style={{
                color: valor || valor === false ? "#1f2937" : "#d1d5db",
                fontSize: 13, margin: "3px 0 0", wordBreak: "break-word",
                fontWeight: valor || valor === false ? 600 : 400,
              }}>
                {valor !== "" && valor !== null && valor !== undefined ? String(valor) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}