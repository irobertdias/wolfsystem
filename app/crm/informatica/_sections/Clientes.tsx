"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Table, Vazio, Btn, inputSm, tdStyle } from "../_ui";
import { brl, dataBR, telFmt, ped, totalPedido, CONFIRMADAS, os, totalOS, type Pedido } from "../_dados";

export default function Clientes({ dados, ir }: any) {
  const { pedidos, ordens } = dados as { pedidos: Pedido[]; ordens: Pedido[] };
  const [busca, setBusca] = useState("");
  const clientes = useMemo(() => {
    type C = { chave: string; nome: string; tel: string; compras: number; os: number; gasto: number; ultimo: string; equipamentos: Set<string> };
    const g: Record<string, C> = {};
    const pega = (p: Pedido) => {
      const chave = String(p.telefone1 || "").replace(/\D/g, "") || `n:${p.nome.toLowerCase().trim()}`;
      const x = g[chave] ||= { chave, nome: p.nome, tel: p.telefone1 || "", compras: 0, os: 0, gasto: 0, ultimo: "", equipamentos: new Set() };
      if (String(p.created_at) > x.ultimo) { x.ultimo = String(p.created_at); x.nome = p.nome; }
      return x;
    };
    for (const p of pedidos) { const x = pega(p); x.compras++; if (CONFIRMADAS.vendas.includes(p.status_venda || "")) x.gasto += totalPedido(ped(p)); }
    for (const p of ordens) { const x = pega(p); const d = os(p); x.os++; if (p.status_venda === "ENTREGUE") x.gasto += totalOS(d); const eq = [d.equipamento, d.marca, d.modelo].filter(Boolean).join(" "); if (eq) x.equipamentos.add(eq); }
    const q = busca.toLowerCase(), dig = busca.replace(/\D/g, "");
    return Object.values(g).filter((x) => !q || x.nome.toLowerCase().includes(q) || (dig.length >= 4 && x.tel.includes(dig)) || [...x.equipamentos].some((e) => e.toLowerCase().includes(q))).sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  }, [pedidos, ordens, busca]);

  return (
    <Page>
      <PageHeader titulo="Clientes e equipamentos" subtitulo={`${clientes.length} cliente(s) · compras e ordens de serviço juntas`} acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={() => ir("os", { novo: true })}>＋ Nova OS</Btn><Btn onClick={() => ir("pedidos", { novo: true })}>＋ Venda</Btn></div>} />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou equipamento" style={{ ...inputSm, maxWidth: 380 }} />
      <Table cols={[{ label: "Cliente" }, { label: "Equipamentos atendidos" }, { label: "Compras", align: "center" }, { label: "OS", align: "center" }, { label: "Total gasto", align: "right" }, { label: "Último contato" }, { label: "", align: "right" }]}
        empty={clientes.length === 0 ? <Vazio icone="👥" titulo="Nenhum cliente ainda" sub="Os clientes aparecem com as vendas e as ordens de serviço." /> : undefined}>
        {clientes.map((c) => (
          <tr key={c.chave}>
            <td style={tdStyle}><b>{c.nome}</b><div style={{ fontSize: 12, color: "var(--i-mut)" }}>{telFmt(c.tel)}</div></td>
            <td style={{ ...tdStyle, fontSize: 12.5, color: "var(--i-txt2)", maxWidth: 260 }}>{[...c.equipamentos].slice(0, 3).join(" · ") || "—"}</td>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{c.compras}</td>
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{c.os}</td>
            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(c.gasto)}</td>
            <td style={tdStyle}>{dataBR(c.ultimo)}</td>
            <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
              {c.os > 0 && <Btn variante="ghost" onClick={() => ir("os", { telefone: c.tel || c.nome })}>OS</Btn>}
              {c.compras > 0 && <Btn variante="ghost" onClick={() => ir("pedidos", { telefone: c.tel || c.nome })}>Compras</Btn>}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
