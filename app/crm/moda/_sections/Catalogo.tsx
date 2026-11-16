"use client";
import { useState } from "react";
import { Page, PageHeader, Btn, Banner, Field, Row, Vazio, Modal, inputSm, SERIFA } from "../_ui";
import { brl, num, novoId, estoqueProduto, salvarConfig, type Produto, type Variante } from "../_dados";
import { SIMBOLOS } from "../../../lib/arte-nicho";

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";
const vid = (t?: string, c?: string) => `${t || "-"}|${c || "-"}`;

async function reduzirFoto(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = URL.createObjectURL(file); });
  const lado = 260, esc = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

type Form = Produto & { tamanhosSel: string[]; cores: string[]; novaCor: string; estoqueGrade: Record<string, string>; estoqueUnico: string };

export default function Catalogo({ dados, gestor }: any) {
  const { wsId, modo, cfg, carregar } = dados;
  const roupas = modo === "roupas";
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("");
  const [f, setF] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const produtos: Produto[] = cfg.produtos || [];
  const lista = produtos.filter((p) => (!cat || p.categoria === cat) && (!busca || `${p.nome} ${p.marca || ""} ${p.sku || ""}`.toLowerCase().includes(busca.toLowerCase())));

  const abrir = (p?: Produto) => {
    setErro("");
    if (p) {
      const tamanhos = [...new Set(p.variantes.map((v) => v.tamanho).filter(Boolean))] as string[];
      const cores = [...new Set(p.variantes.map((v) => v.cor).filter(Boolean))] as string[];
      setF({ ...p, tamanhosSel: tamanhos, cores, novaCor: "", estoqueGrade: Object.fromEntries(p.variantes.map((v) => [vid(v.tamanho, v.cor), String(v.estoque)])), estoqueUnico: String(p.variantes[0]?.estoque ?? 0) });
    } else {
      setF({ id: novoId(), nome: "", categoria: cfg.categorias[0] || "", marca: "", sku: "", preco: 0, custo: 0, ativo: true, servico: false, variantes: [], tamanhosSel: roupas ? ["P", "M", "G"] : [], cores: [], novaCor: "", estoqueGrade: {}, estoqueUnico: "0" });
    }
  };

  async function salvar() {
    if (!f) return;
    if (!f.nome.trim()) { setErro("Informe o nome."); return; }
    if (!num(f.preco)) { setErro("Informe o preço."); return; }
    let variantes: Variante[];
    if (roupas && (f.tamanhosSel.length || f.cores.length)) {
      const ts = f.tamanhosSel.length ? f.tamanhosSel : [undefined as any];
      const cs = f.cores.length ? f.cores : [undefined as any];
      variantes = ts.flatMap((t: string) => cs.map((c: string) => ({ id: vid(t, c), tamanho: t, cor: c, estoque: Math.max(0, Math.round(num(f.estoqueGrade[vid(t, c)]))) })));
    } else {
      variantes = [{ id: f.variantes[0]?.id || "unico", estoque: f.servico ? 0 : Math.max(0, Math.round(num(f.estoqueUnico))) }];
    }
    const prod: Produto = { id: f.id, nome: f.nome.trim(), categoria: f.categoria, marca: f.marca?.trim() || undefined, sku: f.sku?.trim() || undefined, descricao: f.descricao, preco: num(f.preco), custo: num(f.custo) || undefined, foto: f.foto, ativo: f.ativo !== false, servico: !!f.servico, variantes };
    setSalvando(true);
    const existe = produtos.some((p) => p.id === prod.id);
    const { error } = await salvarConfig(wsId, { ...cfg, produtos: existe ? produtos.map((p) => (p.id === prod.id ? prod : p)) : [...produtos, prod] });
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setF(null); carregar();
  }
  async function remover() {
    if (!f || !confirm(`Remover "${f.nome}" do catálogo?`)) return;
    const { error } = await salvarConfig(wsId, { ...cfg, produtos: produtos.filter((p) => p.id !== f.id) });
    if (error) { setErro(error.message); return; }
    setF(null); carregar();
  }

  const simbolo = SIMBOLOS[modo === "roupas" ? "roupas" : "vendas"];
  return (
    <Page>
      <PageHeader titulo={roupas ? "Catálogo" : "Produtos e serviços"} subtitulo={`${produtos.length} ${roupas ? "peça(s)" : "item(ns)"} cadastrado(s)`} acao={<Btn onClick={() => abrir()}>＋ {roupas ? "Nova peça" : "Novo produto ou serviço"}</Btn>} />
      <Row>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={roupas ? "Buscar peça, marca ou código" : "Buscar produto, serviço ou código"} style={{ ...inputSm, flex: "2 1 260px", width: "auto" }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inputSm, flex: "1 1 180px", width: "auto" }}><option value="">Todas as categorias</option>{cfg.categorias.map((c: string) => <option key={c}>{c}</option>)}</select>
      </Row>
      {lista.length === 0 ? (
        <div style={{ background: "var(--m-papel)", border: "1px solid var(--m-linha)", padding: 44 }}><Vazio icone={roupas ? "👗" : "🏷️"} titulo={produtos.length ? "Nada encontrado" : roupas ? "Catálogo vazio" : "Nenhum produto ainda"} sub={roupas ? "Cadastre as peças com a grade de tamanhos e cores para controlar o estoque de cada uma." : "Cadastre produtos (com estoque) e serviços (sem estoque)."} acao={<Btn onClick={() => abrir()}>＋ Cadastrar</Btn>} /></div>
      ) : (
        <div className="moda-lookbook">
          {lista.map((p, k) => {
            const est = estoqueProduto(p), baixo = !p.servico && est <= cfg.estoque_minimo;
            const tams = [...new Set(p.variantes.map((v) => v.tamanho).filter(Boolean))] as string[];
            const cores = [...new Set(p.variantes.map((v) => v.cor).filter(Boolean))] as string[];
            return (
              <button key={p.id} onClick={() => abrir(p)} className={`moda-look${k % 7 === 0 ? " destaque" : ""}`} style={{ opacity: p.ativo === false ? 0.5 : 1 }}>
                <div className="moda-look-foto" style={{ background: p.foto ? `#EFE9DF url(${p.foto}) center/cover` : undefined }}>
                  {!p.foto && <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round"><path d={simbolo[k % simbolo.length]} /></svg>}
                  <span className="moda-look-num">Nº {String(k + 1).padStart(2, "0")}</span>
                  {baixo && <span className="moda-look-selo">{est === 0 ? "Esgotado" : "Últimas peças"}</span>}
                  {tams.length > 0 && <span className="moda-look-grade">{tams.map((t) => { const q = p.variantes.filter((v) => v.tamanho === t).reduce((s, v) => s + (Number(v.estoque) || 0), 0); return <i key={t} className={q > 0 ? "" : "zero"}>{t}</i>; })}</span>}
                </div>
                <div style={{ padding: "12px 2px 4px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 9.5, color: "var(--m-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".18em" }}>{[p.categoria, p.marca].filter(Boolean).join(" · ") || "Coleção"}</span>
                  <span style={{ fontSize: 18, color: "var(--m-tinta)", fontFamily: SERIFA, lineHeight: 1.2 }}>{p.nome}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ color: "var(--m-tinta)", fontSize: 14, fontWeight: 600 }}>{brl(p.preco)}</span>
                    {cores.length > 0 && <span style={{ fontSize: 12, color: "var(--m-sub)", fontFamily: SERIFA, fontStyle: "italic" }}>{cores.length === 1 ? cores[0] : `${cores.length} cores`}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: p.servico ? "var(--m-sub)" : baixo ? "#9F1239" : "var(--m-sub)" }}>{p.servico ? "serviço" : `${est} em estoque`}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {f && (
        <Modal titulo={produtos.some((p) => p.id === f.id) ? f.nome || "Produto" : roupas ? "Nova peça" : "Novo produto ou serviço"} onClose={() => setF(null)} maxWidth={820}
          footer={<>{gestor && produtos.some((p) => p.id === f.id) && <Btn variante="danger" onClick={remover}>Remover</Btn>}<Btn variante="ghost" onClick={() => setF(null)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn></>}>
          {erro && <Banner tipo="warn">{erro}</Banner>}
          <Row>
            <div style={{ flex: "0 0 120px" }}>
              <label style={{ display: "flex", width: 120, height: 120, borderRadius: 16, cursor: "pointer", background: f.foto ? `#fff url(${f.foto}) center/cover` : "var(--w-50)", alignItems: "center", justifyContent: "center", color: "var(--w-600)", fontSize: 12, fontWeight: 800, textAlign: "center", boxShadow: "inset 0 0 0 1.5px var(--w-200)" }}>
                {!f.foto && "＋ Foto"}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, foto: await reduzirFoto(file) }); }} />
              </label>
              {f.foto && <a onClick={() => setF({ ...f, foto: undefined })} style={{ fontSize: 12, color: "var(--m-mut)", cursor: "pointer" }}>remover foto</a>}
            </div>
            <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 10 }}>
              <Row>
                <Field label={roupas ? "Nome da peça" : "Nome"} flex="2 1 220px"><input style={inputSm} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={roupas ? "Ex.: Vestido midi linho" : "Ex.: Instalação, Kit X"} /></Field>
                <Field label="Categoria" flex="1 1 150px"><select style={inputSm} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{cfg.categorias.map((c: string) => <option key={c}>{c}</option>)}</select></Field>
              </Row>
              <Row>
                {roupas && <Field label="Marca / coleção" flex="1 1 150px"><input style={inputSm} value={f.marca || ""} onChange={(e) => setF({ ...f, marca: e.target.value })} /></Field>}
                <Field label="Código / SKU" flex="1 1 120px"><input style={inputSm} value={f.sku || ""} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
                <Field label="Preço de venda (R$)" flex="1 1 130px"><input style={inputSm} inputMode="decimal" value={String(f.preco || "").replace(".", ",")} onChange={(e) => setF({ ...f, preco: e.target.value as any })} /></Field>
                <Field label="Custo (R$)" flex="1 1 110px"><input style={inputSm} inputMode="decimal" value={String(f.custo || "").replace(".", ",")} onChange={(e) => setF({ ...f, custo: e.target.value as any })} /></Field>
              </Row>
              {num(f.preco) > 0 && num(f.custo) > 0 && <span style={{ fontSize: 12.5, color: "var(--m-sub)" }}>Margem: <b>{Math.round(((num(f.preco) - num(f.custo)) / num(f.preco)) * 100)}%</b> ({brl(num(f.preco) - num(f.custo))} por {roupas ? "peça" : "unidade"})</span>}
            </div>
          </Row>

          {roupas ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--w-700)", letterSpacing: ".04em", textTransform: "uppercase" }}>Grade: tamanhos e cores</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {cfg.tamanhos.map((t: string) => { const sel = f.tamanhosSel.includes(t); return <button key={t} onClick={() => setF({ ...f, tamanhosSel: sel ? f.tamanhosSel.filter((x) => x !== t) : cfg.tamanhos.filter((x: string) => x === t || f.tamanhosSel.includes(x)) })} style={{ minWidth: 44, height: 36, borderRadius: 10, border: 0, cursor: "pointer", fontWeight: 800, background: sel ? "var(--w-600)" : "var(--m-campo)", color: sel ? "#fff" : "var(--m-txt2)" }}>{t}</button>; })}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {f.cores.map((c) => <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--m-campo)", borderRadius: 999, padding: "5px 10px", fontSize: 13, fontWeight: 700 }}>{c}<a onClick={() => setF({ ...f, cores: f.cores.filter((x) => x !== c) })} style={{ cursor: "pointer", color: "var(--m-mut)" }}>✕</a></span>)}
                <input style={{ ...inputSm, width: 160 }} placeholder="Cor (Enter para incluir)" value={f.novaCor} onChange={(e) => setF({ ...f, novaCor: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && f.novaCor.trim()) { e.preventDefault(); setF({ ...f, cores: [...new Set([...f.cores, f.novaCor.trim()])], novaCor: "" }); } }} />
              </div>
              {(f.tamanhosSel.length > 0 || f.cores.length > 0) ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse" }}>
                    <thead><tr><th style={{ padding: 6, fontSize: 12, color: "var(--m-sub)", textAlign: "left" }}>Estoque</th>{(f.tamanhosSel.length ? f.tamanhosSel : ["—"]).map((t) => <th key={t} style={{ padding: 6, fontSize: 12, color: "var(--m-sub)" }}>{t}</th>)}</tr></thead>
                    <tbody>
                      {(f.cores.length ? f.cores : [""]).map((c) => (
                        <tr key={c || "sem"}>
                          <td style={{ padding: 6, fontSize: 13, fontWeight: 700 }}>{c || "Única cor"}</td>
                          {(f.tamanhosSel.length ? f.tamanhosSel : [""]).map((t) => { const k = vid(t || undefined, c || undefined); return <td key={k} style={{ padding: 4 }}><input style={{ ...inputSm, width: 64, textAlign: "center" }} inputMode="numeric" value={f.estoqueGrade[k] ?? ""} placeholder="0" onChange={(e) => setF({ ...f, estoqueGrade: { ...f.estoqueGrade, [k]: e.target.value } })} /></td>; })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Row><Field label="Estoque" flex="0 1 140px"><input style={inputSm} inputMode="numeric" value={f.estoqueUnico} onChange={(e) => setF({ ...f, estoqueUnico: e.target.value })} /></Field></Row>}
            </>
          ) : (
            <Row>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--m-txt2)" }}><input type="checkbox" checked={!!f.servico} onChange={(e) => setF({ ...f, servico: e.target.checked })} /> É um serviço (não controla estoque)</label>
              {!f.servico && <Field label="Estoque" flex="0 1 140px"><input style={inputSm} inputMode="numeric" value={f.estoqueUnico} onChange={(e) => setF({ ...f, estoqueUnico: e.target.value })} /></Field>}
            </Row>
          )}
          <Row>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--m-txt2)" }}><input type="checkbox" checked={f.ativo !== false} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Disponível para venda</label>
          </Row>
        </Modal>
      )}
    </Page>
  );
}
