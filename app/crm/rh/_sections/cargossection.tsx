"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍💼 RH · Cargos & Salários  (WolfSystem — multi-tenant · tabela 'cargos')
// PORTADO DO UNITA → WOLF. Isolamento por workspace_id em todas as queries.
// ───────────────────────────────────────────────────────────────────────
// Colunas do banco: sal_min, sal_med, sal_max (mapeadas p/ salMin/Med/Max).
// ocupantes = contagem real em 'funcionarios' por cargo (campo cargo = nome).
// ═══════════════════════════════════════════════════════════════════════

const COR = "#059669";
const COR_TEXTO = "#065F46";
const card = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const inputStyle = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box" as const, outline: "none" };

const DEPARTAMENTOS = ["Comercial", "Atendimento", "Financeiro", "TI", "Administrativo"];
const NIVEIS = ["Júnior", "Pleno", "Sênior", "Especialista", "Gestão"];
const NIVEL_COR: Record<string, string> = { "Júnior": "#0369A1", "Pleno": "#059669", "Sênior": "#0F766E", "Especialista": "#BE185D", "Gestão": "#C2410C" };

type Cargo = { id: string; nome: string; departamento: string; nivel: string; salMin: number; salMed: number; salMax: number; ocupantes: number };
const FORM_VAZIO: Cargo = { id: "", nome: "", departamento: DEPARTAMENTOS[0], nivel: NIVEIS[0], salMin: 0, salMed: 0, salMax: 0, ocupantes: 0 };
const real = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function CargosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Cargo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<Cargo>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = !!form.id;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🔌 Carrega cargos + contagem de ocupantes por cargo
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const [cargosResp, funcsResp] = await Promise.all([
      supabase.from("cargos").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
      supabase.from("funcionarios").select("cargo").eq("workspace_id", wsId),
    ]);
    if (cargosResp.error) { console.error(cargosResp.error); alert("Erro ao carregar cargos: " + cargosResp.error.message); setCarregando(false); return; }
    const contagem: Record<string, number> = {};
    (funcsResp.data || []).forEach((f: any) => { if (f.cargo) contagem[f.cargo] = (contagem[f.cargo] || 0) + 1; });
    const mapeada: Cargo[] = (cargosResp.data || []).map((c: any) => ({
      id: c.id, nome: c.nome, departamento: c.departamento || "", nivel: c.nivel || NIVEIS[0],
      salMin: Number(c.sal_min) || 0, salMed: Number(c.sal_med) || 0, salMax: Number(c.sal_max) || 0,
      ocupantes: contagem[c.nome] || 0,
    }));
    setLista(mapeada);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [wsId]);

  const filtrados = useMemo(() => {
    let l = lista;
    if (busca) { const b = busca.toLowerCase(); l = l.filter(c => c.nome.toLowerCase().includes(b) || c.departamento.toLowerCase().includes(b)); }
    if (filtroNivel !== "todos") l = l.filter(c => c.nivel === filtroNivel);
    return l;
  }, [lista, busca, filtroNivel]);

  const faixaMediaGeral = useMemo(() => lista.length ? Math.round(lista.reduce((s, c) => s + c.salMed, 0) / lista.length) : 0, [lista]);
  const totalOcupantes = useMemo(() => lista.reduce((s, c) => s + c.ocupantes, 0), [lista]);

  const abrirNovo = () => { setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEditar = (c: Cargo) => { setForm({ ...c }); setModalAberto(true); };
  const fechar = () => { setModalAberto(false); setForm(FORM_VAZIO); };

  // 🔌 insert / update (salMin/Med/Max -> sal_min/med/max)
  const salvar = async () => {
    if (!form.nome.trim()) { alert("Informe o nome do cargo."); return; }
    if (!wsId) { alert("Workspace não identificado. Recarregue a página."); return; }
    setSalvando(true);
    const payload = { nome: form.nome, departamento: form.departamento, nivel: form.nivel, sal_min: form.salMin || 0, sal_med: form.salMed || 0, sal_max: form.salMax || 0, workspace_id: wsId };
    const resp = editando
      ? await supabase.from("cargos").update(payload).eq("id", form.id).eq("workspace_id", wsId)
      : await supabase.from("cargos").insert(payload);
    setSalvando(false);
    if (resp.error) { alert("Erro ao salvar: " + resp.error.message); return; }
    fechar();
    carregar();
  };

  // 🔌 delete
  const excluir = async (c: Cargo) => {
    if (!wsId) return;
    if (!confirm(`Remover o cargo "${c.nome}"?`)) return;
    const { error } = await supabase.from("cargos").delete().eq("id", c.id).eq("workspace_id", wsId);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    carregar();
  };

  const set = (k: keyof Cargo, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Cargos & Salários</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}><b style={{ color: COR_TEXTO }}>{lista.length}</b> cargo(s) · {totalOcupantes} ocupantes</p>
          </div>
        </div>
        <button onClick={abrirNovo} style={{ background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`, color: "white", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)", whiteSpace: "nowrap" }}>+ Novo Cargo</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: "Cargos", value: String(lista.length), cor: "#059669", icon: "💼" },
          { label: "Ocupantes", value: String(totalOcupantes), cor: "#059669", icon: "👥" },
          { label: "Faixa média", value: real(faixaMediaGeral), cor: "#C2410C", icon: "💰" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.cor}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{<IconeEmoji e={s.icon} />}</div>
              <p style={{ color: "#64748B", fontSize: 11, margin: 0, fontWeight: 700 }}>{s.label}</p>
            </div>
            <p style={{ color: "#0F172A", fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Buscar por cargo ou departamento..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, flex: "1 1 280px", maxWidth: 460, borderRadius: 20 }} />
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="todos">Nível: Todos</option>
          {NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {carregando ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}><p style={{ color: "#64748B", fontSize: 13 }}>Carregando cargos...</p></div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}><span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="busca" tamanho={24} /></span><p style={{ color: "#64748B", fontSize: 13 }}>{lista.length === 0 ? "Nenhum cargo cadastrado ainda." : "Nenhum cargo encontrado"}</p></div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#F7FAF9" }}>
                {["Cargo", "Departamento", "Nível", "Mínimo", "Médio", "Máximo", "Ocupantes", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", color: "#64748B", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, borderBottom: "1px solid #E6ECEA" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtrados.map((c, i) => {
                  const nc = NIVEL_COR[c.nivel] || COR;
                  return (
                    <tr key={c.id} onClick={() => abrirEditar(c)} style={{ borderTop: "1px solid #F1F5F4", background: "#ffffff", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F7FAF9"} onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}>
                      <td style={{ padding: "12px 16px", color: "#0F172A", fontSize: 13, fontWeight: 700 }}>{c.nome}</td>
                      <td style={{ padding: "12px 16px", color: "#475569", fontSize: 12 }}>{c.departamento}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ background: `${nc}15`, color: nc, fontSize: 11, padding: "3px 10px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{c.nivel}</span></td>
                      <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}>{real(c.salMin)}</td>
                      <td style={{ padding: "12px 16px", color: "#0F172A", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{real(c.salMed)}</td>
                      <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}>{real(c.salMax)}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ background: "#ECFDF5", color: COR_TEXTO, border: "1px solid #A7F3D0", fontSize: 11, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{c.ocupantes}</span></td>
                      <td style={{ padding: "12px 16px" }}><button onClick={(e) => { e.stopPropagation(); excluir(c); }} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}><Icone nome="lixeira" tamanho={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAberto && (
        <div onClick={fechar} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 540, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E6ECEA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar Cargo" : "Novo Cargo"}</h3>
              <button onClick={fechar} style={{ background: "#F3F6F5", border: "none", color: "#64748B", fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center", cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <Campo label="Nome do cargo"><input value={form.nome} onChange={e => set("nome", e.target.value)} style={inputStyle} placeholder="Ex: Analista Comercial" /></Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Departamento"><select value={form.departamento} onChange={e => set("departamento", e.target.value)} style={inputStyle}>{DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}</select></Campo>
                <Campo label="Nível"><select value={form.nivel} onChange={e => set("nivel", e.target.value)} style={inputStyle}>{NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}</select></Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <Campo label="Salário mín."><input type="number" value={form.salMin || ""} onChange={e => set("salMin", Number(e.target.value))} style={inputStyle} /></Campo>
                <Campo label="Salário médio"><input type="number" value={form.salMed || ""} onChange={e => set("salMed", Number(e.target.value))} style={inputStyle} /></Campo>
                <Campo label="Salário máx."><input type="number" value={form.salMax || ""} onChange={e => set("salMax", Number(e.target.value))} style={inputStyle} /></Campo>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E6ECEA", display: "flex", gap: 10, justifyContent: "flex-end", background: "#F7FAF9" }}>
              <button onClick={fechar} style={{ background: "#ffffff", color: "#334155", border: "1px solid #E6ECEA", borderRadius: 10, padding: "9px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`, color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 13, cursor: salvando ? "wait" : "pointer", fontWeight: 700, boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)", opacity: salvando ? 0.7 : 1 }}>{salvando ? "Salvando..." : editando ? "Salvar" : "+ Cadastrar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label style={{ color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>{label}</label>{children}</div>);
}