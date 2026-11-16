"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Table, Vazio, Btn, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import { brl, dataBR, telFmt, ped, totalPedido, CONFIRMADAS, type Pedido } from "../_dados";

export default function Clientes({ dados, ir }: any) {
  const { modo, pedidos } = dados as { modo: "roupas" | "vendas"; pedidos: Pedido[] };
  const [busca, setBusca] = useState("");
  const clientes = useMemo(() => {
    const g: Record<string, { chave: string; nome: string; tel: string; cidade: string; pedidos: number; gasto: number; ultimo: string; tamanhos: Record<string, number> }> = {};
    for (const p of pedidos) {
      const chave = String(p.telefone1 || "").replace(/\D/g, "") || `n:${p.nome.toLowerCase().trim()}`;
      const x = g[chave] ||= { chave, nome: p.nome, tel: p.telefone1 || "", cidade: p.cidade || "", pedidos: 0, gasto: 0, ultimo: "", tamanhos: {} };
      x.pedidos++;
      if (CONFIRMADAS[modo].includes(p.status_venda || "")) {
        x.gasto += totalPedido(ped(p));
        for (const i of ped(p).itens) if (i.tamanho) x.tamanhos[i.tamanho] = (x.tamanhos[i.tamanho] || 0) + i.qtd;
      }
      const q = String(p.created_at);
      if (q > x.ultimo) { x.ultimo = q; x.nome = p.nome; x.cidade = p.cidade || x.cidade; }
    }
    const q = busca.toLowerCase(), dig = busca.replace(/\D/g, "");
    return Object.values(g).filter((x) => !q || x.nome.toLowerCase().includes(q) || (dig.length >= 4 && x.tel.includes(dig))).sort((a, b) => b.gasto - a.gasto);
  }, [pedidos, busca, modo]);
  const recorrentes = clientes.filter((c) => c.pedidos > 1).length;

  return (
    <Page>
      <PageHeader titulo="Clientes" subtitulo={`${clientes.length} cliente(s) · ${recorrentes} compraram mais de uma vez`} acao={<Btn onClick={() => ir("pedidos", { novo: true })}>＋ Novo pedido</Btn>} />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" style={{ ...inputSm, maxWidth: 380 }} />
      <Table cols={[{ label: "Cliente" }, ...(modo === "roupas" ? [{ label: "Tamanhos que compra" }] : []), { label: "Pedidos", align: "center" as const }, { label: "Total comprado", align: "right" as const }, { label: "Última compra" }]}
        empty={clientes.length === 0 ? <Vazio icone="👥" titulo="Nenhum cliente ainda" sub="Os clientes aparecem conforme os pedidos são criados." /> : undefined}>
        {clientes.map((c) => (
          <tr key={c.chave} onClick={() => ir("pedidos", { telefone: c.tel || c.nome })} style={{ cursor: "pointer" }}>
            <td style={tdStyle}><b>{c.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{telFmt(c.tel)}{c.cidade ? ` · ${c.cidade}` : ""}</div></td>
            {modo === "roupas" && <td style={tdStyle}>{Object.entries(c.tamanhos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(", ") || "—"}</td>}
            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{c.pedidos}</td>
            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(c.gasto)}</td>
            <td style={tdStyle}>{dataBR(c.ultimo)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
