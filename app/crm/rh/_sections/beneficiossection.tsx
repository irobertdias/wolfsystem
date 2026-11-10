"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useWorkspace } from "../../../hooks/useWorkspace";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// 🧑‍💼 RH · Benefícios (WolfSystem — multi-tenant · tabela 'beneficios'; custoEmpresa↔custo_empresa)
// PORTADO DO UNITA → WOLF. Isolamento por workspace_id em todas as queries.
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
const TIPOS: Record<string, { cor: string; icon: string }> = {
  Transporte: { cor: "#0369A1", icon: "🚌" },
  Alimentação: { cor: "#C2410C", icon: "🍽️" },
  Saúde: { cor: "#059669", icon: "🏥" },
  "Bem-estar": { cor: "#BE185D", icon: "🧘" },
  Seguro: { cor: "#0F766E", icon: "🛡️" },
};
type Beneficio = { id: string; nome: string; tipo: string; custoEmpresa: number; aderentes: number };
const FORM_VAZIO: Beneficio = { id: "", nome: "", tipo: "Transporte", custoEmpresa: 0, aderentes: 0 };

export function BeneficiosSection() {
  // 🏢 Workspace ativo (multi-tenant Wolf)
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Beneficio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Beneficio>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = !!form.id;
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
      .from("beneficios")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Erro ao carregar: " + error.message);
    } else
      setLista(
        (data || []).map((b: any) => ({
          id: b.id,
          nome: b.nome,
          tipo: b.tipo || "Transporte",
          custoEmpresa: Number(b.custo_empresa) || 0,
          aderentes: b.aderentes || 0,
        }))
      );
    setCarregando(false);
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const custoMensal = useMemo(() => lista.reduce((s, b) => s + b.custoEmpresa * b.aderentes, 0), [lista]);
  const totalAdesoes = useMemo(() => lista.reduce((s, b) => s + b.aderentes, 0), [lista]);

  const salvar = async () => {
    if (!form.nome.trim()) {
      alert("Informe o nome do benefício.");
      return;
    }
    if (!wsId) {
      alert("Workspace não identificado. Recarregue a página.");
      return;
    }
    setSalvando(true);
    const payload = {
      nome: form.nome,
      tipo: form.tipo,
      custo_empresa: form.custoEmpresa || 0,
      aderentes: form.aderentes || 0,
      workspace_id: wsId,
    };
    const resp = editando
      ? await supabase.from("beneficios").update(payload).eq("id", form.id).eq("workspace_id", wsId)
      : await supabase.from("beneficios").insert(payload);
    setSalvando(false);
    if (resp.error) {
      alert("Erro ao salvar: " + resp.error.message);
      return;
    }
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };
  const excluir = async (b: Beneficio) => {
    if (!wsId) return;
    if (!confirm(`Remover "${b.nome}"?`)) return;
    const { error } = await supabase.from("beneficios").delete().eq("id", b.id).eq("workspace_id", wsId);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    carregar();
  };
  const set = (k: keyof Beneficio, v: any) => setForm((f) => ({ ...f, [k]: v }));

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
              Benefícios
            </h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
              <b style={{ color: COR_TEXTO }}>{lista.length}</b> benefício(s) ativos
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
          + Novo Benefício
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {[
          { label: "Benefícios", value: String(lista.length), cor: "#059669", icon: "🎁" },
          { label: "Adesões totais", value: String(totalAdesoes), cor: "#059669", icon: "👥" },
          { label: "Custo mensal", value: real(custoMensal), cor: "#C2410C", icon: "💰" },
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
          <p style={{ color: "#64748B", fontSize: 13 }}>Nenhum benefício cadastrado.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {lista.map((b) => {
            const t = TIPOS[b.tipo] || { cor: COR, icon: "🎁" };
            return (
              <div
                key={b.id}
                style={{
                  ...card,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 11,
                        background: `${t.cor}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {<IconeEmoji e={t.icon} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          color: "#0F172A",
                          fontSize: 14,
                          fontWeight: 800,
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.nome}
                      </p>
                      <span style={{ color: t.cor, fontSize: 11, fontWeight: 600 }}>{b.tipo}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setForm(b);
                        setModal(true);
                      }}
                      style={{
                        background: "#ECFDF5",
                        color: COR_TEXTO,
                        border: "1px solid #A7F3D0",
                        borderRadius: 8,
                        padding: "4px 9px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      <Icone nome="editar" tamanho={15} />
                    </button>
                    <button
                      onClick={() => excluir(b)}
                      style={{
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        border: "none",
                        borderRadius: 8,
                        padding: "4px 9px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      <Icone nome="lixeira" tamanho={15} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #F1F5F4",
                    paddingTop: 12,
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: "#94A3B8",
                        fontSize: 10,
                        margin: 0,
                        fontWeight: 700,
                      }}
                    >
                      Custo/pessoa
                    </p>
                    <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 800, margin: "2px 0 0" }}>
                      {real(b.custoEmpresa)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        color: "#94A3B8",
                        fontSize: 10,
                        margin: 0,
                        fontWeight: 700,
                      }}
                    >
                      Aderentes
                    </p>
                    <p style={{ color: t.cor, fontSize: 15, fontWeight: 800, margin: "2px 0 0" }}>
                      {b.aderentes}
                    </p>
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
            style={{ ...card, width: "100%", maxWidth: 480, overflow: "hidden" }}
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
                {editando ? "Editar Benefício" : "Novo Benefício"}
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
              <Campo label="Nome do benefício">
                <input
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Vale Refeição"
                />
              </Campo>
              <Campo label="Tipo">
                <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputStyle}>
                  {Object.keys(TIPOS).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Campo label="Custo por pessoa (R$)">
                  <input
                    type="number"
                    value={form.custoEmpresa || ""}
                    onChange={(e) => set("custoEmpresa", Number(e.target.value))}
                    style={inputStyle}
                  />
                </Campo>
                <Campo label="Aderentes">
                  <input
                    type="number"
                    value={form.aderentes || ""}
                    onChange={(e) => set("aderentes", Number(e.target.value))}
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
                {salvando ? "Salvando..." : editando ? "Salvar" : "+ Cadastrar"}
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