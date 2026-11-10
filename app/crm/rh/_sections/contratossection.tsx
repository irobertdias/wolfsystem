"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";
import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Contratos (CONECTADO — 'contratos')
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
const dataBR = (iso: string) => {
  if (!iso) return "Indeterminado";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};
const TIPOS = ["CLT", "PJ", "Temporário", "Estágio", "Aprendiz"];
type StatusC = "vigente" | "experiencia" | "renovar" | "encerrado";
type Contrato = {
  id: string;
  funcionario: string;
  tipo: string;
  inicio: string;
  fim: string;
  status: StatusC;
};
const SI: Record<StatusC, { label: string; cor: string }> = {
  vigente: { label: "Vigente", cor: "#059669" },
  experiencia: { label: "Experiência", cor: "#0369A1" },
  renovar: { label: "A renovar", cor: "#C2410C" },
  encerrado: { label: "Encerrado", cor: "#64748B" },
};
const FORM_VAZIO: Contrato = {
  id: "",
  funcionario: "",
  tipo: TIPOS[0],
  inicio: "",
  fim: "",
  status: "vigente",
};
export function ContratosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | StatusC>("todos");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Contrato>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from("contratos")
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
          funcionario: r.funcionario,
          tipo: r.tipo || TIPOS[0],
          inicio: r.inicio || "",
          fim: r.fim || "",
          status: (r.status || "vigente") as StatusC,
        }))
      );
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);
  const filtrados = useMemo(
    () => (filtro === "todos" ? lista : lista.filter((c) => c.status === filtro)),
    [lista, filtro]
  );
  const stats = useMemo(
    () => ({
      vigentes: lista.filter((c) => c.status === "vigente").length,
      experiencia: lista.filter((c) => c.status === "experiencia").length,
      renovar: lista.filter((c) => c.status === "renovar").length,
    }),
    [lista]
  );
  const salvar = async () => {
    if (!form.funcionario.trim()) {
      alert("Informe o colaborador.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setSalvando(true);
    const payload = {
      funcionario: form.funcionario,
      tipo: form.tipo,
      inicio: form.inicio || null,
      fim: form.fim || null,
      status: form.status,
      workspace_id: wsId,
    };
    const { error } = await supabase.from("contratos").insert(payload);
    setSalvando(false);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const excluir = async (c: Contrato) => {
    if (!wsId) return;
    if (!confirm(`Remover contrato de ${c.funcionario}?`)) return;
    const { error } = await supabase.from("contratos").delete().eq("id", c.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof Contrato, v: any) => setForm((f) => ({ ...f, [k]: v }));
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
              Contratos
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Contratos de trabalho e vigências
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
          + Novo Contrato
        </button>
      </div>
      {stats.renovar > 0 && (
        <div
          style={{
            background: "#FFF7ED",
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <IconeEmoji e="⚠️" tamanho={16} />
          <p style={{ color: "#92400e", fontSize: 13, margin: 0, fontWeight: 600 }}>
            <b>{stats.renovar}</b> contrato(s) a renovar — verifique as datas de término.
          </p>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {[
          { label: "Vigentes", value: String(stats.vigentes), cor: "#059669", icon: "✅" },
          { label: "Em experiência", value: String(stats.experiencia), cor: "#0369A1", icon: "🔍" },
          { label: "A renovar", value: String(stats.renovar), cor: "#C2410C", icon: "🔁" },
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
          [["todos", "Todos"], ...Object.entries(SI).map(([k, v]) => [k, v.label])] as [string, string][]
        ).map(([k, lbl]) => {
          const a = filtro === k;
          const cor = k === "todos" ? COR : SI[k as StatusC].cor;
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
            {lista.length === 0 ? "Nenhum contrato cadastrado." : "Nada com esse filtro"}
          </p>
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7FAF9" }}>
                  {["Colaborador", "Tipo", "Início", "Término", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        color: "#64748B",
                        fontSize: 11,
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                        borderBottom: "1px solid #E6ECEA",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c, i) => {
                  const st = SI[c.status];
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderTop: "1px solid #F1F5F4",
                        background: "#ffffff",
                      }}
                    >
                      <td style={{ padding: "12px 16px", color: "#0F172A", fontSize: 13, fontWeight: 700 }}>
                        {c.funcionario}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            background: "#ECFDF5",
                            color: COR_TEXTO,
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                            fontWeight: 700,
                          }}
                        >
                          {c.tipo}
                        </span>
                      </td>
                      <td
                        style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        {dataBR(c.inicio)}
                      </td>
                      <td
                        style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        {dataBR(c.fim)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            background: `${st.cor}15`,
                            color: st.cor,
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => excluir(c)}
                          style={{
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            border: "none",
                            borderRadius: 8,
                            padding: "5px 11px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          <Icone nome="lixeira" tamanho={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>Novo Contrato</h3>
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
              <Campo label="Colaborador">
                <input
                  value={form.funcionario}
                  onChange={(e) => set("funcionario", e.target.value)}
                  style={inputStyle}
                  placeholder="Nome"
                />
              </Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Tipo">
                  <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputStyle}>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as StatusC)}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Início">
                  <input
                    type="date"
                    value={form.inicio}
                    onChange={(e) => set("inicio", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Término (se houver)">
                  <input
                    type="date"
                    value={form.fim}
                    onChange={(e) => set("fim", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
              </div>
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