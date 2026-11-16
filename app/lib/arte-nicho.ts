// Identidade visual de cada nicho: símbolos (traço 24x24), padrão de fundo,
// arte grande para os banners e o rótulo do ramo. Aplicado no <html> como
// variáveis CSS (--nicho-padrao, --nicho-padrao-chat, --nicho-arte) por
// aplicarCorDoNicho (vertical-workspace.ts) e usado em globals.css.
import type { Vertical } from "./vertical-workspace";

const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const SIMBOLOS: Record<Vertical, string[]> = {
  telecom: [
    "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",              // wi-fi
    "M12 4v17M8 21l4-9 4 9M6 7.5a8 8 0 0 1 12 0M8.5 10a4.5 4.5 0 0 1 7 0",                           // torre/antena
    "M3 14h18v5H3zM7 16.5h.01M11 16.5h.01M7 14L5 8M17 14l2-6",                                      // roteador
    "M4 20v-3M9 20v-7M14 20V9M19 20V4",                                                              // sinal
    `M3 17c4 0 4-10 9-10s5 10 9 10${circ(3, 17, 1.3)}${circ(21, 17, 1.3)}`,                          // fibra
    `${circ(12, 12, 9)}M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18`,                    // globo
  ],
  revisional: [
    "M12 3v18M7 21h10M4 7h16M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z",                     // balança
    "M6 2h9l4 4v16H6zM15 2v4h4M9 11h7M9 15h7M9 19h4",                                                // contrato
    "M6 2h12v20H6zM9 5h6v4H9zM9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01",            // calculadora
    "M14 3l7 7M11 6l7 7M12.5 4.5l-6 6M9.5 12.5L3 19M15 21H8",                                        // martelo
    "M3 3v18h18M7 15l4-4 3 3 6-7",                                                                   // gráfico
    `M19 5L5 19${circ(7, 7, 2)}${circ(17, 17, 2)}`,                                                  // %
  ],
  consignado: [
    `M2 7h20v10H2z${circ(12, 12, 2.6)}M5.5 10v4M18.5 10v4`,                                          // cédula
    `${circ(12, 12, 9)}M10 7.5h2.8a2.2 2.2 0 0 1 0 4.4H10V7.5zM10 11.9v4.6M12.6 11.9l2.2 4.6`,     // moeda R$
    "M2 6h20v12H2zM2 10h20M6 15h4",                                                                  // cartão
    "M3 10h18M12 3l9 5H3zM5 10v8M9 10v8M15 10v8M19 10v8M3 21h18",                                   // banco
    "M5 12a7 6 0 0 1 13-2.5h2v4l-2 1a7 6 0 0 1-3 3.5v2h-3v-1h-2v1H7v-2a6 6 0 0 1-2-6zM12 6.5V4M15.5 11h.01", // cofrinho
    "M3 7h16a2 2 0 0 1 2 2v10H3zM3 7l12-3v3M16 13h5v4h-5zM18 15h.01",                                // carteira
  ],
  vendas: [
    "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",                                                        // sacola
    `M3 12V3h9l9 9-9 9z${circ(7.5, 7.5, 1.5)}`,                                                      // etiqueta
    `M2 4h2.5l2.6 11h11L21 7H6M9 20h.01M17 20h.01${circ(9, 20, 1.2)}${circ(17, 20, 1.2)}`,          // carrinho
    "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",                                                  // caixa
    `${circ(12, 12, 9)}M8.5 12.5l2.5 2.5 4.5-5`,                                                     // check
    `M19 5L5 19${circ(7, 7, 2)}${circ(17, 17, 2)}`,                                                  // desconto
  ],
  roupas: [
    "M12 6.5a2 2 0 1 1 2 2c-1 .4-2 1-2 2l9.5 6.5H2.5L12 10.5",                                       // cabide
    "M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c0 2-2 3.2-4 3.2S8 5 8 3z",                                  // camiseta
    "M9.5 2h5l-1 5 5.5 14H5L10.5 7z",                                                                // vestido
    `${circ(6, 6, 2.6)}${circ(6, 18, 2.6)}M8.2 7.5L20 18M8.2 16.5L20 6`,                             // tesoura
    `${circ(10, 12, 6)}${circ(10, 12, 1.4)}M16 12h6v4h-6M18 16v-2M20 16v-2`,                         // fita métrica
    "M3 18h18v-2c-3.5 0-6.5-1.2-8.5-4.5L9.5 7 5.5 9l1 5.5L3 16z",                                    // sapato
  ],
};

export const ROTULO: Record<Vertical, string> = {
  telecom: "Internet & Telecom",
  revisional: "Revisão de contratos",
  consignado: "Crédito consignado",
  vendas: "Vendas & Pedidos",
  roupas: "Moda & Vestuário",
};

const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const icone = (d: string, x: number, y: number, escala: number, rot: number, cor: string, op: number, larg = 1.6) =>
  `<g transform="translate(${x} ${y}) rotate(${rot} 12 12) scale(${escala})" fill="none" stroke="${cor}" stroke-opacity="${op}" stroke-width="${larg / escala}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;

// Posições do ladrilho 260x260 (x, y, escala, rotação), com os 6 símbolos espalhados.
const LADRILHO: [number, number, number, number][] = [
  [14, 16, 1.5, -12], [140, 6, 1.3, 10], [78, 92, 1.7, 6], [196, 96, 1.4, -8], [20, 176, 1.35, 14], [150, 184, 1.6, -4],
  [214, 20, 0.9, 20], [104, 210, 0.9, -18],
];

/** Padrão de fundo (data URI) com os símbolos do nicho. */
export function padraoNicho(v: Vertical, cor: string, opacidade = 0.09) {
  const s = SIMBOLOS[v];
  const g = LADRILHO.map(([x, y, e, r], i) => icone(s[i % s.length], x, y, e, r, cor, opacidade)).join("");
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">${g}</svg>`);
}

/** Arte grande dos banners (traço branco translúcido sobre o gradiente do nicho). */
export function arteNicho(v: Vertical) {
  const s = SIMBOLOS[v];
  const g = [
    icone(s[0], 150, 30, 6.2, -8, "#ffffff", 0.28, 1.5),
    icone(s[1], 40, 110, 3.6, 10, "#ffffff", 0.22, 1.4),
    icone(s[2], 250, 150, 3, -14, "#ffffff", 0.2, 1.3),
    icone(s[3], 20, 10, 2.2, 12, "#ffffff", 0.16, 1.2),
    icone(s[4], 290, 20, 2, -6, "#ffffff", 0.16, 1.2),
  ].join("");
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240">${g}</svg>`);
}

/** Ícone do nicho (o primeiro símbolo) para usar inline. */
export const iconeNicho = (v: Vertical) => SIMBOLOS[v][0];

// Tons escuros de cada nicho para o padrão de fundo (o padrão é imagem: não lê variável CSS).
export const TOM_PADRAO: Record<Vertical, string> = {
  telecom: "#047857", revisional: "#047857", consignado: "#1D4ED8", vendas: "#C2410C", roupas: "#BE123C",
};
