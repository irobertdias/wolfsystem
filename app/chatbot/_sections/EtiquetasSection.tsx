"use client";

export function EtiquetasSection() {
  const etiquetas = [
    { nome: "Lead Quente", cor: "#dc2626" },
    { nome: "Lead Frio", cor: "#3b82f6" },
    { nome: "Agendado", cor: "#f59e0b" },
    { nome: "Fechado", cor: "#16a34a" },
    { nome: "Retornar", cor: "#8b5cf6" },
  ];

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Etiquetas</h1>
        <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Etiqueta</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {etiquetas.map((e, i) => (
          <div key={i} style={{ background: "#111", borderRadius: 10, padding: "12px 20px", border: `2px solid ${e.cor}44`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: e.cor }} />
            <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{e.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}