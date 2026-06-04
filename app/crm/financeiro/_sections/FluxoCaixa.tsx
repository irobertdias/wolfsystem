"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🌊 Fluxo de Caixa — entradas/saídas realizadas (pago) mês a mês
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const inputStyle: any = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" };

export default function FluxoCaixa() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).eq("status", "pago").in("tipo", ["receita", "despesa"]);
    setLancs((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const linhas = MESES.map((nome, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const pref = `${ano}-${mm}`;
    const doMes = lancs.filter((l) => (l.pago_em || "").slice(0, 7) === pref);
    const entrada = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
    const saida = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
    return { nome, entrada, saida, saldo: entrada - saida };
  });
  let acc = 0;
  const comAcc = linhas.map((l) => { acc += l.saldo; return { ...l, acumulado: acc }; });
  const totE = linhas.reduce((s, l) => s + l.entrada, 0);
  const totS = linhas.reduce((s, l) => s + l.saida, 0);

  const cell: any = { padding: "10px 12px", fontSize: 13, textAlign: "right", borderTop: "1px solid #f3f4f6" };
  const head: any = { padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "right", background: "#f8fafc" };

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🌊</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Fluxo de Caixa</h1>
        </div>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} style={inputStyle}>
          {[0, 1, 2].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y}</option>; })}
        </select>
      </div>
      {carregando ? <p style={{ color: "#9ca3af" }}>Carregando…</p> : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...head, textAlign: "left" }}>Mês</th>
              <th style={head}>Entradas</th><th style={head}>Saídas</th><th style={head}>Saldo</th><th style={head}>Acumulado</th>
            </tr></thead>
            <tbody>
              {comAcc.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...cell, textAlign: "left", fontWeight: 600, color: "#111827" }}>{l.nome}</td>
                  <td style={{ ...cell, color: "#16a34a" }}>{l.entrada ? brl(l.entrada) : "—"}</td>
                  <td style={{ ...cell, color: "#dc2626" }}>{l.saida ? brl(l.saida) : "—"}</td>
                  <td style={{ ...cell, fontWeight: 700, color: l.saldo >= 0 ? "#16a34a" : "#dc2626" }}>{brl(l.saldo)}</td>
                  <td style={{ ...cell, fontWeight: 700, color: l.acumulado >= 0 ? "#111827" : "#dc2626" }}>{brl(l.acumulado)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f8fafc" }}>
                <td style={{ ...cell, textAlign: "left", fontWeight: 800 }}>Total</td>
                <td style={{ ...cell, fontWeight: 800, color: "#16a34a" }}>{brl(totE)}</td>
                <td style={{ ...cell, fontWeight: 800, color: "#dc2626" }}>{brl(totS)}</td>
                <td style={{ ...cell, fontWeight: 800, color: (totE - totS) >= 0 ? "#16a34a" : "#dc2626" }}>{brl(totE - totS)}</td>
                <td style={cell}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}