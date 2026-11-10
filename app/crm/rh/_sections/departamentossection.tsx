"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍💼 RH · Departamentos  (WolfSystem — multi-tenant · tabela 'departamentos')
// ───────────────────────────────────────────────────────────────────────
// PORTADO DO UNITA → WOLF. Isolamento por workspace_id em todas as queries.
// Coluna do banco: centro_custo. No app uso centroCusto (mapeado nas bordas).
// qtdFuncionarios = contagem real em 'funcionarios' por departamento (no ws).
// ═══════════════════════════════════════════════════════════════════════

const COR = "#059669";
const COR_TEXTO = "#065F46";
const card = { background: "#ffffff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const inputStyle = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box" as const, outline: "none" };

const PALETA = ["#059669", "#0369A1", "#C2410C", "#10b981", "#BE185D", "#0F766E", "#ef4444", "#14b8a6"];

type Departamento = { id: string; nome: string; gestor: string; centroCusto: string; descricao: string; qtdFuncionarios: number };
const FORM_VAZIO: Departamento = { id: "", nome: "", gestor: "", centroCusto: "", descricao: "", qtdFuncionarios: 0 };

export function DepartamentosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();

  const [lista, setLista] = useState<Departamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<Departamento>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = !!form.id;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🔌 Carrega departamentos + contagem de funcionários por departamento (isolado por workspace)
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const [depsResp, funcsResp] = await Promise.all([
      supabase.from("departamentos").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
      supabase.from("funcionarios").select("departamento").eq("workspace_id", wsId),
    ]);
    if (depsResp.error) { console.error(depsResp.error); alert("Erro ao carregar departamentos: " + depsResp.error.message); setCarregando(false); return; }
    const contagem: Record<string, number> = {};
    (funcsResp.data || []).forEach((f: any) => { if (f.departamento) contagem[f.departamento] = (contagem[f.departamento] || 0) + 1; });
    const mapeada: Departamento[] = (depsResp.data || []).map((d: any) => ({
      id: d.id, nome: d.nome, gestor: d.gestor || "", centroCusto: d.centro_custo || "", descricao: d.descricao || "",
      qtdFuncionarios: contagem[d.nome] || 0,
    }));
    setLista(mapeada);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [wsId]);

  const filtrados = useMemo(() => {
    if (!busca) return lista;
    const b = busca.toLowerCase();
    return lista.filter(d => d.nome.toLowerCase().includes(b) || d.gestor.toLowerCase().includes(b) || d.centroCusto.toLowerCase().includes(b));
  }, [lista, busca]);

  const totalPessoas = useMemo(() => lista.reduce((s, d) => s + d.qtdFuncionarios, 0), [lista]);
  const maior = useMemo(() => lista.reduce((a, b) => b.qtdFuncionarios > a.qtdFuncionarios ? b : a, lista[0] || FORM_VAZIO), [lista]);

  const abrirNovo = () => { setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEditar = (d: Departamento) => { setForm({ ...d }); setModalAberto(true); };
  const fechar = () => { setModalAberto(false); setForm(FORM_VAZIO); };

  // 🔌 insert / update (mapeando centroCusto -> centro_custo; carimba/filtra workspace)
  const salvar = async () => {
    if (!form.nome.trim()) { alert("Informe o nome do departamento."); return; }
    if (!wsId) { alert("Workspace não identificado. Recarregue a página."); return; }
    setSalvando(true);
    const payload = { nome: form.nome, gestor: form.gestor, centro_custo: form.centroCusto, descricao: form.descricao, workspace_id: wsId };
    const resp = editando
      ? await supabase.from("departamentos").update(payload).eq("id", form.id).eq("workspace_id", wsId)
      : await supabase.from("departamentos").insert(payload);
    setSalvando(false);
    if (resp.error) { alert("Erro ao salvar: " + resp.error.message); return; }
    fechar();
    carregar();
  };

  // 🔌 delete (filtra workspace)
  const excluir = async (d: Departamento) => {
    if (!wsId) return;
    if (!confirm(`Remover o departamento "${d.nome}"?`)) return;
    const { error } = await supabase.from("departamentos").delete().eq("id", d.id).eq("workspace_id", wsId);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    carregar();
  };

  const set = (campo: keyof Departamento, valor: any) => setForm(f => ({ ...f, [campo]: valor }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Departamentos</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}><b style={{ color: COR_TEXTO }}>{lista.length}</b> departamento(s) · {totalPessoas} pessoas</p>
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{ background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`, color: "white", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)", whiteSpace: "nowrap" }}>
          + Novo Departamento
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: "Departamentos", value: String(lista.length), cor: "#059669", icon: "🏢" },
          { label: "Pessoas alocadas", value: String(totalPessoas), cor: "#059669", icon: "👥" },
          { label: "Maior área", value: maior.nome || "—", cor: "#C2410C", icon: "🏆" },
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

      <div style={{ ...card, padding: 14 }}>
        <input placeholder="Buscar por nome, gestor ou centro de custo..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, borderRadius: 20 }} />
      </div>

      {carregando ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}><p style={{ color: "#64748B", fontSize: 13 }}>Carregando departamentos...</p></div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="busca" tamanho={24} /></span>
          <p style={{ color: "#64748B", fontSize: 13 }}>{lista.length === 0 ? "Nenhum departamento cadastrado ainda." : "Nenhum departamento encontrado"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtrados.map((d, i) => {
            const cor = PALETA[i % PALETA.length];
            const pct = totalPessoas ? Math.round((d.qtdFuncionarios / totalPessoas) * 100) : 0;
            return (
              <div key={d.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${cor}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏢</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</p>
                      <p style={{ color: "#94A3B8", fontSize: 11, margin: "2px 0 0" }}>{d.centroCusto || "—"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(d)} style={{ background: "#ECFDF5", color: COR_TEXTO, border: "1px solid #A7F3D0", borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}><Icone nome="editar" tamanho={15} /></button>
                    <button onClick={() => excluir(d)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}><Icone nome="lixeira" tamanho={15} /></button>
                  </div>
                </div>

                {d.descricao && <p style={{ color: "#64748B", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{d.descricao}</p>}

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{(d.gestor || "?").charAt(0)}</div>
                  <span style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>{d.gestor || "Sem gestor"}</span>
                  <span style={{ color: "#94A3B8", fontSize: 11 }}>· gestor</span>
                </div>

                <div style={{ borderTop: "1px solid #F1F5F4", paddingTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "#64748B", fontSize: 11, fontWeight: 600 }}>{d.qtdFuncionarios} pessoas</span>
                    <span style={{ color: cor, fontSize: 11, fontWeight: 700 }}>{pct}% do total</span>
                  </div>
                  <div style={{ height: 7, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: cor, borderRadius: 5 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div onClick={fechar} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E6ECEA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar Departamento" : "Novo Departamento"}</h3>
              <button onClick={fechar} style={{ background: "#F3F6F5", border: "none", color: "#64748B", fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center", cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <Campo label="Nome do departamento"><input value={form.nome} onChange={e => set("nome", e.target.value)} style={inputStyle} placeholder="Ex: Comercial" /></Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Gestor responsável"><input value={form.gestor} onChange={e => set("gestor", e.target.value)} style={inputStyle} placeholder="Nome do gestor" /></Campo>
                <Campo label="Centro de custo"><input value={form.centroCusto} onChange={e => set("centroCusto", e.target.value)} style={inputStyle} placeholder="CC-000" /></Campo>
              </div>
              <Campo label="Descrição">
                <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="O que esse departamento faz..." />
              </Campo>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E6ECEA", display: "flex", gap: 10, justifyContent: "flex-end", background: "#F7FAF9" }}>
              <button onClick={fechar} style={{ background: "#F3F6F5", color: "#334155", borderRadius: 10, padding: "9px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
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