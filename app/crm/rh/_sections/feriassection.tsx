"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";
import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Férias (CONECTADO — 'ferias'; agendar = update status/inicio_agendado)
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
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};
type StatusF = "em_gozo" | "agendada" | "disponivel" | "vencendo";
type Ferias = {
  id: string;
  nome: string;
  cargo: string;
  aquisitivo: string;
  diasDireito: number;
  diasGozados: number;
  venceEm: string;
  status: StatusF;
  inicioAgendado: string;
};
const SI: Record<StatusF, { label: string; cor: string }> = {
  em_gozo: { label: "Em gozo", cor: "#0369A1" },
  agendada: { label: "Agendada", cor: "#0F766E" },
  disponivel: { label: "Disponível", cor: "#059669" },
  vencendo: { label: "Vencendo", cor: "#dc2626" },
};
const FORM_VAZIO: Ferias = {
  id: "",
  nome: "",
  cargo: "",
  aquisitivo: "",
  diasDireito: 30,
  diasGozados: 0,
  venceEm: "",
  status: "disponivel",
  inicioAgendado: "",
};
export function FeriasSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Ferias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Ferias>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [agendar, setAgendar] = useState<Ferias | null>(null);
  const [dataAg, setDataAg] = useState("");
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from("ferias")
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
          nome: r.nome,
          cargo: r.cargo || "",
          aquisitivo: r.aquisitivo || "",
          diasDireito: r.dias_direito || 30,
          diasGozados: r.dias_gozados || 0,
          venceEm: r.vence_em || "",
          status: (r.status || "disponivel") as StatusF,
          inicioAgendado: r.inicio_agendado || "",
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
      vencendo: lista.filter((f) => f.status === "vencendo").length,
      emGozo: lista.filter((f) => f.status === "em_gozo").length,
      agendadas: lista.filter((f) => f.status === "agendada").length,
    }),
    [lista]
  );
  const salvar = async () => {
    if (!form.nome.trim()) {
      alert("Informe o colaborador.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setSalvando(true);
    const payload = {
      nome: form.nome,
      cargo: form.cargo,
      aquisitivo: form.aquisitivo,
      dias_direito: form.diasDireito || 30,
      dias_gozados: form.diasGozados || 0,
      vence_em: form.venceEm,
      status: form.status,
      workspace_id: wsId,
    };
    const { error } = await supabase.from("ferias").insert(payload);
    setSalvando(false);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const confirmarAgendamento = async () => {
    if (!agendar || !dataAg) {
      alert("Escolha a data de início.");
      return;
    }
    const { error } = await supabase
      .from("ferias")
      .update({ status: "agendada", inicio_agendado: dataAg })
      .eq("id", agendar.id)
      .eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setAgendar(null);
    setDataAg("");
    carregar();
  };
  const excluir = async (f: Ferias) => {
    if (!wsId) return;
    if (!confirm(`Remover registro de ${f.nome}?`)) return;
    const { error } = await supabase.from("ferias").delete().eq("id", f.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof Ferias, v: any) => setForm((p) => ({ ...p, [k]: v }));
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
              Férias
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Controle de períodos aquisitivos e agendamentos
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
          + Novo Registro
        </button>
      </div>
      {stats.vencendo > 0 && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <IconeEmoji e="⚠️" tamanho={16} />
          <p style={{ color: "#991b1b", fontSize: 13, margin: 0, fontWeight: 600 }}>
            <b>{stats.vencendo}</b> período(s) de férias vencendo — agende o quanto antes.
          </p>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {[
          { label: "Vencendo", value: String(stats.vencendo), cor: "#dc2626", icon: "⚠️" },
          { label: "Em gozo", value: String(stats.emGozo), cor: "#0369A1", icon: "🌴" },
          { label: "Agendadas", value: String(stats.agendadas), cor: "#0F766E", icon: "📅" },
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
          <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum registro de férias.</p>
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7FAF9" }}>
                  {["Colaborador", "Aquisitivo", "Dias", "Vence em", "Status", "Ações"].map((h) => (
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
                {lista.map((f, i) => {
                  const st = SI[f.status];
                  const restantes = f.diasDireito - f.diasGozados;
                  return (
                    <tr
                      key={f.id}
                      style={{
                        borderTop: "1px solid #F1F5F4",
                        background: "#ffffff",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, margin: 0 }}>{f.nome}</p>
                        <p style={{ color: "#94A3B8", fontSize: 11, margin: "2px 0 0" }}>{f.cargo}</p>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12 }}>{f.aquisitivo}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>
                        <span style={{ color: "#059669", fontWeight: 700 }}>{restantes}</span>{" "}
                        <span style={{ color: "#94A3B8" }}>de {f.diasDireito}</span>
                      </td>
                      <td
                        style={{ padding: "12px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        {f.venceEm}
                        {f.inicioAgendado ? ` · início ${dataBR(f.inicioAgendado)}` : ""}
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
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => {
                            setAgendar(f);
                            setDataAg(f.inicioAgendado || "");
                          }}
                          style={{
                            background: "#ECFDF5",
                            color: COR_TEXTO,
                            border: "1px solid #A7F3D0",
                            borderRadius: 8,
                            padding: "5px 11px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontWeight: 600,
                            marginRight: 6,
                          }}
                        >
                          Agendar
                        </button>
                        <button
                          onClick={() => excluir(f)}
                          style={{
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            border: "none",
                            borderRadius: 8,
                            padding: "5px 9px",
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
              <h3 style={{ color: "#0F172A", fontSize: 18, fontWeight: 800, margin: 0 }}>
                Novo Registro de Férias
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Colaborador">
                  <input value={form.nome} onChange={(e) => set("nome", e.target.value)} style={inputStyle} />
                </Campo>
                <Campo label="Cargo">
                  <input
                    value={form.cargo}
                    onChange={(e) => set("cargo", e.target.value)}
                    style={inputStyle}
                  />
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Período aquisitivo">
                  <input
                    value={form.aquisitivo}
                    onChange={(e) => set("aquisitivo", e.target.value)}
                    style={inputStyle}
                    placeholder="2024/2025"
                  />
                </Campo>
                <Campo label="Vence em">
                  <input
                    value={form.venceEm}
                    onChange={(e) => set("venceEm", e.target.value)}
                    style={inputStyle}
                    placeholder="07/2026"
                  />
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <Campo label="Dias direito">
                  <input
                    type="number"
                    value={form.diasDireito || ""}
                    onChange={(e) => set("diasDireito", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Dias gozados">
                  <input
                    type="number"
                    value={form.diasGozados || ""}
                    onChange={(e) => set("diasGozados", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as StatusF)}
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
                  background: "#F3F6F5",
                  color: "#334155",
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
      {agendar && (
        <div
          onClick={() => setAgendar(null)}
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
            style={{ ...card, width: "100%", maxWidth: 420, overflow: "hidden" }}
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
                Agendar férias de {agendar.nome}
              </h3>
              <button
                onClick={() => setAgendar(null)}
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
            <div style={{ padding: 24 }}>
              <Campo label="Data de início">
                <input
                  type="date"
                  value={dataAg}
                  onChange={(e) => setDataAg(e.target.value)}
                  style={inputStyle}
                />
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
                onClick={() => setAgendar(null)}
                style={{
                  background: "#F3F6F5",
                  color: "#334155",
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
                onClick={confirmarAgendamento}
                style={{
                  background: `linear-gradient(140deg, #10B981, #059669 60%, #047857)`,
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 22px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Confirmar
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