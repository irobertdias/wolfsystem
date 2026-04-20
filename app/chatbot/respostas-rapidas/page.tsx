"use client";
import { useState } from "react";

export default function RespostasRapidasPage() {
  const [respostas, setRespostas] = useState([
    { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
    { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
    { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
    { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
  ]);

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>⚡ Respostas Rápidas</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Digite / no chat para usar</p>
        </div>
        <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Resposta</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {respostas.map((r, i) => (
          <div key={i} style={{ background: "#111", borderRadius: 10, padding: "16px 20px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "4px 12px", borderRadius: 8, fontWeight: "bold", whiteSpace: "nowrap" }}>{r.atalho}</span>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
            <button onClick={() => setRespostas(respostas.filter((_, idx) => idx !== i))} style={{ background: "none", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}