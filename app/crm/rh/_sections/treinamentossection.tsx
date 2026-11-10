"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";
import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Treinamentos (CONECTADO — 'treinamentos'; cargaHoraria↔carga_horaria)
const COR = "#059669";
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
const dataBR = (iso: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};
const MODALIDADES = ["Presencial", "Online", "Híbrido"];
type StatusT = "planejado" | "em_andamento" | "concluido";
type Treinamento = {
  id: string;
  titulo: string;
  modalidade: string;
  instrutor: string;
  participantes: number;
  cargaHoraria: number;
  status: StatusT;
  data: string;
};
const SI: Record<StatusT, { label: string; cor: string }> = {
  planejado: { label: "Planejado", cor: "#0369A1" },
  em_andamento: { label: "Em andamento", cor: "#C2410C" },
  concluido: { label: "Concluído", cor: "#059669" },
};
const FORM_VAZIO: Treinamento = {
  id: "",
  titulo: "",
  modalidade: MODALIDADES[0],
  instrutor: "",
  participantes: 0,
  cargaHoraria: 0,
  status: "planejado",
  data: "",
};
export function TreinamentosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Treinamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Treinamento>(FORM_VAZIO);
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
    const { data, error } = await supabase
      .from("treinamentos")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Erro: " + error.message);
    } else
      setLista(
        (data || []).map((r: any) => ({
          id: r.id,
          titulo: r.titulo,
          modalidade: r.modalidade || MODALIDADES[0],
          instrutor: r.instrutor || "",
          participantes: r.participantes || 0,
          cargaHoraria: r.carga_horaria || 0,
          status: (r.status || "planejado") as StatusT,
          data: r.data || "",
        }))
      );
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);
  const stats = useMemo(
    () => ({
      total: lista.length,
      andamento: lista.filter((t) => t.status === "em_andamento").length,
      concluidos: lista.filter((t) => t.status === "concluido").length,
      horas: lista.reduce((s, t) => s + t.cargaHoraria, 0),
    }),
    [lista]
  );
  const salvar = async () => {
    if (!form.titulo.trim()) {
      alert("Informe o título.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setSalvando(true);
    const payload = {
      titulo: form.titulo,
      modalidade: form.modalidade,
      instrutor: form.instrutor,
      participantes: form.participantes || 0,
      carga_horaria: form.cargaHoraria || 0,
      status: form.status,
      data: form.data || null,
      workspace_id: wsId,
    };
    const { error } = await supabase.from("treinamentos").insert(payload);
    setSalvando(false);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const excluir = async (t: Treinamento) => {
    if (!wsId) return;
    if (!confirm(`Remover "${t.titulo}"?`)) return;
    const { error } = await supabase.from("treinamentos").delete().eq("id", t.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof Treinamento, v: any) => setForm((f) => ({ ...f, [k]: v }));
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
              Treinamentos
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Capacitação e desenvolvimento da equipe
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
          + Novo Treinamento
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: "Treinamentos", value: String(stats.total), cor: "#059669", icon: "🎓" },
          { label: "Em andamento", value: String(stats.andamento), cor: "#C2410C", icon: "🔄" },
          { label: "Concluídos", value: String(stats.concluidos), cor: "#059669", icon: "✅" },
          { label: "Horas totais", value: stats.horas + "h", cor: "#0369A1", icon: "⏱️" },
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
      {carregando ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Carregando...</p>
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icone nome="pasta" tamanho={24} /></span>
          <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum treinamento cadastrado.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {lista.map((t) => {
            const st = SI[t.status];
            return (
              <div
                key={t.id}
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
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 800, margin: 0 }}>{t.titulo}</p>
                  <span
                    style={{
                      background: `${st.cor}15`,
                      color: st.cor,
                      fontSize: 12,
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
                <p style={{ color: "#64748B", fontSize: 12, margin: 0 }}>
                  {t.instrutor} · {t.modalidade}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #F1F5F4",
                    paddingTop: 12,
                  }}
                >
                  <span style={{ color: "#64748B", fontSize: 12 }}>
                    {t.participantes} · ⏱️ {t.cargaHoraria}h
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#065F46", fontSize: 12, fontWeight: 700 }}>{dataBR(t.data)}</span>
                    <button
                      onClick={() => excluir(t)}
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
            style={{ ...card, width: "100%", maxWidth: 540, overflow: "hidden" }}
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
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>Novo Treinamento</h3>
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
              <Campo label="Título">
                <input
                  value={form.titulo}
                  onChange={(e) => set("titulo", e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Técnicas de Vendas"
                />
              </Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Instrutor">
                  <input
                    value={form.instrutor}
                    onChange={(e) => set("instrutor", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Modalidade">
                  <select
                    value={form.modalidade}
                    onChange={(e) => set("modalidade", e.target.value)}
                    style={inputStyle}
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <Campo label="Participantes">
                  <input
                    type="number"
                    value={form.participantes || ""}
                    onChange={(e) => set("participantes", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Carga (h)">
                  <input
                    type="number"
                    value={form.cargaHoraria || ""}
                    onChange={(e) => set("cargaHoraria", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Data">
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => set("data", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
              </div>
              <Campo label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as StatusT)}
                  style={inputStyle}
                >
                  {Object.entries(SI).map(([k, v]) => (
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