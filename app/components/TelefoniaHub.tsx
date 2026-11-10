"use client";
import { useState } from "react";
import ConexoesVoipSection from "./ConexoesVoipSection";
import UraDiscadorSection from "./UraDiscadorSection";
import { usePermissao } from "../hooks/usePermissao";
import Icone from "./a2/Icone";

// Telefonia no padrão A2: título da tela, abas em pílula branca e a seção ativa abaixo.
export default function TelefoniaHub() {
  const { isDono, isSuperAdmin, permissoes } = usePermissao();
  const podeConexoes = isDono || isSuperAdmin || !!permissoes.voip_conexoes;
  const podeCampanhas = isDono || isSuperAdmin || !!permissoes.voip_campanhas;
  const [aba, setAba] = useState<"conexoes" | "ura">(podeCampanhas ? "ura" : "conexoes");

  const abas = [
    podeCampanhas && { key: "ura" as const, label: "URA inteligente", sub: "Fluxos e campanhas", icone: "robo" },
    podeConexoes && { key: "conexoes" as const, label: "Conexões", sub: "Provedores e ramais", icone: "telefone" },
  ].filter(Boolean) as { key: "conexoes" | "ura"; label: string; sub: string; icone: string }[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1440, margin: "0 auto", width: "100%", padding: "8px 4px 0", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, color: "#0F172A", fontSize: 30, fontWeight: 800, letterSpacing: "-.02em" }}>Telefonia</h1>
          <p style={{ margin: "6px 0 0", color: "#64748B", fontSize: 14 }}>Ligações, URA e discador da sua operação</p>
        </div>
        {abas.length > 1 && (
          <div role="tablist" style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 14, padding: 5, boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 6px 16px -10px rgba(16,24,40,.25)", maxWidth: "100%", overflowX: "auto" }}>
            {abas.map((a) => {
              const sel = aba === a.key;
              return (
                <button key={a.key} role="tab" aria-selected={sel} onClick={() => setAba(a.key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, border: 0, cursor: "pointer", borderRadius: 10, padding: "8px 16px 8px 10px", background: sel ? "#ECFDF5" : "transparent", textAlign: "left", whiteSpace: "nowrap" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#059669" : "#F3F6F5", color: sel ? "#fff" : "#64748B" }}>
                    <Icone nome={a.icone as any} tamanho={16} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: sel ? "#065F46" : "#334155" }}>{a.label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#94A3B8" }}>{a.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {aba === "conexoes" && podeConexoes ? <ConexoesVoipSection /> : podeCampanhas ? <UraDiscadorSection /> : null}
    </div>
  );
}
