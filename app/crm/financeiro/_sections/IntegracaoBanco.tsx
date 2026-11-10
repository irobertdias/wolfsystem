"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🔌 INTEGRAÇÃO BANCÁRIA (ao-vivo) — slot pra agregador Open Finance
//   lê o status do provedor em fin_config; sincronização entra com o provedor.
// ═══════════════════════════════════════════════════════════════════════
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #E6ECEA", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const COR = "#6366f1", G2 = "#818cf8";

export default function IntegracaoBanco() {
  const { wsId } = useWorkspace();
  const [provedor, setProvedor] = useState("");
  const [temChave, setTemChave] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
    setProvedor(data?.config?.banco_provedor || "");
    setTemChave(!!data?.config?.banco_chave);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const conectado = !!provedor && temChave;

  const passos = [
    { n: 1, t: "Contratar um agregador", d: "Pluggy ou Belvo — serviços que falam com os bancos via Open Finance.", i: "🤝" },
    { n: 2, t: "Colar a chave em Configurações", d: "Em Configurações → Integração bancária, informe provedor e token.", i: "🔑" },
    { n: 3, t: "Sincronizar", d: "O sistema puxa os extratos automaticamente pra Conciliação.", i: "🔄" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>🔌</span></div>
        <div><h1 style={{ color: "#0F172A", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Integração bancária</h1><p style={{ color: "#64748B", fontSize: 13, margin: "3px 0 0" }}>Puxar o extrato direto do banco, ao-vivo, sem subir arquivo</p></div>
      </div>

      {/* STATUS */}
      <div style={{ ...card, padding: 24, borderLeft: `5px solid ${conectado ? "#059669" : "#94A3B8"}`, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: conectado ? "linear-gradient(135deg, #059669 0%, #10B981 100%)" : "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: `0 6px 16px ${conectado ? "rgba(5,150,105,0.3)" : "rgba(148,163,184,0.3)"}` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{conectado ? "✅" : "🔌"}</span></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: conectado ? "#059669" : "#94A3B8" }} />
            <strong style={{ fontSize: 17, color: "#0F172A" }}>{carregando ? "Verificando…" : conectado ? "Conectado" : "Não conectado"}</strong>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#64748B", lineHeight: 1.5 }}>
            {conectado
              ? <>Provedor <b style={{ color: COR }}>{provedor}</b> configurado. A sincronização automática entra quando ligarmos a integração.</>
              : <>Configure o provedor e a chave em <b>Configurações → Integração bancária</b> pra habilitar a conexão ao-vivo.</>}
          </p>
        </div>
        <button disabled style={{ background: "#E6ECEA", color: "#94A3B8", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "default", whiteSpace: "nowrap" }}>Sincronizar agora (em breve)</button>
      </div>

      {/* PASSOS */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>Como funciona</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {passos.map((p) => (
            <div key={p.n} style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 800, boxShadow: `0 4px 10px ${COR}30` }}>{p.n}</div>
                <span style={{ fontSize: 22 }}>{p.i}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{p.t}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPARATIVO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div style={{ ...card, padding: 22, borderTop: "3px solid #059669" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ fontSize: 22 }}>📑</span><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#059669" }}>Importar OFX <span style={{ fontSize: 11, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "2px 9px", borderRadius: 20 }}>Disponível agora</span></h3></div>
          <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 }}>Baixe o extrato em <b>.ofx</b> no app do banco e suba em <b>Importar extrato</b>. A conciliação funciona igual, <b>sem custo</b> de provedor.</p>
        </div>
        <div style={{ ...card, padding: 22, borderTop: `3px solid ${COR}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ fontSize: 22 }}>🔌</span><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: COR }}>Open Finance ao-vivo <span style={{ fontSize: 11, background: "#ECFDF5", color: COR, border: "1px solid #A7F3D0", padding: "2px 9px", borderRadius: 20 }}>Em breve</span></h3></div>
          <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 }}>Conexão direta com o banco via agregador (Pluggy/Belvo). O extrato chega <b>sozinho</b>, sem baixar arquivo. É um serviço contratado à parte.</p>
        </div>
      </div>
    </div>
  );
}