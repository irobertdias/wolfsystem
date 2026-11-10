"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";
import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Vagas (CONECTADO — 'vagas'; abertaEm↔aberta_em; candidatos = contagem em 'candidatos' por vaga)
const COR = "#059669";
const COR_TEXTO = "#065F46";
const card = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)",
};
const inputStyle = {
  width: "100%",
  background: "#F7FAF9",
  border: "1px solid #E6ECEA",
  borderRadius: 12,
  padding: "11px 14px",
  color: "#0F172A",
  fontSize: 14,
  fontWeight: 600,
  boxSizing: "border-box" as const,
  outline: "none",
};
const REGIMES = ["CLT", "PJ", "Estágio", "Temporário"];
const dataBR = (iso: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};
type StatusV = "aberta" | "em_analise" | "fechada";
type Vaga = {
  id: string;
  titulo: string;
  departamento: string;
  regime: string;
  salario: string;
  status: StatusV;
  abertaEm: string;
  candidatos: number;
};
const ST: Record<StatusV, { label: string; cor: string }> = {
  aberta: { label: "Aberta", cor: "#059669" },
  em_analise: { label: "Em análise", cor: "#C2410C" },
  fechada: { label: "Fechada", cor: "#64748B" },
};
const FORM_VAZIO: Vaga = {
  id: "",
  titulo: "",
  departamento: "",
  regime: REGIMES[0],
  salario: "",
  status: "aberta",
  abertaEm: "",
  candidatos: 0,
};
export function VagasSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Vaga[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | StatusV>("todos");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Vaga>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const [vagasR, candR] = await Promise.all([
      supabase.from("vagas").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
      supabase.from("candidatos").select("vaga").eq("workspace_id", wsId),
    ]);
    if (vagasR.error) {
      console.error(vagasR.error);
      alert("Erro: " + vagasR.error.message);
      setCarregando(false);
      return;
    }
    const cont: Record<string, number> = {};
    (candR.data || []).forEach((c: any) => {
      if (c.vaga) cont[c.vaga] = (cont[c.vaga] || 0) + 1;
    });
    setLista(
      (vagasR.data || []).map((v: any) => ({
        id: v.id,
        titulo: v.titulo,
        departamento: v.departamento || "",
        regime: v.regime || REGIMES[0],
        salario: v.salario || "",
        status: (v.status || "aberta") as StatusV,
        abertaEm: v.aberta_em || "",
        candidatos: cont[v.titulo] || 0,
      }))
    );
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);
  const filtrados = useMemo(
    () => (filtro === "todos" ? lista : lista.filter((v) => v.status === filtro)),
    [lista, filtro]
  );
  const stats = useMemo(
    () => ({
      abertas: lista.filter((v) => v.status === "aberta").length,
      candidatos: lista.reduce((s, v) => s + v.candidatos, 0),
      total: lista.length,
    }),
    [lista]
  );
  const salvar = async () => {
    if (!form.titulo.trim()) {
      alert("Informe o título da vaga.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setSalvando(true);
    const payload = {
      titulo: form.titulo,
      departamento: form.departamento,
      regime: form.regime,
      salario: form.salario,
      status: form.status,
      aberta_em: form.abertaEm || null,
      workspace_id: wsId,
    };
    const { error } = form.id
      ? await supabase.from("vagas").update(payload).eq("id", form.id).eq("workspace_id", wsId)
      : await supabase.from("vagas").insert(payload);
    setSalvando(false);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const abrirEditar = (v: Vaga) => {
    setForm(v);
    setModal(true);
  };
  const excluir = async (v: Vaga) => {
    if (!wsId) return;
    if (!confirm(`Remover a vaga "${v.titulo}"?`)) return;
    const { error } = await supabase.from("vagas").delete().eq("id", v.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof Vaga, val: any) => setForm((f) => ({ ...f, [k]: val }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
              Vagas
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Posições abertas e recrutamento
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setForm(FORM_VAZIO);
            setModal(true);
          }}
          style={{
            background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "11px 20px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
            boxShadow: "0 12px 24px -12px rgba(5,150,105,.7)",
            whiteSpace: "nowrap",
          }}
        >
          + Nova Vaga
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {[
          { label: "Vagas abertas", value: String(stats.abertas), cor: "#059669", icon: "📢" },
          { label: "Candidatos", value: String(stats.candidatos), cor: "#059669", icon: "👥" },
          { label: "Total de vagas", value: String(stats.total), cor: "#0369A1", icon: "📋" },
        ].map((s) => (
          <div key={s.label} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${s.cor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                {<IconeEmoji e={s.icon} />}
              </div>
              <p
                style={{
                  color: "#64748B",
                  fontSize: 13,
                  margin: 0,
                  fontWeight: 700,
                }}
              >
                {s.label}
              </p>
            </div>
            <p style={{ color: "#0F172A", fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(
          [["todos", "Todas"], ...Object.entries(ST).map(([k, v]) => [k, v.label])] as [string, string][]
        ).map(([k, lbl]) => {
          const a = filtro === k;
          const cor = k === "todos" ? COR : ST[k as StatusV].cor;
          return (
            <button
              key={k}
              onClick={() => setFiltro(k as any)}
              style={{
                background: a ? `${cor}15` : "#F7FAF9",
                color: a ? cor : "#64748B",
                border: `1px solid ${a ? cor + "50" : "#E6ECEA"}`,
                borderRadius: 10,
                padding: "7px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: a ? 700 : 600,
              }}
            >
              {lbl}
            </button>
          );
        })}
      </div>
      {carregando ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Carregando...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="busca" tamanho={24} /></span>
          <p style={{ color: "#64748B", fontSize: 13 }}>
            {lista.length === 0 ? "Nenhuma vaga cadastrada." : "Nada com esse filtro"}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {filtrados.map((v) => {
            const st = ST[v.status];
            return (
              <div
                key={v.id}
                style={{
                  ...card,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  borderLeft: `4px solid ${st.cor}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 800, margin: 0 }}>{v.titulo}</p>
                    <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
                      {v.departamento} · {v.regime}
                    </p>
                  </div>
                  <span
                    style={{
                      background: `${st.cor}15`,
                      color: st.cor,
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 8,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {st.label}
                  </span>
                </div>
                <p style={{ color: COR_TEXTO, fontSize: 13, fontWeight: 700, margin: 0 }}>
                  {v.salario || "A combinar"}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #F1F5F4",
                    paddingTop: 12,
                  }}
                >
                  <span style={{ color: "#64748B", fontSize: 12 }}>{v.candidatos} candidato(s)</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#94A3B8", fontSize: 11 }}>{dataBR(v.abertaEm)}</span>
                    <button
                      onClick={() => abrirEditar(v)}
                      style={{
                        background: "#ECFDF5",
                        color: "#065F46",
                        border: "1px solid #A7F3D0",
                        borderRadius: 8,
                        padding: "3px 8px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      <Icone nome="editar" tamanho={15} />
                    </button>
                    <button
                      onClick={() => excluir(v)}
                      style={{
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        border: "none",
                        borderRadius: 8,
                        padding: "3px 8px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      <Icone nome="lixeira" tamanho={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <div
          onClick={() => setModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...card, width: "100%", maxWidth: 520, overflow: "hidden" }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #E6ECEA",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>
                {form.id ? "Editar Vaga" : "Nova Vaga"}
              </h3>
              <button
                onClick={() => setModal(false)}
                style={{
                  background: "#F3F6F5",
                  border: "none",
                  color: "#64748B",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                }}
              >
                <Icone nome="x" tamanho={16} />
              </button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <Campo label="Título da vaga">
                <input
                  value={form.titulo}
                  onChange={(e) => set("titulo", e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Analista Comercial"
                />
              </Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Departamento">
                  <input
                    value={form.departamento}
                    onChange={(e) => set("departamento", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Regime">
                  <select
                    value={form.regime}
                    onChange={(e) => set("regime", e.target.value)}
                    style={inputStyle}
                  >
                    {REGIMES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Faixa salarial">
                  <input
                    value={form.salario}
                    onChange={(e) => set("salario", e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: R$ 3.000 - 4.000"
                  />
                </Campo>
                <Campo label="Aberta em">
                  <input
                    type="date"
                    value={form.abertaEm}
                    onChange={(e) => set("abertaEm", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
              </div>
              <Campo label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as StatusV)}
                  style={inputStyle}
                >
                  {Object.entries(ST).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E6ECEA",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                background: "#F7FAF9",
              }}
            >
              <button
                onClick={() => setModal(false)}
                style={{
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #E6ECEA",
                  borderRadius: 10,
                  padding: "9px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{
                  background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 22px",
                  fontSize: 13,
                  cursor: salvando ? "wait" : "pointer",
                  fontWeight: 700,
                  opacity: salvando ? 0.7 : 1,
                }}
              >
                {salvando ? "Salvando..." : "+ Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          color: "#64748B",
          fontSize: 11,
          fontWeight: 700,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}