"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ⚙️ Configurações do Financeiro (fin_config) — 1 linha por workspace
const COR = "#d97706";
const REGIMES = [
  { v: "", l: "— Não definido —" },
  { v: "simples", l: "Simples Nacional" },
  { v: "presumido", l: "Lucro Presumido" },
  { v: "real", l: "Lucro Real" },
];
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function ConfigFinanceiro() {
  const { wsId } = useWorkspace();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [regime, setRegime] = useState("");
  const [cfg, setCfg] = useState<any>({ nome_empresa: "", cnpj: "", nfe_provedor: "", nfe_chave: "", banco_provedor: "", banco_chave: "" });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_config").select("*").eq("workspace_id", wsId).maybeSingle();
    if (data) {
      setRegime(data.regime || "");
      setCfg({ nome_empresa: "", cnpj: "", nfe_provedor: "", nfe_chave: "", banco_provedor: "", banco_chave: "", ...(data.config || {}) });
    }
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!wsId) return;
    setSalvando(true); setSalvo(false);
    await supabase.from("fin_config").upsert(
      { workspace_id: wsId, regime: regime || null, config: cfg, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );
    setSalvando(false); setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  const set = (k: string, v: string) => setCfg((p: any) => ({ ...p, [k]: v }));

  function Card({ titulo, children, nota }: { titulo: string; children: any; nota?: string }) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "#111827" }}>{titulo}</h3>
        {nota && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af" }}>{nota}</p>}
        <div style={{ marginTop: nota ? 0 : 12 }}>{children}</div>
      </div>
    );
  }

  if (carregando) return <div style={{ padding: 24, color: "#9ca3af" }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>⚙️</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Configurações do Financeiro</h1>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Dados da empresa, regime tributário e integrações.</p>

      <Card titulo="Empresa">
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Razão social</label>
            <input value={cfg.nome_empresa} onChange={(e) => set("nome_empresa", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ width: 200 }}>
            <label style={labelStyle}>CNPJ</label>
            <input value={cfg.cnpj} onChange={(e) => set("cnpj", e.target.value)} style={inputStyle} />
          </div>
        </div>
        <label style={labelStyle}>Regime tributário</label>
        <select value={regime} onChange={(e) => setRegime(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }}>
          {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </Card>

      <Card titulo="🧾 Emissão de NF-e" nota="Slot pra integração futura (PlugNotas, Focus, eNotas...). Cole as credenciais aqui quando contratar o provedor.">
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 200 }}>
            <label style={labelStyle}>Provedor</label>
            <input value={cfg.nfe_provedor} onChange={(e) => set("nfe_provedor", e.target.value)} style={inputStyle} placeholder="plugnotas" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Token / Chave</label>
            <input value={cfg.nfe_chave} onChange={(e) => set("nfe_chave", e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
        </div>
      </Card>

      <Card titulo="🏦 Integração bancária (ao-vivo)" nota="Slot pra agregador (Pluggy, Belvo). O extrato OFX por arquivo funciona sem isso.">
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 200 }}>
            <label style={labelStyle}>Provedor</label>
            <input value={cfg.banco_provedor} onChange={(e) => set("banco_provedor", e.target.value)} style={inputStyle} placeholder="pluggy" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Token / Chave</label>
            <input value={cfg.banco_chave} onChange={(e) => set("banco_chave", e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={salvar} disabled={salvando} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar configurações"}</button>
        {salvo && <span style={{ color: "#16a34a", fontSize: 14, fontWeight: 600 }}>✓ Salvo</span>}
      </div>
    </div>
  );
}