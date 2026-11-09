import { NextResponse, type NextRequest } from "next/server";

// Taxa média de mercado do Banco Central (SGS), em % ao mês, para comparar com o contrato.
//   veiculo → 25471: PF, recursos livres, aquisição de veículos
//   imovel  → 25497: PF, recursos direcionados, financiamento imobiliário com taxas de mercado
// GET ?tipo=veiculo|imovel&mes=AAAA-MM  (sem mês, ou mês ainda não divulgado → último disponível)

const SERIES = { veiculo: 25471, imovel: 25497 } as const;

type Ponto = { data: string; valor: string };

// A API do BCB às vezes responde 304/5xx sem motivo: tenta de novo sem cache.
async function buscar(url: string): Promise<Ponto[]> {
  for (const opcoes of [{ next: { revalidate: 43200 } }, { cache: "no-store" as const }]) {
    try {
      const r = await fetch(url, { ...opcoes, headers: { Accept: "application/json", "Cache-Control": "no-cache" } });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length) return j as Ponto[];
    } catch { /* tenta a próxima */ }
  }
  return [];
}

const ddmmaaaa = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") === "imovel" ? "imovel" : "veiculo";
  const mes = request.nextUrl.searchParams.get("mes") || "";
  const serie = SERIES[tipo];
  const base = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados`;
  try {
    let pontos: Ponto[] = [];
    let doMes = false;
    if (/^\d{4}-\d{2}$/.test(mes)) {
      const [a, m] = mes.split("-");
      pontos = await buscar(`${base}?formato=json&dataInicial=01/${m}/${a}&dataFinal=01/${m}/${a}`);
      doMes = pontos.length > 0;
    }
    if (!pontos.length) pontos = await buscar(`${base}/ultimos/1?formato=json`);
    if (!pontos.length) {
      const inicio = new Date(); inicio.setMonth(inicio.getMonth() - 6);
      pontos = await buscar(`${base}?formato=json&dataInicial=${ddmmaaaa(inicio)}&dataFinal=${ddmmaaaa(new Date())}`);
    }
    const p = pontos[pontos.length - 1];
    const taxa = p ? Number(String(p.valor).replace(",", ".")) : NaN;
    if (!p || !Number.isFinite(taxa)) {
      return NextResponse.json({ success: false, error: "Banco Central indisponível no momento" }, { status: 502 });
    }
    const [, mm, aaaa] = p.data.split("/");
    return NextResponse.json({
      success: true,
      tipo,
      serie,
      taxa_mensal: taxa,
      referencia: `${mm}/${aaaa}`,
      do_mes_do_contrato: doMes,
      fonte: `Banco Central do Brasil — SGS ${serie}`,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Banco Central indisponível no momento" }, { status: 502 });
  }
}
