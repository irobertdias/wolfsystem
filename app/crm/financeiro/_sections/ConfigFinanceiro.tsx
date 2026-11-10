"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES DO FINANCEIRO (fin_config) — empresa, regime e provedores
//   upsert por workspace_id; guarda dados em config (jsonb).
// ═══════════════════════════════════════════════════════════════════════
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
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
    // Mantém outras chaves de config (ex.: `revisional`) que esta tela não edita.
    const { data: atual } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
    await supabase.from("fin_config").upsert({ workspace_id: wsId, regime, config: { ...((atual as any)?.config || {}), ...c } }, { onConflict: "workspace_id" });
    setSalvando(false); setSalvo(true); setTimeout(() => setSalvo(false), 2500);
  }
  const set = (k: string, v: string) => setC((p: any) => ({ ...p, [k]: v }));

  function Secao({ icone, titulo, desc, children, badge }: any) {
    return (
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, boxShadow: `0 4px 10px ${COR}25` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{<IconeEmoji e={icone} />}</span></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{titulo}</div><div style={{ fontSize: 12.5, color: "#94A3B8" }}>{desc}</div></div>
          {badge}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Configurações</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Dados da empresa, regime e integrações</p></div>
        </div>
        <button onClick={salvar} disabled={salvando || carregando} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 24px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: salvando || carregando ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : salvo ? "✓ Salvo!" : "Salvar"}</button>
      </div>

      {carregando ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Carregando…</p> : (
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
                <button key={r.v} onClick={() => setRegime(r.v)} style={{ padding: "14px", borderRadius: 12, cursor: "pointer", textAlign: "left", border: on ? `2px solid ${COR}` : "1px solid #E6ECEA", background: on ? `${COR}0c` : "#fff" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{r.i}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: on ? COR : "#0F172A" }}>{r.l}</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{r.d}</div>
                </button>
              ); })}
            </div>
          </Secao>

          <Secao icone="🧾" titulo="Provedor de NF-e" desc="Para emitir nota fiscal na SEFAZ"
            badge={<span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 11px", borderRadius: 20, background: c.nfe_provedor ? "#ECFDF5" : "#F1F5F4", color: c.nfe_provedor ? "#059669" : "#94A3B8", border: `1px solid ${c.nfe_provedor ? "#A7F3D0" : "#E6ECEA"}` }}>{c.nfe_provedor ? "● Configurado" : "○ Não configurado"}</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <div><label style={lbl}>Provedor</label><select value={c.nfe_provedor} onChange={(e) => set("nfe_provedor", e.target.value)} style={input}><option value="">Nenhum</option><option value="PlugNotas">PlugNotas</option><option value="Focus NFe">Focus NFe</option><option value="eNotas">eNotas</option><option value="NFe.io">NFe.io</option></select></div>
              <div><label style={lbl}>Token / chave de API</label><input type="password" value={c.nfe_chave} onChange={(e) => set("nfe_chave", e.target.value)} style={input} placeholder="••••••••" /></div>
            </div>
          </Secao>

          <Secao icone="🔌" titulo="Integração bancária" desc="Open Finance — extrato ao-vivo"
            badge={<span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 11px", borderRadius: 20, background: c.banco_provedor ? "#ECFDF5" : "#F1F5F4", color: c.banco_provedor ? "#059669" : "#94A3B8", border: `1px solid ${c.banco_provedor ? "#A7F3D0" : "#E6ECEA"}` }}>{c.banco_provedor ? "● Configurado" : "○ Não configurado"}</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <div><label style={lbl}>Provedor</label><select value={c.banco_provedor} onChange={(e) => set("banco_provedor", e.target.value)} style={input}><option value="">Nenhum</option><option value="Pluggy">Pluggy</option><option value="Belvo">Belvo</option></select></div>
              <div><label style={lbl}>Token / chave de API</label><input type="password" value={c.banco_chave} onChange={(e) => set("banco_chave", e.target.value)} style={input} placeholder="••••••••" /></div>
            </div>
          </Secao>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={salvar} disabled={salvando} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 28px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : salvo ? "✓ Salvo!" : "Salvar configurações"}</button>
          </div>
        </>
      )}
    </div>
  );
}