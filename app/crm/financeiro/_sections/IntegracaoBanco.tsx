"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🔌 Integração bancária (ao-vivo) — slot pra agregador Open Finance
const COR = "#d97706";

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

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>🔌</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Integração bancária</h1>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Puxar o extrato direto do banco (ao-vivo), sem subir arquivo. Funciona via agregador Open Finance.</p>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${conectado ? "#16a34a" : "#9ca3af"}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: conectado ? "#16a34a" : "#9ca3af" }} />
          <strong style={{ fontSize: 15, color: "#111827" }}>{carregando ? "Verificando…" : conectado ? "Conectado" : "Não conectado"}</strong>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
          {conectado
            ? <>Provedor <strong>{provedor}</strong> configurado. Quando ligarmos a integração, o botão "Sincronizar agora" vai puxar os extratos pra Conciliação.</>
            : <>Configure o provedor e a chave em <strong>Configurações → Integração bancária</strong> pra habilitar.</>}
        </p>
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
        <strong>Como funciona:</strong> a conexão ao-vivo usa um agregador (Pluggy, Belvo) que fala com os bancos via Open Finance. É um serviço contratado à parte — depois de contratar, você cola a chave em Configurações e este botão liga.
        <br /><br />
        Enquanto isso, use <strong>Importar extrato (OFX)</strong>: baixa o arquivo no banco e a Conciliação funciona igual, sem custo.
      </div>

      <button disabled style={{ marginTop: 16, background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "default" }}>
        🔄 Sincronizar agora (em breve)
      </button>
    </div>
  );
}