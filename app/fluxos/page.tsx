"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TipoNo =
  | "texto" | "imagem" | "video" | "audio" | "embed"
  | "input_texto" | "input_numero" | "input_email" | "input_website"
  | "input_data" | "input_hora" | "input_telefone" | "input_botao"
  | "input_selecao_imagem" | "input_pagamento" | "input_avaliacao"
  | "input_arquivo" | "input_cards"
  | "condicao" | "variavel" | "redirecionar" | "script" | "espera"
  | "teste_ab" | "webhook" | "pular" | "retornar"
  | "google_sheets" | "http_request" | "openai" | "claude_ai" | "gmail"
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

type BlocoConfig = {
  label: string;
  icone: string;
  cor: string;
  saidas: string[];
  grupo: string;
};

const BLOCOS: Record<TipoNo, BlocoConfig> = {
  texto:                { label: "Texto",            icone: "💬", cor: "#3b82f6", saidas: ["Próximo"],                      grupo: "Bubbles" },
  imagem:               { label: "Imagem",           icone: "🖼️", cor: "#06b6d4", saidas: ["Próximo"],                      grupo: "Bubbles" },
  video:                { label: "Vídeo",            icone: "🎥", cor: "#8b5cf6", saidas: ["Próximo"],                      grupo: "Bubbles" },
  audio:                { label: "Áudio",            icone: "🎵", cor: "#ec4899", saidas: ["Próximo"],                      grupo: "Bubbles" },
  embed:                { label: "Incorporar",       icone: "🔗", cor: "#f97316", saidas: ["Próximo"],                      grupo: "Bubbles" },
  input_texto:          { label: "Texto",            icone: "✏️", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_numero:         { label: "Número",           icone: "🔢", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_email:          { label: "Email",            icone: "📧", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_website:        { label: "Website",          icone: "🌐", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_data:           { label: "Data",             icone: "📅", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_hora:           { label: "Hora",             icone: "🕐", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_telefone:       { label: "Telefone",         icone: "📱", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_botao:          { label: "Botão",            icone: "🔘", cor: "#16a34a", saidas: ["Botão 1", "Botão 2", "Botão 3"], grupo: "Inputs" },
  input_selecao_imagem: { label: "Seleção Imagem",  icone: "🖼️", cor: "#16a34a", saidas: ["Selecionado"],                  grupo: "Inputs" },
  input_pagamento:      { label: "Pagamento",        icone: "💳", cor: "#16a34a", saidas: ["Aprovado", "Recusado"],         grupo: "Inputs" },
  input_avaliacao:      { label: "Avaliação",        icone: "⭐", cor: "#16a34a", saidas: ["Resposta recebida"],            grupo: "Inputs" },
  input_arquivo:        { label: "Arquivo",          icone: "📎", cor: "#16a34a", saidas: ["Arquivo recebido"],             grupo: "Inputs" },
  input_cards:          { label: "Cards",            icone: "🃏", cor: "#16a34a", saidas: ["Selecionado"],                  grupo: "Inputs" },
  condicao:             { label: "Condição",         icone: "🔀", cor: "#f59e0b", saidas: ["Verdadeiro", "Falso"],          grupo: "Lógica" },
  variavel:             { label: "Variável",         icone: "📦", cor: "#f59e0b", saidas: ["Próximo"],                      grupo: "Lógica" },
  redirecionar:         { label: "Redirecionar",     icone: "↩️", cor: "#f59e0b", saidas: [],                               grupo: "Lógica" },
  script:               { label: "Script",           icone: "⌨️", cor: "#f59e0b", saidas: ["Próximo"],                      grupo: "Lógica" },
  espera:               { label: "Espera",           icone: "⏳", cor: "#f59e0b", saidas: ["Continuar"],                    grupo: "Lógica" },
  teste_ab:             { label: "Teste A/B",        icone: "🧪", cor: "#f59e0b", saidas: ["A", "B"],                       grupo: "Lógica" },
  webhook:              { label: "Webhook",          icone: "🔔", cor: "#f59e0b", saidas: ["Próximo"],                      grupo: "Lógica" },
  pular:                { label: "Pular",            icone: "⏭️", cor: "#f59e0b", saidas: [],                               grupo: "Lógica" },
  retornar:             { label: "Retornar",         icone: "🔁", cor: "#f59e0b", saidas: [],                               grupo: "Lógica" },
  google_sheets:        { label: "Google Sheets",    icone: "📊", cor: "#10b981", saidas: ["Próximo"],                      grupo: "Integrações" },
  http_request:         { label: "HTTP Request",     icone: "🌐", cor: "#10b981", saidas: ["Sucesso", "Erro"],              grupo: "Integrações" },
  openai:               { label: "OpenAI",           icone: "🤖", cor: "#10b981", saidas: ["Próximo"],                      grupo: "Integrações" },
  claude_ai:            { label: "Claude AI",        icone: "🧠", cor: "#10b981", saidas: ["Próximo"],                      grupo: "Integrações" },
  gmail:                { label: "Gmail",            icone: "📨", cor: "#10b981", saidas: ["Enviado"],                      grupo: "Integrações" },
  inicio:               { label: "Início",           icone: "🚀", cor: "#16a34a", saidas: ["Próximo"],                      grupo: "Eventos" },
  comando:              { label: "Comando",          icone: "⚡", cor: "#dc2626", saidas: ["Próximo"],                      grupo: "Eventos" },
  reply:                { label: "Reply",            icone: "↩️", cor: "#dc2626", saidas: ["Próximo"],                      grupo: "Eventos" },
  invalido:             { label: "Inválido",         icone: "❌", cor: "#dc2626", saidas: ["Próximo"],                      grupo: "Eventos" },
  transferir:           { label: "Transferir",       icone: "👤", cor: "#dc2626", saidas: ["Próximo"],                      grupo: "Eventos" },
  finalizar:            { label: "Finalizar",        icone: "🏁", cor: "#dc2626", saidas: [],                               grupo: "Eventos" },
};

const GRUPOS_ORDEM = ["Bubbles", "Inputs", "Lógica", "Integrações", "Eventos"];

function gerarId() { return Math.random().toString(36).substring(2, 10); }

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
    case "webhook": return { url: "", metodo: "POST", headers: "", body: "" };
    case "pular": return { alvo: "" };
    case "retornar": return { alvo: "" };
    case "google_sheets": return { spreadsheet_id: "", aba: "Sheet1", acao: "append", dados: "" };
    case "http_request": return { url: "", metodo: "GET", headers: "", body: "", variavel: "" };
    case "openai": return { apiKey: "", modelo: "gpt-4o-mini", prompt: "", variavel: "resposta_ia" };
    case "claude_ai": return { apiKey: "", modelo: "claude-sonnet-4-6", prompt: "", variavel: "resposta_ia" };
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
    case "input_texto": case "input_numero": case "input_email":
    case "input_website": case "input_data": case "input_hora":
    case "input_telefone": case "input_arquivo": case "input_avaliacao":
      return `${no.dados.pergunta || "Pergunta"} → {{${no.dados.variavel || "var"}}}`;
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

  // Canvas
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 60, y: 60 });
  const canvasOffsetRef = useRef({ x: 60, y: 60 });
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasScaleRef = useRef(1);
  const [conectando, setConectando] = useState<{ noId: string; saidaIndex: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);

  useEffect(() => {
    canvasScaleRef.current = canvasScale;
  }, [canvasScale]);

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

  // Adiciona bloco no centro do canvas — SEM NENHUM DRAG
  const adicionarNo = (tipo: TipoNo) => {
    const cfg = BLOCOS[tipo];
    const rect = canvasRef.current?.getBoundingClientRect();
    const cw = rect?.width || 800;
    const ch = rect?.height || 600;
    const scale = canvasScaleRef.current;
    const offset = canvasOffsetRef.current;
    const cx = (cw / 2 - offset.x) / scale - 110;
    const cy = (ch / 2 - offset.y) / scale - 40;
    const spread = (nos.length % 6) * 30;
    const novoNo: No = {
      id: gerarId(), tipo,
      x: cx + spread, y: cy + spread,
      dados: getDadosPadrao(tipo),
      saidas: [...cfg.saidas],
    };
    setNos(prev => [...prev, novoNo]);
    setNoSelecionado(novoNo);
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

  // ===== DRAG & DROP COM REFS (sem re-render durante drag) =====
  const handleMouseDownNo = (e: React.MouseEvent, noId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (conectando) return;
    const no = nos.find(n => n.id === noId);
    if (!no) return;
    draggingRef.current = noId;
    setNoSelecionado(no);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const scale = canvasScaleRef.current;
      const offset = canvasOffsetRef.current;
      dragOffsetRef.current = {
        x: e.clientX - rect.left - (no.x * scale + offset.x),
        y: e.clientY - rect.top - (no.y * scale + offset.y),
      };
    }
  };

  const handleMouseMoveCanvas = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    if (draggingRef.current) {
      const scale = canvasScaleRef.current;
      const offset = canvasOffsetRef.current;
      const nx = (mx - dragOffsetRef.current.x - offset.x) / scale;
      const ny = (my - dragOffsetRef.current.y - offset.y) / scale;
      setNos(prev => prev.map(n => n.id === draggingRef.current ? { ...n, x: nx, y: ny } : n));
      return;
    }

    if (isPanningRef.current) {
      const newOffset = {
        x: canvasOffsetRef.current.x + e.movementX,
        y: canvasOffsetRef.current.y + e.movementY,
      };
      canvasOffsetRef.current = newOffset;
      setCanvasOffset({ ...newOffset });
    }
  }, []);

  const handleMouseUpCanvas = useCallback(() => {
    draggingRef.current = null;
    isPanningRef.current = false;
    forceUpdate(n => n + 1);
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Ignora cliques em botões, inputs, selects etc
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea")) return;
    if (draggingRef.current) return;
    if (conectando) { setConectando(null); return; }
    if (e.button === 0) isPanningRef.current = true;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(canvasScaleRef.current * delta, 0.2), 2);
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newOffset = {
      x: mx - (mx - canvasOffsetRef.current.x) * (newScale / canvasScaleRef.current),
      y: my - (my - canvasOffsetRef.current.y) * (newScale / canvasScaleRef.current),
    };
    canvasOffsetRef.current = newOffset;
    canvasScaleRef.current = newScale;
    setCanvasOffset({ ...newOffset });
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

  const excluirAresta = (id: string) => setArestas(prev => prev.filter(a => a.id !== id));

  const getPosConexao = (no: No, saidaIndex: number) => ({
    x: no.x + 220,
    y: no.y + 48 + 36 * saidaIndex + 18,
  });
  const getPosEntrada = (no: No) => ({ x: no.x, y: no.y + 48 + 18 });

  const IS: React.CSSProperties = { width: "100%", background: "#0a0a0a", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "white", fontSize: 12, boxSizing: "border-box" };
  const LS: React.CSSProperties = { color: "#9ca3af", fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4, letterSpacing: 1 };

  const renderPropriedades = () => {
    if (!noSelecionado) return null;
    const d = noSelecionado.dados;
    const id = noSelecionado.id;
    const upd = (obj: Record<string, any>) => atualizarNo(id, obj);

    const F = (label: string, key: string, type = "text", ph = "") => (
      <div key={key}>
        <label style={LS}>{label}</label>
        <input type={type} value={d[key] || ""} onChange={e => upd({ [key]: e.target.value })} style={IS} placeholder={ph} />
      </div>
    );
    const T = (label: string, key: string, ph = "", h = 80) => (
      <div key={key}>
        <label style={LS}>{label}</label>
        <textarea value={d[key] || ""} onChange={e => upd({ [key]: e.target.value })} style={{ ...IS, height: h, resize: "vertical" }} placeholder={ph} />
      </div>
    );
    const S = (label: string, key: string, opts: { value: string; label: string }[]) => (
      <div key={key}>
        <label style={LS}>{label}</label>
        <select value={d[key] || opts[0]?.value} onChange={e => upd({ [key]: e.target.value })} style={IS}>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );

    switch (noSelecionado.tipo) {
      case "texto": return T("Mensagem", "texto", "Digite sua mensagem...", 120);
      case "imagem": return <>{F("URL da Imagem", "url", "url", "https://...")}{F("Legenda", "legenda", "text", "Opcional")}</>;
      case "video": return <>{F("URL do Vídeo", "url", "url", "https://...")}{F("Legenda", "legenda", "text", "Opcional")}</>;
      case "audio": return F("URL do Áudio", "url", "url", "https://...");
      case "embed": return F("URL para Incorporar", "url", "url", "https://...");
      case "input_texto": case "input_email": case "input_website":
      case "input_numero": case "input_telefone": case "input_arquivo":
        return <>{T("Pergunta", "pergunta", "Qual é...?", 80)}{F("Salvar em variável", "variavel", "text", "Ex: nome")}</>;
      case "input_data": case "input_hora":
        return <>{T("Pergunta", "pergunta", "Qual é...?", 80)}{F("Salvar em variável", "variavel", "text", "Ex: data")}</>;
      case "input_avaliacao":
        return <>{T("Pergunta", "pergunta", "Como você avalia?", 80)}{F("Nota máxima", "max", "number", "5")}{F("Salvar em variável", "variavel", "text", "avaliacao")}</>;
      case "input_pagamento":
        return <>{F("Valor (R$)", "valor", "number", "0.00")}{F("Descrição", "descricao", "text", "Produto")}</>;
      case "input_botao":
        return (
          <>
            {T("Texto", "texto", "Escolha uma opção:", 60)}
            <div>
              <label style={LS}>Botões (um por linha, máx 3)</label>
              <textarea
                value={(d.botoes || []).join("\n")}
                onChange={e => {
                  const botoes = e.target.value.split("\n").filter(Boolean).slice(0, 3);
                  upd({ botoes });
                  setNos(prev => prev.map(n => n.id === id ? { ...n, saidas: botoes.length > 0 ? botoes : ["Botão 1"] } : n));
                }}
                style={{ ...IS, height: 80, resize: "vertical" }}
                placeholder={"Sim\nNão\nTalvez"}
              />
            </div>
          </>
        );
      case "input_cards":
        return (
          <div>
            <label style={LS}>Cards (Título|Descrição)</label>
            <textarea
              value={(d.cards || []).map((c: any) => `${c.titulo}|${c.descricao}`).join("\n")}
              onChange={e => {
                const cards = e.target.value.split("\n").filter(Boolean).map((l: string) => {
                  const [titulo, descricao] = l.split("|");
                  return { titulo: titulo?.trim() || "", descricao: descricao?.trim() || "" };
                });
                upd({ cards });
              }}
              style={{ ...IS, height: 100, resize: "vertical" }}
              placeholder={"Produto 1|Descrição\nProduto 2|Outra"}
            />
          </div>
        );
      case "condicao":
        return (
          <>
            {F("Variável", "variavel", "text", "Ex: resposta")}
            {S("Operador", "operador", [
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
            {F("Valor", "valor", "text", "Valor para comparar")}
          </>
        );
      case "variavel":
        return (
          <>
            {F("Nome da Variável", "nome", "text", "Ex: nome_cliente")}
            {S("Tipo", "tipo", [
              { value: "texto", label: "Texto" },
              { value: "numero", label: "Número" },
              { value: "booleano", label: "Verdadeiro/Falso" },
              { value: "lista", label: "Lista" },
            ])}
            {F("Valor", "valor", "text", "{{outra_variavel}}")}
          </>
        );
      case "redirecionar": return F("URL", "url", "url", "https://...");
      case "script": return T("Código JavaScript", "codigo", "// Seu código\nreturn true;", 150);
      case "espera": return F("Aguardar (segundos)", "segundos", "number", "3");
      case "teste_ab":
        return (
          <div>
            <label style={LS}>Percentual para A (%)</label>
            <input type="number" min={1} max={99} value={d.percentual_a || 50} onChange={e => upd({ percentual_a: Number(e.target.value) })} style={IS} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0 0" }}>B receberá {100 - (d.percentual_a || 50)}%</p>
          </div>
        );
      case "webhook":
        return (
          <>
            {F("URL do Webhook", "url", "url", "https://...")}
            {S("Método", "metodo", [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" }])}
            {T("Headers (JSON)", "headers", '{"Authorization": "Bearer token"}', 60)}
            {T("Body (JSON)", "body", '{"chave": "valor"}', 60)}
          </>
        );
      case "pular": case "retornar": return F("ID do nó alvo", "alvo", "text", "ID do bloco destino");
      case "google_sheets":
        return (
          <>
            {F("ID da Planilha", "spreadsheet_id", "text", "ID do Google Sheets")}
            {F("Aba", "aba", "text", "Sheet1")}
            {S("Ação", "acao", [{ value: "append", label: "Adicionar linha" }, { value: "update", label: "Atualizar" }, { value: "get", label: "Buscar" }])}
            {T("Dados (variáveis separadas por vírgula)", "dados", "{{nome}},{{email}}", 60)}
          </>
        );
      case "http_request":
        return (
          <>
            {F("URL", "url", "url", "https://api.exemplo.com")}
            {S("Método", "metodo", [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" }])}
            {T("Headers (JSON)", "headers", '{"Content-Type": "application/json"}', 60)}
            {T("Body (JSON)", "body", '{"chave": "{{variavel}}"}', 60)}
            {F("Salvar resposta em variável", "variavel", "text", "Ex: resposta_api")}
          </>
        );
      case "openai":
        return (
          <>
            {F("API Key", "apiKey", "password", "sk-...")}
            {S("Modelo", "modelo", [{ value: "gpt-4o", label: "GPT-4o" }, { value: "gpt-4o-mini", label: "GPT-4o Mini" }, { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }])}
            {T("Prompt", "prompt", "Você é um assistente...", 100)}
            {F("Salvar resposta em variável", "variavel", "text", "resposta_ia")}
          </>
        );
      case "claude_ai":
        return (
          <>
            {F("API Key", "apiKey", "password", "sk-ant-...")}
            {S("Modelo", "modelo", [{ value: "claude-opus-4-6", label: "Claude Opus 4" }, { value: "claude-sonnet-4-6", label: "Claude Sonnet 4" }, { value: "claude-haiku-4-5-20251001", label: "Claude Haiku" }])}
            {T("Prompt", "prompt", "Você é um assistente...", 100)}
            {F("Salvar resposta em variável", "variavel", "text", "resposta_ia")}
          </>
        );
      case "gmail":
        return (
          <>
            {F("Para", "para", "email", "destino@email.com")}
            {F("Assunto", "assunto", "text", "Assunto do email")}
            {T("Corpo", "corpo", "Olá {{nome}}...", 120)}
          </>
        );
      case "inicio": return T("Mensagem de Boas-vindas", "mensagem", "Olá! Como posso te ajudar?", 100);
      case "comando": return F("Comando", "comando", "text", "/start");
      case "reply":
        return (
          <div>
            <label style={LS}>Palavras-chave (separadas por vírgula)</label>
            <input value={d.palavras || ""} onChange={e => upd({ palavras: e.target.value })} style={IS} placeholder="oi, olá, bom dia" />
          </div>
        );
      case "invalido": return T("Mensagem para resposta inválida", "mensagem", "Desculpe, não entendi...", 80);
      case "transferir":
        return (
          <>
            {S("Fila de destino", "fila", [{ value: "Fila Principal", label: "Fila Principal" }, { value: "Fila Suporte", label: "Fila Suporte" }, { value: "Fila Vendas", label: "Fila Vendas" }])}
            {T("Mensagem ao transferir", "mensagem", "Transferindo...", 80)}
          </>
        );
      case "finalizar": return T("Mensagem de encerramento", "mensagem", "Obrigado pelo contato!", 80);
      default: return <p style={{ color: "#6b7280", fontSize: 12 }}>Sem propriedades.</p>;
    }
  };

  // ===== VIEW LISTA =====
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
            <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 500, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>➕ Novo Fluxo</h2>
                  <button onClick={() => setShowNovoFluxo(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                </div>
                <div>
                  <label style={{ ...LS, fontSize: 11 }}>Nome *</label>
                  <input autoFocus placeholder="Ex: Fluxo de Vendas" value={formNovoFluxo.nome} onChange={e => setFormNovoFluxo({ ...formNovoFluxo, nome: e.target.value })} onKeyDown={e => e.key === "Enter" && criarFluxo()} style={{ ...IS, fontSize: 14, padding: "10px 14px", background: "#1f2937" }} />
                </div>
                <div>
                  <label style={{ ...LS, fontSize: 11 }}>Descrição</label>
                  <input placeholder="Objetivo do fluxo" value={formNovoFluxo.descricao} onChange={e => setFormNovoFluxo({ ...formNovoFluxo, descricao: e.target.value })} style={{ ...IS, background: "#1f2937" }} />
                </div>
                <div>
                  <label style={{ ...LS, fontSize: 11 }}>Quando Ativar</label>
                  <select value={formNovoFluxo.trigger_tipo} onChange={e => setFormNovoFluxo({ ...formNovoFluxo, trigger_tipo: e.target.value })} style={{ ...IS, background: "#1f2937" }}>
                    <option value="qualquer_mensagem">Qualquer mensagem recebida</option>
                    <option value="palavra_chave">Palavra-chave específica</option>
                    <option value="primeiro_contato">Primeiro contato</option>
                    <option value="fora_horario">Fora do horário</option>
                  </select>
                </div>
                {formNovoFluxo.trigger_tipo === "palavra_chave" && (
                  <div>
                    <label style={{ ...LS, fontSize: 11 }}>Palavra-chave</label>
                    <input placeholder="Ex: oi, olá" value={formNovoFluxo.trigger_valor} onChange={e => setFormNovoFluxo({ ...formNovoFluxo, trigger_valor: e.target.value })} style={{ ...IS, background: "#1f2937" }} />
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
              <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>{fluxos.length} fluxo(s)</p>
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
              {fluxos.map(fluxo => (
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
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
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

  // ===== VIEW EDITOR =====
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a", color: "white", overflow: "hidden" }}>

      {/* PAINEL ESQUERDO */}
      <div style={{ width: 210, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setView("lista")} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", padding: 0 }}>←</button>
          <h3 style={{ color: "white", fontSize: 12, fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{fluxoAtivo?.nome}</h3>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {GRUPOS_ORDEM.map(grupo => {
            const tipos = (Object.entries(BLOCOS) as [TipoNo, BlocoConfig][]).filter(([, c]) => c.grupo === grupo);
            const aberto = grupoAberto === grupo;
            return (
              <div key={grupo}>
                <button onClick={() => setGrupoAberto(aberto ? "" : grupo)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "7px 14px", background: "none", border: "none", cursor: "pointer", color: aberto ? "#8b5cf6" : "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>
                  <span>{grupo}</span>
                  <span style={{ fontSize: 9 }}>{aberto ? "▼" : "▶"}</span>
                </button>
                {aberto && (
                  <div style={{ padding: "2px 8px 8px 8px" }}>
                    {tipos.map(([tipo, cfg]) => (
                      <button
                        key={tipo}
                        onClick={() => adicionarNo(tipo)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#1a1a1a", border: "1px solid #1f2937", borderRadius: 6, padding: "6px 10px", color: "white", fontSize: 11, cursor: "pointer", marginBottom: 3, textAlign: "left" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#1f2937")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#1a1a1a")}
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
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: draggingRef.current ? "grabbing" : isPanningRef.current ? "grabbing" : conectando ? "crosshair" : "default" }}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        onMouseLeave={handleMouseUpCanvas}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Grade */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="dots" width={24 * canvasScale} height={24 * canvasScale} patternUnits="userSpaceOnUse" x={canvasOffset.x % (24 * canvasScale)} y={canvasOffset.y % (24 * canvasScale)}>
              <circle cx={1} cy={1} r={0.8} fill="#1f2937" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Conexões */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {arestas.map(aresta => {
            const nO = nos.find(n => n.id === aresta.de);
            const nD = nos.find(n => n.id === aresta.para);
            if (!nO || !nD) return null;
            const o = getPosConexao(nO, aresta.saidaIndex);
            const d2 = getPosEntrada(nD);
            const ox = o.x * canvasScale + canvasOffset.x;
            const oy = o.y * canvasScale + canvasOffset.y;
            const dx = d2.x * canvasScale + canvasOffset.x;
            const dy = d2.y * canvasScale + canvasOffset.y;
            const cor = BLOCOS[nO.tipo]?.cor || "#4b5563";
            return (
              <g key={aresta.id} style={{ pointerEvents: "all", cursor: "pointer" }} onClick={() => excluirAresta(aresta.id)}>
                <path d={`M ${ox} ${oy} C ${ox + 80 * canvasScale} ${oy} ${dx - 80 * canvasScale} ${dy} ${dx} ${dy}`} stroke={cor} strokeWidth={2} fill="none" opacity={0.7} />
                <path d={`M ${ox} ${oy} C ${ox + 80 * canvasScale} ${oy} ${dx - 80 * canvasScale} ${dy} ${dx} ${dy}`} stroke="transparent" strokeWidth={14} fill="none" />
                <circle cx={dx} cy={dy} r={5} fill={cor} />
              </g>
            );
          })}
          {conectando && (() => {
            const no = nos.find(n => n.id === conectando.noId);
            if (!no) return null;
            const o = getPosConexao(no, conectando.saidaIndex);
            const ox = o.x * canvasScale + canvasOffset.x;
            const oy = o.y * canvasScale + canvasOffset.y;
            const cor = BLOCOS[no.tipo]?.cor || "#8b5cf6";
            return <path d={`M ${ox} ${oy} C ${ox + 80} ${oy} ${mousePos.x - 80} ${mousePos.y} ${mousePos.x} ${mousePos.y}`} stroke={cor} strokeWidth={2} strokeDasharray="6 3" fill="none" />;
          })()}
        </svg>

        {/* NÓS */}
        <div style={{ position: "absolute", inset: 0, transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`, transformOrigin: "0 0" }}>
          {nos.map(no => {
            const cfg = BLOCOS[no.tipo];
            if (!cfg) return null;
            const sel = noSelecionado?.id === no.id;
            return (
              <div
                key={no.id}
                style={{ position: "absolute", left: no.x, top: no.y, width: 220, background: "#111", borderRadius: 10, border: `2px solid ${sel ? cfg.cor : "#2d2d2d"}`, boxShadow: sel ? `0 0 0 3px ${cfg.cor}33, 0 4px 20px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.4)", userSelect: "none", zIndex: sel ? 10 : 1 }}
                onMouseDown={e => handleMouseDownNo(e, no.id)}
                onClick={e => { e.stopPropagation(); setNoSelecionado(nos.find(n => n.id === no.id) || null); }}
                onMouseUp={e => finalizarConexao(e, no.id)}
              >
                <div style={{ background: cfg.cor, borderRadius: "8px 8px 0 0", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{cfg.icone}</span>
                    <span style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>{cfg.label}</span>
                    <span style={{ background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.6)", fontSize: 9, padding: "1px 6px", borderRadius: 10 }}>{cfg.grupo}</span>
                  </div>
                  {no.tipo !== "inicio" && (
                    <button onClick={e => { e.stopPropagation(); excluirNo(no.id); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                  )}
                </div>
                <div style={{ padding: "7px 10px", borderBottom: cfg.saidas.length > 0 ? "1px solid #1f2937" : "none", cursor: "grab" }}>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getPreviewNo(no)}</p>
                </div>
                {no.tipo !== "inicio" && (
                  <div style={{ position: "absolute", left: -7, top: 48 + 18 - 7, width: 14, height: 14, borderRadius: "50%", background: "#1f2937", border: `2px solid ${cfg.cor}`, cursor: "crosshair", zIndex: 5 }} onMouseUp={e => finalizarConexao(e, no.id)} />
                )}
                {no.saidas.map((saida, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 36, borderTop: idx > 0 ? "1px solid #1a1a1a" : "none" }}>
                    <span style={{ color: "#6b7280", fontSize: 10 }}>{saida}</span>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: cfg.cor, cursor: "crosshair", flexShrink: 0, position: "relative", right: -18, border: "2px solid #111" }} onMouseDown={e => { e.stopPropagation(); iniciarConexao(e, no.id, idx); }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Controles */}
        <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 8 }}>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 12px" }}>
            <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>🖱️ Arraste • Scroll para zoom • ● conectar • Clique na linha para excluir</p>
          </div>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 10px", display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => { const s = Math.min(canvasScaleRef.current * 1.2, 2); canvasScaleRef.current = s; setCanvasScale(s); }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
            <span style={{ color: "#6b7280", fontSize: 10 }}>{Math.round(canvasScale * 100)}%</span>
            <button onClick={() => { const s = Math.max(canvasScaleRef.current * 0.8, 0.2); canvasScaleRef.current = s; setCanvasScale(s); }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>−</button>
            <button onClick={() => { canvasScaleRef.current = 1; canvasOffsetRef.current = { x: 60, y: 60 }; setCanvasScale(1); setCanvasOffset({ x: 60, y: 60 }); }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 10 }}>Reset</button>
          </div>
        </div>
        <div style={{ position: "absolute", top: 16, right: noSelecionado ? 285 : 16, background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "6px 12px" }}>
          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{nos.length} blocos • {arestas.length} conexões</p>
        </div>
      </div>

      {/* PAINEL DIREITO */}
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