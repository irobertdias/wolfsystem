"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Cadastro = {
  id: number; created_at: string; nome: string; empresa: string;
  email: string; whatsapp: string; plano: string; autorizado: boolean;
  workspace_id: string; usuarios_liberados?: number; conexoes_liberadas?: number;
  permite_webjs?: boolean; permite_waba?: boolean; permite_instagram?: boolean;
  ia?: string; senha?: string;
};

const planoPresets: Record<string, { usuarios: number; conexoes: number; webjs: boolean; waba: boolean; instagram: boolean }> = {
  basico:        { usuarios: 7,  conexoes: 1,  webjs: true,  waba: false, instagram: false },
  intermediario: { usuarios: 15, conexoes: 3,  webjs: true,  waba: true,  instagram: false },
  ultra:         { usuarios: 50, conexoes: 10, webjs: true,  waba: true,  instagram: true  },
};

export default function Clientes() {
  const router = useRouter();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loadingCadastros, setLoadingCadastros] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [showModalCliente, setShowModalCliente] = useState(false);
  const [showModalDetalhe, setShowModalDetalhe] = useState(false);
  const [cadastroSelecionado, setCadastroSelecionado] = useState<Cadastro | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [formCadastro, setFormCadastro] = useState<Partial<Cadastro>>({
    nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
    usuarios_liberados: 7, conexoes_liberadas: 1,
    permite_webjs: true, permite_waba: false, permite_instagram: false,
    ia: "gpt", autorizado: false, senha: "",
  });

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };
  const inputSm = { ...inputStyle, padding: "8px 12px", fontSize: 13 };

  const fetchCadastros = async () => {
    setLoadingCadastros(true);
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoadingCadastros(false);
  };

  useEffect(() => { fetchCadastros(); }, []);

  const autorizarCadastro = async (c: Cadastro) => {
    try {
      await supabase.from("cadastros").update({ autorizado: true }).eq("id", c.id);
      await fetchCadastros();
      alert(`✅ ${c.nome} autorizado!`);
    } catch { alert("Erro ao autorizar!"); }
  };

  const desautorizarCadastro = async (c: Cadastro) => {
    if (!confirm(`Desautorizar ${c.nome}?`)) return;
    await supabase.from("cadastros").update({ autorizado: false }).eq("id", c.id);
    await fetchCadastros();
  };

  const excluirCadastro = async (c: Cadastro) => {
    if (!confirm(`Excluir ${c.nome} permanentemente?`)) return;
    await supabase.from("cadastros").delete().eq("id", c.id);
    await fetchCadastros();
    setShowModalDetalhe(false);
    alert("✅ Cliente excluído!");
  };

  const abrirNovo = () => {
    setFormCadastro({ nome: "", empresa: "", email: "", whatsapp: "", plano: "basico", usuarios_liberados: 7, conexoes_liberadas: 1, permite_webjs: true, permite_waba: false, permite_instagram: false, ia: "gpt", autorizado: false, senha: "" });
    setCadastroSelecionado(null);
    setShowModalCliente(true);
  };

  const abrirEditar = (c: Cadastro) => {
    setFormCadastro({ ...c });
    setCadastroSelecionado(c);
    setShowModalCliente(true);
    setShowModalDetalhe(false);
  };

  const aplicarPresetPlano = (plano: string) => {
    const preset = planoPresets[plano];
    if (preset) setFormCadastro(prev => ({ ...prev, plano, usuarios_liberados: preset.usuarios, conexoes_liberadas: preset.conexoes, permite_webjs: preset.webjs, permite_waba: preset.waba, permite_instagram: preset.instagram }));
    else setFormCadastro(prev => ({ ...prev, plano }));
  };

  const salvarCadastro = async () => {
    if (!formCadastro.nome || !formCadastro.email) { alert("Nome e email são obrigatórios!"); return; }
    setSalvandoCliente(true);
    try {
      const dadosSalvar = { nome: formCadastro.nome, empresa: formCadastro.empresa, email: formCadastro.email, whatsapp: formCadastro.whatsapp, plano: formCadastro.plano, usuarios_liberados: formCadastro.usuarios_liberados, conexoes_liberadas: formCadastro.conexoes_liberadas, permite_webjs: formCadastro.permite_webjs, permite_waba: formCadastro.permite_waba, permite_instagram: formCadastro.permite_instagram, ia: formCadastro.ia, autorizado: formCadastro.autorizado };
      if (cadastroSelecionado) {
        await supabase.from("cadastros").update(dadosSalvar).eq("id", cadastroSelecionado.id);
        alert("✅ Cliente atualizado!");
      } else {
        await supabase.from("cadastros").insert([{ ...dadosSalvar, senha: formCadastro.senha }]);
        alert("✅ Cliente adicionado!");
      }
      await fetchCadastros();
      setShowModalCliente(false);
    } catch { alert("Erro ao salvar!"); }
    setSalvandoCliente(false);
  };

  const Toggle = ({ value, onChange, label, desc, color = "#16a34a" }: { value: boolean; onChange: () => void; label: string; desc?: string; color?: string }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", borderRadius: 8, padding: "12px 16px", border: "1px solid #374151" }}>
      <div>
        <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{label}</p>
        {desc && <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0 0" }}>{desc}</p>}
      </div>
      <button onClick={onChange} style={{ width: 44, height: 24, background: value ? color : "#374151", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s" }} />
      </button>
    </div>
  );

  const cadastrosFiltrados = cadastros
    .filter(c => filtroStatus === "todos" || (filtroStatus === "ativos" ? c.autorizado : !c.autorizado))
    .filter(c => !buscaCliente || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.email?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.empresa?.toLowerCase().includes(buscaCliente.toLowerCase()) || c.whatsapp?.includes(buscaCliente));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* MODAL CRIAR/EDITAR */}
      {showModalCliente && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 680, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente Wolf"}</h2>
              <button onClick={() => setShowModalCliente(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div>
              <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>👤 Dados Pessoais</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input placeholder="Nome completo" value={formCadastro.nome || ""} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} style={inputSm} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Empresa</label><input placeholder="Nome da empresa" value={formCadastro.empresa || ""} onChange={e => setFormCadastro({ ...formCadastro, empresa: e.target.value })} style={inputSm} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Email *</label><input placeholder="email@empresa.com" value={formCadastro.email || ""} onChange={e => setFormCadastro({ ...formCadastro, email: e.target.value })} style={inputSm} /></div>
                <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>WhatsApp</label><input placeholder="(62) 99999-9999" value={formCadastro.whatsapp || ""} onChange={e => setFormCadastro({ ...formCadastro, whatsapp: e.target.value })} style={inputSm} /></div>
                {!cadastroSelecionado && <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha</label><input type="password" placeholder="Senha de acesso" value={formCadastro.senha || ""} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} style={inputSm} /></div>}
              </div>
            </div>
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>📦 Plano</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ key: "basico", label: "Básico", color: "#16a34a", usuarios: 7, conexoes: 1 }, { key: "intermediario", label: "Intermediário", color: "#3b82f6", usuarios: 15, conexoes: 3 }, { key: "ultra", label: "Ultra", color: "#8b5cf6", usuarios: 50, conexoes: 10 }].map(p => (
                  <button key={p.key} onClick={() => aplicarPresetPlano(p.key)} style={{ flex: 1, background: formCadastro.plano === p.key ? `${p.color}22` : "#1f2937", border: `2px solid ${formCadastro.plano === p.key ? p.color : "#374151"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}>
                    <p style={{ color: formCadastro.plano === p.key ? p.color : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>{p.label}</p>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{p.usuarios} usuários • {p.conexoes} conexões</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>⚙️ Limites Personalizados</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>👥 Usuários Liberados</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 3, 5, 7, 10, 15, 20, 50].map(n => <button key={n} onClick={() => setFormCadastro({ ...formCadastro, usuarios_liberados: n })} style={{ background: formCadastro.usuarios_liberados === n ? "#f59e0b" : "#1f2937", color: formCadastro.usuarios_liberados === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>📱 Conexões Liberadas</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 5, 10, 15, 20].map(n => <button key={n} onClick={() => setFormCadastro({ ...formCadastro, conexoes_liberadas: n })} style={{ background: formCadastro.conexoes_liberadas === n ? "#3b82f6" : "#1f2937", color: formCadastro.conexoes_liberadas === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>{n}</button>)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Toggle value={!!formCadastro.permite_webjs} onChange={() => setFormCadastro({ ...formCadastro, permite_webjs: !formCadastro.permite_webjs })} label="📱 WhatsApp Web (QR Code)" desc="Conexão via QR Code — gratuita" color="#16a34a" />
              <Toggle value={!!formCadastro.permite_waba} onChange={() => setFormCadastro({ ...formCadastro, permite_waba: !formCadastro.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp Business" color="#3b82f6" />
              <Toggle value={!!formCadastro.permite_instagram} onChange={() => setFormCadastro({ ...formCadastro, permite_instagram: !formCadastro.permite_instagram })} label="📸 Instagram Direct" desc="Mensagens do Instagram Direct" color="#e1306c" />
            </div>
            <Toggle value={!!formCadastro.autorizado} onChange={() => setFormCadastro({ ...formCadastro, autorizado: !formCadastro.autorizado })} label="✅ Autorizado — Permitir acesso ao sistema" color="#16a34a" />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModalCliente(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvarCadastro} disabled={salvandoCliente} style={{ background: salvandoCliente ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvandoCliente ? "Salvando..." : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE */}
      {showModalDetalhe && cadastroSelecionado && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 620, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏢</div>
                <div>
                  <h2 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.nome}</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>{cadastroSelecionado.empresa || "Sem empresa"}</p>
                  <span style={{ background: cadastroSelecionado.autorizado ? "#16a34a22" : "#f59e0b22", color: cadastroSelecionado.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{cadastroSelecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                </div>
              </div>
              <button onClick={() => setShowModalDetalhe(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ label: "Email", value: cadastroSelecionado.email, icon: "✉️" }, { label: "WhatsApp", value: cadastroSelecionado.whatsapp, icon: "📱" }, { label: "Plano", value: cadastroSelecionado.plano, icon: "📦" }, { label: "IA", value: cadastroSelecionado.ia, icon: "🤖" }].filter(i => i.value).map(info => (
                <div key={info.label} style={{ background: "#1f2937", borderRadius: 8, padding: 12 }}>
                  <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", margin: "0 0 4px 0" }}>{info.icon} {info.label}</p>
                  <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{info.value}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>⚙️ Limites do Plano</p>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1, textAlign: "center", background: "#111", borderRadius: 8, padding: 12 }}>
                  <p style={{ color: "#f59e0b", fontSize: 28, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.usuarios_liberados || 1}</p>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>👥 Usuários</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#111", borderRadius: 8, padding: 12 }}>
                  <p style={{ color: "#3b82f6", fontSize: 28, fontWeight: "bold", margin: 0 }}>{cadastroSelecionado.conexoes_liberadas || 1}</p>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>📱 Conexões</p>
                </div>
              </div>
            </div>
            <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
              <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px 0" }}>🔗 Conexões Permitidas</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ key: "permite_webjs", label: "📱 WhatsApp Web", color: "#16a34a" }, { key: "permite_waba", label: "🔗 API Meta", color: "#3b82f6" }, { key: "permite_instagram", label: "📸 Instagram", color: "#e1306c" }].map(item => (
                  <span key={item.key} style={{ background: (cadastroSelecionado as any)[item.key] ? `${item.color}22` : "#11111133", color: (cadastroSelecionado as any)[item.key] ? item.color : "#6b7280", border: `1px solid ${(cadastroSelecionado as any)[item.key] ? item.color + "44" : "#374151"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: "bold" }}>
                    {(cadastroSelecionado as any)[item.key] ? "✓" : "✗"} {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!cadastroSelecionado.autorizado
                ? <button onClick={() => { autorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Autorizar Acesso</button>
                : <button onClick={() => { desautorizarCadastro(cadastroSelecionado); setShowModalDetalhe(false); }} style={{ flex: 1, background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🚫 Desautorizar</button>
              }
              <button onClick={() => abrirEditar(cadastroSelecionado)} style={{ flex: 1, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✏️ Editar</button>
              <button onClick={() => excluirCadastro(cadastroSelecionado)} style={{ flex: 1, background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🗑️ Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🏢 Clientes Wolf System</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>{cadastros.filter(c => c.autorizado).length} ativos • {cadastros.filter(c => !c.autorizado).length} pendentes • {cadastros.length} total</p>
        </div>
        <button onClick={abrirNovo} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Cliente</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {[{ label: "Total", value: cadastros.length, color: "#8b5cf6", icon: "📊" }, { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a", icon: "✅" }, { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b", icon: "⏳" }].map(card => (
          <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar por nome, email, empresa, WhatsApp..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} style={{ ...inputStyle, maxWidth: 380, padding: "8px 14px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {[{ key: "todos", label: "Todos", color: "#8b5cf6" }, { key: "ativos", label: "✅ Ativos", color: "#16a34a" }, { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" }].map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtroStatus === f.key ? f.color : "#1f2937", color: filtroStatus === f.key ? "white" : "#9ca3af" }}>{f.label}</button>
          ))}
        </div>
      </div>

      {loadingCadastros ? <p style={{ color: "#6b7280" }}>Carregando...</p> : cadastrosFiltrados.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>🏢</p>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum cliente encontrado</h3>
          <button onClick={abrirNovo} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold", marginTop: 12 }}>+ Novo Cliente</button>
        </div>
      ) : (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d0d0d" }}>
                {["Cliente", "Email", "Plano", "👥 Usuários", "📱 Conexões", "Permite", "Status", "Ações"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cadastrosFiltrados.map((c, i) => (
                <tr key={c.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                  <td style={{ padding: "14px 16px" }}><div><p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{c.nome}</p>{c.empresa && <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.empresa}</p>}</div></td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12 }}>{c.email}</td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: c.plano === "ultra" ? "#8b5cf622" : c.plano === "intermediario" ? "#3b82f622" : "#16a34a22", color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.plano === "intermediario" ? "Intermediário" : c.plano === "ultra" ? "Ultra" : "Básico"}</span></td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.usuarios_liberados || 1}</span></td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.conexoes_liberadas || 1}</span></td>
                  <td style={{ padding: "14px 16px" }}><div style={{ display: "flex", gap: 4 }}>{c.permite_webjs && <span style={{ fontSize: 14 }} title="WhatsApp Web">📱</span>}{c.permite_waba && <span style={{ fontSize: 14 }} title="API Meta">🔗</span>}{c.permite_instagram && <span style={{ fontSize: 14 }} title="Instagram">📸</span>}</div></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: c.autorizado ? "#16a34a22" : "#f59e0b22", color: c.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span></td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setCadastroSelecionado(c); setShowModalDetalhe(true); }} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>👁️</button>
                      {!c.autorizado ? <button onClick={() => autorizarCadastro(c)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>✅</button> : <button onClick={() => desautorizarCadastro(c)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🚫</button>}
                      <button onClick={() => abrirEditar(c)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => excluirCadastro(c)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}