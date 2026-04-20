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
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [selecionado, setSelecionado] = useState<Cadastro | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Partial<Cadastro>>({
    nome: "", empresa: "", email: "", whatsapp: "", plano: "basico",
    usuarios_liberados: 7, conexoes_liberadas: 1,
    permite_webjs: true, permite_waba: false, permite_instagram: false,
    ia: "gpt", autorizado: false, senha: "",
  });

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("cadastros").select("*").order("created_at", { ascending: false });
    setCadastros(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const autorizar = async (c: Cadastro) => {
    await supabase.from("cadastros").update({ autorizado: true }).eq("id", c.id);
    await fetch();
  };

  const desautorizar = async (c: Cadastro) => {
    if (!confirm(`Desautorizar ${c.nome}?`)) return;
    await supabase.from("cadastros").update({ autorizado: false }).eq("id", c.id);
    await fetch();
  };

  const excluir = async (c: Cadastro) => {
    if (!confirm(`Excluir ${c.nome} permanentemente?`)) return;
    await supabase.from("cadastros").delete().eq("id", c.id);
    await fetch();
    setShowDetalhe(false);
  };

  const abrirNovo = () => {
    setForm({ nome: "", empresa: "", email: "", whatsapp: "", plano: "basico", usuarios_liberados: 7, conexoes_liberadas: 1, permite_webjs: true, permite_waba: false, permite_instagram: false, ia: "gpt", autorizado: false, senha: "" });
    setSelecionado(null);
    setShowModal(true);
  };

  const abrirEditar = (c: Cadastro) => {
    setForm({ ...c });
    setSelecionado(c);
    setShowModal(true);
    setShowDetalhe(false);
  };

  const aplicarPlano = (plano: string) => {
    const p = planoPresets[plano];
    if (p) setForm(prev => ({ ...prev, plano, usuarios_liberados: p.usuarios, conexoes_liberadas: p.conexoes, permite_webjs: p.webjs, permite_waba: p.waba, permite_instagram: p.instagram }));
    else setForm(prev => ({ ...prev, plano }));
  };

  const salvar = async () => {
    if (!form.nome || !form.email) { alert("Nome e email obrigatórios!"); return; }
    setSalvando(true);
    const dados = { nome: form.nome, empresa: form.empresa, email: form.email, whatsapp: form.whatsapp, plano: form.plano, usuarios_liberados: form.usuarios_liberados, conexoes_liberadas: form.conexoes_liberadas, permite_webjs: form.permite_webjs, permite_waba: form.permite_waba, permite_instagram: form.permite_instagram, ia: form.ia, autorizado: form.autorizado };
    if (selecionado) {
      await supabase.from("cadastros").update(dados).eq("id", selecionado.id);
    } else {
      await supabase.from("cadastros").insert([{ ...dados, senha: form.senha }]);
    }
    await fetch();
    setShowModal(false);
    setSalvando(false);
  };

  const Toggle = ({ value, onChange, label, desc, color = "#16a34a" }: { value: boolean; onChange: () => void; label: string; desc?: string; color?: string }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", borderRadius: 8, padding: "12px 16px", border: "1px solid #374151" }}>
      <div>
        <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{label}</p>
        {desc && <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>{desc}</p>}
      </div>
      <button onClick={onChange} style={{ width: 44, height: 24, background: value ? color : "#374151", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s" }} />
      </button>
    </div>
  );

  const filtrados = cadastros
    .filter(c => filtroStatus === "todos" || (filtroStatus === "ativos" ? c.autorizado : !c.autorizado))
    .filter(c => !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.email?.toLowerCase().includes(busca.toLowerCase()) || c.empresa?.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* MODAL EDITAR/CRIAR */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 680, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{selecionado ? "✏️ Editar Cliente" : "➕ Novo Cliente"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label><input value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Empresa</label><input value={form.empresa || ""} onChange={e => setForm({ ...form, empresa: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Email *</label><input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} style={IS} /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>WhatsApp</label><input value={form.whatsapp || ""} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={IS} /></div>
              {!selecionado && <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Senha</label><input type="password" value={form.senha || ""} onChange={e => setForm({ ...form, senha: e.target.value })} style={IS} /></div>}
            </div>
            <div>
              <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 12px" }}>📦 Plano</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ key: "basico", label: "Básico", color: "#16a34a" }, { key: "intermediario", label: "Intermediário", color: "#3b82f6" }, { key: "ultra", label: "Ultra", color: "#8b5cf6" }].map(p => (
                  <button key={p.key} onClick={() => aplicarPlano(p.key)} style={{ flex: 1, background: form.plano === p.key ? `${p.color}22` : "#1f2937", border: `2px solid ${form.plano === p.key ? p.color : "#374151"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer" }}>
                    <p style={{ color: form.plano === p.key ? p.color : "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>👥 Usuários</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[1, 3, 5, 7, 10, 15, 20, 50].map(n => <button key={n} onClick={() => setForm({ ...form, usuarios_liberados: n })} style={{ background: form.usuarios_liberados === n ? "#f59e0b" : "#1f2937", color: form.usuarios_liberados === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{n}</button>)}
                </div>
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>📱 Conexões</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[1, 2, 3, 5, 10, 15, 20].map(n => <button key={n} onClick={() => setForm({ ...form, conexoes_liberadas: n })} style={{ background: form.conexoes_liberadas === n ? "#3b82f6" : "#1f2937", color: form.conexoes_liberadas === n ? "white" : "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{n}</button>)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Toggle value={!!form.permite_webjs} onChange={() => setForm({ ...form, permite_webjs: !form.permite_webjs })} label="📱 WhatsApp Web" desc="Conexão via QR Code" color="#16a34a" />
              <Toggle value={!!form.permite_waba} onChange={() => setForm({ ...form, permite_waba: !form.permite_waba })} label="🔗 API Meta (WABA)" desc="API oficial do WhatsApp" color="#3b82f6" />
              <Toggle value={!!form.permite_instagram} onChange={() => setForm({ ...form, permite_instagram: !form.permite_instagram })} label="📸 Instagram Direct" color="#e1306c" />
              <Toggle value={!!form.autorizado} onChange={() => setForm({ ...form, autorizado: !form.autorizado })} label="✅ Autorizado" desc="Permitir acesso ao sistema" color="#16a34a" />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background: salvando ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE */}
      {showDetalhe && selecionado && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 560, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: selecionado.autorizado ? "#16a34a22" : "#f59e0b22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏢</div>
                <div>
                  <h2 style={{ color: "white", fontSize: 20, fontWeight: "bold", margin: 0 }}>{selecionado.nome}</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>{selecionado.empresa || "Sem empresa"}</p>
                  <span style={{ background: selecionado.autorizado ? "#16a34a22" : "#f59e0b22", color: selecionado.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{selecionado.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span>
                </div>
              </div>
              <button onClick={() => setShowDetalhe(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ label: "Email", value: selecionado.email, icon: "✉️" }, { label: "WhatsApp", value: selecionado.whatsapp, icon: "📱" }, { label: "Plano", value: selecionado.plano, icon: "📦" }, { label: "Usuários", value: String(selecionado.usuarios_liberados || 1), icon: "👥" }].filter(i => i.value).map(info => (
                <div key={info.label} style={{ background: "#1f2937", borderRadius: 8, padding: 12 }}>
                  <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", margin: "0 0 4px" }}>{info.icon} {info.label}</p>
                  <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{info.value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!selecionado.autorizado
                ? <button onClick={() => { autorizar(selecionado); setShowDetalhe(false); }} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Autorizar</button>
                : <button onClick={() => { desautorizar(selecionado); setShowDetalhe(false); }} style={{ flex: 1, background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🚫 Desautorizar</button>
              }
              <button onClick={() => abrirEditar(selecionado)} style={{ flex: 1, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✏️ Editar</button>
              <button onClick={() => excluir(selecionado)} style={{ flex: 1, background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🗑️ Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🏢 Clientes Wolf System</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{cadastros.filter(c => c.autorizado).length} ativos • {cadastros.filter(c => !c.autorizado).length} pendentes</p>
        </div>
        <button onClick={abrirNovo} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Cliente</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {[{ label: "Total", value: cadastros.length, color: "#8b5cf6" }, { label: "Ativos", value: cadastros.filter(c => c.autorizado).length, color: "#16a34a" }, { label: "Pendentes", value: cadastros.filter(c => !c.autorizado).length, color: "#f59e0b" }].map(card => (
          <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>{card.label}</p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, minWidth: 280 }} />
        {[{ key: "todos", label: "Todos", color: "#8b5cf6" }, { key: "ativos", label: "✅ Ativos", color: "#16a34a" }, { key: "pendentes", label: "⏳ Pendentes", color: "#f59e0b" }].map(f => (
          <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: filtroStatus === f.key ? f.color : "#1f2937", color: filtroStatus === f.key ? "white" : "#9ca3af" }}>{f.label}</button>
        ))}
      </div>

      <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0d0d0d" }}>
              {["Cliente", "Email", "Plano", "👥", "📱", "Status", "Ações"].map(h => (
                <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>Carregando...</td></tr>
              : filtrados.map((c, i) => (
                <tr key={c.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d" }}>
                  <td style={{ padding: "14px 16px" }}><p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{c.nome}</p>{c.empresa && <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.empresa}</p>}</td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12 }}>{c.email}</td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: c.plano === "ultra" ? "#8b5cf622" : c.plano === "intermediario" ? "#3b82f622" : "#16a34a22", color: c.plano === "ultra" ? "#8b5cf6" : c.plano === "intermediario" ? "#3b82f6" : "#16a34a", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.plano === "intermediario" ? "Inter." : c.plano === "ultra" ? "Ultra" : "Básico"}</span></td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 12, padding: "3px 8px", borderRadius: 20 }}>{c.usuarios_liberados || 1}</span></td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "3px 8px", borderRadius: 20 }}>{c.conexoes_liberadas || 1}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: c.autorizado ? "#16a34a22" : "#f59e0b22", color: c.autorizado ? "#16a34a" : "#f59e0b", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.autorizado ? "✅ Ativo" : "⏳ Pendente"}</span></td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setSelecionado(c); setShowDetalhe(true); }} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>👁️</button>
                      {!c.autorizado ? <button onClick={() => autorizar(c)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✅</button> : <button onClick={() => desautorizar(c)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🚫</button>}
                      <button onClick={() => abrirEditar(c)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => excluir(c)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}