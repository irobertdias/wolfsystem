"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ==================== TIPOS ====================
type TipoNo =
  // Bubbles
  | "texto" | "imagem" | "video" | "audio" | "embed"
  // Inputs
  | "input_texto" | "input_numero" | "input_email" | "input_website"
  | "input_data" | "input_hora" | "input_telefone" | "input_botao"
  | "input_selecao_imagem" | "input_pagamento" | "input_avaliacao"
  | "input_arquivo" | "input_cards"
  // Lógica
  | "condicao" | "variavel" | "redirecionar" | "script" | "espera"
  | "teste_ab" | "webhook" | "pular" | "retornar"
  // Integrações
  | "google_sheets" | "http_request" | "openai" | "claude_ai" | "gmail"
  // Eventos
  | "inicio" | "comando" | "reply" | "invalido" | "transferir" | "finalizar";

type No = {
  id: string;
  tipo: TipoNo;
  x: number;
  y: number;
  dados: Record<string, any>;
  saidas: string[];
};

type Aresta = {
  id: string;
  de: string;
  saidaIndex: number;
  para: string;
};

type Fluxo = {
  id?: number;
  nome: string;
  descricao: string;
  ativo: boolean;
  trigger_tipo: string;
  trigger_valor: string;
  nos: No[];
  conexoes: Aresta[];
  workspace_id: string;
};

// ==================== CONFIGURAÇÕES DOS BLOCOS ====================
type BlocoConfig = {
  label: string;
  icone: string;
  cor: string;
  saidas: string[];
  grupo: string;
};

const BLOCOS: Record<TipoNo, BlocoConfig> = {
  // Bubbles
  texto:                { label: "Texto",             icone: "💬", cor: "#3b82f6", saidas: ["Próximo"], grupo: "Bubbles" },
  imagem:               { label: "Imagem",            icone: "🖼️", cor: "#06b6d4", saidas: ["Próximo"], grupo: "Bubbles" },
  video:                { label: "Vídeo",             icone: "🎥", cor: "#8b5cf6", saidas: ["Próximo"], grupo: "Bubbles" },
  audio:                { label: "Áudio",             icone: "🎵", cor: "#ec4899", saidas: ["Próximo"], grupo: "Bubbles" },
  embed:                { label: "Incorporar",        icone: "🔗", cor: "#f97316", saidas: ["Próximo"], grupo: "Bubbles" },
  // Inputs
  input_texto:          { label: "Texto",             icone: "✏️", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_numero:         { label: "Número",            icone: "🔢", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_email:          { label: "Email",             icone: "📧", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_website:        { label: "Website",           icone: "🌐", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_data:           { label: "Data",              icone: "📅", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_hora:           { label: "Hora",              icone: "🕐", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_telefone:       { label: "Telefone",          icone: "📱", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_botao:          { label: "Botão",             icone: "🔘", cor: "#16a34a", saidas: ["Botão 1", "Botão 2", "Botão 3"], grupo: "Inputs" },
  input_selecao_imagem: { label: "Seleção Imagem",   icone: "🖼️", cor: "#16a34a", saidas: ["Selecionado"], grupo: "Inputs" },
  input_pagamento:      { label: "Pagamento",         icone: "💳", cor: "#16a34a", saidas: ["Aprovado", "Recusado"], grupo: "Inputs" },
  input_avaliacao:      { label: "Avaliação",         icone: "⭐", cor: "#16a34a", saidas: ["Resposta recebida"], grupo: "Inputs" },
  input_arquivo:        { label: "Arquivo",           icone: "📎", cor: "#16a34a", saidas: ["Arquivo recebido"], grupo: "Inputs" },
  input_cards:          { label: "Cards",             icone: "🃏", cor: "#16a34a", saidas: ["Selecionado"], grupo: "Inputs" },
  // Lógica
  condicao:             { label: "Condição",          icone: "🔀", cor: "#f59e0b", saidas: ["Verdadeiro", "Falso"], grupo: "Lógica" },
  variavel:             { label: "Variável",          icone: "📦", cor: "#f59e0b", saidas: ["Próximo"], grupo: "Lógica" },
  redirecionar:         { label: "Redirecionar",      icone: "↩️", cor: "#f59e0b", saidas: [], grupo: "Lógica" },
  script:               { label: "Script",            icone: "⌨️", cor: "#f59e0b", saidas: ["Próximo"], grupo: "Lógica" },
  espera:               { label: "Espera",            icone: "⏳", cor: "#f59e0b", saidas: ["Continuar"], grupo: "Lógica" },
  teste_ab:             { label: "Teste A/B",         icone: "🧪", cor: "#f59e0b", saidas: ["A", "B"], grupo: "Lógica" },
  webhook:              { label: "Webhook",           icone: "🔔", cor: "#f59e0b", saidas: ["Próximo"], grupo: "Lógica" },
  pular:                { label: "Pular",             icone: "⏭️", cor: "#f59e0b", saidas: [], grupo: "Lógica" },
  retornar:             { label: "Retornar",          icone: "🔁", cor: "#f59e0b", saidas: [], grupo: "Lógica" },
  // Integrações
  google_sheets:        { label: "Google Sheets",     icone: "📊", cor: "#10b981", saidas: ["Próximo"], grupo: "Integrações" },
  http_request:         { label: "HTTP Request",      icone: "🌐", cor: "#10b981", saidas: ["Sucesso", "Erro"], grupo: "Integrações" },
  openai:               { label: "OpenAI",            icone: "🤖", cor: "#10b981", saidas: ["Próximo"], grupo: "Integrações" },
  claude_ai:            { label: "Claude AI",         icone: "🧠", cor: "#10b981", saidas: ["Próximo"], grupo: "Integrações" },
  gmail:                { label: "Gmail",             icone: "📨", cor: "#10b981", saidas: ["Enviado"], grupo: "Integrações" },
  // Eventos
  inicio:               { label: "Início",            icone: "🚀", cor: "#16a34a", saidas: ["Próximo"], grupo: "Eventos" },
  comando:              { label: "Comando",           icone: "⚡", cor: "#dc2626", saidas: ["Próximo"], grupo: "Eventos" },
  reply:                { label: "Reply",             icone: "↩️", cor: "#dc2626", saidas: ["Próximo"], grupo: "Eventos" },
  invalido:             { label: "Inválido",          icone: "❌", cor: "#dc2626", saidas: ["Próximo"], grupo: "Eventos" },
  transferir:           { label: "Transferir",        icone: "👤", cor: "#dc2626", saidas: ["Próximo"], grupo: "Eventos" },
  finalizar:            { label: "Finalizar",         icone: "🏁", cor: "#dc2626", saidas: [], grupo: "Eventos" },
};

const GRUPOS_ORDEM = ["Bubbles", "Inputs", "Lógica", "Integrações", "Eventos"];

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: ws } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
  return ws ? ws.id.toString() : null;
}

function getDadosPadrao(tipo: TipoNo): Record<string, any> {
  switch (tipo) {
    case "texto": return { texto: "Digite sua mensagem aqui..." };
    case "imagem": return { url: "", legenda: "" };
    case "video": return { url: "", legenda: "" };
    case "audio": return { url: "" };
    case "embed": return { url: "" };
    case "input_texto": return { pergunta: "Qual é o seu nome?", variavel: "nome" };
    case "input_numero": return { pergunta: "Qual é o seu número?", variavel: "numero" };
    case "input_email": return { pergunta: "Qual é o seu email?", variavel: "email" };
    case "input_website": return { pergunta: "Qual é o seu website?", variavel: "website" };
    case "input_data": return { pergunta: "Qual é a data?", variavel: "data" };
    case "input_hora": return { pergunta: "Qual é a hora?", variavel: "hora" };
    case "input_telefone": return { pergunta: "Qual é o seu telefone?", variavel: "telefone" };
    case "input_botao": return { texto: "Escolha uma opção:", botoes: ["Opção 1", "Opção 2"] };
    case "input_selecao_imagem": return { texto: "Selecione uma imagem:", itens: [] };
    case "input_pagamento": return { valor: 0, descricao: "Pagamento" };
    case "input_avaliacao": return { pergunta: "Como você avalia?", max: 5, variavel: "avaliacao" };
    case "input_arquivo": return { pergunta: "Envie um arquivo:", variavel: "arquivo" };
    case "input_cards": return { cards: [{ titulo: "Card 1", descricao: "" }] };
    case "condicao": return { variavel: "resposta", operador: "igual", valor: "" };
    case "variavel": return { nome: "minhaVariavel", valor: "", tipo: "texto" };
    case "redirecionar": return { url: "" };
    case "script": return { codigo: "// seu código aqui\nreturn true;" };
    case "espera": return { segundos: 3 };
    case "teste_ab": return { percentual_a: 50 };
    case "webhook": return { url: "", metodo: "POST" };
    case "pular": return { alvo: "" };
    case "retornar": return { alvo: "" };
    case "google_sheets": return { spreadsheet_id: "", aba: "Sheet1", acao: "append", dados: "" };
    case "http_request": return { url: "", metodo: "GET", headers: "", body: "" };
    case "openai": return { apiKey: "", modelo: "gpt-4o-mini", prompt: "", variavel: "resposta_ia" };
    case "claude_ai": return { apiKey: "", modelo: "claude-sonnet-4-20250514", prompt: "", variavel: "resposta_ia" };
    case "gmail": return { para: "", assunto: "", corpo: "" };
    case "inicio": return { mensagem: "Olá! Como posso te ajudar?" };
    case "comando": return { comando: "/start" };
    case "reply": return { palavras: "" };
    case "invalido": return { mensagem: "Desculpe, não entendi. Tente novamente." };
    case "transferir": return { fila: "Fila Principal", mensagem: "Transferindo para atendente..." };
    case "finalizar": return { mensagem: "Atendimento finalizado. Obrigado!" };
    default: return {};
  }
}

function getPreviewNo(no: No): string {
  switch (no.tipo) {
    case "texto": return no.dados.texto || "Mensagem vazia";
    case "imagem": return no.dados.legenda || no.dados.url || "Sem URL";
    case "video": return no.dados.legenda || no.dados.url || "Sem URL";
    case "audio": return no.dados.url || "Sem URL";
    case "embed": return no.dados.url || "Sem URL";
    case "input_texto":
    case "input_numero":
    case "input_email":
    case "input_website":
    case "input_data":
    case "input_hora":
    case "input_telefone":
    case "input_arquivo":
    case "input_avaliacao": return `${no.dados.pergunta || "Pergunta"} → {{${no.dados.variavel || "var"}}}`;
    case "input_botao": return `${no.dados.botoes?.length || 0} botões`;
    case "input_selecao_imagem": return `${no.dados.itens?.length || 0} imagens`;
    case "input_pagamento": return `R$ ${no.dados.valor || 0}`;
    case "input_cards": return `${no.dados.cards?.length || 0} cards`;
    case "condicao": return `SE {{${no.dados.variavel}}} ${no.dados.operador} "${no.dados.valor}"`;
    case "variavel": return `{{${no.dados.nome}}} = "${no.dados.valor}"`;
    case "redirecionar": return no.dados.url || "Sem URL";
    case "script": return "Script personalizado";
    case "espera": return `⏳ ${no.dados.segundos}s`;
    case "teste_ab": return `A: ${no.dados.percentual_a}% / B: ${100 - no.dados.percentual_a}%`;
    case "webhook": return `${no.dados.metodo} ${no.dados.url || "Sem URL"}`;
    case "pular": return `→ ${no.dados.alvo || "?"}`;
    case "retornar": return `↩ ${no.dados.alvo || "?"}`;
    case "google_sheets": return `Sheets: ${no.dados.acao}`;
    case "http_request": return `${no.dados.metodo} ${no.dados.url || "Sem URL"}`;
    case "openai": return `GPT: ${no.dados.modelo}`;
    case "claude_ai": return `Claude: ${no.dados.modelo}`;
    case "gmail": return `Para: ${no.dados.para || "?"}`;
    case "inicio": return no.dados.mensagem || "Início";
    case "comando": return no.dados.comando || "/start";
    case "reply": return no.dados.palavras || "Palavras-chave";
    case "invalido": return no.dados.mensagem || "Inválido";
    case "transferir": return `→ ${no.dados.fila}`;
    case "finalizar": return no.dados.mensagem || "Finalizar";
    default: return "";
  }
}

export default function FluxosPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [wsId, setWsId] = useState<string | null>(null);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [fluxoAtivo, setFluxoAtivo] = useState<Fluxo | null>(null);
  const [nos, setNos] = useState<No[]>([]);
  const [arestas, setArestas] = useState<Aresta[]>([]);
  const [noSelecionado, setNoSelecionado] = useState<No | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [view, setView] = useState<"lista" | "editor">("lista");
  const [showNovoFluxo, setShowNovoFluxo] = useState(false);
  const [formNovoFluxo, setFormNovoFluxo] = useState({ nome: "", descricao: "", trigger_tipo: "qualquer_mensagem", trigger_valor: "" });
  const [grupoAberto, setGrupoAberto] = useState<string>("Bubbles");

  // Canvas state
  const [draggingNo, setDraggingNo] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 60, y: 60 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [conectando, setConectando] = useState<{ noId: string; saidaIndex: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const init = async () => {
      const id = await getWorkspaceId();
      setWsId(id);
      if (id) await fetchFluxos(id);
    };
    init();
  }, []);

  const fetchFluxos = async (id?: string) => {
    const wid = id || wsId;
    if (!wid) return;
    const { data } = await supabase.from("fluxos").select("*").eq("workspace_id", wid).order("created_at", { ascending: false });
    setFluxos((data || []).map(f => ({ ...f, nos: f.nos || [], conexoes: f.conexoes || [] })));
  };

  const criarFluxo = async () => {
    if (!formNovoFluxo.nome.trim()) { alert("Digite o nome do fluxo!"); return; }
    setCriando(true);
    try {
      const id = wsId || await getWorkspaceId();
      if (!id) { alert("Workspace não encontrado!"); return; }
      const noInicio: No = {
        id: gerarId(), tipo: "inicio", x: 200, y: 200,
        dados: getDadosPadrao("inicio"), saidas: [...BLOCOS["inicio"].saidas],
      };
      const novoFluxo = {
        nome: formNovoFluxo.nome.trim(), descricao: formNovoFluxo.descricao,
        ativo: false, trigger_tipo: formNovoFluxo.trigger_tipo,
        trigger_valor: formNovoFluxo.trigger_valor,
        nos: [noInicio], conexoes: [], workspace_id: id,
      };
      const { data, error } = await supabase.from("fluxos").insert([novoFluxo]).select().single();
      if (error) { alert("Erro: " + error.message); return; }
      if (data) {
        setWsId(id);
        await fetchFluxos(id);
        abrirEditor({ ...novoFluxo, id: data.id } as Fluxo);
        setShowNovoFluxo(false);
        setFormNovoFluxo({ nome: "", descricao: "", trigger_tipo: "qualquer_mensagem", trigger_valor: "" });
      }
    } finally { setCriando(false); }
  };

  const abrirEditor = (fluxo: Fluxo) => {
    setFluxoAtivo(fluxo);
    setNos(fluxo.nos || []);
    setArestas(fluxo.conexoes || []);
    setNoSelecionado(null);
    setView("editor");
  };

  const salvarFluxo = async () => {
    if (!fluxoAtivo?.id) return;
    setSalvando(true);
    await supabase.from("fluxos").update({
      nos, conexoes: arestas, nome: fluxoAtivo.nome,
      descricao: fluxoAtivo.descricao, ativo: fluxoAtivo.ativo,
      trigger_tipo: fluxoAtivo.trigger_tipo, trigger_valor: fluxoAtivo.trigger_valor,
    }).eq("id", fluxoAtivo.id);
    await fetchFluxos();
    setSalvando(false);
    alert("✅ Fluxo salvo!");
  };

  const adicionarNo = (tipo: TipoNo) => {
  const cfg = BLOCOS[tipo];
  const rect = canvasRef.current?.getBoundingClientRect();
  const canvasW = rect?.width || window.innerWidth - 480;
  const canvasH = rect?.height || window.innerHeight;
  // Posiciona no centro visível do canvas
  const cx = (canvasW / 2 - canvasOffset.x) / canvasScale - 110;
  const cy = (canvasH / 2 - canvasOffset.y) / canvasScale - 50;
  const offset = (nos.length % 8) * 25;
  const novoNo: No = {
    id: gerarId(), tipo,
    x: cx + offset,
    y: cy + offset,
    dados: getDadosPadrao(tipo),
    saidas: [...cfg.saidas],
  };
  setNos(prev => [...prev, novoNo]);
  // Seleciona o nó recém criado para já abrir propriedades
  setTimeout(() => setNoSelecionado(novoNo), 50);
};

  const excluirNo = (id: string) => {
    if (nos.find(n => n.id === id)?.tipo === "inicio") { alert("Não é possível excluir o nó de início!"); return; }
    setNos(prev => prev.filter(n => n.id !== id));
    setArestas(prev => prev.filter(a => a.de !== id && a.para !== id));
    if (noSelecionado?.id === id) setNoSelecionado(null);
  };

  const atualizarNo = (id: string, dados: Record<string, any>) => {
    setNos(prev => prev.map(n => n.id === id ? { ...n, dados: { ...n.dados, ...dados } } : n));
    setNoSelecionado(prev => prev?.id === id ? { ...prev, dados: { ...prev.dados, ...dados } } : prev);
  };

  const toggleAtivo = async () => {
    if (!fluxoAtivo?.id) return;
    const novoAtivo = !fluxoAtivo.ativo;
    await supabase.from("fluxos").update({ ativo: novoAtivo }).eq("id", fluxoAtivo.id);
    setFluxoAtivo(prev => prev ? { ...prev, ativo: novoAtivo } : null);
    await fetchFluxos();
  };

  const excluirFluxo = async (id: number) => {
    if (!confirm("Excluir este fluxo?")) return;
    await supabase.from("fluxos").delete().eq("id", id);
    await fetchFluxos();
  };

  // ==================== DRAG & DROP ====================
  const handleMouseDownNo = (e: React.MouseEvent, noId: string) => {
    e.stopPropagation();
    if (conectando) return;
    const no = nos.find(n => n.id === noId);
    if (!no) return;
    setDraggingNo(noId);
    setNoSelecionado(nos.find(n => n.id === noId) || null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - (no.x * canvasScale + canvasOffset.x),
        y: e.clientY - rect.top - (no.y * canvasScale + canvasOffset.y),
      });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });
    if (draggingNo) {
      const nx = (mx - dragOffset.x - canvasOffset.x) / canvasScale;
      const ny = (my - dragOffset.y - canvasOffset.y) / canvasScale;
      setNos(prev => prev.map(n => n.id === draggingNo ? { ...n, x: nx, y: ny } : n));
    }
    if (isPanning) {
      setCanvasOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  }, [draggingNo, dragOffset, canvasOffset, canvasScale, isPanning]);

  const handleMouseUp = useCallback(() => {
    setDraggingNo(null);
    setIsPanning(false);
  }, []);

  const adicionarNo = (tipo: TipoNo) => {
  const cfg = BLOCOS[tipo];
  const rect = canvasRef.current?.getBoundingClientRect();
  const canvasW = rect?.width || window.innerWidth - 480;
  const canvasH = rect?.height || window.innerHeight;
  // Posiciona no centro visível do canvas
  const cx = (canvasW / 2 - canvasOffset.x) / canvasScale - 110;
  const cy = (canvasH / 2 - canvasOffset.y) / canvasScale - 50;
  const offset = (nos.length % 8) * 25;
  const novoNo: No = {
    id: gerarId(), tipo,
    x: cx + offset,
    y: cy + offset,
    dados: getDadosPadrao(tipo),
    saidas: [...cfg.saidas],
  };
  setNos(prev => [...prev, novoNo]);
  // Seleciona o nó recém criado para já abrir propriedades
  setTimeout(() => setNoSelecionado(novoNo), 50);
};

const handleCanvasMouseDown = (e: React.MouseEvent) => {
  // Só ativa panning se o clique foi diretamente no canvas (não em botões)
  const target = e.target as HTMLElement;
  if (target.tagName === "BUTTON" || target.closest("button")) return;
  if (draggingNo) return;
  if (conectando) { setConectando(null); return; }
  if (e.button === 0) setIsPanning(true);
};

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(canvasScale * delta, 0.2), 2);
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setCanvasOffset(prev => ({
      x: mx - (mx - prev.x) * (newScale / canvasScale),
      y: my - (my - prev.y) * (newScale / canvasScale),
    }));
    setCanvasScale(newScale);
  };

  const iniciarConexao = (e: React.MouseEvent, noId: string, saidaIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setConectando({ noId, saidaIndex });
  };

  const finalizarConexao = (e: React.MouseEvent, noId: string) => {
    e.stopPropagation();
    if (!conectando || conectando.noId === noId) { setConectando(null); return; }
    setArestas(prev => {
      const filtered = prev.filter(a => !(a.de === conectando.noId && a.saidaIndex === conectando.saidaIndex));
      return [...filtered, { id: gerarId(), de: conectando.noId, saidaIndex: conectando.saidaIndex, para: noId }];
    });
    setConectando(null);
  };

  const excluirAresta = (id: string) => {
    setArestas(prev => prev.filter(a => a.id !== id));
  };

  const getPosConexao = (no: No, saidaIndex: number) => ({
    x: no.x + 220,
    y: no.y + 48 + 36 * saidaIndex + 18,
  });

  const getPosEntrada = (no: No) => ({ x: no.x, y: no.y + 48 + 18 });

  const inputStyle: React.CSSProperties = { width: "100%", background: "#0a0a0a", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "white", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4, letterSpacing: 1 };

  // ==================== PAINEL PROPRIEDADES ====================
  const renderPropriedades = () => {
    if (!noSelecionado) return null;
    const cfg = BLOCOS[noSelecionado.tipo];
    const d = noSelecionado.dados;

    const campo = (label: string, campo: string, tipo: string = "text", placeholder: string = "") => (
      <div>
        <label style={labelStyle}>{label}</label>
        <input type={tipo} value={d[campo] || ""} onChange={(e) => atualizarNo(noSelecionado.id, { [campo]: e.target.value })} style={inputStyle} placeholder={placeholder} />
      </div>
    );

    const textarea = (label: string, campo: string, placeholder: string = "", height: number = 80) => (
      <div>
        <label style={labelStyle}>{label}</label>
        <textarea value={d[campo] || ""} onChange={(e) => atualizarNo(noSelecionado.id, { [campo]: e.target.value })} style={{ ...inputStyle, height, resize: "vertical" }} placeholder={placeholder} />
      </div>
    );

    const select = (label: string, campo: string, opcoes: { value: string; label: string }[]) => (
      <div>
        <label style={labelStyle}>{label}</label>
        <select value={d[campo] || opcoes[0]?.value} onChange={(e) => atualizarNo(noSelecionado.id, { [campo]: e.target.value })} style={inputStyle}>
          {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );

    switch (noSelecionado.tipo) {
      case "texto":
        return textarea("Mensagem", "texto", "Digite sua mensagem...", 120);
      case "imagem":
        return <>{campo("URL da Imagem", "url", "url", "https://...")}{campo("Legenda", "legenda", "text", "Legenda opcional")}</>;
      case "video":
        return <>{campo("URL do Vídeo", "url", "url", "https://...")}{campo("Legenda", "legenda", "text", "Legenda opcional")}</>;
      case "audio":
        return campo("URL do Áudio", "url", "url", "https://...");
      case "embed":
        return campo("URL para Incorporar", "url", "url", "https://...");
      case "input_texto":
      case "input_email":
      case "input_website":
      case "input_numero":
      case "input_telefone":
      case "input_arquivo":
        return <>{textarea("Pergunta", "pergunta", "Qual é...?", 80)}{campo("Salvar em variável", "variavel", "text", "Ex: nome")}</>;
      case "input_data":
        return <>{textarea("Pergunta", "pergunta", "Qual é a data?", 80)}{campo("Salvar em variável", "variavel", "text", "Ex: data")}</>;
      case "input_hora":
        return <>{textarea("Pergunta", "pergunta", "Qual é a hora?", 80)}{campo("Salvar em variável", "variavel", "text", "Ex: hora")}</>;
      case "input_avaliacao":
        return <>{textarea("Pergunta", "pergunta", "Como você avalia?", 80)}{campo("Nota máxima", "max", "number", "5")}{campo("Salvar em variável", "variavel", "text", "Ex: avaliacao")}</>;
      case "input_pagamento":
        return <>{campo("Valor (R$)", "valor", "number", "0.00")}{campo("Descrição", "descricao", "text", "Produto/Serviço")}</>;
      case "input_botao":
        return (
          <>
            {textarea("Texto", "texto", "Escolha uma opção:", 60)}
            <div>
              <label style={labelStyle}>Botões (um por linha, máx 3)</label>
              <textarea
                value={(d.botoes || []).join("\n")}
                onChange={(e) => {
                  const botoes = e.target.value.split("\n").filter(Boolean).slice(0, 3);
                  atualizarNo(noSelecionado.id, { botoes });
                  setNos(prev => prev.map(n => n.id === noSelecionado.id ? { ...n, saidas: botoes.length > 0 ? botoes : ["Botão 1"] } : n));
                }}
                style={{ ...inputStyle, height: 80, resize: "vertical" }}
                placeholder={"Sim\nNão\nTalvez"}
              />
            </div>
          </>
        );
      case "input_cards":
        return (
          <div>
            <label style={labelStyle}>Cards (título | descrição)</label>
            <textarea
              value={(d.cards || []).map((c: any) => `${c.titulo}|${c.descricao}`).join("\n")}
              onChange={(e) => {
                const cards = e.target.value.split("\n").filter(Boolean).map(l => {
                  const [titulo, descricao] = l.split("|");
                  return { titulo: titulo?.trim() || "", descricao: descricao?.trim() || "" };
                });
                atualizarNo(noSelecionado.id, { cards });
              }}
              style={{ ...inputStyle, height: 100, resize: "vertical" }}
              placeholder={"Produto 1|Descrição do produto\nProduto 2|Outra descrição"}
            />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0 0" }}>Formato: Título|Descrição</p>
          </div>
        );
      case "condicao":
        return (
          <>
            {campo("Variável", "variavel", "text", "Ex: resposta")}
            {select("Operador", "operador", [
              { value: "igual", label: "É igual a" },
              { value: "diferente", label: "É diferente de" },
              { value: "contem", label: "Contém" },
              { value: "nao_contem", label: "Não contém" },
              { value: "comeca", label: "Começa com" },
              { value: "termina", label: "Termina com" },
              { value: "vazio", label: "Está vazio" },
              { value: "nao_vazio", label: "Não está vazio" },
              { value: "maior", label: "Maior que" },
              { value: "menor", label: "Menor que" },
            ])}
            {campo("Valor", "valor", "text", "Valor para comparar")}
          </>
        );
      case "variavel":
        return (
          <>
            {campo("Nome da Variável", "nome", "text", "Ex: nome_cliente")}
            {select("Tipo", "tipo", [
              { value: "texto", label: "Texto" },
              { value: "numero", label: "Número" },
              { value: "booleano", label: "Verdadeiro/Falso" },
              { value: "lista", label: "Lista" },
            ])}
            {campo("Valor", "valor", "text", "Valor ou {{outra_variavel}}")}
          </>
        );
      case "redirecionar":
        return campo("URL de Redirecionamento", "url", "url", "https://...");
      case "script":
        return textarea("Código JavaScript", "codigo", "// Seu código\nreturn true;", 150);
      case "espera":
        return campo("Aguardar (segundos)", "segundos", "number", "3");
      case "teste_ab":
        return (
          <div>
            <label style={labelStyle}>Percentual para A (%)</label>
            <input type="number" min={1} max={99} value={d.percentual_a || 50} onChange={(e) => atualizarNo(noSelecionado.id, { percentual_a: Number(e.target.value) })} style={inputStyle} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0 0" }}>B receberá {100 - (d.percentual_a || 50)}%</p>
          </div>
        );
      case "webhook":
        return (
          <>
            {campo("URL do Webhook", "url", "url", "https://...")}
            {select("Método", "metodo", [
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "DELETE", label: "DELETE" },
            ])}
            {textarea("Headers (JSON)", "headers", '{"Authorization": "Bearer token"}', 80)}
            {textarea("Body (JSON)", "body", '{"chave": "valor"}', 80)}
          </>
        );
      case "pular":
      case "retornar":
        return campo("ID do nó alvo", "alvo", "text", "ID do bloco de destino");
      case "google_sheets":
        return (
          <>
            {campo("ID da Planilha", "spreadsheet_id", "text", "ID do Google Sheets")}
            {campo("Aba", "aba", "text", "Sheet1")}
            {select("Ação", "acao", [
              { value: "append", label: "Adicionar linha" },
              { value: "update", label: "Atualizar célula" },
              { value: "get", label: "Buscar dado" },
            ])}
            {textarea("Dados (variáveis separadas por vírgula)", "dados", "{{nome}},{{email}},{{telefone}}", 60)}
          </>
        );
      case "http_request":
        return (
          <>
            {campo("URL", "url", "url", "https://api.exemplo.com/endpoint")}
            {select("Método", "metodo", [
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "DELETE", label: "DELETE" },
            ])}
            {textarea("Headers (JSON)", "headers", '{"Content-Type": "application/json"}', 60)}
            {textarea("Body (JSON)", "body", '{"chave": "{{variavel}}"}', 80)}
            {campo("Salvar resposta em variável", "variavel", "text", "Ex: resposta_api")}
          </>
        );
      case "openai":
        return (
          <>
            {campo("API Key", "apiKey", "password", "sk-...")}
            {select("Modelo", "modelo", [
              { value: "gpt-4o", label: "GPT-4o" },
              { value: "gpt-4o-mini", label: "GPT-4o Mini" },
              { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
            ])}
            {textarea("Prompt do sistema", "prompt", "Você é um assistente...", 100)}
            {campo("Salvar resposta em variável", "variavel", "text", "Ex: resposta_ia")}
          </>
        );
      case "claude_ai":
        return (
          <>
            {campo("API Key", "apiKey", "password", "sk-ant-...")}
            {select("Modelo", "modelo", [
              { value: "claude-opus-4-6", label: "Claude Opus 4" },
              { value: "claude-sonnet-4-6", label: "Claude Sonnet 4" },
              { value: "claude-haiku-4-5-20251001", label: "Claude Haiku" },
            ])}
            {textarea("Prompt do sistema", "prompt", "Você é um assistente...", 100)}
            {campo("Salvar resposta em variável", "variavel", "text", "Ex: resposta_ia")}
          </>
        );
      case "gmail":
        return (
          <>
            {campo("Para", "para", "email", "destino@email.com ou {{email}}")}
            {campo("Assunto", "assunto", "text", "Assunto do email")}
            {textarea("Corpo do Email", "corpo", "Olá {{nome}},\n\n...", 120)}
          </>
        );
      case "inicio":
        return textarea("Mensagem de Boas-vindas", "mensagem", "Olá! Como posso te ajudar?", 100);
      case "comando":
        return campo("Comando", "comando", "text", "/start");
      case "reply":
        return (
          <>
            <div>
              <label style={labelStyle}>Palavras-chave (separadas por vírgula)</label>
              <input value={d.palavras || ""} onChange={(e) => atualizarNo(noSelecionado.id, { palavras: e.target.value })} style={inputStyle} placeholder="oi, olá, bom dia" />
            </div>
          </>
        );
      case "invalido":
        return textarea("Mensagem para resposta inválida", "mensagem", "Desculpe, não entendi...", 80);
      case "transferir":
        return (
          <>
            {select("Fila de destino", "fila", [
              { value: "Fila Principal", label: "Fila Principal" },
              { value: "Fila Suporte", label: "Fila Suporte" },
              { value: "Fila Vendas", label: "Fila Vendas" },
            ])}
            {textarea("Mensagem ao transferir", "mensagem", "Transferindo...", 80)}
          </>
        );
      case "finalizar":
        return textarea("Mensagem de encerramento", "mensagem", "Obrigado pelo contato!", 80);
      default:
        return <p style={{ color: "#6b7280", fontSize: 12 }}>Sem propriedades para este bloco.</p>;
    }
  };

  // ==================== VIEW LISTA ====================
  if (view === "lista") {
    return (
      <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a", color: "white" }}>
        <div style={{ width: 220, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", padding: 16, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)" }} />
            <span style={{ color: "white", fontWeight: "bold", fontSize: 14 }}>Wolf Chatbot</span>
          </div>
          <button onClick={() => router.push("/chatbot")} style={{ background: "#3b82f622", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px 14px", color: "#3b82f6", fontSize: 13, fontWeight: "bold", cursor: "pointer", textAlign: "left" }}>💬 Conversas</button>
          <button style={{ background: "#8b5cf622", border: "1px solid #8b5cf633", borderRadius: 8, padding: "10px 14px", color: "#8b5cf6", fontSize: 13, fontWeight: "bold", cursor: "pointer", textAlign: "left" }}>🤖 Fluxos</button>
          <button onClick={() => router.push("/crm")} style={{ background: "none", border: "none", borderRadius: 8, padding: "10px 14px", color: "#6b7280", fontSize: 13, cursor: "pointer", textAlign: "left", marginTop: "auto" }}>← Voltar ao CRM</button>
        </div>

        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          {showNovoFluxo && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 500, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>➕ Novo Fluxo</h2>
                  <button onClick={() => setShowNovoFluxo(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Nome *</label>
                  <input autoFocus placeholder="Ex: Fluxo de Vendas" value={formNovoFluxo.nome} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && criarFluxo()} style={{ ...inputStyle, fontSize: 14, padding: "10px 14px", background: "#1f2937" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Descrição</label>
                  <input placeholder="Descreva o objetivo do fluxo" value={formNovoFluxo.descricao} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, descricao: e.target.value })} style={{ ...inputStyle, background: "#1f2937" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Quando Ativar</label>
                  <select value={formNovoFluxo.trigger_tipo} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, trigger_tipo: e.target.value })} style={{ ...inputStyle, background: "#1f2937" }}>
                    <option value="qualquer_mensagem">Qualquer mensagem recebida</option>
                    <option value="palavra_chave">Palavra-chave específica</option>
                    <option value="primeiro_contato">Primeiro contato</option>
                    <option value="fora_horario">Fora do horário</option>
                  </select>
                </div>
                {formNovoFluxo.trigger_tipo === "palavra_chave" && (
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Palavra-chave</label>
                    <input placeholder="Ex: oi, olá, inicio" value={formNovoFluxo.trigger_valor} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, trigger_valor: e.target.value })} style={{ ...inputStyle, background: "#1f2937" }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowNovoFluxo(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={criarFluxo} disabled={criando} style={{ background: criando ? "#6b21a8" : "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: criando ? "wait" : "pointer", fontWeight: "bold" }}>
                    {criando ? "⏳ Criando..." : "🤖 Criar Fluxo"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>🤖 Meus Fluxos</h1>
              <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>{fluxos.length} fluxo(s) criado(s)</p>
            </div>
            <button onClick={() => setShowNovoFluxo(true)} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Fluxo</button>
          </div>

          {fluxos.length === 0 ? (
            <div style={{ background: "#111", borderRadius: 12, padding: 64, textAlign: "center", border: "1px solid #1f2937" }}>
              <p style={{ fontSize: 64, margin: "0 0 16px 0" }}>🤖</p>
              <h3 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum fluxo criado</h3>
              <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px 0" }}>Crie fluxos de atendimento automático</p>
              <button onClick={() => setShowNovoFluxo(true)} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>+ Criar Primeiro Fluxo</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {fluxos.map((fluxo) => (
                <div key={fluxo.id} style={{ background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${fluxo.ativo ? "#8b5cf644" : "#1f2937"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{fluxo.nome}</h3>
                      {fluxo.descricao && <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0 0" }}>{fluxo.descricao}</p>}
                    </div>
                    <span style={{ background: fluxo.ativo ? "#8b5cf622" : "#1f2937", color: fluxo.ativo ? "#8b5cf6" : "#6b7280", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {fluxo.ativo ? "🟢 Ativo" : "⚫ Inativo"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>{fluxo.nos?.length || 0} blocos</span>
                    <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>
                      {fluxo.trigger_tipo === "qualquer_mensagem" ? "📨 Qualquer msg" : fluxo.trigger_tipo === "palavra_chave" ? `🔑 "${fluxo.trigger_valor}"` : fluxo.trigger_tipo === "primeiro_contato" ? "👋 1º contato" : "🕐 Fora horário"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => abrirEditor(fluxo)} style={{ flex: 1, background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✏️ Editar</button>
                    <button onClick={() => excluirFluxo(fluxo.id!)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== VIEW EDITOR ====================
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a", color: "white", overflow: "hidden" }}>

      {/* PAINEL ESQUERDO - BLOCOS */}
      <div style={{ width: 210, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setView("lista")} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", padding: 0 }}>←</button>
          <h3 style={{ color: "white", fontSize: 12, fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{fluxoAtivo?.nome}</h3>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {GRUPOS_ORDEM.map((grupo) => {
            const tiposDoGrupo = (Object.entries(BLOCOS) as [TipoNo, BlocoConfig][]).filter(([, cfg]) => cfg.grupo === grupo);
            const aberto = grupoAberto === grupo;
            return (
              <div key={grupo}>
                <button
                  onClick={() => setGrupoAberto(aberto ? "" : grupo)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "7px 14px", background: "none", border: "none", cursor: "pointer", color: aberto ? "#8b5cf6" : "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}
                >
                  <span>{grupo}</span>
                  <span style={{ fontSize: 9 }}>{aberto ? "▼" : "▶"}</span>
                </button>
                {aberto && (
                  <div style={{ padding: "2px 8px 8px 8px" }}>
                    {tiposDoGrupo.map(([tipo, cfg]) => (
                      <button
                        key={tipo}
                        onClick={() => adicionarNo(tipo)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#1a1a1a", border: "1px solid #1f2937", borderRadius: 6, padding: "6px 10px", color: "white", fontSize: 11, cursor: "pointer", marginBottom: 3, textAlign: "left", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1f2937")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      >
                        <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{cfg.icone}</span>
                        <span style={{ flex: 1 }}>{cfg.label}</span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.cor, flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 10, borderTop: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a1a", borderRadius: 8, padding: "7px 10px", marginBottom: 8 }}>
            <span style={{ color: fluxoAtivo?.ativo ? "#8b5cf6" : "#6b7280", fontSize: 11, fontWeight: "bold" }}>{fluxoAtivo?.ativo ? "🟢 Ativo" : "⚫ Inativo"}</span>
            <button onClick={toggleAtivo} style={{ width: 34, height: 18, background: fluxoAtivo?.ativo ? "#8b5cf6" : "#374151", borderRadius: 9, cursor: "pointer", border: "none", position: "relative" }}>
              <div style={{ width: 12, height: 12, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: fluxoAtivo?.ativo ? 19 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
          <button onClick={salvarFluxo} disabled={salvando} style={{ width: "100%", background: salvando ? "#6b21a8" : "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "9px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
            {salvando ? "Salvando..." : "💾 Salvar Fluxo"}
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={canvasRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: draggingNo ? "grabbing" : isPanning ? "grabbing" : conectando ? "crosshair" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Grade pontilhada */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="dots" width={24 * canvasScale} height={24 * canvasScale} patternUnits="userSpaceOnUse" x={canvasOffset.x % (24 * canvasScale)} y={canvasOffset.y % (24 * canvasScale)}>
              <circle cx={1} cy={1} r={0.8} fill="#1f2937" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* SVG das conexões */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {arestas.map((aresta) => {
            const noOrigem = nos.find(n => n.id === aresta.de);
            const noDestino = nos.find(n => n.id === aresta.para);
            if (!noOrigem || !noDestino) return null;
            const origem = getPosConexao(noOrigem, aresta.saidaIndex);
            const destino = getPosEntrada(noDestino);
            const ox = origem.x * canvasScale + canvasOffset.x;
            const oy = origem.y * canvasScale + canvasOffset.y;
            const dx = destino.x * canvasScale + canvasOffset.x;
            const dy = destino.y * canvasScale + canvasOffset.y;
            const cor = BLOCOS[noOrigem.tipo]?.cor || "#4b5563";
            return (
              <g key={aresta.id} style={{ pointerEvents: "all", cursor: "pointer" }} onClick={() => excluirAresta(aresta.id)}>
                <path d={`M ${ox} ${oy} C ${ox + 80 * canvasScale} ${oy} ${dx - 80 * canvasScale} ${dy} ${dx} ${dy}`} stroke={cor} strokeWidth={2} fill="none" opacity={0.7} />
                <path d={`M ${ox} ${oy} C ${ox + 80 * canvasScale} ${oy} ${dx - 80 * canvasScale} ${dy} ${dx} ${dy}`} stroke="transparent" strokeWidth={12} fill="none" />
                <circle cx={dx} cy={dy} r={5} fill={cor} />
              </g>
            );
          })}

          {/* Linha em progresso */}
          {conectando && (() => {
            const no = nos.find(n => n.id === conectando.noId);
            if (!no) return null;
            const origem = getPosConexao(no, conectando.saidaIndex);
            const ox = origem.x * canvasScale + canvasOffset.x;
            const oy = origem.y * canvasScale + canvasOffset.y;
            const cor = BLOCOS[no.tipo]?.cor || "#8b5cf6";
            return (
              <path d={`M ${ox} ${oy} C ${ox + 80} ${oy} ${mousePos.x - 80} ${mousePos.y} ${mousePos.x} ${mousePos.y}`} stroke={cor} strokeWidth={2} strokeDasharray="6 3" fill="none" opacity={0.8} />
            );
          })()}
        </svg>

        {/* NÓS */}
        <div style={{ position: "absolute", inset: 0, transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`, transformOrigin: "0 0" }}>
          {nos.map((no) => {
            const cfg = BLOCOS[no.tipo];
            if (!cfg) return null;
            const selecionado = noSelecionado?.id === no.id;
            const preview = getPreviewNo(no);
            return (
              <div
                key={no.id}
                style={{ position: "absolute", left: no.x, top: no.y, width: 220, background: "#111", borderRadius: 10, border: `2px solid ${selecionado ? cfg.cor : "#2d2d2d"}`, boxShadow: selecionado ? `0 0 0 3px ${cfg.cor}33, 0 4px 20px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.4)", cursor: draggingNo === no.id ? "grabbing" : "grab", userSelect: "none", zIndex: selecionado ? 10 : 1 }}
                onMouseDown={(e) => handleMouseDownNo(e, no.id)}
                onClick={(e) => { e.stopPropagation(); setNoSelecionado(nos.find(n => n.id === no.id) || null); }}
                onMouseUp={(e) => finalizarConexao(e, no.id)}
              >
                {/* Header */}
                <div style={{ background: cfg.cor, borderRadius: "8px 8px 0 0", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{cfg.icone}</span>
                    <span style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>{cfg.label}</span>
                    <span style={{ background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.7)", fontSize: 9, padding: "1px 6px", borderRadius: 10 }}>{cfg.grupo}</span>
                  </div>
                  {no.tipo !== "inicio" && (
                    <button onClick={(e) => { e.stopPropagation(); excluirNo(no.id); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                  )}
                </div>

                {/* Preview */}
                <div style={{ padding: "7px 10px", borderBottom: cfg.saidas.length > 0 ? "1px solid #1f2937" : "none" }}>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
                </div>

                {/* Ponto de entrada */}
                {no.tipo !== "inicio" && (
                  <div
                    style={{ position: "absolute", left: -7, top: 48 + 18 - 7, width: 14, height: 14, borderRadius: "50%", background: "#1f2937", border: `2px solid ${cfg.cor}`, cursor: "pointer", zIndex: 5 }}
                    onMouseUp={(e) => finalizarConexao(e, no.id)}
                  />
                )}

                {/* Saídas */}
                {no.saidas.map((saida, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 0 10px", height: 36, borderTop: idx > 0 ? "1px solid #1a1a1a" : "none" }}>
                    <span style={{ color: "#6b7280", fontSize: 10 }}>{saida}</span>
                    <div
                      style={{ width: 14, height: 14, borderRadius: "50%", background: cfg.cor, cursor: "crosshair", flexShrink: 0, position: "relative", right: -18, border: "2px solid #111" }}
                      onMouseDown={(e) => { e.stopPropagation(); iniciarConexao(e, no.id, idx); }}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Dicas e controles */}
        <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 12px" }}>
            <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>🖱️ Arraste blocos • Scroll para zoom • ● para conectar • Clique na linha para excluir</p>
          </div>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 12px", display: "flex", gap: 8 }}>
            <button onClick={() => setCanvasScale(prev => Math.min(prev * 1.2, 2))} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>+</button>
            <span style={{ color: "#6b7280", fontSize: 10, padding: "2px 0" }}>{Math.round(canvasScale * 100)}%</span>
            <button onClick={() => setCanvasScale(prev => Math.max(prev * 0.8, 0.2))} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>−</button>
            <button onClick={() => { setCanvasScale(1); setCanvasOffset({ x: 60, y: 60 }); }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 10 }}>Reset</button>
          </div>
        </div>

        {/* Contador de blocos */}
        <div style={{ position: "absolute", top: 16, right: noSelecionado ? 300 : 16, background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 12px" }}>
          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{nos.length} blocos • {arestas.length} conexões</p>
        </div>
      </div>

      {/* PAINEL DIREITO - PROPRIEDADES */}
      {noSelecionado && (
        <div style={{ width: 270, background: "#111", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: BLOCOS[noSelecionado.tipo]?.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {BLOCOS[noSelecionado.tipo]?.icone}
              </div>
              <div>
                <h3 style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{BLOCOS[noSelecionado.tipo]?.label}</h3>
                <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{BLOCOS[noSelecionado.tipo]?.grupo}</p>
              </div>
            </div>
            <button onClick={() => setNoSelecionado(null)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ padding: 14, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {renderPropriedades()}
            {noSelecionado.tipo !== "inicio" && (
              <button onClick={() => excluirNo(noSelecionado.id)} style={{ background: "#dc262611", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer", fontWeight: "bold", marginTop: "auto" }}>
                🗑️ Excluir Bloco
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
