"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import {
  SECOES_LABEL,
  montarCamposUnificados,
  type CampoUnificado,
  type ConfigCampoPadrao,
  type CampoCustom,
} from "../../lib/campos_proposta_definicao";

type UsuarioWs = { email: string; nome: string; };

function PropostaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace } = useWorkspace();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const [loading, setLoading] = useState(false);

  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [podeEscolherVendedor, setPodeEscolherVendedor] = useState<boolean>(false);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);

  const [camposUnificados, setCamposUnificados] = useState<CampoUnificado[]>([]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [form, setForm] = useState<Record<string, any>>({
    data_proposta: new Date().toISOString().split("T")[0],
    nome: searchParams.get("nome") || "",
    telefone1: searchParams.get("numero") || "",
    status_venda: "PENDENTE",
  });

  const [dadosCustomizados, setDadosCustomizados] = useState<Record<string, any>>({});

  useEffect(() => {
    const carregar = async () => {
      if (!workspace?.username) return;
      setCarregandoUsuarios(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCarregandoUsuarios(false); return; }
        setUserEmail(user.email || "");

        const { data: ws } = await supabase.from("workspaces")
          .select("owner_id, owner_email, nome, username, id")
          .or(`username.eq.${workspace.username},id.eq.${workspace.username}`)
          .maybeSingle();
        const userEhDono = ws?.owner_id === user.id;
        const { data: subs } = await supabase.from("usuarios_workspace")
          .select("email, nome, perfil, grupo_id")
          .eq("workspace_id", workspace.username);

        const lista: UsuarioWs[] = [];
        if (ws?.owner_email) lista.push({ email: ws.owner_email, nome: ws.nome || "Dono" });
        for (const s of (subs || [])) {
          if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
            lista.push({ email: s.email, nome: s.nome || s.email });
          }
        }
        setUsuariosWs(lista);

        let pode = userEhDono;
        if (!pode) {
          const uw = (subs || []).find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
          if (uw?.perfil === "Administrador") pode = true;
          else if (uw?.grupo_id) {
            const { data: gp } = await supabase.from("grupos_permissao")
              .select("permissoes").eq("id", uw.grupo_id).maybeSingle();
            if (gp?.permissoes?.vendas_equipe === true) pode = true;
          }
        }
        setPodeEscolherVendedor(pode);

        setForm(p => ({ ...p, vendedor: user.email || "" }));

        const [respConfig, respCustom] = await Promise.all([
          supabase.from("proposta_campos_padrao_config")
            .select("*")
            .eq("workspace_id", workspace.username),
          supabase.from("proposta_campos_customizados")
            .select("*")
            .eq("workspace_id", workspace.username)
            .eq("ativo", true)
            .order("ordem", { ascending: true }),
        ]);

        const configs: ConfigCampoPadrao[] = (respConfig.data || []).map((c: any) => ({
          id: c.id,
          campo_slug: c.campo_slug,
          label_custom: c.label_custom,
          obrigatorio: c.obrigatorio,
          visivel: c.visivel,
          ordem: c.ordem,
          opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" && c.opcoes ? JSON.parse(c.opcoes) : null),
          placeholder_custom: c.placeholder_custom,
        }));
        const customs: CampoCustom[] = (respCustom.data || []).map((c: any) => ({
          id: c.id,
          slug: c.slug,
          label: c.label,
          tipo: c.tipo,
          obrigatorio: c.obrigatorio,
          ordem: c.ordem,
          opcoes: Array.isArray(c.opcoes) ? c.opcoes : (typeof c.opcoes === "string" ? JSON.parse(c.opcoes) : []),
          placeholder: c.placeholder,
          ativo: c.ativo,
        }));

        const lista2 = montarCamposUnificados(configs, customs).filter(c => c.visivel);
        setCamposUnificados(lista2);

        const initDados: Record<string, any> = {};
        for (const c of lista2) {
          if (c.origem === "custom") {
            initDados[c.slug] = c.tipo === "checkbox" ? false : "";
          }
        }
        setDadosCustomizados(initDados);
      } catch (e) { console.error("Erro ao carregar:", e); }
      setCarregandoUsuarios(false);
    };
    carregar();
  }, [workspace]);

  const handleSubmit = async () => {
    if (!isDono && !isSuperAdmin && !permissoes.proposta_criar) {
      alert("❌ Você não tem permissão para criar propostas.");
      return;
    }

    for (const c of camposUnificados) {
      if (!c.obrigatorio) continue;
      const valor = c.origem === "fixo" ? form[c.slug] : dadosCustomizados[c.slug];
      const vazio = c.tipo === "checkbox" ? valor !== true : (valor === undefined || valor === null || String(valor).trim() === "");
      if (vazio) {
        alert(`O campo "${c.label}" é obrigatório.`);
        return;
      }
    }

    if (!workspace) {
      alert("Workspace não encontrado!");
      return;
    }

    setLoading(true);

    const payload: any = {
      data_proposta: form.data_proposta || null,
      nome: form.nome || "",
      cpf: form.cpf || "",
      data_nascimento: form.data_nascimento || null,
      nome_mae: form.nome_mae || "",
      rg: form.rg || "",
      email: form.email || "",
      endereco: form.endereco || "",
      cep: form.cep || "",
      cidade: form.cidade || "",
      estado: form.estado || "",
      telefone1: form.telefone1 || "",
      telefone2: form.telefone2 || "",
      telefone3: form.telefone3 || "",
      vencimento: form.vencimento || "",
      forma_pagamento: form.forma_pagamento || "",
      plano: form.plano || "",
      valor_plano: form.valor_plano ? Number(form.valor_plano) : null,
      data_agendamento: form.data_agendamento || null,
      periodo_instalacao: form.periodo_instalacao || "",
      vendedor: form.vendedor || "",
      status_venda: form.status_venda || "PENDENTE",
      data_instalacao: form.data_instalacao || null,
      data_cancelamento: form.data_cancelamento || null,
      operadora: form.operadora || "",
      workspace_id: workspace.username,
      dados_customizados: dadosCustomizados,
    };

    const { error } = await supabase.from("proposta").insert([payload]);
    setLoading(false);

    if (error) {
      alert("Erro ao salvar proposta: " + error.message);
      return;
    }
    alert("Proposta cadastrada com sucesso!");
    router.push("/crm/vendas");
  };

  // 🎨 ESTILOS LIGHT TECH
  const inputStyle = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#1f2937",
    fontSize: 14,
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const labelStyle = {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    display: "block" as const,
    fontWeight: 700,
  };
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };

  // ═══ Renderização DINÂMICA ═══
  const renderCampoVendedor = () => {
    if (carregandoUsuarios) {
      return <input value="⏳ Carregando vendedores..." disabled style={{ ...inputStyle, background: "#f3f4f6", color: "#9ca3af", opacity: 0.7 }} />;
    }
    if (podeEscolherVendedor) {
      return (
        <select value={form.vendedor || ""} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} style={inputStyle}>
          <option value="">Selecione o vendedor...</option>
          {usuariosWs.map(u => (
            <option key={u.email} value={u.email}>
              {u.nome} {u.email === userEmail ? "(você)" : ""}
            </option>
          ))}
        </select>
      );
    }
    const meuNome = usuariosWs.find(u => u.email?.toLowerCase() === userEmail.toLowerCase())?.nome || userEmail;
    return (
      <input value={`${meuNome} (você)`} disabled
        style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
        title="Você só pode cadastrar propostas em seu próprio nome" />
    );
  };

  const renderCampo = (c: CampoUnificado) => {
    const labelComObr = (
      <>
        {c.label}
        {c.obrigatorio && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
      </>
    );

    // ── FIXOS ──
    if (c.origem === "fixo") {
      const val = form[c.slug];
      const set = (v: any) => setForm({ ...form, [c.slug]: v });

      if (c.tipo === "vendedor") {
        return (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
            <label style={labelStyle}>{labelComObr}</label>
            {renderCampoVendedor()}
          </div>
        );
      }

      const valorEfetivo = c.slug === "status_venda" ? (val || "PENDENTE") : (val ?? "");

      let input;
      if (c.tipo === "data") {
        input = <input type="date" value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      } else if (c.tipo === "email") {
        input = <input type="email" placeholder={c.placeholder || ""} value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      } else if (c.tipo === "numero") {
        input = <input type="number" placeholder={c.placeholder || ""} value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      } else if (c.tipo === "moeda") {
        input = <input type="number" step="0.01" placeholder={c.placeholder || ""} value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      } else if (c.tipo === "telefone") {
        input = <input type="tel" placeholder={c.placeholder || ""} value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      } else if (c.tipo === "dropdown") {
        const placeholderLabel = c.slug === "vencimento" ? "Selecione..." : c.slug === "periodo_instalacao" ? "Selecione..." : c.slug === "forma_pagamento" ? "Selecione..." : null;
        const prefixoVenc = c.slug === "vencimento";
        input = (
          <select value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle}>
            {placeholderLabel && <option value="">{placeholderLabel}</option>}
            {(c.opcoes || []).map(op => (
              <option key={op} value={op}>{prefixoVenc ? `Dia ${op}` : op}</option>
            ))}
          </select>
        );
      } else {
        input = <input placeholder={c.placeholder || ""} value={valorEfetivo} onChange={e => set(e.target.value)} style={inputStyle} />;
      }
      return (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          <label style={labelStyle}>{labelComObr}</label>
          {input}
        </div>
      );
    }

    // ── CUSTOM ──
    const val = dadosCustomizados[c.slug];
    const set = (v: any) => setDadosCustomizados(prev => ({ ...prev, [c.slug]: v }));

    let input;
    if (c.tipo === "textarea") {
      input = <textarea placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} rows={3}
        style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />;
    } else if (c.tipo === "numero") {
      input = <input type="number" placeholder={c.placeholder || "0"} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} />;
    } else if (c.tipo === "moeda") {
      input = <input type="number" step="0.01" placeholder={c.placeholder || "0,00"} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} />;
    } else if (c.tipo === "data") {
      input = <input type="date" value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} />;
    } else if (c.tipo === "dropdown") {
      input = (
        <select value={val || ""} onChange={e => set(e.target.value)} style={inputStyle}>
          <option value="">Selecione...</option>
          {(c.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
        </select>
      );
    } else if (c.tipo === "checkbox") {
      const marcado = val === true;
      return (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          <label style={labelStyle}>{labelComObr}</label>
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: marcado ? "#f0fdf4" : "#ffffff",
            borderRadius: 10,
            border: `1px solid ${marcado ? "#bbf7d0" : "#e5e7eb"}`,
            cursor: "pointer",
            transition: "all 0.15s",
          }}>
            <input type="checkbox" checked={marcado} onChange={e => set(e.target.checked)} style={{ accentColor: "#16a34a", width: 17, height: 17, cursor: "pointer" }} />
            <span style={{ color: marcado ? "#16a34a" : "#6b7280", fontSize: 13, fontWeight: 600 }}>{marcado ? "Sim" : "Não"}</span>
          </label>
        </div>
      );
    } else {
      input = <input placeholder={c.placeholder || ""} value={val || ""} onChange={e => set(e.target.value)} style={inputStyle} />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
        <label style={labelStyle}>{labelComObr}</label>
        {input}
      </div>
    );
  };

  // ═══ Sem permissão ═══
  if (!isDono && !isSuperAdmin && !permissoes.proposta_criar) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>Você não tem permissão para criar propostas.</p>
          <button onClick={() => router.back()}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              color: "white", border: "none", borderRadius: 12,
              padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial, sans-serif", padding: isMobile ? 12 : 32 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", marginBottom: isMobile ? 16 : 28, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div style={{
            width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14,
            background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(31,41,55,0.25)",
            flexShrink: 0, padding: 6,
          }}>
            <img src="/logo1.png" alt="Wolf" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 18 : 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Nova Proposta</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Wolf CRM · <b>{workspace?.nome}</b>
            </p>
          </div>
        </div>
        <button onClick={() => router.push("/crm/vendas")}
          style={{
            background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb",
            borderRadius: 10, padding: "9px 18px", fontSize: 13, cursor: "pointer",
            whiteSpace: "nowrap", fontWeight: 600,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
          ← Voltar para Vendas
        </button>
      </div>

      {/* ═══ FORM CARD ═══ */}
      <div style={{ ...cardStyle, padding: isMobile ? 18 : 32, display: "flex", flexDirection: "column", gap: isMobile ? 18 : 24 }}>

        {camposUnificados.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 13 }}>⏳ Carregando formulário...</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 14 : 18 }}>
            {camposUnificados.map(c => (
              <div key={`${c.origem}-${c.slug}`} style={c.larguraTotal || c.tipo === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                {renderCampo(c)}
              </div>
            ))}
          </div>
        )}

        {/* Divisor */}
        <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />

        {/* Botões */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column-reverse" : "row", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/crm/vendas")}
            style={{
              background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb",
              borderRadius: 10, padding: "11px 24px", fontSize: 14, cursor: "pointer", fontWeight: 600,
            }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading}
            style={{
              background: loading ? "#15803d" : "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
              color: "white", border: "none", borderRadius: 10,
              padding: "11px 32px", fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}>
            {loading ? "⏳ Salvando..." : "💾 Salvar Proposta"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NovaProposta() {
  return (
    <Suspense fallback={
      <div style={{ background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280" }}>Carregando...</p>
      </div>
    }>
      <PropostaForm />
    </Suspense>
  );
}