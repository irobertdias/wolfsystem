"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES DO FINANCEIRO (fin_config) — empresa, regime e provedores
//   upsert por workspace_id; guarda dados em config (jsonb).
// ═══════════════════════════════════════════════════════════════════════
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const COR = "#475569", G2 = "#94a3b8";

const REGIMES = [
  { v: "simples", l: "Simples Nacional", d: "MEI e Simples", i: "🟢" },
  { v: "presumido", l: "Lucro Presumido", d: "Presunção de lucro", i: "🔵" },
  { v: "real", l: "Lucro Real", d: "Lucro efetivo", i: "🟣" },
];

export default function ConfigFinanceiro() {
  const { wsId } = useWorkspace();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [regime, setRegime] = useState("simples");
  const [c, setC] = useState<any>({ razao_social: "", cnpj: "", nfe_provedor: "", nfe_chave: "", banco_provedor: "", banco_chave: "" });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_config").select("*").eq("workspace_id", wsId).maybeSingle();
    if (data) { setRegime(data.regime || "simples"); setC({ razao_social: data.config?.razao_social || "", cnpj: data.config?.cnpj || "", nfe_provedor: data.config?.nfe_provedor || "", nfe_chave: data.config?.nfe_chave || "", banco_provedor: data.config?.banco_provedor || "", banco_chave: data.config?.banco_chave || "" }); }
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!wsId) return;
    setSalvando(true); setSalvo(false);
    await supabase.from("fin_config").upsert({ workspace_id: wsId, regime, config: { ...c } }, { onConflict: "workspace_id" });
    setSalvando(false); setSalvo(true); setTimeout(() => setSalvo(false), 2500);
  }
  const set = (k: string, v: string) => setC((p: any) => ({ ...p, [k]: v }));

  function Secao({ icone, titulo, desc, children, badge }: any) {
    return (
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, boxShadow: `0 4px 10px ${COR}25` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{icone}</span></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: "#1f2937" }}>{titulo}</div><div style={{ fontSize: 12.5, color: "#9ca3af" }}>{desc}</div></div>
          {badge}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>⚙️</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Configurações</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Dados da empresa, regime e integrações</p></div>
        </div>
        <button onClick={salvar} disabled={salvando || carregando} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 24px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: salvando || carregando ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : salvo ? "✓ Salvo!" : "💾 Salvar"}</button>
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : (
        <>
          <Secao icone="🏢" titulo="Empresa" desc="Aparece nas notas e relatórios">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <div><label style={lbl}>Razão social</label><input value={c.razao_social} onChange={(e) => set("razao_social", e.target.value)} style={input} placeholder="Nome da empresa" /></div>
              <div><label style={lbl}>CNPJ</label><input value={c.cnpj} onChange={(e) => set("cnpj", e.target.value)} style={input} placeholder="00.000.000/0001-00" /></div>
            </div>
          </Secao>

          <Secao icone="🧮" titulo="Regime tributário" desc="Usado nos cálculos e na DRE">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              {REGIMES.map((r) => { const on = regime === r.v; return (
                <button key={r.v} onClick={() => setRegime(r.v)} style={{ padding: "14px", borderRadius: 12, cursor: "pointer", textAlign: "left", border: on ? `2px solid ${COR}` : "1px solid #e5e7eb", background: on ? `${COR}0c` : "#fff" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{r.i}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: on ? COR : "#1f2937" }}>{r.l}</div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{r.d}</div>
                </button>
              ); })}
            </div>
          </Secao>

          <Secao icone="🧾" titulo="Provedor de NF-e" desc="Para emitir nota fiscal na SEFAZ"
            badge={<span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 11px", borderRadius: 20, background: c.nfe_provedor ? "#f0fdf4" : "#f3f4f6", color: c.nfe_provedor ? "#16a34a" : "#9ca3af", border: `1px solid ${c.nfe_provedor ? "#bbf7d0" : "#e5e7eb"}` }}>{c.nfe_provedor ? "● Configurado" : "○ Não configurado"}</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <div><label style={lbl}>Provedor</label><select value={c.nfe_provedor} onChange={(e) => set("nfe_provedor", e.target.value)} style={input}><option value="">Nenhum</option><option value="PlugNotas">PlugNotas</option><option value="Focus NFe">Focus NFe</option><option value="eNotas">eNotas</option><option value="NFe.io">NFe.io</option></select></div>
              <div><label style={lbl}>Token / chave de API</label><input type="password" value={c.nfe_chave} onChange={(e) => set("nfe_chave", e.target.value)} style={input} placeholder="••••••••" /></div>
            </div>
          </Secao>

          <Secao icone="🔌" titulo="Integração bancária" desc="Open Finance — extrato ao-vivo"
            badge={<span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 11px", borderRadius: 20, background: c.banco_provedor ? "#f0fdf4" : "#f3f4f6", color: c.banco_provedor ? "#16a34a" : "#9ca3af", border: `1px solid ${c.banco_provedor ? "#bbf7d0" : "#e5e7eb"}` }}>{c.banco_provedor ? "● Configurado" : "○ Não configurado"}</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <div><label style={lbl}>Provedor</label><select value={c.banco_provedor} onChange={(e) => set("banco_provedor", e.target.value)} style={input}><option value="">Nenhum</option><option value="Pluggy">Pluggy</option><option value="Belvo">Belvo</option></select></div>
              <div><label style={lbl}>Token / chave de API</label><input type="password" value={c.banco_chave} onChange={(e) => set("banco_chave", e.target.value)} style={input} placeholder="••••••••" /></div>
            </div>
          </Secao>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={salvar} disabled={salvando} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 28px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : salvo ? "✓ Salvo!" : "💾 Salvar configurações"}</button>
          </div>
        </>
      )}
    </div>
  );
}