"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { useSoftphone } from "../../hooks/useSoftphone";

type Atendimento = {
  id: number; created_at: string; updated_at?: string; numero: string; nome: string; mensagem: string;
  status: string; fila: string; atendente: string; workspace_id: string;
  canal_id?: number;
  email?: string; notas?: string; avaliacao?: number;
  bloqueado_ia?: boolean; bloqueado_fluxo?: boolean; bloqueado_typebot?: boolean; bloqueado_contato?: boolean;
  funil_etapa?: string; kanban_coluna?: string; demanda?: string; valor?: number;
};
type Mensagem = { id?: number; created_at?: string; numero: string; mensagem: string; de: string; workspace_id?: string; canal_id?: number; };
type Etiqueta = { id: number; nome: string; cor: string; icone: string; };
type UsuarioWs = { email: string; nome: string; };
type CanalInfo = { id: number; nome: string; tipo: string; };

const WA_BG_DARK = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' opacity='0.04'><g fill='%23ffffff'><path d='M40 40 l10 0 l0 10 l-10 0 z'/><circle cx='70' cy='75' r='4'/><path d='M110 35 l15 -5 l5 15 l-15 5 z' opacity='0.6'/><circle cx='150' cy='55' r='3'/><path d='M30 110 l8 8 l-8 8 l-8 -8 z'/><circle cx='80' cy='135' r='5'/><path d='M130 115 l10 0 l-5 10 z' opacity='0.7'/><circle cx='165' cy='150' r='4'/><path d='M50 170 l12 0 l-6 12 z'/><circle cx='100' cy='180' r='3'/></g></svg>")`;

// 🆕 Lista de emojis organizados por categoria (estilo WhatsApp/Telegram)
// Seleção curada dos mais usados — sem depender de lib externa
const EMOJIS_CATEGORIAS: { id: string; label: string; icone: string; emojis: string[] }[] = [
  {
    id: "smileys", label: "Smileys", icone: "😊", emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
      "😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨",
      "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕",
      "🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁",
      "☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣",
      "😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺"
    ]
  },
  {
    id: "gestos", label: "Gestos & Pessoas", icone: "👋", emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆",
      "🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️",
      "💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁️","👅","👄",
      "👶","🧒","👦","👧","🧑","👨","👩","🧔","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷"
    ]
  },
  {
    id: "animais", label: "Animais & Natureza", icone: "🐶", emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵",
      "🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗",
      "🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖",
      "🐙","🦑","🦐","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍",
      "🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🎍","🎋","🍃","🍂","🍁","🍄","🌾",
      "💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗",
      "🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","💫","⭐","🌟","✨","⚡","☄️","💥","🔥"
    ]
  },
  {
    id: "comida", label: "Comida & Bebida", icone: "🍔", emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
      "🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠",
      "🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴",
      "🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜",
      "🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧",
      "🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯",
      "🥛","🍼","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴"
    ]
  },
  {
    id: "atividades", label: "Atividades & Esportes", icone: "⚽", emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍",
      "🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌",
      "🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽",
      "🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹",
      "🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🎲","♟️","🎯",
      "🎳","🎮","🎰","🧩","🎨"
    ]
  },
  {
    id: "viagens", label: "Viagens & Lugares", icone: "🚗", emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵",
      "🚲","🛴","🛺","🚠","🚡","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇",
      "🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️",
      "⛴️","🚢","⚓","⛽","🚧","🚦","🚥","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢",
      "🎠","⛲","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️","⛺","🏠","🏡","🏘️","🏚️",
      "🏗️","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","⛪","🕌","🕍","🛕","🕋"
    ]
  },
  {
    id: "objetos", label: "Objetos", icone: "💡", emojis: [
      "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼",
      "📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭",
      "⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸",
      "💵","💴","💶","💷","💰","💳","💎","⚖️","🧰","🔧","🔨","⚒️","🛠️","⛏️","🔩","⚙️",
      "🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","⚱️","🏺","🔮",
      "📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪",
      "🌡️","🧹","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪒","🧽","🧴","🔑","🗝️","🚪",
      "🛋️","🛏️","🛌","🧸","🖼️","🛍️","🛒","🎁","🎈","🎏","🎀","🎊","🎉","🎎","🏮","🎐"
    ]
  },
  {
    id: "simbolos", label: "Símbolos & Corações", icone: "❤️", emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈",
      "♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴",
      "📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲",
      "🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷",
      "🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️",
      "🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤",
      "🏧","🚾","♿","🅿️","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","🚻","🚮","🎦"
    ]
  }
];

// ═══ Player de áudio estilo WhatsApp (com waveform real) ═══
function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(Array(40).fill(0.3));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resp = await fetch(src);
        const buf = await resp.arrayBuffer();
        // @ts-ignore
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(buf);
        const raw = audioBuffer.getChannelData(0);
        const samples = 40;
        const blockSize = Math.floor(raw.length / samples);
        const peaks: number[] = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j] || 0);
          peaks.push(sum / blockSize);
        }
        const max = Math.max(...peaks, 0.01);
        const normalized = peaks.map(p => Math.max(0.15, p / max));
        if (!cancel) setWaveform(normalized);
        try { ctx.close(); } catch {}
      } catch (err) { console.warn("Falha ao gerar waveform:", err); }
    })();
    return () => { cancel = true; };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => { setDuration(a.duration || 0); setLoaded(true); };
    const onTime = () => setCurrent(a.currentTime || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const seekFromBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, pct * duration));
    a.currentTime = newTime; setCurrent(newTime);
  };

  const format = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const corAtiva = isOwn ? "#ffffff" : "#00a884";
  const corInativa = isOwn ? "#0d7a5f" : "#5d7a80";
  const progress = duration ? current / duration : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 260, padding: "4px 2px" }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />
      <button onClick={toggle}
        style={{ width: 36, height: 36, borderRadius: "50%", background: isOwn ? "#ffffff22" : "#00a88422", border: "none", color: isOwn ? "#ffffff" : "#00a884", fontSize: 16, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div onClick={seekFromBar}
          style={{ display: "flex", alignItems: "center", gap: 2, height: 28, cursor: "pointer", userSelect: "none" }}>
          {waveform.map((h, i) => {
            const isPast = (i / waveform.length) < progress;
            return (
              <div key={i} style={{ flex: 1, height: `${Math.max(15, h * 100)}%`, minHeight: 4, background: isPast ? corAtiva : corInativa, borderRadius: 2, transition: "background 0.1s" }} />
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: isOwn ? "#a3e4d0" : "#8696a0", fontVariantNumeric: "tabular-nums" }}>
          {loaded ? format(playing || current > 0 ? current : duration) : "carregando…"}
        </span>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isOwn ? "#ffffff22" : "#8696a033", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
        {isOwn ? "👤" : "🧑"}
      </div>
    </div>
  );
}

export function ChatSection() {
  const { workspace, wsId, user } = useWorkspace();
  const { permissoes, isDono } = usePermissao();
  // 🆕 Softphone — botão de ligar chama iniciarChamada(numero, nome)
  const { iniciarChamada } = useSoftphone();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  // 🆕 Ref do container de mensagens — usado pra ler scrollTop e saber se o user tá no fundo
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 🆕 "Sticky fundo": se o usuário está colado ao final (ou não). Só mexe scroll automaticamente se true.
  // Evita o bug de forçar o scroll pra baixo quando o user tá lendo msg antiga lá em cima.
  const [stickyFundo, setStickyFundo] = useState(true);
  // 🆕 Indica se chegou mensagem nova enquanto o user estava scrollado pra cima (pra mostrar badge flutuante)
  const [temMensagemNova, setTemMensagemNova] = useState(false);

  // 🆕 Indica se a Roleta de Distribuição está ativa no workspace.
  // Quando ativa, o atendente vê o botão "Parar BOT/IA" nos chats onde a roleta já atribuiu ele,
  // mesmo com o bot ainda respondendo. Clicando, ele assume e o bot para.
  const [roletaAtiva, setRoletaAtiva] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);

  // 🆕 Emoji picker — abre painel fixo acima do input, estilo WhatsApp
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategoria, setEmojiCategoria] = useState<string>("smileys");
  const [emojiBusca, setEmojiBusca] = useState("");

  // 🆕 Upload de mídia (imagem/vídeo/PDF/Excel/doc)
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [arquivoPreviewUrl, setArquivoPreviewUrl] = useState<string>("");
  const [legendaArquivo, setLegendaArquivo] = useState("");
  const [enviandoMidia, setEnviandoMidia] = useState(false);

  // 🆕 Template WABA — envia template pra cliente (rompe janela 24h de WABA)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templatesDoCanal, setTemplatesDoCanal] = useState<any[]>([]);
  const [templateEscolhido, setTemplateEscolhido] = useState<any | null>(null);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [enviandoTemplate, setEnviandoTemplate] = useState(false);
  // 🆕 Menu de 3 pontinhos REMOVIDO — todos os botões ficam visíveis na toolbar agora
  const [abaConversa, setAbaConversa] = useState<"automatico" | "aguardando" | "abertos" | "finalizados">("aguardando");
  const [busca, setBusca] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Atendimento | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [canais, setCanais] = useState<CanalInfo[]>([]);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");

  const [mostrarTodosFinalizados, setMostrarTodosFinalizados] = useState(false);

  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [meuNome, setMeuNome] = useState("");

  const [showPainelContato, setShowPainelContato] = useState(false);
  const [abaPainel, setAbaPainel] = useState<"perfil" | "protocolo" | "funil" | "ia" | "utils" | "etiquetas">("perfil");
  const [salvandoContato, setSalvandoContato] = useState(false);

  const [etiquetasWorkspace, setEtiquetasWorkspace] = useState<Etiqueta[]>([]);
  const [etiquetasAtendimento, setEtiquetasAtendimento] = useState<number[]>([]);

  const [filtroFila, setFiltroFila] = useState("todas");
  const [filtroAtendente, setFiltroAtendente] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("todas");

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };
  const inputSm = { ...IS, padding: "7px 10px", fontSize: 12 };

  const respostasRapidas = [
    { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
    { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
    { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
    { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
  ];

  const WA_BASE = process.env.NEXT_PUBLIC_WHATSAPP_URL || "";
  const isAudioMsg = (txt: string) => typeof txt === "string" && txt.startsWith("[audio:") && txt.endsWith("]");
  const audioFilename = (txt: string) => txt.replace(/^\[audio:/, "").replace(/\]$/, "");

  // 🆕 Parsers de mídia nova (img/video/file) — formato: "[tipo:filename]" ou "[tipo:filename]\nlegenda"
  const parseMidia = (txt: string): { tipo: "img" | "video" | "file" | null; filename: string; legenda: string } => {
    if (typeof txt !== "string") return { tipo: null, filename: "", legenda: "" };
    const match = txt.match(/^\[(img|video|file):([^\]]+)\](\n([\s\S]*))?$/);
    if (!match) return { tipo: null, filename: "", legenda: "" };
    return {
      tipo: match[1] as "img" | "video" | "file",
      filename: match[2],
      legenda: match[4] || ""
    };
  };

  // Ícone baseado na extensão do arquivo (pra tipo=file)
  const iconePorExtensao = (filename: string): string => {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    if (["pdf"].includes(ext)) return "📕";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (["doc", "docx", "rtf"].includes(ext)) return "📄";
    if (["ppt", "pptx"].includes(ext)) return "📽️";
    if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
    if (["txt"].includes(ext)) return "📝";
    return "📎";
  };
  const audioUrl = (filename: string) => `${WA_BASE}/audios/${filename}`;

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const nomeDoAtendente = (emailOrBot: string): string => {
    if (!emailOrBot) return "—";
    if (emailOrBot === "BOT") return "BOT";
    if (emailOrBot === "sistema") return "Sistema";
    const u = usuariosWs.find(u => u.email?.toLowerCase() === emailOrBot.toLowerCase());
    if (u?.nome) return u.nome;
    return emailOrBot.split("@")[0];
  };

  const nomeDoCanal = (canalId?: number): string => {
    if (!canalId) return "—";
    const c = canais.find(ch => ch.id === canalId);
    return c ? c.nome : `Canal ${canalId}`;
  };

  const iconeCanal = (canalId?: number): string => {
    if (!canalId) return "📱";
    const c = canais.find(ch => ch.id === canalId);
    return c?.tipo === "waba" ? "🔗" : "📱";
  };

  const fetchCanais = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("conexoes").select("id, nome, tipo").eq("workspace_id", wsId);
    setCanais(data || []);
  };

  const fetchAtendimentos = async () => {
    if (!wsId) return;
    // 🆕 Ordena por updated_at (última atividade real) ao invés de created_at (só quando criou).
    // Se a tabela ainda não tiver updated_at populado em todas as linhas, o Supabase usa como fallback
    // o próprio created_at graças ao trigger padrão. E no frontend a gente sempre faz updated_at || created_at.
    const { data } = await supabase.from("atendimentos").select("*")
      .eq("workspace_id", wsId)
      .order("updated_at", { ascending: false, nullsFirst: false });
    setAtendimentos(data || []);
  };

  const fetchHistorico = async (numero: string, canalId?: number) => {
    if (!wsId) return;  // 🔒 SEGURANÇA: sem wsId, não busca nada (evita vazamento)
    // 🔒 MULTI-TENANT: sempre filtra por workspace_id — antes vazava mensagens entre workspaces
    // que tivessem o mesmo número (ex: lead da Abc + lead da RM TELECOM com mesmo telefone).
    let query = supabase.from("mensagens").select("*")
      .eq("numero", numero)
      .eq("workspace_id", wsId);
    if (canalId) query = query.eq("canal_id", canalId);
    const { data } = await query.order("created_at", { ascending: true });
    setHistorico(data || []);
  };

  const fetchEtiquetasWorkspace = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("etiquetas").select("*").eq("workspace_id", wsId).order("nome", { ascending: true });
    setEtiquetasWorkspace(data || []);
  };

  const fetchEtiquetasAtendimento = async (atendimentoId: number) => {
    const { data } = await supabase.from("atendimento_etiquetas").select("etiqueta_id").eq("atendimento_id", atendimentoId);
    setEtiquetasAtendimento((data || []).map(d => d.etiqueta_id));
  };

  const fetchUsuariosWorkspace = async () => {
    if (!wsId) return;
    const subs: UsuarioWs[] = [];
    const { data } = await supabase.from("usuarios_workspace").select("email, nome").eq("workspace_id", wsId);
    if (data) subs.push(...data);
    if (workspace?.owner_email) { subs.push({ email: workspace.owner_email, nome: workspace.nome || "Dono" }); }
    setUsuariosWs(subs);
    if (user?.email) {
      const eu = subs.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
      if (eu?.nome) setMeuNome(eu.nome);
      else setMeuNome(user.email.split("@")[0]);
    }
  };

  const toggleEtiqueta = async (etiquetaId: number) => {
    if (!atendimentoAtivo) return;
    const jaTem = etiquetasAtendimento.includes(etiquetaId);
    setSalvandoContato(true);
    try {
      if (jaTem) {
        await supabase.from("atendimento_etiquetas").delete().eq("atendimento_id", atendimentoAtivo.id).eq("etiqueta_id", etiquetaId);
        setEtiquetasAtendimento(prev => prev.filter(id => id !== etiquetaId));
      } else {
        await supabase.from("atendimento_etiquetas").insert([{ atendimento_id: atendimentoAtivo.id, etiqueta_id: etiquetaId }]);
        setEtiquetasAtendimento(prev => [...prev, etiquetaId]);
      }
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoContato(false);
  };

  const inserirMensagemSistema = async (numero: string, texto: string, canalId?: number) => {
    try {
      const payload: any = { numero, mensagem: texto, de: "sistema", workspace_id: wsId };
      if (canalId) payload.canal_id = canalId;
      await supabase.from("mensagens").insert([payload]);
    } catch (e) { console.error("Erro ao inserir mensagem de sistema:", e); }
  };

  useEffect(() => {
    if (!wsId) return;
    fetchCanais();
    fetchAtendimentos();
    fetchEtiquetasWorkspace();
    fetchUsuariosWorkspace();

    // 🆕 Busca config da roleta (pra saber se botão "Parar BOT/IA" aparece)
    const fetchRoleta = async () => {
      const { data } = await supabase.from("roleta_config").select("ativa").eq("workspace_id", wsId).maybeSingle();
      setRoletaAtiva(!!data?.ativa);
    };
    fetchRoleta();

    const ch = supabase.channel("atendimentos_chat_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` }, () => fetchAtendimentos())
      .on("postgres_changes", { event: "*", schema: "public", table: "etiquetas", filter: `workspace_id=eq.${wsId}` }, () => fetchEtiquetasWorkspace())
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${wsId}` }, () => fetchUsuariosWorkspace())
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes", filter: `workspace_id=eq.${wsId}` }, () => fetchCanais())
      // 🆕 Atualiza em tempo real se o dono ligar/desligar a roleta
      .on("postgres_changes", { event: "*", schema: "public", table: "roleta_config", filter: `workspace_id=eq.${wsId}` }, () => fetchRoleta())
      .subscribe();
    const polling = setInterval(() => fetchAtendimentos(), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [wsId, workspace?.owner_email, user?.email]);

  useEffect(() => {
    if (!atendimentoAtivo) { setEtiquetasAtendimento([]); return; }
    setHistorico([]);
    // 🆕 Ao abrir um atendimento NOVO, reseta o sticky pra true e esconde o badge —
    // o user acabou de entrar no chat, faz sentido ir pro fundo.
    setStickyFundo(true);
    setTemMensagemNova(false);
    fetchHistorico(atendimentoAtivo.numero, atendimentoAtivo.canal_id);
    fetchEtiquetasAtendimento(atendimentoAtivo.id);
    const num = atendimentoAtivo.numero; const cId = atendimentoAtivo.canal_id;
    // 🔒 SEGURANÇA MULTI-TENANT: filter `workspace_id=eq.${wsId}` no postgres_changes garante
    // que o canal só recebe INSERTs deste workspace. Antes recebia de TODOS workspaces e filtrava
    // no JS — vulnerável (e desperdiçava ciclos). Agora o Postgres filtra na fonte.
    const ch = supabase.channel(`msgs_${wsId}_${num}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `workspace_id=eq.${wsId}` }, (payload) => {
        const m = payload.new as Mensagem;
        // Defesa extra: confere workspace mesmo após filter (não custa nada)
        if (m.workspace_id !== wsId) return;
        if (m.numero === num && (!cId || m.canal_id === cId)) {
          setHistorico(p => [...p, m]);
          // 🆕 Se o user está scrollado pra cima lendo msg antiga, NÃO arrasta ele pra baixo —
          // apenas sinaliza que chegou msg nova. Ele decide quando descer clicando no badge.
          if (!stickyFundoRef.current) {
            setTemMensagemNova(true);
          }
        }
      }).subscribe();
    const polling = setInterval(() => fetchHistorico(num, cId), 3000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [atendimentoAtivo?.numero, atendimentoAtivo?.id, atendimentoAtivo?.canal_id]);

  // 🆕 Ref que espelha o state de stickyFundo — necessário porque o listener do realtime
  // é criado uma vez e capturaria o valor inicial de stickyFundo no closure (stale state).
  const stickyFundoRef = useRef(stickyFundo);
  useEffect(() => { stickyFundoRef.current = stickyFundo; }, [stickyFundo]);

  // 🆕 Handler do scroll — detecta se o user está "colado" no fundo do chat
  // (tolerância de 120px pra não virar cacete quando dá um leve overshoot)
  const onScrollChat = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanciaDoFundo = el.scrollHeight - el.scrollTop - el.clientHeight;
    const estaNoFundo = distanciaDoFundo < 120;
    if (estaNoFundo !== stickyFundo) setStickyFundo(estaNoFundo);
    if (estaNoFundo && temMensagemNova) setTemMensagemNova(false);
  };

  // 🆕 Scroll automático SÓ se o usuário estiver colado ao fundo (sticky=true).
  // Se ele tá lendo msg antiga lá em cima, o polling de 3s NÃO vai mais arrastar ele de volta.
  useEffect(() => {
    if (!stickyFundo) return;
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [historico, stickyFundo]);

  // 🆕 Função pro botão "↓ Nova mensagem" — leva o user pro fundo manualmente e limpa o badge
  const irParaFundo = () => {
    setStickyFundo(true);
    setTemMensagemNova(false);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentesEmails = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);
  const podeVerTudo = isDono || permissoes.chat_todos;

  const classificarAba = (a: Atendimento): "automatico" | "aguardando" | "abertos" | "finalizados" => {
    if (a.status === "resolvido") return "finalizados";
    if (a.atendente === "BOT") return "automatico";
    // 🆕 Se já tem um atendente real atribuído (ex: vindo da roleta), vai direto pra "Abertos".
    // Antes caía em "Aguardando" porque status ainda era "pendente" — agora respeita o atendente real.
    const atendenteEhReal = !!a.atendente && !["BOT", "Humano"].includes(a.atendente);
    if (atendenteEhReal) return "abertos";
    if (a.status === "pendente") return "aguardando";
    return "abertos";
  };

  const podeVerAtendimento = (a: Atendimento, aba: string): boolean => {
    if (aba === "abertos") {
      if (podeVerTudo) return true;
      return a.atendente === user?.email;
    }
    if (aba === "finalizados") {
      if (podeVerTudo && mostrarTodosFinalizados) return true;
      return a.atendente === user?.email;
    }
    return true;
  };

  const contadoresAbas = { automatico: 0, aguardando: 0, abertos: 0, finalizados: 0 };
  atendimentos.forEach(a => {
    const aba = classificarAba(a);
    if (!podeVerAtendimento(a, aba)) return;
    contadoresAbas[aba]++;
  });

  const atendimentosFiltrados = atendimentos
    .filter(a => classificarAba(a) === abaConversa)
    .filter(a => podeVerAtendimento(a, abaConversa))
    .filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.numero?.includes(busca))
    .filter(a => filtroFila === "todas" || a.fila === filtroFila)
    .filter(a => filtroAtendente === "todos" || a.atendente === filtroAtendente)
    .filter(a => filtroCanal === "todos" || String(a.canal_id) === filtroCanal);

  const temFiltroAtivo = filtroFila !== "todas" || filtroAtendente !== "todos" || filtroEtiqueta !== "todas" || filtroCanal !== "todos";

  const enviarMensagem = async () => {
    if (!mensagem || !atendimentoAtivo) return;
    if (!atendimentoAtivo.canal_id) { alert("⚠️ Atendimento sem canal_id. Não é possível enviar."); return; }
    setEnviandoMsg(true);
    // 🆕 User enviou mensagem → ele claramente quer ver a própria msg, então volta pro fundo
    setStickyFundo(true);
    setTemMensagemNova(false);
    try {
      const nomeHeader = meuNome ? `*${meuNome}*\n` : "";
      const mensagemFinal = nomeHeader + mensagem;
      // 🔒 MULTI-TENANT: workspaceId é OBRIGATÓRIO no backend agora.
      // Sem ele a rota /enviar retorna 400. wsId vem do useWorkspace().
      const resp = await wa("enviar", { numero: atendimentoAtivo.numero, mensagem: mensagemFinal, canalId: atendimentoAtivo.canal_id, workspaceId: wsId });
      if (!resp.success) { alert("Erro ao enviar: " + (resp.error || "desconhecido")); }
      else { setMensagem(""); }
    }
    catch { alert("Erro ao enviar!"); }
    setEnviandoMsg(false);
  };

  // 🆕 EMOJI PICKER — insere emoji no texto da mensagem no cursor
  const inserirEmoji = (emoji: string) => {
    setMensagem(prev => prev + emoji);
  };

  // Filtra emojis pela busca (procura pelo char mesmo ou deixa passar todos se busca vazia)
  const emojisVisiveis = (() => {
    const cat = EMOJIS_CATEGORIAS.find(c => c.id === emojiCategoria);
    if (!cat) return [];
    if (!emojiBusca.trim()) return cat.emojis;
    // Busca simples: se o char do emoji contém o texto, retorna
    // (limitação: emojis não têm nome, então busca só filtra por aparência parcial)
    return cat.emojis.filter(e => e.includes(emojiBusca));
  })();

  // 🆕 UPLOAD DE MÍDIA — quando user clica em 📎 e escolhe um arquivo
  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_MB = 25; // Limite Meta/WABA = 16MB pra imagem, 100MB pra doc. 25MB é seguro pra todos.
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`⚠️ Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo ${MAX_MB}MB.`);
      if (fileUploadRef.current) fileUploadRef.current.value = "";
      return;
    }
    setArquivoSelecionado(file);
    // Cria preview URL pra imagens/vídeos
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setArquivoPreviewUrl(url);
    } else {
      setArquivoPreviewUrl("");
    }
    setLegendaArquivo("");
    if (fileUploadRef.current) fileUploadRef.current.value = "";
  };

  const cancelarEnvioArquivo = () => {
    if (arquivoPreviewUrl) URL.revokeObjectURL(arquivoPreviewUrl);
    setArquivoSelecionado(null);
    setArquivoPreviewUrl("");
    setLegendaArquivo("");
  };

  const enviarMidia = async () => {
    if (!arquivoSelecionado || !atendimentoAtivo) return;
    if (!atendimentoAtivo.canal_id) { alert("⚠️ Atendimento sem canal_id."); return; }
    setEnviandoMidia(true);
    setStickyFundo(true);
    setTemMensagemNova(false);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivoSelecionado);
      fd.append("numero", atendimentoAtivo.numero);
      fd.append("canalId", String(atendimentoAtivo.canal_id));
      // 🔒 MULTI-TENANT: workspaceId obrigatório (proxy /api/whatsapp-midia repassa o FormData inteiro)
      fd.append("workspaceId", String(wsId));
      if (legendaArquivo) fd.append("legenda", legendaArquivo);
      const resp = await fetch("/api/whatsapp-midia", { method: "POST", body: fd });
      const data = await resp.json();
      if (!data.success) {
        alert("Erro ao enviar arquivo: " + (data.error || "desconhecido"));
      } else {
        cancelarEnvioArquivo();
      }
    } catch (e: any) {
      alert("Erro ao enviar arquivo: " + e.message);
    }
    setEnviandoMidia(false);
  };

  // 🆕 TEMPLATE WABA — calcula se passou 24h da última mensagem do cliente
  // Só faz sentido em canais WABA (WebJS não tem limite de janela)
  const canalAtivo = canais.find(c => c.id === atendimentoAtivo?.canal_id);
  const ehCanalWaba = canalAtivo?.tipo === "waba";

  const { janelaExpirada, horasDesdeUltimaMsgCliente } = (() => {
    if (!ehCanalWaba || historico.length === 0) {
      return { janelaExpirada: false, horasDesdeUltimaMsgCliente: 0 };
    }
    // Pega a mensagem mais recente VINDA DO CLIENTE
    const msgsCliente = historico.filter(m => m.de === "cliente");
    if (msgsCliente.length === 0) {
      // Nunca recebeu mensagem do cliente → janela nunca abriu → considera expirada
      return { janelaExpirada: true, horasDesdeUltimaMsgCliente: 9999 };
    }
    const ultimaMsgCliente = msgsCliente[msgsCliente.length - 1];
    const tempoMs = Date.now() - new Date(ultimaMsgCliente.created_at).getTime();
    const horas = tempoMs / (1000 * 60 * 60);
    return { janelaExpirada: horas > 24, horasDesdeUltimaMsgCliente: horas };
  })();

  const abrirModalTemplate = async () => {
    if (!atendimentoAtivo?.canal_id || !wsId) return;
    setShowTemplateModal(true);
    // Busca templates aprovados do canal no Supabase direto (mais rápido que passar pelo backend)
    const { data } = await supabase.from("templates_waba")
      .select("*").eq("workspace_id", wsId).eq("canal_id", atendimentoAtivo.canal_id).eq("status", "aprovado")
      .order("created_at", { ascending: false });
    setTemplatesDoCanal(data || []);
    setTemplateEscolhido(null);
    setTemplateVars({});
  };

  // Extrai variáveis {{1}}, {{2}} etc do template selecionado
  const variaveisDoTemplate = (() => {
    if (!templateEscolhido) return [] as string[];
    const vars = new Set<string>();
    for (const comp of templateEscolhido.componentes || []) {
      if ((comp.type === "BODY" && comp.text) || (comp.type === "HEADER" && comp.format === "TEXT" && comp.text)) {
        const matches = comp.text.matchAll(/\{\{(\d+)\}\}/g);
        for (const m of matches) vars.add(m[1]);
      }
    }
    return Array.from(vars).sort((a, b) => parseInt(a) - parseInt(b));
  })();

  const enviarTemplateWaba = async () => {
    if (!templateEscolhido || !atendimentoAtivo) return;
    // Valida que todas as variáveis estão preenchidas
    const faltando = variaveisDoTemplate.filter(v => !templateVars[v]?.trim());
    if (faltando.length > 0) {
      if (!confirm(`⚠️ Variáveis sem valor: ${faltando.map(v => `{{${v}}}`).join(", ")}.\n\nElas vão ser enviadas literalmente. Continuar?`)) return;
    }
    setEnviandoTemplate(true);
    try {
      const resp = await wa("enviar-template", {
        numero: atendimentoAtivo.numero,
        canalId: atendimentoAtivo.canal_id,
        templateId: templateEscolhido.id,
        variaveis: templateVars,
        workspaceId: wsId
      });
      if (!resp.success) {
        alert("Erro ao enviar template: " + (resp.error || "desconhecido"));
      } else {
        setShowTemplateModal(false);
        setTemplateEscolhido(null);
        setTemplateVars({});
        setStickyFundo(true);
      }
    } catch (e: any) {
      alert("Erro ao enviar template: " + e.message);
    }
    setEnviandoTemplate(false);
  };

  const iniciarGravacao = async () => {
    if (!atendimentoAtivo) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
                 : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                 : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
                 : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      setGravando(true); setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000);
    } catch (err: any) { alert("Não foi possível acessar o microfone.\n\n" + (err.message || "Verifique as permissões do navegador.")); }
  };

  const pararStream = () => {
    if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cancelarGravacao = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    audioChunksRef.current = []; pararStream(); setGravando(false); setTempoGravacao(0);
  };

  const enviarAudioGravado = async () => {
    if (!atendimentoAtivo || !mediaRecorderRef.current) return;
    if (!atendimentoAtivo.canal_id) { alert("⚠️ Atendimento sem canal_id. Não é possível enviar áudio."); return; }
    // 🆕 Áudio agora funciona em WebJS E WABA. Backend converte pra OGG opus e envia via Graph API
    // (upload + send) no caso WABA, ou MessageMedia.sendAudioAsVoice no WebJS. Ambos exibem como
    // mensagem de voz nativa pro cliente.
    //
    // ⚠️ Limitação WABA: respeita janela de 24h. Se passou, Meta rejeita e o erro vem no alert.

    const recorder = mediaRecorderRef.current;
    setEnviandoAudio(true);
    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); try { recorder.stop(); } catch { resolve(); } });
    pararStream(); setGravando(false);
    try {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      const form = new FormData();
      form.append("audio", blob);
      form.append("numero", atendimentoAtivo.numero);
      form.append("canalId", String(atendimentoAtivo.canal_id));
      // 🔒 MULTI-TENANT: workspaceId obrigatório (proxy /api/whatsapp-audio repassa o FormData inteiro)
      form.append("workspaceId", String(wsId));
      const resp = await fetch("/api/whatsapp-audio", { method: "POST", body: form });
      const data = await resp.json();
      if (!data.success) alert("Erro ao enviar áudio: " + (data.error || "desconhecido"));
    } catch (e: any) { alert("Erro ao enviar áudio: " + e.message); }
    setEnviandoAudio(false); setTempoGravacao(0);
  };

  const assumirChatDaLista = async (e: React.MouseEvent, a: Atendimento) => {
    e.stopPropagation();
    if (!user?.email) { alert("⚠️ Usuário não identificado. Recarregue a página."); return; }
    await wa("assumir", { numero: a.numero, canalId: a.canal_id, workspaceId: wsId, atendenteEmail: user.email });
    await inserirMensagemSistema(a.numero, `Chat assumido por: ${meuNome}`, a.canal_id);
    await fetchAtendimentos();
  };

  const pararBotDaLista = async (e: React.MouseEvent, a: Atendimento) => {
    e.stopPropagation();
    if (!user?.email) { alert("⚠️ Usuário não identificado. Recarregue a página."); return; }
    if (!confirm(`Parar o BOT para ${a.nome}?\n\nO BOT vai parar de responder automaticamente. Você assume o atendimento.`)) return;
    try {
      // 🔒 MULTI-TENANT: confirma workspace_id mesmo updateando por id (defesa em profundidade)
      await supabase.from("atendimentos").update({ bloqueado_ia: true, bloqueado_fluxo: true, bloqueado_typebot: true })
        .eq("id", a.id).eq("workspace_id", wsId);
      await wa("assumir", { numero: a.numero, canalId: a.canal_id, workspaceId: wsId, atendenteEmail: user.email });
      await inserirMensagemSistema(a.numero, `BOT interrompido. Chat assumido por: ${meuNome}`, a.canal_id);
      await fetchAtendimentos();
      setAbaConversa("abertos");
      alert("✅ BOT parado. Você assumiu o atendimento.\n\nVá na aba 💬 Abertos pra continuar.");
    } catch (err: any) { alert("Erro: " + err.message); }
  };

  const assumirChat = async (numero: string, canalId?: number) => {
    if (!user?.email) { alert("⚠️ Usuário não identificado. Recarregue a página."); return; }
    await wa("assumir", { numero, canalId, workspaceId: wsId, atendenteEmail: user.email });
    await inserirMensagemSistema(numero, `Chat assumido por: ${meuNome}`, canalId);
    fetchAtendimentos();
    setAbaConversa("abertos");
  };
  const finalizarChat = async (numero: string, canalId?: number) => {
    await wa("finalizar", { numero, canalId, workspaceId: wsId });
    await inserirMensagemSistema(numero, `Chat finalizado por: ${meuNome}`, canalId);
    fetchAtendimentos();
    setAtendimentoAtivo(null); setHistorico([]);
  };
  const devolverBot = async (numero: string, canalId?: number) => {
    await wa("devolver", { numero, canalId, workspaceId: wsId });
    await inserirMensagemSistema(numero, `Chat devolvido ao BOT por: ${meuNome}`, canalId);
    fetchAtendimentos();
  };

  // 🆕 Para o BOT/IA e assume o chat — usado quando roleta atribui atendente mas bot ainda tá respondendo.
  // Diferente do "assumir" tradicional porque o atendente JÁ é o dono do chat (atribuído pela roleta).
  // Aqui só seta as flags de bloqueio pra bot parar e salva mensagem sistema.
  const pararBotIA = async () => {
    if (!atendimentoAtivo) return;
    if (!user?.email) { alert("⚠️ Usuário não identificado. Recarregue."); return; }

    // Se o atendente atribuído pela roleta é OUTRA pessoa, pede confirmação antes de "roubar" o chat
    const ehMeu = atendimentoAtivo.atendente === user.email;
    if (!ehMeu) {
      const nomeDono = usuariosWs.find(u => u.email === atendimentoAtivo.atendente)?.nome || atendimentoAtivo.atendente;
      if (!confirm(`Esse chat foi atribuído pela roleta a ${nomeDono}.\n\nDeseja assumir mesmo assim? (${nomeDono} vai perder o lead)`)) return;
    }

    try {
      await supabase.from("atendimentos").update({
        bloqueado_ia: true,
        bloqueado_fluxo: true,
        bloqueado_typebot: true,
        atendente: user.email,
        status: "aberto"
      }).eq("id", atendimentoAtivo.id).eq("workspace_id", wsId);  // 🔒 MULTI-TENANT

      // Também avisa o backend pra limpar sessão de IA na RAM (evita bot responder mais uma vez)
      await wa("assumir", { numero: atendimentoAtivo.numero, canalId: atendimentoAtivo.canal_id, workspaceId: wsId, atendenteEmail: user.email });

      await inserirMensagemSistema(
        atendimentoAtivo.numero,
        `🛑 BOT/IA interrompido. Chat assumido por: ${meuNome}`,
        atendimentoAtivo.canal_id
      );
      await fetchAtendimentos();
      setAbaConversa("abertos");
    } catch (e: any) {
      alert("Erro ao parar bot: " + e.message);
    }
  };
  const transferirParaFila = async (fila: string) => {
    if (!atendimentoAtivo) return;
    try {
      await supabase.from("atendimentos").update({ fila }).eq("id", atendimentoAtivo.id).eq("workspace_id", wsId);  // 🔒 MULTI-TENANT
      await inserirMensagemSistema(atendimentoAtivo.numero, `Chat transferido para fila: ${fila}, por: ${meuNome}`, atendimentoAtivo.canal_id);
      await fetchAtendimentos(); setShowTransferir(false);
      alert(`✅ Transferido para fila ${fila}`);
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // 🆕 Transferir pra um atendente específico (não pra fila)
  // Grava o email do atendente no campo `atendente` → quem recebeu vê o chat na aba "Abertos" dele
  // Também garante que o chat saia do BOT e de "pendente"
  const transferirParaAtendente = async (emailDestino: string, nomeDestino: string) => {
    if (!atendimentoAtivo) return;
    if (!emailDestino) { alert("Atendente sem email válido."); return; }
    try {
      await supabase.from("atendimentos").update({
        atendente: emailDestino,
        status: "aberto",
        bloqueado_ia: true,
        bloqueado_fluxo: true,
        bloqueado_typebot: true,
      }).eq("id", atendimentoAtivo.id).eq("workspace_id", wsId);  // 🔒 MULTI-TENANT
      await inserirMensagemSistema(
        atendimentoAtivo.numero,
        `Chat transferido para: ${nomeDestino}, por: ${meuNome}`,
        atendimentoAtivo.canal_id
      );
      await fetchAtendimentos();
      setShowTransferir(false);
      alert(`✅ Transferido para ${nomeDestino}`);
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  // 🆕 Reabrir atendimento finalizado
  // Status volta pra "aberto", quem reabriu vira o atendente, chat aparece na aba "Abertos"
  const reabrirChat = async (a: Atendimento) => {
    if (!user?.email) { alert("⚠️ Usuário não identificado. Recarregue a página."); return; }
    if (!confirm(`Reabrir atendimento de ${a.nome}?\n\nO chat volta para a aba "Abertos" e você passa a ser o atendente.`)) return;
    try {
      await supabase.from("atendimentos").update({
        status: "aberto",
        atendente: user.email,
        bloqueado_ia: true,
        bloqueado_fluxo: true,
        bloqueado_typebot: true,
      }).eq("id", a.id).eq("workspace_id", wsId);  // 🔒 MULTI-TENANT
      await inserirMensagemSistema(a.numero, `Atendimento REABERTO por: ${meuNome}`, a.canal_id);
      await fetchAtendimentos();
      setAbaConversa("abertos");
      // Atualiza o atendimento ativo com o novo status pra UI reagir na hora
      setAtendimentoAtivo({ ...a, status: "aberto", atendente: user.email });
      alert("✅ Atendimento reaberto. Você é o atendente agora.");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  const limparFiltros = () => { setFiltroFila("todas"); setFiltroAtendente("todos"); setFiltroEtiqueta("todas"); setFiltroCanal("todos"); };

  const tempoRelativo = (data: string) => { const d = Math.floor((Date.now() - new Date(data).getTime()) / 60000); return d < 1 ? "agora" : d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}d`; };
  const horaMsg = (data: string) => new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataHoraMsg = (data: string) => new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatTempo = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const salvarCampoContato = async (campo: string, valor: any) => {
    if (!atendimentoAtivo) return;
    setSalvandoContato(true);
    try {
      const { error } = await supabase.from("atendimentos").update({ [campo]: valor })
        .eq("id", atendimentoAtivo.id).eq("workspace_id", wsId);  // 🔒 MULTI-TENANT
      if (error) { alert("Erro ao salvar: " + error.message); setSalvandoContato(false); return; }
      setAtendimentoAtivo({ ...atendimentoAtivo, [campo]: valor });
      setAtendimentos(prev => prev.map(a => a.id === atendimentoAtivo.id ? { ...a, [campo]: valor } : a));
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoContato(false);
  };

  const exportarPDF = () => {
    if (!atendimentoAtivo) return;
    const janela = window.open("", "_blank", "width=800,height=600");
    if (!janela) { alert("Popup bloqueado!"); return; }
    const html = `
      <html><head><title>Histórico ${atendimentoAtivo.nome}</title>
      <style>body{font-family:Arial;padding:20px}h1{color:#16a34a}.msg{padding:10px;margin:5px 0;border-radius:8px;max-width:60%}.cliente{background:#e5e7eb;margin-right:auto}.atendente{background:#dbeafe;margin-left:auto;text-align:right}.bot{background:#dcfce7;margin-left:auto;text-align:right}.sistema{background:#f3f4f6;margin:10px auto;text-align:center;font-style:italic;color:#6b7280}.meta{font-size:10px;color:#6b7280}</style>
      </head><body>
      <h1>📄 Histórico — ${atendimentoAtivo.nome}</h1>
      <p><b>Número:</b> ${atendimentoAtivo.numero}<br><b>Canal:</b> ${nomeDoCanal(atendimentoAtivo.canal_id)}<br><b>Fila:</b> ${atendimentoAtivo.fila || "—"}<br><b>Exportado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <hr>
      ${historico.map(m => `<div class="msg ${m.de === "cliente" ? "cliente" : m.de === "bot" ? "bot" : m.de === "sistema" ? "sistema" : "atendente"}">
        <div>${isAudioMsg(m.mensagem) ? "🎤 [Áudio]" : (m.mensagem || "").replace(/</g, "&lt;")}</div>
        <div class="meta">${m.de === "cliente" ? "Cliente" : m.de === "bot" ? "BOT" : m.de === "sistema" ? "Sistema" : "Atendente"} • ${m.created_at ? new Date(m.created_at).toLocaleString("pt-BR") : ""}</div>
      </div>`).join("")}
      </body></html>`;
    janela.document.write(html); janela.document.close();
    setTimeout(() => janela.print(), 500);
  };

  const numeroSanitizado = (num: string) => (num || "").replace(/\D/g, "");
  const etiquetasAplicadas = etiquetasWorkspace.filter(e => etiquetasAtendimento.includes(e.id));

  const abas = [
    { key: "automatico", label: "Automático", icon: "🤖", color: "#8b5cf6", count: contadoresAbas.automatico },
    { key: "aguardando", label: "Aguardando", icon: "⏳", color: "#f59e0b", count: contadoresAbas.aguardando },
    { key: "abertos", label: "Abertos", icon: "💬", color: "#3b82f6", count: contadoresAbas.abertos },
    { key: "finalizados", label: "Finalizados", icon: "✅", color: "#16a34a", count: contadoresAbas.finalizados },
  ];

  const renderBotaoAcaoLista = (a: Atendimento) => {
    const aba = classificarAba(a);
    if (aba === "automatico") return <button onClick={(e) => pararBotDaLista(e, a)} title="Parar BOT e assumir" style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>⏹ Parar BOT</button>;
    if (aba === "aguardando") return <button onClick={(e) => assumirChatDaLista(e, a)} title="Assumir atendimento" style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>Atender</button>;
    // 🆕 Botão Reabrir direto da lista (aba Finalizados)
    if (aba === "finalizados") return <button
      onClick={(e) => { e.stopPropagation(); reabrirChat(a); }}
      title="Reabrir esta conversa"
      style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}
    >🔓 Reabrir</button>;
    return null;
  };

  // 🆕 Helper pros botões-ícone da toolbar do header — mesmo estilo em todos
  const botaoToolbar = (cor: string = "#aebac1") => ({
    background: "none" as const,
    border: "none" as const,
    color: cor,
    cursor: "pointer" as const,
    fontSize: 16,
    padding: 8,
    borderRadius: 6,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  });

  return (
    <div style={{ display: "flex", flex: 1, height: "100vh" }}>

      {/* LISTA ESQUERDA */}
      <div style={{ width: 340, background: "#111b21", borderRight: "1px solid #222d34", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", background: "#202c33", borderBottom: "1px solid #222d34", display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="🔍 Buscar conversa..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ flex: 1, background: "#111b21", border: "none", borderRadius: 20, padding: "8px 14px", color: "white", fontSize: 13 }} />
          <button onClick={fetchAtendimentos} title="Atualizar lista"
            style={{ background: "none", border: "none", color: "#aebac1", cursor: "pointer", fontSize: 16, padding: 4 }}>🔄</button>
          <button onClick={() => setShowFiltros(!showFiltros)} title="Filtros"
            style={{ background: "none", border: "none", color: temFiltroAtivo ? "#00a884" : "#aebac1", cursor: "pointer", fontSize: 16, padding: 4, position: "relative" }}>
            🔽{temFiltroAtivo && <span style={{ position: "absolute", top: 0, right: 0, width: 6, height: 6, background: "#00a884", borderRadius: "50%" }} />}
          </button>
        </div>

        {showFiltros && (
          <div style={{ background: "#111b21", borderBottom: "1px solid #222d34", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#8696a0", fontSize: 11, fontWeight: "bold", textTransform: "uppercase" }}>Filtros</span>
              {temFiltroAtivo && <button onClick={limparFiltros} style={{ background: "none", border: "none", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>✕ Limpar</button>}
            </div>
            {canais.length > 1 && (
              <select value={filtroCanal} onChange={e => setFiltroCanal(e.target.value)} style={{ ...inputSm, background: "#202c33", border: "none" }}>
                <option value="todos">📡 Todos os canais</option>
                {canais.map(c => <option key={c.id} value={String(c.id)}>{c.tipo === "waba" ? "🔗" : "📱"} {c.nome}</option>)}
              </select>
            )}
            <select value={filtroFila} onChange={e => setFiltroFila(e.target.value)} style={{ ...inputSm, background: "#202c33", border: "none" }}>
              <option value="todas">Todas as filas</option>
              {filas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {podeVerTudo && (
              <select value={filtroAtendente} onChange={e => setFiltroAtendente(e.target.value)} style={{ ...inputSm, background: "#202c33", border: "none" }}>
                <option value="todos">Todos os atendentes</option>
                {atendentesEmails.map(a => <option key={a} value={a}>{a === "BOT" ? "🤖 BOT" : "👤 " + nomeDoAtendente(a)}</option>)}
              </select>
            )}
            <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={{ ...inputSm, background: "#202c33", border: "none" }}>
              <option value="todas">Todas as etiquetas</option>
              {etiquetasWorkspace.map(et => <option key={et.id} value={et.id.toString()}>{et.icone} {et.nome}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: "flex", borderBottom: "1px solid #222d34", background: "#111b21" }}>
          {abas.map(t => (
            <button key={t.key} onClick={() => setAbaConversa(t.key as any)}
              style={{ flex: 1, padding: "10px 2px", background: "none", border: "none", color: abaConversa === t.key ? t.color : "#8696a0", fontSize: 10, fontWeight: "bold", cursor: "pointer", borderBottom: abaConversa === t.key ? `3px solid ${t.color}` : "3px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.count > 0 && <span style={{ background: t.color, color: "white", borderRadius: 10, padding: "0 6px", fontSize: 9, minWidth: 16 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {abaConversa === "finalizados" && podeVerTudo && (
          <div style={{ background: "#0d1418", borderBottom: "1px solid #222d34", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#e9edef", fontSize: 12, fontWeight: "bold", margin: 0 }}>
                {mostrarTodosFinalizados ? "👁️ Todos os finalizados" : "👤 Só os meus finalizados"}
              </p>
              <p style={{ color: "#8696a0", fontSize: 10, margin: "2px 0 0" }}>
                {mostrarTodosFinalizados ? "Visualizando de todos os atendentes" : "Ative pra ver os de outros atendentes"}
              </p>
            </div>
            <button onClick={() => setMostrarTodosFinalizados(!mostrarTodosFinalizados)}
              style={{ width: 40, height: 22, background: mostrarTodosFinalizados ? "#00a884" : "#374151", borderRadius: 11, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: mostrarTodosFinalizados ? 21 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
        )}

        <div style={{ overflowY: "auto", flex: 1, background: "#111b21" }}>
          {atendimentosFiltrados.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>{abas.find(a => a.key === abaConversa)?.icon}</p>
              <p style={{ color: "#8696a0", fontSize: 13 }}>{temFiltroAtivo ? "Nenhum resultado para os filtros" : `Nenhum atendimento em ${abas.find(a => a.key === abaConversa)?.label.toLowerCase()}`}</p>
            </div>
          ) : atendimentosFiltrados.map(a => {
            const aba = classificarAba(a);
            return (
              <div key={a.id} onClick={() => { setAtendimentoAtivo(a); setHistorico([]); fetchHistorico(a.numero, a.canal_id); }}
                style={{ padding: "12px 14px", borderBottom: "1px solid #1f2c33", cursor: "pointer", background: atendimentoAtivo?.id === a.id ? "#2a3942" : "transparent" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: 14 }}>
                    {a.nome?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, gap: 8 }}>
                      <span style={{ color: "#e9edef", fontSize: 14, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{a.nome}</span>
                      <span style={{ color: "#8696a0", fontSize: 11, flexShrink: 0 }}>{tempoRelativo(a.updated_at || a.created_at)}</span>
                    </div>
                    <p style={{ color: "#8696a0", fontSize: 12, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📱 {numeroSanitizado(a.numero)} {canais.length > 1 && a.canal_id && <span style={{ color: "#00a884" }}>• {iconeCanal(a.canal_id)} {nomeDoCanal(a.canal_id)}</span>}
                    </p>
                    <p style={{ color: "#8696a0", fontSize: 12, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isAudioMsg(a.mensagem) ? "🎤 Mensagem de áudio" : a.mensagem}
                    </p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {a.fila && <span style={{ background: "#00a88422", color: "#00a884", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>{a.fila}</span>}
                        {aba === "automatico" && <span style={{ background: "#8b5cf622", color: "#8b5cf6", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>🤖 BOT</span>}
                        {aba === "aguardando" && <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>⏳ Aguardando</span>}
                        {(aba === "abertos" || aba === "finalizados") && a.atendente && a.atendente !== "BOT" && (
                          <>
                            <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>👤 Humano</span>
                            <span style={{ background: "#16a34a22", color: "#16a34a", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>👨‍💼 {nomeDoAtendente(a.atendente)}</span>
                          </>
                        )}
                      </div>
                      {renderBotaoAcaoLista(a)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ÁREA DO CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0b141a", backgroundImage: WA_BG_DARK, backgroundRepeat: "repeat", position: "relative" }}>
        {atendimentoAtivo ? (
          <>
            {/* 🆕 HEADER REFORMULADO
                - Avatar+nome viraram CLICÁVEIS (abrem painel Dados do Contato)
                - Removemos o menu de 3 pontinhos (showMenuTresPontos)
                - Todos os botões ficam VISÍVEIS na toolbar pra agilizar o atendimento
                - Finalizar Venda ganhou destaque (botão verde com texto)
            */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #222d34", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              {/* BLOCO CLICÁVEL: Avatar + Nome + Info → abre painel do contato
                  O clique ainda funciona, mas sem tooltip "Ver dados do contato" (que era gigante
                  e aparecia sobre o chat atrapalhando a leitura). Pra descobrabilidade, tem um
                  botão 👁️ dedicado na toolbar do lado direito. */}
              <div
                onClick={() => setShowPainelContato(true)}
                style={{
                  display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0,
                  cursor: "pointer",
                  padding: "4px 8px",
                  margin: "-4px -8px",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#2a3942")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: 14 }}>
                  {atendimentoAtivo.nome?.charAt(0).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ color: "#e9edef", fontSize: 15, fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{atendimentoAtivo.nome}</h3>
                  <p style={{ color: "#8696a0", fontSize: 11, margin: 0 }}>
                    {atendimentoAtivo.fila || "—"} • {atendimentoAtivo.numero}
                    {atendimentoAtivo.canal_id && canais.length > 1 && <> • {iconeCanal(atendimentoAtivo.canal_id)} {nomeDoCanal(atendimentoAtivo.canal_id)}</>}
                    {atendimentoAtivo.atendente && atendimentoAtivo.atendente !== "BOT" && <> • 👨‍💼 {nomeDoAtendente(atendimentoAtivo.atendente)}</>}
                  </p>
                  {etiquetasAplicadas.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {etiquetasAplicadas.slice(0, 3).map(et => (
                        <span key={et.id} style={{ background: et.cor + "22", border: `1px solid ${et.cor}`, color: et.cor, fontSize: 10, padding: "1px 7px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <span>{et.icone}</span> {et.nome}
                        </span>
                      ))}
                      {etiquetasAplicadas.length > 3 && <span style={{ color: "#8696a0", fontSize: 10 }}>+{etiquetasAplicadas.length - 3}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* TOOLBAR DE AÇÕES — muda conforme o status do atendimento */}
              <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative", flexShrink: 0 }}>
                {/* 📞 Ligar — inicia chamada VOIP pro número do lead */}
                {permissoes.voip_usar !== false && (
                  <button onClick={() => iniciarChamada(atendimentoAtivo.numero, atendimentoAtivo.nome)}
                    title="📞 Ligar pro lead via softphone"
                    style={{ ...botaoToolbar("#16a34a"), background: "#16a34a22", border: "1px solid #16a34a44" }}>📞</button>
                )}

                {/* 👁️ Ver dados do contato — abre o painel à direita (novo, dedicado) */}
                <button onClick={() => setShowPainelContato(true)}
                  title="Ver dados do contato" style={botaoToolbar()}>👁️</button>

                {/* 🔄 Atualizar — sempre visível */}
                <button onClick={() => fetchHistorico(atendimentoAtivo.numero, atendimentoAtivo.canal_id)}
                  title="Atualizar mensagens" style={botaoToolbar()}>🔄</button>

                {atendimentoAtivo.status === "resolvido" ? (
                  /* 🆕 ATENDIMENTO FINALIZADO → mostra SÓ o botão de Reabrir (destaque laranja) */
                  <button
                    onClick={() => reabrirChat(atendimentoAtivo)}
                    title="Reabrir esta conversa — volta pra aba Abertos"
                    style={{
                      background: "#f59e0b",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: "bold",
                      padding: "8px 14px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                      marginLeft: 4,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#d97706")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#f59e0b")}
                  >
                    🔓 Reabrir Conversa
                  </button>
                ) : (
                  /* ATENDIMENTO ATIVO → mostra todas as ações */
                  <>
                    {/* 👤 Assumir / 🛑 Parar BOT/IA / 🤖 Devolver Bot — logo após o atualizar (mais acessível) */}
                    {(() => {
                      const atendenteEhEmailReal = !!atendimentoAtivo.atendente && !["BOT", "Humano"].includes(atendimentoAtivo.atendente);
                      const botAtivo = !atendimentoAtivo.bloqueado_ia && !atendimentoAtivo.bloqueado_fluxo;

                      if (atendimentoAtivo.atendente === "BOT" || (!atendenteEhEmailReal && atendimentoAtivo.status === "pendente")) {
                        return (
                          <button onClick={() => assumirChat(atendimentoAtivo.numero, atendimentoAtivo.canal_id)}
                            title="Assumir atendimento (parar o bot)"
                            style={botaoToolbar("#f59e0b")}>👤</button>
                        );
                      }
                      if (atendenteEhEmailReal && botAtivo) {
                        return (
                          <button onClick={pararBotIA}
                            title="🛑 Parar BOT/IA e assumir a conversa"
                            style={{ ...botaoToolbar("#dc2626"), background: "#dc262622", border: "1px solid #dc262644" }}>🛑</button>
                        );
                      }
                      return (
                        <button onClick={() => devolverBot(atendimentoAtivo.numero, atendimentoAtivo.canal_id)}
                          title="Devolver para o BOT"
                          style={botaoToolbar("#8b5cf6")}>🤖</button>
                      );
                    })()}

                    {/* ↗️ Encaminhar (fila ou atendente) */}
                    <button onClick={() => setShowTransferir(!showTransferir)}
                      title="Encaminhar para fila ou atendente"
                      style={{ ...botaoToolbar(showTransferir ? "#00a884" : "#aebac1"), background: showTransferir ? "#00a88422" : "none" }}>↗️</button>

                    {/* 💰 FINALIZAR VENDA — destaque */}
                    {(permissoes.vendas_proprio || permissoes.vendas_equipe) && atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && (
                      <button
                        onClick={() => window.open(`/crm/proposta?nome=${encodeURIComponent(atendimentoAtivo.nome)}&numero=${encodeURIComponent(numeroSanitizado(atendimentoAtivo.numero))}`, "_blank")}
                        title="Finalizar venda — abre a tela de proposta em nova aba"
                        style={{
                          background: "#16a34a",
                          border: "none",
                          color: "white",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: "bold",
                          padding: "8px 14px",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          whiteSpace: "nowrap",
                          marginLeft: 4,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#15803d")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#16a34a")}
                      >
                        💰 Finalizar Venda
                      </button>
                    )}

                    {/* ✓ Finalizar atendimento */}
                    <button
                      onClick={() => {
                        if (confirm(`Finalizar atendimento de ${atendimentoAtivo.nome}?`))
                          finalizarChat(atendimentoAtivo.numero, atendimentoAtivo.canal_id);
                      }}
                      title="Finalizar atendimento"
                      style={{ ...botaoToolbar("#dc2626"), fontSize: 18, fontWeight: "bold" }}
                    >✓</button>
                  </>
                )}

                {/* 🆕 Dropdown de transferir — agora com DUAS SEÇÕES: Filas E Atendentes */}
                {showTransferir && (
                  <div style={{ position: "absolute", top: 44, right: 0, background: "#233138", border: "1px solid #2a3942", borderRadius: 8, padding: 12, zIndex: 110, width: 260, maxHeight: 440, overflowY: "auto" }}>
                    {/* Seção FILAS */}
                    <p style={{ color: "#00a884", fontSize: 10, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: 0.5 }}>
                      📋 Encaminhar para fila
                    </p>
                    {filas.length === 0 ? (
                      <p style={{ color: "#8696a0", fontSize: 11, fontStyle: "italic", margin: "0 0 10px" }}>Nenhuma fila cadastrada.</p>
                    ) : (
                      filas.map(f => (
                        <button key={"fila-" + f} onClick={() => transferirParaFila(f)}
                          style={{ display: "block", width: "100%", background: "#111b21", border: "1px solid #2a3942", borderRadius: 6, padding: "8px 12px", color: "#e9edef", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
                          📋 {f}
                        </button>
                      ))
                    )}

                    {/* Separador */}
                    <div style={{ height: 1, background: "#2a3942", margin: "12px 0" }} />

                    {/* Seção ATENDENTES */}
                    <p style={{ color: "#f59e0b", fontSize: 10, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: 0.5 }}>
                      👥 Encaminhar para atendente
                    </p>
                    {(() => {
                      // Filtra: remove o próprio usuário e entradas sem email válido
                      const outrosAtendentes = usuariosWs.filter(u =>
                        u.email && u.email.toLowerCase() !== user?.email?.toLowerCase()
                      );
                      if (outrosAtendentes.length === 0) {
                        return <p style={{ color: "#8696a0", fontSize: 11, fontStyle: "italic", margin: "0 0 8px" }}>Nenhum outro atendente no workspace.</p>;
                      }
                      return outrosAtendentes.map((u, idx) => (
                        <button key={"user-" + u.email + idx} onClick={() => transferirParaAtendente(u.email, u.nome || u.email.split("@")[0])}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#111b21", border: "1px solid #2a3942", borderRadius: 6, padding: "8px 12px", color: "#e9edef", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f59e0b33", color: "#f59e0b", fontWeight: "bold", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {(u.nome || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#e9edef", fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {u.nome || u.email.split("@")[0]}
                            </p>
                            <p style={{ color: "#8696a0", fontSize: 9, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {u.email}
                            </p>
                          </div>
                        </button>
                      ));
                    })()}

                    <button onClick={() => setShowTransferir(false)}
                      style={{ background: "none", color: "#8696a0", border: "none", padding: "6px", fontSize: 11, cursor: "pointer", width: "100%", marginTop: 6 }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 🆕 Container de mensagens agora com ref + onScroll pra detectar posição do user */}
            <div ref={scrollContainerRef} onScroll={onScrollChat} style={{ flex: 1, overflowY: "auto", padding: "16px 8%", display: "flex", flexDirection: "column", gap: 6 }}>
              {historico.length === 0
                ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ color: "#8696a0", fontSize: 13 }}>Nenhuma mensagem ainda</p></div>
                : historico.map((msg, i) => {
                    if (msg.de === "sistema") {
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                          <div style={{ background: "#182229", color: "#8696a0", fontSize: 11, padding: "6px 14px", borderRadius: 10, maxWidth: "80%", textAlign: "center", fontStyle: "italic" }}>
                            {msg.mensagem}
                            {msg.created_at && <div style={{ fontSize: 9, color: "#667781", marginTop: 2 }}>{dataHoraMsg(msg.created_at)}</div>}
                          </div>
                        </div>
                      );
                    }
                    const isCliente = msg.de === "cliente"; const isBot = msg.de === "bot";
                    const ehAudio = isAudioMsg(msg.mensagem);
                    // 🆕 Detecta se é mídia nova (img/video/file)
                    const midia = parseMidia(msg.mensagem);
                    const ehMidia = midia.tipo !== null;
                    // Largura máxima varia: áudio 340, imagem/vídeo 320, arquivo 300, texto 65%
                    const maxWidth = ehAudio ? 340 : midia.tipo === "img" || midia.tipo === "video" ? 320 : midia.tipo === "file" ? 300 : "65%";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: isCliente ? "flex-start" : "flex-end" }}>
                        <div style={{ maxWidth, padding: ehMidia ? "4px 4px 6px" : "6px 10px 8px", borderRadius: isCliente ? "8px 8px 8px 2px" : "8px 8px 2px 8px", background: isCliente ? "#202c33" : "#005c4b", boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)" }}>
                          {!isCliente && !ehAudio && !ehMidia && <p style={{ color: "#8edfc3", fontSize: 10, margin: "0 0 2px", fontWeight: "bold" }}>{isBot ? "🤖 BOT" : "👤 Você"}</p>}

                          {ehAudio && <AudioPlayer src={audioUrl(audioFilename(msg.mensagem))} isOwn={!isCliente} />}

                          {/* 🆕 Imagem inline — clique abre em nova aba */}
                          {midia.tipo === "img" && (
                            <div>
                              <a href={audioUrl(midia.filename)} target="_blank" rel="noreferrer">
                                <img src={audioUrl(midia.filename)} alt={midia.filename}
                                  style={{ display: "block", maxWidth: "100%", maxHeight: 320, borderRadius: 6, cursor: "pointer", objectFit: "cover" }} />
                              </a>
                              {midia.legenda && <p style={{ color: "#e9edef", fontSize: 13.5, margin: "6px 6px 0", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{midia.legenda}</p>}
                            </div>
                          )}

                          {/* 🆕 Vídeo inline — com controles nativos */}
                          {midia.tipo === "video" && (
                            <div>
                              <video src={audioUrl(midia.filename)} controls preload="metadata"
                                style={{ display: "block", maxWidth: "100%", maxHeight: 320, borderRadius: 6 }} />
                              {midia.legenda && <p style={{ color: "#e9edef", fontSize: 13.5, margin: "6px 6px 0", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{midia.legenda}</p>}
                            </div>
                          )}

                          {/* 🆕 Arquivo genérico (PDF, Excel, etc) — ícone + nome + botão download */}
                          {midia.tipo === "file" && (
                            <div>
                              <a href={audioUrl(midia.filename)} target="_blank" rel="noreferrer" download
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isCliente ? "#1f2a31" : "#00604f", borderRadius: 6, textDecoration: "none" }}>
                                <span style={{ fontSize: 32 }}>{iconePorExtensao(midia.filename)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ color: "#e9edef", fontSize: 13, fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {/* Remove o prefixo midia_TIMESTAMP_RAND_ pra mostrar só o nome original */}
                                    {midia.filename.replace(/^midia_\d+_[a-z0-9]+_/, "")}
                                  </p>
                                  <p style={{ color: isCliente ? "#8696a0" : "#a3e4d0", fontSize: 11, margin: "2px 0 0" }}>
                                    {(midia.filename.split(".").pop() || "arquivo").toUpperCase()} · clique p/ baixar
                                  </p>
                                </div>
                              </a>
                              {midia.legenda && <p style={{ color: "#e9edef", fontSize: 13.5, margin: "6px 6px 0", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{midia.legenda}</p>}
                            </div>
                          )}

                          {/* Texto comum — só se não for áudio nem mídia */}
                          {!ehAudio && !ehMidia && (
                            <p style={{ color: "#e9edef", fontSize: 13.5, margin: 0, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.mensagem}</p>
                          )}

                          {msg.created_at && <p style={{ color: isCliente ? "#8696a0" : "#a3e4d0", fontSize: 10, margin: "2px 6px 0 0", textAlign: "right" }}>{horaMsg(msg.created_at)}{!isCliente && " ✓✓"}</p>}
                        </div>
                      </div>
                    );
                  })}
              <div ref={chatBottomRef} />
            </div>

            {/* 🆕 Botão flutuante "↓ Nova mensagem" — aparece quando o user tá scrollado pra cima
                e chega msg nova. Clicando, leva pro fundo. Evita arrastar o user à força. */}
            {!stickyFundo && (
              <button
                onClick={irParaFundo}
                title={temMensagemNova ? "Nova mensagem recebida — clique pra ver" : "Ir para a última mensagem"}
                style={{
                  position: "absolute",
                  right: 20,
                  bottom: 90, // acima do input de texto
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: temMensagemNova ? "#00a884" : "#2a3942",
                  border: "1px solid " + (temMensagemNova ? "#00a884" : "#3b4a54"),
                  color: "white",
                  fontSize: 18,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  zIndex: 10,
                  fontWeight: "bold",
                }}
              >
                ↓
                {temMensagemNova && (
                  <span style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 12,
                    height: 12,
                    background: "#dc2626",
                    borderRadius: "50%",
                    border: "2px solid #0b141a",
                  }} />
                )}
              </button>
            )}

            {showRespostas && permissoes.respostas_rapidas && !gravando && (
              <div style={{ background: "#202c33", borderTop: "1px solid #2a3942", padding: 10, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {respostasRapidas.map((r, i) => (
                  <button key={i} onClick={() => { setMensagem(r.mensagem); setShowRespostas(false); }}
                    style={{ background: "#111b21", border: "1px solid #2a3942", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 10 }}>
                    <span style={{ color: "#00a884", fontWeight: "bold", minWidth: 60 }}>{r.atalho}</span>
                    <span style={{ color: "#aebac1" }}>{r.mensagem}</span>
                  </button>
                ))}
              </div>
            )}

            {gravando ? (
              <div style={{ background: "#202c33", padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={cancelarGravacao} disabled={enviandoAudio} title="Cancelar gravação"
                  style={{ background: "#dc2626", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "#2a3942", borderRadius: 20, padding: "10px 18px" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", animation: "pulse 1s infinite" }} />
                  <span style={{ color: "#e9edef", fontSize: 14, fontWeight: "bold" }}>Gravando...</span>
                  <span style={{ color: "#8696a0", fontSize: 13, fontFamily: "monospace", marginLeft: "auto" }}>{formatTempo(tempoGravacao)}</span>
                </div>
                <button onClick={enviarAudioGravado} disabled={enviandoAudio} title="Enviar áudio"
                  style={{ background: enviandoAudio ? "#047857" : "#00a884", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{enviandoAudio ? "…" : "➤"}</button>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
              </div>
            ) : (
              <>
                {/* 🆕 BANNER de aviso de janela 24h expirada (só pra WABA) */}
                {ehCanalWaba && janelaExpirada && (
                  <div style={{ background: "#f59e0b22", borderTop: "1px solid #f59e0b66", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#fbbf24", fontSize: 12, margin: 0, fontWeight: "bold" }}>
                        Janela de 24h expirada
                      </p>
                      <p style={{ color: "#fde68a", fontSize: 11, margin: "2px 0 0" }}>
                        {horasDesdeUltimaMsgCliente > 9000 ? "Esse contato nunca te enviou mensagem." : `Última mensagem do cliente há ${Math.floor(horasDesdeUltimaMsgCliente)}h.`} Só é possível enviar via Template aprovado.
                      </p>
                    </div>
                    <button onClick={abrirModalTemplate} style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>📋 Enviar Template</button>
                  </div>
                )}

                {/* 🆕 EMOJI PICKER — painel fixo acima do input (estilo WhatsApp) */}
                {showEmojiPicker && (
                  <div style={{ background: "#202c33", borderTop: "1px solid #2a3942", maxHeight: 320, display: "flex", flexDirection: "column" }}>
                    {/* Header: abas de categorias + busca */}
                    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #2a3942", padding: "6px 8px", overflowX: "auto" }}>
                      {EMOJIS_CATEGORIAS.map(cat => (
                        <button key={cat.id} onClick={() => setEmojiCategoria(cat.id)} title={cat.label}
                          style={{
                            background: emojiCategoria === cat.id ? "#00a88433" : "transparent",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 18,
                            cursor: "pointer",
                            flexShrink: 0,
                            borderBottom: emojiCategoria === cat.id ? "2px solid #00a884" : "2px solid transparent"
                          }}>
                          {cat.icone}
                        </button>
                      ))}
                      <input placeholder="🔍 Buscar..." value={emojiBusca} onChange={e => setEmojiBusca(e.target.value)}
                        style={{ flex: 1, minWidth: 100, background: "#111b21", border: "1px solid #2a3942", borderRadius: 6, padding: "4px 10px", color: "#e9edef", fontSize: 12, marginLeft: 8 }} />
                    </div>
                    {/* Grid de emojis */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))", gap: 2 }}>
                      {emojisVisiveis.length === 0 ? (
                        <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#8696a0", fontSize: 12, padding: 20 }}>
                          Nenhum emoji encontrado
                        </div>
                      ) : emojisVisiveis.map((emoji, i) => (
                        <button key={`${emojiCategoria}-${i}`} onClick={() => inserirEmoji(emoji)}
                          style={{ background: "none", border: "none", fontSize: 22, padding: 4, cursor: "pointer", borderRadius: 4, lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.background = "#2a3942"}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TOOLBAR do input */}
                <div style={{ background: "#202c33", padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                  {permissoes.respostas_rapidas && (
                    <button onClick={() => setShowRespostas(!showRespostas)} title="Respostas rápidas"
                      style={{ background: showRespostas ? "#00a88422" : "none", color: showRespostas ? "#00a884" : "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>⚡</button>
                  )}

                  {/* 🆕 Botão EMOJI — abre/fecha picker */}
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji"
                    style={{ background: showEmojiPicker ? "#00a88422" : "none", color: showEmojiPicker ? "#00a884" : "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 20, cursor: "pointer" }}>😊</button>

                  {/* 🆕 Botão ANEXAR — abre dialog do navegador pra escolher arquivo */}
                  <input
                    ref={fileUploadRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                    onChange={handleArquivoSelecionado}
                    style={{ display: "none" }}
                  />
                  <button onClick={() => fileUploadRef.current?.click()} title="Anexar arquivo"
                    style={{ background: "none", color: "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>📎</button>

                  {/* 🆕 Botão TEMPLATE — só aparece em canal WABA. Amarelo se janela expirou, cinza se dentro dos 24h */}
                  {ehCanalWaba && (
                    <button onClick={abrirModalTemplate} title={janelaExpirada ? "Enviar template (janela 24h expirada)" : "Enviar template aprovado"}
                      style={{
                        background: janelaExpirada ? "#f59e0b" : "none",
                        color: janelaExpirada ? "white" : "#8696a0",
                        border: janelaExpirada ? "none" : "none",
                        borderRadius: "50%",
                        width: 38,
                        height: 38,
                        fontSize: 18,
                        cursor: "pointer",
                        animation: janelaExpirada ? "pulse 2s infinite" : "none"
                      }}>📋</button>
                  )}

                  <input placeholder={meuNome ? `Mensagem (vai com *${meuNome}* no topo)` : "Mensagem"} value={mensagem}
                    onChange={e => { setMensagem(e.target.value); if (e.target.value === "/" && permissoes.respostas_rapidas) setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }}
                    onKeyDown={e => e.key === "Enter" && enviarMensagem()}
                    onFocus={() => setShowEmojiPicker(false)}
                    style={{ flex: 1, background: "#2a3942", border: "none", borderRadius: 20, padding: "10px 16px", color: "#e9edef", fontSize: 14 }} />
                  {mensagem ? (
                    <button onClick={enviarMensagem} disabled={enviandoMsg} title="Enviar"
                      style={{ background: "#00a884", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold" }}>{enviandoMsg ? "…" : "➤"}</button>
                  ) : (
                    <button onClick={iniciarGravacao} title="Gravar áudio"
                      style={{ background: "none", color: "#8696a0", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer" }}>🎤</button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#222e35" }}>
            <span style={{ fontSize: 80, opacity: 0.5 }}>💬</span>
            <h2 style={{ color: "#e9edef", fontSize: 28, fontWeight: "300", margin: 0 }}>Wolf Chatbot</h2>
            <p style={{ color: "#8696a0", fontSize: 14, margin: 0, maxWidth: 400, textAlign: "center" }}>Selecione uma conversa à esquerda pra começar a atender</p>
            {meuNome && <p style={{ color: "#00a884", fontSize: 12, margin: 0 }}>👋 Olá, {meuNome}!</p>}
          </div>
        )}
      </div>

      {/* 🆕 MODAL PREVIEW DE ARQUIVO — aparece antes de enviar pra user ver preview + adicionar legenda */}
      {arquivoSelecionado && (
        <div onClick={() => !enviandoMidia && cancelarEnvioArquivo()}
          style={{ position: "fixed", inset: 0, background: "#000e", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111b21", borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid #2a3942", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #2a3942", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>📎 Enviar arquivo</h3>
              <button onClick={cancelarEnvioArquivo} disabled={enviandoMidia}
                style={{ background: "none", border: "none", color: "#8696a0", fontSize: 22, cursor: enviandoMidia ? "not-allowed" : "pointer" }}>✕</button>
            </div>

            {/* Preview */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "#0b141a" }}>
              {arquivoPreviewUrl && arquivoSelecionado.type.startsWith("image/") ? (
                <img src={arquivoPreviewUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, objectFit: "contain" }} />
              ) : arquivoPreviewUrl && arquivoSelecionado.type.startsWith("video/") ? (
                <video src={arquivoPreviewUrl} controls style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }} />
              ) : (
                <div style={{ background: "#2a3942", borderRadius: 8, padding: 30, textAlign: "center", width: "100%" }}>
                  <p style={{ fontSize: 56, margin: 0 }}>
                    {arquivoSelecionado.type.startsWith("audio/") ? "🎵"
                      : arquivoSelecionado.name.match(/\.pdf$/i) ? "📕"
                      : arquivoSelecionado.name.match(/\.(xlsx?|csv)$/i) ? "📊"
                      : arquivoSelecionado.name.match(/\.(docx?|rtf)$/i) ? "📄"
                      : arquivoSelecionado.name.match(/\.(pptx?)$/i) ? "📽️"
                      : arquivoSelecionado.name.match(/\.(zip|rar|7z)$/i) ? "🗜️"
                      : "📎"}
                  </p>
                </div>
              )}
              <div style={{ textAlign: "center", color: "#e9edef" }}>
                <p style={{ fontSize: 14, fontWeight: "bold", margin: "0 0 2px", wordBreak: "break-all" }}>{arquivoSelecionado.name}</p>
                <p style={{ fontSize: 11, color: "#8696a0", margin: 0 }}>
                  {(arquivoSelecionado.size / 1024 / 1024).toFixed(2)} MB · {arquivoSelecionado.type || "tipo desconhecido"}
                </p>
              </div>
            </div>

            {/* Legenda + botão enviar */}
            <div style={{ padding: "12px 16px", background: "#202c33", display: "flex", gap: 8, alignItems: "center" }}>
              <input placeholder="Adicione uma legenda (opcional)" value={legendaArquivo}
                onChange={e => setLegendaArquivo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !enviandoMidia && enviarMidia()}
                disabled={enviandoMidia}
                style={{ flex: 1, background: "#2a3942", border: "none", borderRadius: 20, padding: "10px 16px", color: "#e9edef", fontSize: 14 }} />
              <button onClick={enviarMidia} disabled={enviandoMidia}
                style={{ background: enviandoMidia ? "#047857" : "#00a884", color: "white", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 18, cursor: enviandoMidia ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                {enviandoMidia ? "…" : "➤"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL TEMPLATE WABA — escolher template aprovado + preencher variáveis + enviar */}
      {showTemplateModal && atendimentoAtivo && (
        <div onClick={() => !enviandoTemplate && setShowTemplateModal(false)}
          style={{ position: "fixed", inset: 0, background: "#000e", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111b21", borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid #2a3942", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #2a3942", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>📋 Enviar Template WABA</h3>
              <button onClick={() => setShowTemplateModal(false)} disabled={enviandoTemplate}
                style={{ background: "none", border: "none", color: "#8696a0", fontSize: 22, cursor: enviandoTemplate ? "not-allowed" : "pointer" }}>✕</button>
            </div>

            {janelaExpirada && (
              <div style={{ padding: "10px 20px", background: "#f59e0b22", borderBottom: "1px solid #f59e0b44" }}>
                <p style={{ color: "#fbbf24", fontSize: 12, margin: 0 }}>
                  ⚠️ Janela de 24h expirada. O template vai reabrir a conversa (custo da Meta aplica).
                </p>
              </div>
            )}

            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Lista de templates */}
              <div>
                <label style={{ color: "#8696a0", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>
                  Template aprovado ({templatesDoCanal.length} disponíveis)
                </label>
                {templatesDoCanal.length === 0 ? (
                  <div style={{ background: "#202c33", borderRadius: 8, padding: 16, textAlign: "center" }}>
                    <p style={{ color: "#f59e0b", fontSize: 13, margin: "0 0 8px" }}>⚠️ Nenhum template aprovado pra esse canal</p>
                    <p style={{ color: "#8696a0", fontSize: 11, margin: 0 }}>
                      Cria templates em <b>Chatbot → Templates</b> e aguarda aprovação da Meta.
                    </p>
                  </div>
                ) : (
                  <select value={templateEscolhido?.id || ""}
                    onChange={e => {
                      const t = templatesDoCanal.find(tpl => tpl.id === parseInt(e.target.value));
                      setTemplateEscolhido(t || null);
                      setTemplateVars({});
                    }}
                    style={{ width: "100%", background: "#2a3942", border: "1px solid #374045", borderRadius: 8, padding: "10px 12px", color: "white", fontSize: 13 }}>
                    <option value="">— Selecione um template —</option>
                    {templatesDoCanal.map(t => (
                      <option key={t.id} value={t.id}>
                        ✅ {t.nome_amigavel || t.meta_template_name} ({t.categoria}, {t.idioma})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Preview do template selecionado */}
              {templateEscolhido && (
                <div style={{ background: "#202c33", borderRadius: 10, padding: 14 }}>
                  <p style={{ color: "#8696a0", fontSize: 10, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>Preview</p>
                  {(templateEscolhido.componentes || []).map((c: any, i: number) => {
                    if (c.type === "HEADER" && c.format === "TEXT") return <p key={i} style={{ color: "#86efac", fontSize: 12, margin: "0 0 6px", fontWeight: "bold" }}>📌 {c.text}</p>;
                    if (c.type === "HEADER") return <p key={i} style={{ color: "#8696a0", fontSize: 11, margin: "0 0 6px" }}>📎 {c.format}</p>;
                    if (c.type === "BODY") return <p key={i} style={{ color: "#e9edef", fontSize: 13, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{c.text}</p>;
                    if (c.type === "FOOTER") return <p key={i} style={{ color: "#8696a0", fontSize: 11, margin: "0 0 6px", fontStyle: "italic" }}>{c.text}</p>;
                    if (c.type === "BUTTONS") return <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {(c.buttons || []).map((b: any, j: number) => (
                        <span key={j} style={{ background: "#00a88422", color: "#00a884", fontSize: 11, padding: "3px 10px", borderRadius: 6 }}>{b.text}</span>
                      ))}
                    </div>;
                    return null;
                  })}
                </div>
              )}

              {/* Inputs pra variáveis {{1}}, {{2}} etc */}
              {templateEscolhido && variaveisDoTemplate.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ color: "#8696a0", fontSize: 11, textTransform: "uppercase", fontWeight: "bold" }}>
                    🔧 Variáveis ({variaveisDoTemplate.length})
                  </label>
                  {variaveisDoTemplate.map(v => (
                    <div key={v}>
                      <label style={{ color: "#8696a0", fontSize: 11, display: "block", marginBottom: 2 }}>{`{{${v}}}`}</label>
                      <input
                        value={templateVars[v] || ""}
                        onChange={e => setTemplateVars(p => ({ ...p, [v]: e.target.value }))}
                        placeholder={`Valor pra {{${v}}}`}
                        style={{ width: "100%", background: "#2a3942", border: "1px solid #374045", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer com botão enviar */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #2a3942", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <p style={{ color: "#8696a0", fontSize: 11, margin: 0 }}>
                Para: <b style={{ color: "#00a884", fontFamily: "monospace" }}>{atendimentoAtivo.numero}</b>
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowTemplateModal(false)} disabled={enviandoTemplate}
                  style={{ background: "#2a3942", color: "#8696a0", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: enviandoTemplate ? "not-allowed" : "pointer" }}>
                  Cancelar
                </button>
                <button onClick={enviarTemplateWaba} disabled={enviandoTemplate || !templateEscolhido}
                  style={{ background: (enviandoTemplate || !templateEscolhido) ? "#047857" : "#00a884", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: (enviandoTemplate || !templateEscolhido) ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                  {enviandoTemplate ? "⏳ Enviando..." : "🚀 Enviar Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DADOS DO CONTATO */}
      {atendimentoAtivo && showPainelContato && (
        <div style={{ width: 340, background: "#111b21", borderLeft: "1px solid #222d34", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #222d34", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: "#e9edef", fontSize: 14, fontWeight: "bold", margin: 0 }}>👤 Dados do Contato</h3>
              <p style={{ color: "#8696a0", fontSize: 11, margin: "2px 0 0" }}>{salvandoContato ? "💾 Salvando..." : "Auto-salvo"}</p>
            </div>
            <button onClick={() => setShowPainelContato(false)} style={{ background: "none", border: "none", color: "#8696a0", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #222d34", background: "#111b21" }}>
            {[{ key: "perfil", icon: "👤" }, { key: "protocolo", icon: "📋" }, { key: "funil", icon: "🎯" }, { key: "etiquetas", icon: "🏷️" }, { key: "ia", icon: "🤖" }, { key: "utils", icon: "🔧" }].map(a => (
              <button key={a.key} onClick={() => setAbaPainel(a.key as any)}
                style={{ flex: 1, padding: "10px 4px", background: abaPainel === a.key ? "#2a3942" : "none", border: "none", borderBottom: abaPainel === a.key ? "2px solid #00a884" : "2px solid transparent", color: abaPainel === a.key ? "#00a884" : "#8696a0", fontSize: 15, cursor: "pointer", position: "relative" }}>
                {a.icon}
                {a.key === "etiquetas" && etiquetasAtendimento.length > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, background: "#dc2626", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>{etiquetasAtendimento.length}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {abaPainel === "perfil" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#00a88422", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 10px" }}>👤</div>
                  <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{atendimentoAtivo.nome}</p>
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label>
                  <input value={atendimentoAtivo.nome || ""} onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, nome: e.target.value })} onBlur={e => salvarCampoContato("nome", e.target.value)} style={inputSm} />
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Telefone</label>
                  <input value={atendimentoAtivo.numero || ""} disabled style={{ ...inputSm, opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Canal</label>
                  <input value={atendimentoAtivo.canal_id ? `${iconeCanal(atendimentoAtivo.canal_id)} ${nomeDoCanal(atendimentoAtivo.canal_id)}` : "—"} disabled style={{ ...inputSm, opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>E-mail</label>
                  <input type="email" placeholder="contato@email.com" value={atendimentoAtivo.email || ""} onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, email: e.target.value })} onBlur={e => salvarCampoContato("email", e.target.value)} style={inputSm} />
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Atendente</label>
                  <input value={atendimentoAtivo.atendente ? nomeDoAtendente(atendimentoAtivo.atendente) : "—"} disabled style={{ ...inputSm, opacity: 0.6 }} />
                </div>
              </div>
            )}

            {abaPainel === "protocolo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#202c33", borderRadius: 8, padding: 12 }}>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase" }}>Número do Protocolo</label>
                  <p style={{ color: "#00a884", fontSize: 16, fontWeight: "bold", margin: "4px 0 0", fontFamily: "monospace" }}>#{String(atendimentoAtivo.id).padStart(6, "0")}</p>
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Avaliação</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => salvarCampoContato("avaliacao", n)} style={{ background: (atendimentoAtivo.avaliacao || 0) >= n ? "#f59e0b" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "8px 12px", fontSize: 16, cursor: "pointer" }}>⭐</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Notas</label>
                  <textarea value={atendimentoAtivo.notas || ""} onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, notas: e.target.value })} onBlur={e => salvarCampoContato("notas", e.target.value)} rows={8} style={{ ...inputSm, resize: "vertical", minHeight: 100 }} />
                </div>
              </div>
            )}

            {abaPainel === "funil" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Etapa</label>
                  <select value={atendimentoAtivo.funil_etapa || ""} onChange={e => salvarCampoContato("funil_etapa", e.target.value)} style={inputSm}>
                    <option value="">Sem etapa</option>
                    <option value="novo">🆕 Novo Lead</option>
                    <option value="contato">📞 Primeiro Contato</option>
                    <option value="qualificacao">🎯 Qualificação</option>
                    <option value="proposta">💰 Proposta</option>
                    <option value="negociacao">🤝 Negociação</option>
                    <option value="fechado_ganho">✅ Fechado Ganho</option>
                    <option value="fechado_perdido">❌ Fechado Perdido</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#8696a0", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Valor (R$)</label>
                  <input type="number" step="0.01" value={atendimentoAtivo.valor || 0} onChange={e => setAtendimentoAtivo({ ...atendimentoAtivo, valor: parseFloat(e.target.value) || 0 })} onBlur={e => salvarCampoContato("valor", parseFloat(e.target.value) || 0)} style={inputSm} />
                </div>
              </div>
            )}

            {abaPainel === "etiquetas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {etiquetasWorkspace.length === 0 ? (
                  <div style={{ background: "#202c33", borderRadius: 8, padding: 24, textAlign: "center" }}>
                    <p style={{ color: "#8696a0", fontSize: 12 }}>Nenhuma etiqueta criada. Vá em Cadastros → Etiquetas.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {etiquetasWorkspace.map(et => {
                      const marcada = etiquetasAtendimento.includes(et.id);
                      return (
                        <button key={et.id} onClick={() => toggleEtiqueta(et.id)}
                          style={{ background: marcada ? et.cor + "22" : "#202c33", border: `2px solid ${marcada ? et.cor : "#374151"}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", opacity: marcada ? 1 : 0.6 }}>
                          <div style={{ background: et.cor + "33", borderRadius: 6, padding: "4px 8px", fontSize: 16 }}>{et.icone || "🏷️"}</div>
                          <span style={{ flex: 1, color: marcada ? et.cor : "white", fontSize: 13, fontWeight: "bold", textAlign: "left" }}>{et.nome}</span>
                          {marcada && <span style={{ background: et.cor, color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {abaPainel === "ia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[{ key: "bloqueado_ia", label: "🤖 ChatGPT / IA", cor: "#16a34a" }, { key: "bloqueado_typebot", label: "🔀 TypeBOT", cor: "#3b82f6" }].map(item => {
                  const bloqueado = !!(atendimentoAtivo as any)[item.key];
                  return (
                    <div key={item.key} style={{ background: "#202c33", borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{item.label}</p>
                        <button onClick={() => salvarCampoContato(item.key, !bloqueado)} style={{ width: 44, height: 24, background: bloqueado ? "#dc2626" : item.cor, borderRadius: 12, cursor: "pointer", border: "none", position: "relative" }}>
                          <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: bloqueado ? 23 : 3, transition: "left 0.2s" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {abaPainel === "utils" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button onClick={exportarPDF} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "12px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>📄 Exportar Histórico em PDF</button>
                <button onClick={() => { navigator.clipboard.writeText(numeroSanitizado(atendimentoAtivo.numero)); alert("Copiado!"); }} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📋 Copiar número</button>
                <button onClick={() => window.open(`https://wa.me/${numeroSanitizado(atendimentoAtivo.numero)}`, "_blank")} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📞 Abrir no WhatsApp Web</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}