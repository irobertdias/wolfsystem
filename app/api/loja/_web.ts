// Utilidades de busca na web para o cadastro com IA das lojas (somente servidor).

/** Bloqueia endereços internos (proteção contra SSRF). */
export function urlPublica(u: string) {
  try {
    const x = new URL(u);
    if (!["http:", "https:"].includes(x.protocol)) return false;
    const h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "0.0.0.0" || h.includes(":")) return false;
    if (/^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false;
    return true;
  } catch { return false; }
}

export async function buscarComTempo(url: string, ms = 7000, init: RequestInit = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; WolfCatalogo/1.0)", "Accept-Language": "pt-BR,pt;q=0.9", ...(init.headers || {}) } }); }
  finally { clearTimeout(t); }
}

/** Imagens principais de uma página de produto (og:image, twitter:image, JSON-LD). */
export async function imagensDaPagina(url: string): Promise<string[]> {
  if (!urlPublica(url)) return [];
  try {
    const r = await buscarComTempo(url, 7000);
    if (!r.ok || !(r.headers.get("content-type") || "").includes("text/html")) return [];
    const html = (await r.text()).slice(0, 600_000);
    const achadas = new Set<string>();
    const meta = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/gi;
    for (const tag of html.match(meta) || []) { const c = tag.match(/content=["']([^"']+)["']/i); if (c) achadas.add(c[1]); }
    const meta2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
    let m: RegExpExecArray | null; while ((m = meta2.exec(html))) achadas.add(m[1]);
    for (const bloco of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
      const imgs = bloco.match(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/);
      if (imgs) for (const u of imgs[1].match(/https?:[^"\\]+/g) || []) achadas.add(u.replace(/\\\//g, "/"));
    }
    return [...achadas].map((u) => { try { return new URL(u.replace(/&amp;/g, "&"), url).toString(); } catch { return ""; } }).filter((u) => u && urlPublica(u)).slice(0, 4);
  } catch { return []; }
}

export const NAVEGADOR = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "text/html,application/xhtml+xml" };
const desfazHtml = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const MARCAS: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", uml: "̈" };
/** Decodifica entidades HTML comuns em português (&atilde; → ã, &nbsp;, &trade;…). */
function entidades(s: string) {
  return desfazHtml(s.replace(/&nbsp;/g, " ").replace(/&trade;/g, "™").replace(/&reg;/g, "®").replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª").replace(/&deg;/g, "°")
    .replace(/&([a-zA-Z])(acute|grave|circ|tilde|cedil|uml);/g, (_, l, k) => (l + MARCAS[k]).normalize("NFC"))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))).replace(/&[a-z]+;/gi, "");
}

export type FotoAchada = { url: string; mini?: string; pagina?: string; titulo?: string };

/** Busca de imagens do Bing (não depende da IA): foto original + miniatura do próprio Bing. */
export async function imagensBing(q: string, qtd = 16): Promise<FotoAchada[]> {
  try {
    const r = await buscarComTempo(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&first=1&cc=BR&setlang=pt-br`, 9000, { headers: NAVEGADOR });
    if (!r.ok) return [];
    const html = await r.text();
    const out: FotoAchada[] = []; const vistos = new Set<string>();
    for (const m of html.matchAll(/\sm="(\{[^"]*?\})"/g)) {
      try {
        const o = JSON.parse(desfazHtml(m[1]));
        if (!o.murl || vistos.has(o.murl) || !urlPublica(o.murl)) continue;
        vistos.add(o.murl);
        out.push({ url: o.murl, mini: o.turl, pagina: o.purl, titulo: o.t ? desfazHtml(String(o.t)).replace(/[-]/g, "") : undefined });
        if (out.length >= qtd) break;
      } catch {}
    }
    return out;
  } catch { return []; }
}

/** Google Imagens pela API oficial (Programmable Search). Precisa de GOOGLE_CSE_KEY e GOOGLE_CSE_CX. */
export async function imagensGoogle(q: string, qtd = 10): Promise<FotoAchada[] | null> {
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return null;
  try {
    const r = await buscarComTempo(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&searchType=image&num=${Math.min(10, qtd)}&gl=br&hl=pt-BR&safe=active`, 9000);
    if (!r.ok) return null;
    const j: any = await r.json();
    return (j.items || []).filter((i: any) => i?.link && urlPublica(i.link)).map((i: any) => ({ url: i.link, mini: i.image?.thumbnailLink, pagina: i.image?.contextLink, titulo: i.title }));
  } catch { return null; }
}

/** Fotos: Google (se configurado) e, se não, Bing. */
export async function buscarImagens(q: string): Promise<FotoAchada[]> {
  const g = await imagensGoogle(q);
  if (g && g.length) return g;
  return imagensBing(q);
}

export type ProdutoLoja = { nome: string; imagem?: string; descricao?: string; preco?: number; marca?: string; url?: string; loja: string };

/** Produtos de uma página de busca de loja que publica schema.org Product (ex.: KaBuM). */
export async function produtosDaBusca(url: string, loja: string): Promise<ProdutoLoja[]> {
  try {
    const r = await buscarComTempo(url, 9000, { headers: NAVEGADOR });
    if (!r.ok) return [];
    const html = await r.text();
    const out: ProdutoLoja[] = [];
    for (const b of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
      try {
        const j = JSON.parse(b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, ""));
        for (const p of (Array.isArray(j) ? j : [j])) {
          if (p?.["@type"] !== "Product" || !p.name) continue;
          const img = Array.isArray(p.image) ? p.image[0] : p.image;
          const preco = Number(p.offers?.price ?? p.offers?.lowPrice);
          const desc = String(p.description || "").replace(/<[^>]+>/g, " ");
          out.push({ nome: String(p.name), imagem: typeof img === "string" ? img : undefined, descricao: entidades(desc).replace(/\s+/g, " ").trim().slice(0, 700), preco: preco > 0 ? preco : undefined, marca: typeof p.brand === "string" ? p.brand : p.brand?.name, url: p.offers?.url || p.url, loja });
        }
      } catch {}
    }
    return out;
  } catch { return []; }
}

export const buscaKabum = (q: string) => produtosDaBusca(`https://www.kabum.com.br/busca/${encodeURIComponent(q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}`, "KaBuM");

/** Fotos livres do Wikimedia Commons (reserva quando as páginas não têm imagem). */
export async function imagensWikimedia(q: string): Promise<string[]> {
  try {
    const r = await buscarComTempo(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&gsrlimit=6`, 6000);
    const j: any = await r.json();
    return Object.values(j?.query?.pages || {}).map((p: any) => p?.imageinfo?.[0]).filter((i: any) => i && /image\/(jpeg|png|webp)/.test(i.mime || "")).map((i: any) => i.thumburl || i.url).slice(0, 4);
  } catch { return []; }
}
