"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Atendimento = {
  id: number; created_at: string; numero: string; nome: string;
  mensagem: string; status: string; fila: string; atendente: string;
};

export default function Contatos() {
  const router = useRouter();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [buscaContato, setBuscaContato] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).single();
      if (ws) {
        const wsId = ws.username || ws.id.toString();
        const { data } = await supabase.from("atendimentos").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
        setAtendimentos(data || []);
      }
    };
    init();
  }, []);

  const contatosFiltrados = atendimentos.filter(a =>
    !buscaContato || a.nome?.toLowerCase().includes(buscaContato.toLowerCase()) || a.numero?.includes(buscaContato)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>👥 Meus Contatos</h1>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>Leads que chegaram pelo WhatsApp — {atendimentos.length} contato(s)</p>
        </div>
      </div>
      <input placeholder="🔍 Buscar por nome ou número..." value={buscaContato} onChange={e => setBuscaContato(e.target.value)} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, maxWidth: 380 }} />
      {atendimentos.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>👥</p>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum contato ainda</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Os leads que chegarem pelo WhatsApp aparecerão aqui automaticamente!</p>
        </div>
      ) : (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d0d0d" }}>
                {["Contato", "Número", "Última Mensagem", "Fila", "Atendente", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contatosFiltrados.map((a, i) => (
                <tr key={a.id} onClick={() => router.push("/chatbot")} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "#111" : "#0d0d0d", cursor: "pointer" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3b82f622", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                      <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>📱 {a.numero}</td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.fila}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: a.atendente === "BOT" ? "#8b5cf622" : "#16a34a22", color: a.atendente === "BOT" ? "#8b5cf6" : "#16a34a", fontSize: 11, padding: "3px 8px", borderRadius: 10 }}>{a.atendente === "BOT" ? "🤖 BOT" : "👤 " + a.atendente}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: a.status === "resolvido" ? "#16a34a22" : a.status === "em_atendimento" ? "#f59e0b22" : "#3b82f622", color: a.status === "resolvido" ? "#16a34a" : a.status === "em_atendimento" ? "#f59e0b" : "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: "bold" }}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}