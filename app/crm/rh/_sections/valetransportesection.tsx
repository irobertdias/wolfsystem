"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";
import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Vale Transporte (CONECTADO — 'vale_transporte'; valorDiario↔valor_diario, diasUteis↔dias_uteis)
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
const real = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type VT = {
  id: string;
  nome: string;
  cargo: string;
  salario: number;
  linha: string;
  valorDiario: number;
  diasUteis: number;
};
const FORM_VAZIO: VT = { id: "", nome: "", cargo: "", salario: 0, linha: "", valorDiario: 0, diasUteis: 22 };
const mensal = (v: VT) => v.valorDiario * v.diasUteis;
const descontoFunc = (v: VT) => Math.min(mensal(v), v.salario * 0.06); // teto 6% do salário
export function ValeTransporteSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<VT[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<VT>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [funcionarios, setFuncionarios] = useState<{ nome: string; cargo: string; salario: number }[]>([]);
  const carregar = async () => {
    if (!wsId) { setCarregando(false); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from("vale_transporte")
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
          salario: Number(r.salario) || 0,
          linha: r.linha || "",
          valorDiario: Number(r.valor_diario) || 0,
          diasUteis: r.dias_uteis || 22,
        }))
      );
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // carrega os funcionários cadastrados pro select
  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const { data } = await supabase
        .from("funcionarios")
        .select("nome, cargo, salario")
        .eq("workspace_id", wsId)
        .order("nome", { ascending: true });
      if (data) setFuncionarios(data as { nome: string; cargo: string; salario: number }[]);
    })();
  }, [wsId]);
  const totalEmpresa = useMemo(() => lista.reduce((s, v) => s + (mensal(v) - descontoFunc(v)), 0), [lista]);
  const totalGeral = useMemo(() => lista.reduce((s, v) => s + mensal(v), 0), [lista]);
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
      salario: form.salario || 0,
      linha: form.linha,
      valor_diario: form.valorDiario || 0,
      dias_uteis: form.diasUteis || 22,
      workspace_id: wsId,
    };
    const { error } = await supabase.from("vale_transporte").insert(payload);
    setSalvando(false);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const excluir = async (v: VT) => {
    if (!wsId) return;
    if (!confirm(`Remover VT de ${v.nome}?`)) return;
    const { error } = await supabase.from("vale_transporte").delete().eq("workspace_id", wsId).eq("id", v.id);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof VT, val: any) => setForm((f) => ({ ...f, [k]: val }));
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
              Vale Transporte
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              Benefício de transporte (desconto limitado a 6% do salário)
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
          + Adicionar VT
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {[
          { label: "Beneficiários", value: String(lista.length), cor: "#059669", icon: "🚌" },
          { label: "Custo empresa/mês", value: real(totalEmpresa), cor: "#C2410C", icon: "💰" },
          { label: "Valor total/mês", value: real(totalGeral), cor: "#0369A1", icon: "📊" },
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
            <p style={{ color: s.cor, fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
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
          <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum vale transporte cadastrado.</p>
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7FAF9" }}>
                  {[
                    "Colaborador",
                    "Linha",
                    "Diário",
                    "Dias",
                    "Total/mês",
                    "Desconto func.",
                    "Empresa paga",
                    "",
                  ].map((h) => (
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
                {lista.map((v, i) => (
                  <tr
                    key={v.id}
                    style={{
                      borderTop: "1px solid #F1F5F4",
                      background: "#ffffff",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, margin: 0 }}>{v.nome}</p>
                      <p style={{ color: "#94A3B8", fontSize: 11, margin: "2px 0 0" }}>{v.cargo}</p>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569", fontSize: 12 }}>{v.linha}</td>
                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12 }}>
                      {real(v.valorDiario)}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12 }}>{v.diasUteis}</td>
                    <td style={{ padding: "12px 16px", color: "#0F172A", fontSize: 12, fontWeight: 700 }}>
                      {real(mensal(v))}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#dc2626", fontSize: 12 }}>
                      {real(descontoFunc(v))}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#059669", fontSize: 12, fontWeight: 700 }}>
                      {real(mensal(v) - descontoFunc(v))}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => excluir(v)}
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
                ))}
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
                Adicionar Vale Transporte
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
                  <select
                    value={form.nome}
                    onChange={(e) => {
                      const f = funcionarios.find((x) => x.nome === e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        nome: e.target.value,
                        cargo: f?.cargo || "",
                        salario: f?.salario ?? 0,
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="">— Selecione o funcionário —</option>
                    {funcionarios.map((f) => (
                      <option key={f.nome} value={f.nome}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Cargo">
                  <input
                    value={form.cargo}
                    onChange={(e) => set("cargo", e.target.value)}
                    style={inputStyle}
                    placeholder="Preenchido pelo funcionário"
                  />
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <Campo label="Linha / trajeto">
                  <input
                    value={form.linha}
                    onChange={(e) => set("linha", e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: 405 + Metrô"
                  />
                </Campo>
                <Campo label="Salário (R$)">
                  <input
                    type="number"
                    value={form.salario || ""}
                    onChange={(e) => set("salario", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Valor diário (R$)">
                  <input
                    type="number"
                    value={form.valorDiario || ""}
                    onChange={(e) => set("valorDiario", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Dias úteis">
                  <input
                    type="number"
                    value={form.diasUteis || ""}
                    onChange={(e) => set("diasUteis", Number(e.target.value))}
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
                {salvando ? "Salvando..." : "+ Adicionar"}
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