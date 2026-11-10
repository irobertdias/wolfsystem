// Ícones de linha do tema A2 (substituem os emojis nas telas).
import type { CSSProperties, ReactNode } from "react";

const P: Record<string, string> = {
  grafico: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  funil: "M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z",
  dinheiro: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.7 7 6.8c0 4.7 10 2.6 10 7.6 0 2.2-2.2 3.4-5 3.4s-5.2-1.2-5.2-3.2",
  usuarios: "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  usuario: "M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z",
  busca: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5",
  filtro: "M4 6h16M7 12h10M10 18h4",
  calendario: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M9 3v4M15 3v4",
  mais: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17 19 7",
  x: "M6 6l12 12M18 6 6 18",
  editar: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  lixeira: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  telefone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  email: "M4 6h16v12H4V6ZM4 7l8 6 8-6",
  documento: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6",
  config: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  alvo: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  relogio: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  seta: "M5 12h14M13 6l6 6-6 6",
  voltar: "M19 12H5M11 18l-6-6 6-6",
  baixo: "M6 9l6 6 6-6",
  download: "M12 4v11M7 10l5 5 5-5M4 20h16",
  upload: "M12 20V9M7 14l5-5 5 5M4 4h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  olho: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  raio: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  estrela: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z",
  predio: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20",
  carteira: "M4 7a2 2 0 0 1 2-2h12v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2ZM16 14h.01",
  megafone: "M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  robo: "M12 3v3M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM9 13h.01M15 13h.01M9.5 16h5",
  escudo: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z",
  cadeado: "M6 11h12v10H6V11ZM8 11V7a4 4 0 1 1 8 0v4",
  sair: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  alerta: "M12 3 2 20h20L12 3ZM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  copiar: "M9 9h11v11H9V9ZM5 15H4V4h11v1",
  enviar: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9ZM7.5 7.5h.01",
  balanca: "M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0L6 7ZM18 7l-3 7a3 3 0 0 0 6 0l-3-7Z",
  pasta: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  whatsapp: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12ZM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.5 3.5 0 0 1-2-2l1-1-1-2L9 9.5Z",
  sino: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0",
  sinoMudo: "M8.7 3.6A6 6 0 0 1 18 8c0 3 .6 5.1 1.4 6.5M17 17H3s3-2 3-9c0-.6.1-1.1.2-1.6M10 21a2 2 0 0 0 4 0M3 3l18 18",
  sorriso: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01",
  clipe: "M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9",
  microfone: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V6ZM5 11a7 7 0 0 0 14 0M12 18v3",
  atualizar:"M20 11a8 8 0 0 0-14.7-4.4L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16M20 20v-4h-4",
};

export type NomeIcone = keyof typeof P;

// Emoji antigo → ícone de linha (para componentes que recebem `icone` como emoji).
const DE_EMOJI: Record<string, string> = {
  "📊": "grafico", "📈": "grafico", "📉": "grafico", "💹": "grafico",
  "🎯": "alvo", "💰": "dinheiro", "💵": "dinheiro", "💲": "dinheiro", "🤑": "dinheiro", "💸": "dinheiro",
  "👥": "usuarios", "👤": "usuario", "🧑": "usuario", "👨‍💼": "usuario", "👩‍💼": "usuario", "🧑‍💼": "usuario",
  "💬": "chat", "🗨️": "chat", "🔍": "busca", "🔎": "busca", "🧩": "filtro", "🔻": "baixo",
  "📅": "calendario", "🗓️": "calendario", "📆": "calendario", "⏰": "relogio", "⏱️": "relogio", "🕐": "relogio", "⌛": "relogio", "⏳": "relogio",
  "✅": "check", "✔️": "check", "☑️": "check", "❌": "x", "✖️": "x", "✏️": "editar", "📝": "editar", "🗑️": "lixeira",
  "📞": "telefone", "☎️": "telefone", "📱": "whatsapp", "📧": "email", "✉️": "email", "📨": "email",
  "📄": "documento", "📃": "documento", "📑": "documento", "📋": "documento", "🧾": "documento", "📜": "documento",
  "⚙️": "config", "🛠️": "config", "🔧": "config", "🔄": "atualizar", "🔁": "atualizar",
  "⬇️": "download", "📥": "download", "⬆️": "upload", "📤": "upload", "🔗": "link", "👁️": "olho", "👀": "olho",
  "⚡": "raio", "🔥": "raio", "🚀": "raio", "⭐": "estrela", "🌟": "estrela", "🏆": "estrela", "🥇": "estrela",
  "🏢": "predio", "🏬": "predio", "🏦": "predio", "💳": "carteira", "👛": "carteira", "🏧": "carteira",
  "📢": "megafone", "📣": "megafone", "🤖": "robo", "🛡️": "escudo", "🔒": "cadeado", "🔐": "cadeado", "🔑": "cadeado",
  "⚠️": "alerta", "🚨": "alerta", "❗": "alerta", "ℹ️": "info", "💡": "info", "❓": "info",
  "📁": "pasta", "📂": "pasta", "🗂️": "pasta", "🏷️": "tag", "⚖️": "balanca", "📎": "link", "📦": "pasta",
  "➕": "mais", "🧬": "grafico", "♾️": "atualizar", "🎉": "estrela", "👋": "usuario", "🙋": "usuario",
};
export function nomeDoEmoji(e?: string | null): string | null {
  if (!e) return null;
  const k = e.trim();
  return DE_EMOJI[k] || DE_EMOJI[k.replace(/️/g, "")] || DE_EMOJI[k + "️"] || null;
}
// Mostra o ícone de linha equivalente; se não houver, mostra o próprio conteúdo.
export function IconeEmoji({ e, tamanho = 18, cor = "currentColor" }: { e?: ReactNode; tamanho?: number; cor?: string }) {
  const n = typeof e === "string" ? nomeDoEmoji(e) : null;
  if (n) return <Icone nome={n} tamanho={tamanho} cor={cor} style={{ display: "inline-block", verticalAlign: "-0.2em" }} />;
  return <>{e}</>;
}

export default function Icone({ nome, tamanho = 18, cor = "currentColor", espessura = 1.9, style }: {
  nome: NomeIcone | string;
  tamanho?: number;
  cor?: string;
  espessura?: number;
  style?: CSSProperties;
}) {
  const d = P[nome] || P.info;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={espessura}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}
