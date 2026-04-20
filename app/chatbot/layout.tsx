"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type Atendimento = { id: number; status: string; };

export default function DashboardPage() {
  const { workspace } = useWorkspace();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);

  useEffect(() => {
    if (!workspace?.id) return;
    const fetch = async () => {
      const { data } = await supabase.from("atendimentos").select("*").eq("workspace_id", workspace.username || workspace.id.toString());
      setAtendimentos(data || []);
    };
    fetch();
  }, [workspace]);

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📊 Dashboard</h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Abertos", value: atendimentos.filter(a => a.status === "aberto").length, color: "#3b82f6", icon: "💬" },
          { label: "Em Atendimento", value: atendimentos.filter(a => a.status === "em_atendimento").length, color: "#f59e0b", icon: "👤" },
          { label: "Resolvidos", value: atendimentos.filter(a => a.status === "resolvido").length, color: "#16a34a", icon: "✅" },
          { label: "Total", value: atendimentos.length, color: "#8b5cf6", icon: "📊" },
        ].map(card => (
          <div key={card.label} style={{ flex: "1 1 200px", background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
            <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}