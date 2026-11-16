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

/** Fotos livres do Wikimedia Commons (reserva quando as páginas não têm imagem). */
export async function imagensWikimedia(q: string): Promise<string[]> {
  try {
    const r = await buscarComTempo(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&gsrlimit=6`, 6000);
    const j: any = await r.json();
    return Object.values(j?.query?.pages || {}).map((p: any) => p?.imageinfo?.[0]).filter((i: any) => i && /image\/(jpeg|png|webp)/.test(i.mime || "")).map((i: any) => i.thumburl || i.url).slice(0, 4);
  } catch { return []; }
}
