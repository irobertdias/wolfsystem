"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Stats, Stat, Table, Vazio, Btn, Banner, Row, inputSm, tdStyle } from "../_ui";
import { brl, num, descVariante, salvarConfig, baixarCSV, hoje, type Produto } from "../_dados";

export default function Estoque({ dados, ir }: any) {
  const { wsId, modo, cfg, carregar } = dados;
  const roupas = modo === "roupas";
  const [busca, setBusca] = useState("");
  const [soBaixo, setSoBaixo] = useState(false);
  const [aviso, setAviso] = useState("");
  const produtos: Produto[] = (cfg.produtos || []).filter((p: Produto) => !p.servico);
  const linhas = useMemo(() => produtos.flatMap((p) => p.variantes.map((v) => ({ p, v }))).filter(({ p, v }) =>
    (!busca || `${p.nome} ${p.marca || ""} ${p.sku || ""} ${descVariante(v)}`.toLowerCase().includes(busca.toLowerCase())) && (!soBaixo || num(v.estoque) <= cfg.estoque_minimo)), [produtos, busca, soBaixo, cfg.estoque_minimo]);
  const totalPecas = produtos.reduce((s, p) => s + p.variantes.reduce((a, v) => a + num(v.estoque), 0), 0);
  const valorCusto = produtos.reduce((s, p) => s + p.variantes.reduce((a, v) => a + num(v.estoque) * num(p.custo), 0), 0);
  const valorVenda = produtos.reduce((s, p) => s + p.variantes.reduce((a, v) => a + num(v.estoque) * num(p.preco), 0), 0);
  const baixo = produtos.flatMap((p) => p.variantes).filter((v) => num(v.estoque) <= cfg.estoque_minimo).length;

  async function ajustar(pid: string, vid: string, delta: number) {
    setAviso("");
    const nova = (cfg.produtos as Produto[]).map((p) => p.id !== pid ? p : { ...p, variantes: p.variantes.map((v) => v.id !== vid ? v : { ...v, estoque: Math.max(0, num(v.estoque) + delta) }) });
    const { error } = await salvarConfig(wsId, { ...cfg, produtos: nova });
    if (error) setAviso("Erro: " + error.message); else carregar();
  }

  return (
    <Page>
      <PageHeader titulo={roupas ? "Estoque por peça" : "Estoque"} subtitulo={roupas ? "Cada tamanho e cor da grade" : "Produtos com controle de estoque"}
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={() => baixarCSV(`estoque-${hoje()}.csv`, [["Produto", "Marca", roupas ? "Tamanho" : "", roupas ? "Cor" : "", "Estoque", "Preço", "Custo"], ...linhas.map(({ p, v }) => [p.nome, p.marca || "", v.tamanho || "", v.cor || "", v.estoque, String(p.preco).replace(".", ","), String(p.custo || "").replace(".", ",")])])}>Exportar</Btn><Btn onClick={() => ir("catalogo")}>Abrir catálogo</Btn></div>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      <Stats>
        <Stat label={roupas ? "Peças em estoque" : "Unidades em estoque"} icone="📦" valor={String(totalPecas)} />
        <Stat label="Valor de venda do estoque" icone="💰" valor={brl(valorVenda)} />
        <Stat label="Valor de custo do estoque" icone="🧾" valor={brl(valorCusto)} sub={valorCusto ? undefined : "cadastre o custo para ver"} />
        <Stat label="Com estoque baixo" icone="⚠️" valor={String(baixo)} cor="#C2410C" sub={`até ${cfg.estoque_minimo} unidade(s)`} />
      </Stats>
      <Row>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" style={{ ...inputSm, flex: "2 1 260px", width: "auto" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "var(--c-txt2)" }}><input type="checkbox" checked={soBaixo} onChange={(e) => setSoBaixo(e.target.checked)} /> Só estoque baixo</label>
      </Row>
      <Table cols={[{ label: roupas ? "Peça" : "Produto" }, ...(roupas ? [{ label: "Tamanho / cor" }] : []), { label: "Preço", align: "right" as const }, { label: "Estoque", align: "center" as const }, { label: "Ajustar", align: "right" as const }]}
        empty={linhas.length === 0 ? <Vazio icone="📦" titulo="Nada no estoque" sub="Cadastre os produtos no catálogo." /> : undefined}>
        {linhas.map(({ p, v }) => {
          const b = num(v.estoque) <= cfg.estoque_minimo;
          return (
            <tr key={p.id + v.id}>
              <td style={tdStyle}><b>{p.nome}</b><div style={{ fontSize: 12, color: "var(--c-mut)" }}>{[p.marca, p.sku].filter(Boolean).join(" · ")}</div></td>
              {roupas && <td style={tdStyle}>{descVariante(v) || "—"}</td>}
              <td style={{ ...tdStyle, textAlign: "right" }}>{brl(p.preco)}</td>
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: b ? "#B91C1C" : "var(--c-tinta)" }}>{v.estoque}</td>
              <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                {[-1, 1, 5].map((d) => <button key={d} onClick={() => ajustar(p.id, v.id, d)} style={{ marginLeft: 4, border: 0, borderRadius: 9, height: 30, minWidth: 38, cursor: "pointer", fontWeight: 800, background: d < 0 ? "#FEF2F2" : "var(--w-50)", color: d < 0 ? "#B91C1C" : "var(--w-700)" }}>{d > 0 ? `+${d}` : d}</button>)}
              </td>
            </tr>
          );
        })}
      </Table>
    </Page>
  );
}
