"use client";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Table, Vazio, Btn, Banner, Pill, tdStyle } from "../../financeiro/_sections/_ui";
import { etapaDe, brl, dataBR, telFmt, ped, totalPedido, qtdItens, mudarEtapa, baixarCSV, hoje, descVariante, type Pedido } from "../_dados";

export default function Entregas({ dados, ir }: any) {
  const { wsId, modo, pedidos, carregar } = dados as { wsId: string; modo: "roupas"; pedidos: Pedido[]; carregar: () => void };
  const [aviso, setAviso] = useState("");
  const separar = pedidos.filter((p) => p.status_venda === "EM SEPARACAO");
  const rota = pedidos.filter((p) => p.status_venda === "AGUARDANDO ENTREGA");
  const hojeISO = hoje();
  const entreguesHoje = pedidos.filter((p) => p.status_venda === "ENTREGUE" && String(p.updated_at || "").slice(0, 10) === hojeISO);
  const atrasados = rota.filter((p) => ped(p).data_entrega && ped(p).data_entrega! < hojeISO);

  async function mover(p: Pedido, nova: string) {
    setAviso("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await mudarEtapa(wsId, modo, p, nova, "", user?.email || "");
    if (error) setAviso("Erro: " + error.message); else carregar();
  }
  const ordem = (l: Pedido[]) => [...l].sort((a, b) => String(ped(a).data_entrega || "9").localeCompare(String(ped(b).data_entrega || "9")));

  const tabela = (l: Pedido[], acao: (p: Pedido) => React.ReactNode, vazio: string) => (
    <Table cols={[{ label: "Pedido" }, { label: "Cliente / endereço" }, { label: "Peças" }, { label: "Quando" }, { label: "Total", align: "right" }, { label: "", align: "right" }]}
      empty={l.length === 0 ? <Vazio icone="🚚" titulo={vazio} /> : undefined}>
      {ordem(l).map((p) => {
        const d = ped(p);
        return (
          <tr key={p.id}>
            <td style={{ ...tdStyle, cursor: "pointer" }} onClick={() => ir("pedidos", { pedidoId: p.id })}><b>#{d.numero || p.id}</b></td>
            <td style={tdStyle}><b>{p.nome}</b> · {telFmt(p.telefone1)}<div style={{ fontSize: 12, color: "#64748B" }}>{d.entrega === "retirada" ? "Retirada na loja" : [p.endereco, p.cidade].filter(Boolean).join(" · ") || "sem endereço"}</div></td>
            <td style={{ ...tdStyle, fontSize: 12.5 }}>{qtdItens(d.itens)} peça(s)<div style={{ color: "#94A3B8" }}>{d.itens.slice(0, 3).map((i) => `${i.qtd}x ${i.nome}${descVariante(i) ? ` ${descVariante(i)}` : ""}`).join(", ")}</div></td>
            <td style={tdStyle}>{d.data_entrega ? dataBR(d.data_entrega) : "—"}{d.periodo_entrega ? <div style={{ fontSize: 12, color: "#94A3B8" }}>{d.periodo_entrega}</div> : null}{d.data_entrega && d.data_entrega < hojeISO && p.status_venda !== "ENTREGUE" ? <Pill texto="atrasado" cor="#DC2626" /> : null}</td>
            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(totalPedido(d))}<div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{d.pagamento}</div></td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{acao(p)}</td>
          </tr>
        );
      })}
    </Table>
  );

  return (
    <Page>
      <PageHeader titulo="Separação e entregas" subtitulo="O que separar, o que está na rua e o que já chegou"
        acao={<Btn variante="ghost" onClick={() => baixarCSV(`romaneio-${hojeISO}.csv`, [["Pedido", "Cliente", "Telefone", "Endereço", "Cidade", "Data", "Período", "Peças", "Total", "Pagamento"], ...ordem(rota).map((p) => { const d = ped(p); return [d.numero || p.id, p.nome, telFmt(p.telefone1), d.entrega === "retirada" ? "Retirada" : p.endereco || "", p.cidade || "", dataBR(d.data_entrega), d.periodo_entrega || "", d.itens.map((i) => `${i.qtd}x ${i.nome} ${descVariante(i)}`).join(" | "), totalPedido(d).toFixed(2).replace(".", ","), d.pagamento || ""]; })])}>Romaneio (CSV)</Btn>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      {atrasados.length > 0 && <Banner tipo="warn"><b>{atrasados.length} entrega(s) atrasada(s).</b></Banner>}
      <Stats>
        <Stat label="Para separar" icone="📦" valor={String(separar.length)} />
        <Stat label="Na rua / prontos" icone="🚚" valor={String(rota.length)} />
        <Stat label="Entregues hoje" icone="✅" valor={String(entreguesHoje.length)} />
      </Stats>
      <h3 style={{ margin: "6px 0 0", fontSize: 16, color: "#0F172A" }}>Separar</h3>
      {tabela(separar, (p) => <Btn variante="ghost" onClick={() => mover(p, "AGUARDANDO ENTREGA")}>{ped(p).entrega === "retirada" ? "Pronto p/ retirada" : "Saiu p/ entrega"} →</Btn>, "Nada para separar")}
      <h3 style={{ margin: "6px 0 0", fontSize: 16, color: "#0F172A" }}>Na rua / aguardando retirada</h3>
      {tabela(rota, (p) => <Btn onClick={() => mover(p, "ENTREGUE")}>Entregue ✓</Btn>, "Nenhuma entrega pendente")}
      <div style={{ fontSize: 12.5, color: "#94A3B8" }}>Status de cada etapa: {["EM SEPARACAO", "AGUARDANDO ENTREGA", "ENTREGUE"].map((k) => etapaDe(modo, k).label).join(" → ")}</div>
    </Page>
  );
}
