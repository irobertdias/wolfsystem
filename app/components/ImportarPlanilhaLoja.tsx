"use client";
import { useMemo, useState } from "react";
import { gerarSku } from "../lib/loja-sku";

// Importa a tabela do fornecedor/distribuidora (XLSX, XLS ou CSV) para o catálogo da loja.
// Detecta as colunas pelo cabeçalho, calcula o preço de venda pela margem sobre o custo
// e atualiza os produtos que já existem (pelo código do fornecedor, EAN ou SKU).

type Linha = Record<string, any>;
type Mapa = { nome: string; codigo: string; ean: string; marca: string; categoria: string; custo: string; preco: string; estoque: string; descricao: string };
const CAMPOS: { k: keyof Mapa; rotulo: string; pistas: RegExp; obrigatorio?: boolean }[] = [
  { k: "nome", rotulo: "Nome / descrição do produto", pistas: /^(descri|produto|nome|item|titulo|título)/i, obrigatorio: true },
  { k: "codigo", rotulo: "Código do fornecedor", pistas: /(c[oó]d|sku|refer|part ?n|pn\b|modelo)/i },
  { k: "ean", rotulo: "EAN / código de barras", pistas: /(ean|gtin|barra)/i },
  { k: "marca", rotulo: "Marca / fabricante", pistas: /(marca|fabric)/i },
  { k: "categoria", rotulo: "Categoria / grupo", pistas: /(categ|grupo|departamento|fam[ií]lia|linha)/i },
  { k: "custo", rotulo: "Custo (preço do fornecedor)", pistas: /(custo|pre[cç]o|valor|unit)/i },
  { k: "preco", rotulo: "Preço de venda sugerido (opcional)", pistas: /(venda|sugerido|varejo|consumidor|pvp)/i },
  { k: "estoque", rotulo: "Estoque / disponível", pistas: /(estoque|dispon|qtd|quant|saldo)/i },
  { k: "descricao", rotulo: "Descrição longa (opcional)", pistas: /(especifica|detalhe|observa|descri[cç][aã]o completa)/i },
];
const num = (v: any) => { if (typeof v === "number") return v; const s = String(v ?? "").trim().replace(/[^\d,.-]/g, ""); if (!s) return 0; const x = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s); return Number.isFinite(x) ? x : 0; };
const norm = (s: any) => String(s ?? "").trim().toLowerCase();
/** Arredonda para cima até o próximo final ,90 (ex.: 123,40 → 123,90; 123,95 → 124,90). */
const arred = (v: number, final90: boolean) => { if (!final90) return Math.round(v * 100) / 100; const i = Math.floor(v); return Math.round((v <= i + 0.9 ? i + 0.9 : i + 1.9) * 100) / 100; };

export default function ImportarPlanilhaLoja({ produtos, categorias, onSalvar, onFechar }: { produtos: any[]; categorias: string[]; onSalvar: (lista: any[], novasCategorias: string[]) => Promise<string | null>; onFechar: () => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [mapa, setMapa] = useState<Mapa>({ nome: "", codigo: "", ean: "", marca: "", categoria: "", custo: "", preco: "", estoque: "", descricao: "" });
  const [arquivo, setArquivo] = useState("");
  const [margem, setMargem] = useState("30");
  const [final99, setFinal99] = useState(true);
  const [usarEstoque, setUsarEstoque] = useState(true);
  const [catPadrao, setCatPadrao] = useState(categorias[0] || "");
  const [criarCategorias, setCriarCategorias] = useState(true);
  const [fornecedor, setFornecedor] = useState("");
  const [atualizarPreco, setAtualizarPreco] = useState(true);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function ler(file: File) {
    setMsg(""); setArquivo(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sh = wb.Sheets[wb.SheetNames[0]];
      // Algumas tabelas têm título nas primeiras linhas: usa como cabeçalho a primeira linha com 3+ textos.
      const bruto: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
      const iCab = Math.max(0, bruto.findIndex((l) => l.filter((c) => typeof c === "string" && c.trim().length > 1).length >= 3));
      const cab = (bruto[iCab] || []).map((c: any, i: number) => String(c || `Coluna ${i + 1}`).trim());
      const dados = bruto.slice(iCab + 1).filter((l) => l.some((c) => String(c).trim())).slice(0, 5000).map((l) => Object.fromEntries(cab.map((c, i) => [c, l[i]])));
      setCols(cab); setLinhas(dados);
      const m: any = {}; const usadas = new Set<string>();
      for (const c of CAMPOS) { const achou = cab.find((h) => !usadas.has(h) && c.pistas.test(h)); m[c.k] = achou || ""; if (achou) usadas.add(achou); }
      setMapa(m);
      if (!fornecedor) setFornecedor(file.name.replace(/\.(xlsx?|csv)$/i, ""));
      if (bruto.length - iCab - 1 > 5000) setMsg("A planilha tem mais de 5.000 linhas: importei as 5.000 primeiras.");
    } catch (e: any) { setMsg("Não consegui ler o arquivo: " + e.message); }
  }

  const previa = useMemo(() => {
    if (!mapa.nome) return null;
    const m = 1 + num(margem) / 100;
    const porCodigo = new Map<string, any>(), porEan = new Map<string, any>(), porSku = new Map<string, any>();
    for (const p of produtos) { if (p.codigo_fornecedor) porCodigo.set(norm(p.codigo_fornecedor), p); if (p.ean) porEan.set(norm(p.ean), p); if (p.sku) porSku.set(norm(p.sku), p); }
    let novos = 0, atualizados = 0, ignorados = 0; const lista: any[] = []; const cats = new Set<string>();
    const todos = [...produtos];
    for (const l of linhas) {
      const nome = String(l[mapa.nome] ?? "").trim(); if (nome.length < 3) { ignorados++; continue; }
      const custo = mapa.custo ? num(l[mapa.custo]) : 0;
      const sugerido = mapa.preco ? num(l[mapa.preco]) : 0;
      const preco = sugerido > 0 ? sugerido : custo > 0 ? arred(custo * m, final99) : 0;
      if (!preco) { ignorados++; continue; }
      const codigo = mapa.codigo ? String(l[mapa.codigo] ?? "").trim() : "";
      const ean = mapa.ean ? String(l[mapa.ean] ?? "").replace(/\D/g, "") : "";
      let categoria = mapa.categoria ? String(l[mapa.categoria] ?? "").trim() : "";
      const catExiste = categorias.find((c) => norm(c) === norm(categoria));
      categoria = catExiste || (categoria && criarCategorias ? categoria : catPadrao);
      if (categoria && !categorias.some((c) => norm(c) === norm(categoria))) cats.add(categoria);
      const estoque = usarEstoque && mapa.estoque ? Math.max(0, Math.round(num(l[mapa.estoque]))) : null;
      const existe = (codigo && porCodigo.get(norm(codigo))) || (ean && porEan.get(norm(ean))) || (codigo && porSku.get(norm(codigo)));
      if (existe) {
        atualizados++;
        lista.push({ ...existe, custo: custo || existe.custo, preco: atualizarPreco ? preco : existe.preco, ean: ean || existe.ean, fornecedor: fornecedor || existe.fornecedor,
          variantes: estoque === null ? existe.variantes : (existe.variantes?.length === 1 ? [{ ...existe.variantes[0], estoque }] : existe.variantes) });
      } else {
        novos++;
        const sku = gerarSku(categoria, todos);
        const p = { id: Math.random().toString(36).slice(2, 10), nome: nome.slice(0, 160), categoria, marca: mapa.marca ? String(l[mapa.marca] ?? "").trim() || undefined : undefined,
          sku, codigo_fornecedor: codigo || undefined, ean: ean || undefined, fornecedor: fornecedor || undefined,
          descricao: mapa.descricao ? String(l[mapa.descricao] ?? "").trim().slice(0, 1500) || undefined : undefined,
          preco, custo: custo || undefined, ativo: true, servico: false, variantes: [{ id: "unico", estoque: estoque ?? 0 }] };
        todos.push(p); lista.push(p);
      }
    }
    return { novos, atualizados, ignorados, lista, cats: [...cats], amostra: lista.slice(0, 6) };
  }, [linhas, mapa, margem, final99, usarEstoque, catPadrao, criarCategorias, fornecedor, atualizarPreco, produtos, categorias]);

  async function aplicar() {
    if (!previa?.lista.length) return;
    setSalvando(true); setMsg("");
    const ids = new Set(previa.lista.map((p) => p.id));
    const final = [...produtos.filter((p) => !ids.has(p.id)), ...previa.lista];
    const erro = await onSalvar(final, previa.cats);
    setSalvando(false);
    if (erro) setMsg("Erro ao salvar: " + erro); else onFechar();
  }

  const inp: any = { width: "100%", boxSizing: "border-box", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 10, padding: "9px 11px", fontSize: 13.5 };
  const lab: any = { fontSize: 12, fontWeight: 700, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 };
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, width: "min(920px, 100%)", maxHeight: "92vh", overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center" }}><b style={{ fontSize: 19, flex: 1 }}>Importar tabela do fornecedor</b><button onClick={onFechar} style={{ border: 0, background: "#F1F5F9", borderRadius: 10, width: 34, height: 34, cursor: "pointer" }}>✕</button></div>
        <span style={{ fontSize: 13, color: "#64748B" }}>Use a planilha que a distribuidora te manda (Excel ou CSV). O preço de venda é calculado pela sua margem sobre o custo. Produtos que já existem (mesmo código do fornecedor, EAN ou SKU) são atualizados em vez de duplicados.</span>
        <label style={{ border: "2px dashed var(--w-200)", borderRadius: 16, padding: 20, textAlign: "center", cursor: "pointer", background: "var(--w-50)", fontWeight: 700, color: "var(--w-800)" }}>
          {arquivo ? `📄 ${arquivo} · ${linhas.length} linha(s)` : "Clique para escolher a planilha (.xlsx, .xls ou .csv)"}
          <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const a = e.target.files?.[0]; if (a) ler(a); }} />
        </label>
        {cols.length > 0 && (
          <>
            <b style={{ fontSize: 14 }}>Colunas da planilha</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {CAMPOS.map((c) => (
                <label key={c.k} style={lab}>{c.rotulo}{c.obrigatorio ? " *" : ""}
                  <select style={inp} value={mapa[c.k]} onChange={(e) => setMapa({ ...mapa, [c.k]: e.target.value })}><option value="">— não usar —</option>{cols.map((x) => <option key={x}>{x}</option>)}</select>
                </label>
              ))}
            </div>
            <b style={{ fontSize: 14 }}>Regras</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, alignItems: "end" }}>
              <label style={lab}>Margem sobre o custo (%)<input style={inp} inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)} /></label>
              <label style={lab}>Categoria quando não vier<select style={inp} value={catPadrao} onChange={(e) => setCatPadrao(e.target.value)}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label style={lab}>Nome do fornecedor<input style={inp} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} /></label>
              <label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={final99} onChange={(e) => setFinal99(e.target.checked)} /> Terminar preço em ,90</label>
              <label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={usarEstoque} onChange={(e) => setUsarEstoque(e.target.checked)} /> Usar o estoque da planilha</label>
              <label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={criarCategorias} onChange={(e) => setCriarCategorias(e.target.checked)} /> Criar categorias novas</label>
              <label style={{ ...lab, flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={atualizarPreco} onChange={(e) => setAtualizarPreco(e.target.checked)} /> Atualizar preço dos que já existem</label>
            </div>
            {previa && (
              <div style={{ background: "var(--w-50)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <b style={{ fontSize: 14 }}>{previa.novos} novo(s) · {previa.atualizados} atualizado(s){previa.ignorados ? ` · ${previa.ignorados} linha(s) sem nome ou sem preço ignorada(s)` : ""}{previa.cats.length ? ` · ${previa.cats.length} categoria(s) nova(s)` : ""}</b>
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead><tr style={{ textAlign: "left", color: "#64748B" }}><th>Produto</th><th>Categoria</th><th>SKU</th><th style={{ textAlign: "right" }}>Custo</th><th style={{ textAlign: "right" }}>Venda</th><th style={{ textAlign: "right" }}>Estoque</th></tr></thead>
                  <tbody>{previa.amostra.map((p) => <tr key={p.id} style={{ borderTop: "1px solid #E6ECEA" }}><td style={{ padding: "5px 4px" }}>{p.nome}</td><td>{p.categoria}</td><td>{p.sku}</td><td style={{ textAlign: "right" }}>{p.custo ? brl(p.custo) : "—"}</td><td style={{ textAlign: "right", fontWeight: 800 }}>{brl(p.preco)}</td><td style={{ textAlign: "right" }}>{p.variantes?.[0]?.estoque ?? 0}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
        {msg && <span style={{ fontSize: 13, color: "#B45309", fontWeight: 700 }}>{msg}</span>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onFechar} style={{ height: 42, padding: "0 18px", borderRadius: 12, border: 0, background: "#F1F5F9", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button disabled={!previa?.lista.length || salvando} onClick={aplicar} style={{ height: 42, padding: "0 18px", borderRadius: 12, border: 0, background: "var(--w-600)", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: !previa?.lista.length || salvando ? 0.5 : 1 }}>{salvando ? "Importando…" : `Importar ${previa?.lista.length || 0} produto(s)`}</button>
        </div>
      </div>
    </div>
  );
}
