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
  texto:                { label: "Texto",           icone: "💬", cor: "#3b82f6", saidas: ["Próximo"],                       grupo: "Bubbles" },
  imagem:               { label: "Imagem",          icone: "🖼️", cor: "#06b6d4", saidas: ["Próximo"],                       grupo: "Bubbles" },
  video:                { label: "Vídeo",           icone: "🎥", cor: "#8b5cf6", saidas: ["Próximo"],                       grupo: "Bubbles" },
  audio:                { label: "Áudio",           icone: "🎵", cor: "#ec4899", saidas: ["Próximo"],                       grupo: "Bubbles" },
  embed:                { label: "Incorporar",      icone: "🔗", cor: "#f97316", saidas: ["Próximo"],                       grupo: "Bubbles" },
  input_texto:          { label: "Texto",           icone: "✏️", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_numero:         { label: "Número",          icone: "🔢", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_email:          { label: "Email",           icone: "📧", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_website:        { label: "Website",         icone: "🌐", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_data:           { label: "Data",            icone: "📅", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_hora:           { label: "Hora",            icone: "🕐", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_telefone:       { label: "Telefone",        icone: "📱", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_botao:          { label: "Botão",           icone: "🔘", cor: "#16a34a", saidas: ["Botão 1","Botão 2","Botão 3"],   grupo: "Inputs"  },
  input_selecao_imagem: { label: "Seleção Imagem", icone: "🖼️", cor: "#16a34a", saidas: ["Selecionado"],                   grupo: "Inputs"  },
  input_pagamento:      { label: "Pagamento",       icone: "💳", cor: "#16a34a", saidas: ["Aprovado","Recusado"],           grupo: "Inputs"  },
  input_avaliacao:      { label: "Avaliação",       icone: "⭐", cor: "#16a34a", saidas: ["Resposta recebida"],             grupo: "Inputs"  },
  input_arquivo:        { label: "Arquivo",         icone: "📎", cor: "#16a34a", saidas: ["Arquivo recebido"],              grupo: "Inputs"  },
  input_cards:          { label: "Cards",           icone: "🃏", cor: "#16a34a", saidas: ["Selecionado"],                   grupo: "Inputs"  },
  condicao:             { label: "Condição",        icone: "🔀", cor: "#f59e0b", saidas: ["Verdadeiro","Falso"],            grupo: "Lógica"  },
  variavel:             { label: "Variável",        icone: "📦", cor: "#f59e0b", saidas: ["Próximo"],                       grupo: "Lógica"  },
  redirecionar:         { label: "Redirecionar",    icone: "↩️", cor: "#f59e0b", saidas: [],                                grupo: "Lógica"  },
  script:               { label: "Script",          icone: "⌨️", cor: "#f59e0b", saidas: ["Próximo"],                       grupo: "Lógica"  },
  espera:               { label: "Espera",          icone: "⏳", cor: "#f59e0b", saidas: ["Continuar"],                     grupo: "Lógica"  },
  teste_ab:             { label: "Teste A/B",       icone: "🧪", cor: "#f59e0b", saidas: ["A","B"],                         grupo: "Lógica"  },
  webhook:              { label: "Webhook",         icone: "🔔", cor: "#f59e0b", saidas: ["Próximo"],                       grupo: "Lógica"  },
  pular:                { label: "Pular",           icone: "⏭️", cor: "#f59e0b", saidas: [],                                grupo: "Lógica"  },
  retornar:             { label: "Retornar",        icone: "🔁", cor: "#f59e0b", saidas: [],                                grupo: "Lógica"  },
  google_sheets:        { label: "Google Sheets",   icone: "📊", cor: "#10b981", saidas: ["Próximo"],                       grupo: "Integrações" },
  http_request:         { label: "HTTP Request",    icone: "🌐", cor: "#10b981", saidas: ["Sucesso","Erro"],                grupo: "Integrações" },
  openai:               { label: "OpenAI",          icone: "🤖", cor: "#10b981", saidas: ["Próximo"],                       grupo: "Integrações" },
  claude_ai:            { label: "Claude AI",       icone: "🧠", cor: "#10b981", saidas: ["Próximo"],                       grupo: "Integrações" },
  gmail:                { label: "Gmail",           icone: "📨", cor: "#10b981", saidas: ["Enviado"],                       grupo: "Integrações" },
  inicio:               { label: "Início",          icone: "🚀", cor: "#16a34a", saidas: ["Próximo"],                       grupo: "Eventos" },
  comando:              { label: "Comando",         icone: "⚡", cor: "#dc2626", saidas: ["Próximo"],                       grupo: "Eventos" },
  reply:                { label: "Reply",           icone: "↩️", cor: "#dc2626", saidas: ["Próximo"],                       grupo: "Eventos" },
  invalido:             { label: "Inválido",        icone: "❌", cor: "#dc2626", saidas: ["Próximo"],                       grupo: "Eventos" },
  transferir:           { label: "Transferir",      icone: "👤", cor: "#dc2626", saidas: ["Próximo"],                       grupo: "Eventos" },
  finalizar:            { label: "Finalizar",       icone: "🏁", cor: "#dc2626", saidas: [],                                grupo: "Eventos" },
};

const GRUPOS_ORDEM = ["Bubbles","Inputs","Lógica","Integrações","Eventos"];

function uid() { return Math.random().toString(36).slice(2,10); }

async function getWsId(): Promise<string|null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
  return data ? String(data.id) : null;
}

function defaultDados(tipo: TipoNo): Record<string,any> {
  const map: Partial<Record<TipoNo, Record<string,any>>> = {
    texto:          { texto: "Digite sua mensagem aqui..." },
    imagem:         { url: "", legenda: "" },
    video:          { url: "", legenda: "" },
    audio:          { url: "" },
    embed:          { url: "" },
    input_texto:    { pergunta: "Qual é o seu nome?", variavel: "nome" },
    input_numero:   { pergunta: "Qual é o número?", variavel: "numero" },
    input_email:    { pergunta: "Qual é o seu email?", variavel: "email" },
    input_website:  { pergunta: "Qual é o seu website?", variavel: "website" },
    input_data:     { pergunta: "Qual é a data?", variavel: "data" },
    input_hora:     { pergunta: "Qual é a hora?", variavel: "hora" },
    input_telefone: { pergunta: "Qual é o telefone?", variavel: "telefone" },
    input_botao:    { texto: "Escolha uma opção:", botoes: ["Opção 1","Opção 2"] },
    input_selecao_imagem: { texto: "Selecione:", itens: [] },
    input_pagamento: { valor: 0, descricao: "Pagamento" },
    input_avaliacao: { pergunta: "Como avalia?", max: 5, variavel: "avaliacao" },
    input_arquivo:  { pergunta: "Envie um arquivo:", variavel: "arquivo" },
    input_cards:    { cards: [{ titulo: "Card 1", descricao: "" }] },
    condicao:       { variavel: "resposta", operador: "igual", valor: "" },
    variavel:       { nome: "minhaVar", valor: "", tipo: "texto" },
    redirecionar:   { url: "" },
    script:         { codigo: "// código aqui\nreturn true;" },
    espera:         { segundos: 3 },
    teste_ab:       { percentual_a: 50 },
    webhook:        { url: "", metodo: "POST", headers: "", body: "" },
    pular:          { alvo: "" },
    retornar:       { alvo: "" },
    google_sheets:  { spreadsheet_id: "", aba: "Sheet1", acao: "append", dados: "" },
    http_request:   { url: "", metodo: "GET", headers: "", body: "", variavel: "" },
    openai:         { apiKey: "", modelo: "gpt-4o-mini", prompt: "", variavel: "resposta_ia" },
    claude_ai:      { apiKey: "", modelo: "claude-sonnet-4-6", prompt: "", variavel: "resposta_ia" },
    gmail:          { para: "", assunto: "", corpo: "" },
    inicio:         { mensagem: "Olá! Como posso te ajudar?" },
    comando:        { comando: "/start" },
    reply:          { palavras: "" },
    invalido:       { mensagem: "Não entendi. Tente novamente." },
    transferir:     { fila: "Fila Principal", mensagem: "Transferindo..." },
    finalizar:      { mensagem: "Atendimento finalizado. Obrigado!" },
  };
  return map[tipo] || {};
}

function preview(no: No): string {
  const d = no.dados;
  switch (no.tipo) {
    case "texto": return d.texto || "Vazio";
    case "imagem": case "video": case "audio": case "embed": return d.url || d.legenda || "Sem URL";
    case "input_texto": case "input_numero": case "input_email": case "input_website":
    case "input_data": case "input_hora": case "input_telefone":
    case "input_arquivo": case "input_avaliacao":
      return `${d.pergunta || "Pergunta"} → {{${d.variavel || "var"}}}`;
    case "input_botao": return `${d.botoes?.length||0} botões`;
    case "input_selecao_imagem": return `${d.itens?.length||0} imagens`;
    case "input_pagamento": return `R$ ${d.valor||0}`;
    case "input_cards": return `${d.cards?.length||0} cards`;
    case "condicao": return `SE {{${d.variavel}}} ${d.operador} "${d.valor}"`;
    case "variavel": return `{{${d.nome}}} = "${d.valor}"`;
    case "redirecionar": return d.url || "Sem URL";
    case "script": return "Script JS";
    case "espera": return `⏳ ${d.segundos}s`;
    case "teste_ab": return `A:${d.percentual_a}% B:${100-(d.percentual_a||50)}%`;
    case "webhook": return `${d.metodo} ${d.url||""}`;
    case "pular": case "retornar": return `→ ${d.alvo||"?"}`;
    case "google_sheets": return `Sheets: ${d.acao}`;
    case "http_request": return `${d.metodo} ${d.url||""}`;
    case "openai": return `GPT: ${d.modelo}`;
    case "claude_ai": return `Claude: ${d.modelo}`;
    case "gmail": return `Para: ${d.para||"?"}`;
    case "inicio": return d.mensagem || "Início";
    case "comando": return d.comando || "/start";
    case "reply": return d.palavras || "Palavras-chave";
    case "invalido": return d.mensagem || "Inválido";
    case "transferir": return `→ ${d.fila}`;
    case "finalizar": return d.mensagem || "Finalizar";
    default: return "";
  }
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function FluxosPage() {
  const router = useRouter();

  // Workspace
  const [wsId, setWsId]   = useState<string|null>(null);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [view, setView]   = useState<"lista"|"editor">("lista");

  // Editor
  const [fluxoAtivo, setFluxoAtivo]       = useState<Fluxo|null>(null);
  const [nos, setNos]                     = useState<No[]>([]);
  const [arestas, setArestas]             = useState<Aresta[]>([]);
  const [noSel, setNoSel]                 = useState<No|null>(null);
  const [salvando, setSalvando]           = useState(false);
  const [grupoAberto, setGrupoAberto]     = useState("Bubbles");
  const [conectando, setConectando]       = useState<{noId:string;saidaIndex:number}|null>(null);
  const [mousePos, setMousePos]           = useState({x:0,y:0});

  // Novo fluxo
  const [showNovo, setShowNovo]   = useState(false);
  const [criando, setCriando]     = useState(false);
  const [form, setForm]           = useState({ nome:"", descricao:"", trigger_tipo:"qualquer_mensagem", trigger_valor:"" });

  // Canvas via refs (sem re-render durante drag)
  const canvasRef   = useRef<HTMLDivElement>(null);
  const scaleRef    = useRef(1);
  const offsetRef   = useRef({x:80, y:80});
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({x:80,y:80});

  // Drag via refs
  const dragIdRef     = useRef<string|null>(null);
  const dragStartRef  = useRef({mx:0, my:0, nx:0, ny:0}); // mouse start + node start
  const panningRef    = useRef(false);
  const didMoveRef    = useRef(false);

  // ─── init ───
  useEffect(() => {
    getWsId().then(id => { setWsId(id); if (id) loadFluxos(id); });
  }, []);

  async function loadFluxos(id?:string) {
    const wid = id || wsId;
    if (!wid) return;
    const { data } = await supabase.from("fluxos").select("*").eq("workspace_id", wid).order("created_at",{ascending:false});
    setFluxos((data||[]).map(f => ({...f, nos:f.nos||[], conexoes:f.conexoes||})));
  }

  async function criarFluxo() {
    if (!form.nome.trim()) { alert("Digite o nome!"); return; }
    setCriando(true);
    try {
      const id = wsId || await getWsId();
      if (!id) { alert("Workspace não encontrado!"); return; }
      const ini: No = { id:uid(), tipo:"inicio", x:200, y:200, dados:defaultDados("inicio"), saidas:[...BLOCOS.inicio.saidas] };
      const payload = { nome:form.nome.trim(), descricao:form.descricao, ativo:false,
        trigger_tipo:form.trigger_tipo, trigger_valor:form.trigger_valor,
        nos:[ini], conexoes:[], workspace_id:id };
      const { data, error } = await supabase.from("fluxos").insert([payload]).select().single();
      if (error) { alert("Erro: "+error.message); return; }
      setWsId(id);
      await loadFluxos(id);
      abrirEditor({...payload, id:data.id} as Fluxo);
      setShowNovo(false);
      setForm({nome:"",descricao:"",trigger_tipo:"qualquer_mensagem",trigger_valor:""});
    } finally { setCriando(false); }
  }

  function abrirEditor(f: Fluxo) {
    setFluxoAtivo(f);
    setNos(f.nos||[]);
    setArestas(f.conexoes||[]);
    setNoSel(null);
    setView("editor");
  }

  async function salvarFluxo() {
    if (!fluxoAtivo?.id) return;
    setSalvando(true);
    await supabase.from("fluxos").update({
      nos, conexoes:arestas, nome:fluxoAtivo.nome, descricao:fluxoAtivo.descricao,
      ativo:fluxoAtivo.ativo, trigger_tipo:fluxoAtivo.trigger_tipo, trigger_valor:fluxoAtivo.trigger_valor,
    }).eq("id",fluxoAtivo.id);
    await loadFluxos();
    setSalvando(false);
    alert("✅ Fluxo salvo!");
  }

  async function toggleAtivo() {
    if (!fluxoAtivo?.id) return;
    const v = !fluxoAtivo.ativo;
    await supabase.from("fluxos").update({ativo:v}).eq("id",fluxoAtivo.id);
    setFluxoAtivo(p => p ? {...p, ativo:v} : null);
    await loadFluxos();
  }

  async function excluirFluxo(id:number) {
    if (!confirm("Excluir este fluxo?")) return;
    await supabase.from("fluxos").delete().eq("id",id);
    await loadFluxos();
  }

  // Clica no bloco da lista → aparece no centro do canvas, SEM drag
  function adicionarNo(tipo: TipoNo) {
    const cfg = BLOCOS[tipo];
    const rect = canvasRef.current?.getBoundingClientRect();
    const cw = rect?.width || 800;
    const ch = rect?.height || 600;
    const s = scaleRef.current;
    const o = offsetRef.current;
    const cx = (cw/2 - o.x) / s - 110;
    const cy = (ch/2 - o.y) / s - 40;
    const spread = (nos.length % 8) * 28;
    const n: No = { id:uid(), tipo, x:cx+spread, y:cy+spread, dados:defaultDados(tipo), saidas:[...cfg.saidas] };
    setNos(p => [...p, n]);
    setNoSel(n);
  }

  function excluirNo(id:string) {
    if (nos.find(n=>n.id===id)?.tipo==="inicio") { alert("Não pode excluir o início!"); return; }
    setNos(p=>p.filter(n=>n.id!==id));
    setArestas(p=>p.filter(a=>a.de!==id && a.para!==id));
    if (noSel?.id===id) setNoSel(null);
  }

  function updateNo(id:string, d:Record<string,any>) {
    setNos(p=>p.map(n=>n.id===id ? {...n,dados:{...n.dados,...d}} : n));
    setNoSel(p=>p?.id===id ? {...p,dados:{...p.dados,...d}} : p);
  }

  // ─── MOUSE HANDLERS (drag por refs, sem estado durante movimento) ───

  // Clique num nó: guarda ponto de início mas NÃO marca dragging ainda
  function onMouseDownNo(e: React.MouseEvent, noId:string) {
    e.stopPropagation();
    e.preventDefault();
    if (conectando) return;
    const no = nos.find(n=>n.id===noId);
    if (!no) return;
    setNoSel(no);
    dragIdRef.current = noId;
    dragStartRef.current = { mx:e.clientX, my:e.clientY, nx:no.x, ny:no.y };
    didMoveRef.current = false;
  }

  // Clique no canvas: inicia pan
  function onMouseDownCanvas(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("button")||t.closest("input")||t.closest("select")||t.closest("textarea")) return;
    if (dragIdRef.current) return;
    if (conectando) { setConectando(null); return; }
    if (e.button===0) panningRef.current = true;
  }

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({x:mx, y:my});

    // Drag do nó
    if (dragIdRef.current) {
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      // Threshold 4px antes de começar a mover
      if (!didMoveRef.current && Math.abs(dx)<4 && Math.abs(dy)<4) return;
      didMoveRef.current = true;
      const s = scaleRef.current;
      const o = offsetRef.current;
      const nx = dragStartRef.current.nx + dx/s;
      const ny = dragStartRef.current.ny + dy/s;
      setNos(p => p.map(n => n.id===dragIdRef.current ? {...n,x:nx,y:ny} : n));
      return;
    }

    // Pan
    if (panningRef.current) {
      const newO = { x:offsetRef.current.x + e.movementX, y:offsetRef.current.y + e.movementY };
      offsetRef.current = newO;
      setOffset({...newO});
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragIdRef.current = null;
    panningRef.current = false;
    didMoveRef.current = false;
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY>0 ? 0.9 : 1.1;
    const newS = Math.min(Math.max(scaleRef.current*factor, 0.2), 2.5);
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newO = {
      x: mx-(mx-offsetRef.current.x)*(newS/scaleRef.current),
      y: my-(my-offsetRef.current.y)*(newS/scaleRef.current),
    };
    scaleRef.current = newS;
    offsetRef.current = newO;
    setScale(newS);
    setOffset({...newO});
  }

  function iniciarConexao(e:React.MouseEvent, noId:string, saidaIndex:number) {
    e.stopPropagation(); e.preventDefault();
    setConectando({noId, saidaIndex});
  }

  function finalizarConexao(e:React.MouseEvent, noId:string) {
    e.stopPropagation();
    if (!conectando || conectando.noId===noId) { setConectando(null); return; }
    setArestas(p => {
      const filtered = p.filter(a=>!(a.de===conectando.noId && a.saidaIndex===conectando.saidaIndex));
      return [...filtered, {id:uid(), de:conectando.noId, saidaIndex:conectando.saidaIndex, para:noId}];
    });
    setConectando(null);
  }

  function posConexao(no:No, idx:number) { return {x:no.x+220, y:no.y+48+36*idx+18}; }
  function posEntrada(no:No)              { return {x:no.x,     y:no.y+48+18};         }

  // ─── ESTILOS ───
  const IS: React.CSSProperties = { width:"100%", background:"#0a0a0a", border:"1px solid #374151", borderRadius:6, padding:"8px 10px", color:"white", fontSize:12, boxSizing:"border-box" };
  const LS: React.CSSProperties = { color:"#9ca3af", fontSize:10, textTransform:"uppercase", display:"block", marginBottom:4, letterSpacing:1 };

  // ─── PAINEL PROPRIEDADES ───
  function Propriedades() {
    if (!noSel) return null;
    const d = noSel.dados;
    const id = noSel.id;
    const u = (obj:Record<string,any>) => updateNo(id, obj);

    const F = (lbl:string, key:string, type="text", ph="") => (
      <div key={key}><label style={LS}>{lbl}</label>
        <input type={type} value={d[key]||""} onChange={e=>u({[key]:e.target.value})} style={IS} placeholder={ph} />
      </div>
    );
    const T = (lbl:string, key:string, ph="", h=80) => (
      <div key={key}><label style={LS}>{lbl}</label>
        <textarea value={d[key]||""} onChange={e=>u({[key]:e.target.value})} style={{...IS,height:h,resize:"vertical"}} placeholder={ph} />
      </div>
    );
    const Sel = (lbl:string, key:string, opts:{value:string;label:string}[]) => (
      <div key={key}><label style={LS}>{lbl}</label>
        <select value={d[key]||opts[0]?.value} onChange={e=>u({[key]:e.target.value})} style={IS}>
          {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );

    switch(noSel.tipo) {
      case "texto": return T("Mensagem","texto","Digite...",120);
      case "imagem": return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
      case "video":  return <>{F("URL","url","url","https://...")}{F("Legenda","legenda")}</>;
      case "audio":  return F("URL do Áudio","url","url","https://...");
      case "embed":  return F("URL","url","url","https://...");
      case "input_texto": case "input_email": case "input_website":
      case "input_numero": case "input_telefone": case "input_arquivo":
      case "input_data": case "input_hora":
        return <>{T("Pergunta","pergunta","Qual é...?",80)}{F("Variável","variavel","text","Ex: nome")}</>;
      case "input_avaliacao":
        return <>{T("Pergunta","pergunta","Como avalia?",80)}{F("Máximo","max","number","5")}{F("Variável","variavel","text","avaliacao")}</>;
      case "input_pagamento":
        return <>{F("Valor (R$)","valor","number","0.00")}{F("Descrição","descricao")}</>;
      case "input_botao":
        return <>
          {T("Texto","texto","Escolha:",60)}
          <div><label style={LS}>Botões (um por linha, máx 3)</label>
            <textarea value={(d.botoes||[]).join("\n")}
              onChange={e=>{
                const b=e.target.value.split("\n").filter(Boolean).slice(0,3);
                u({botoes:b});
                setNos(p=>p.map(n=>n.id===id?{...n,saidas:b.length?b:["Botão 1"]}:n));
              }}
              style={{...IS,height:80,resize:"vertical"}} placeholder={"Sim\nNão\nTalvez"} />
          </div>
        </>;
      case "input_cards":
        return <div><label style={LS}>Cards (Título|Descrição, um por linha)</label>
          <textarea value={(d.cards||[]).map((c:any)=>`${c.titulo}|${c.descricao}`).join("\n")}
            onChange={e=>{
              const cards=e.target.value.split("\n").filter(Boolean).map((l:string)=>{
                const [t,desc]=l.split("|"); return {titulo:t?.trim()||"",descricao:desc?.trim()||""};
              });
              u({cards});
            }}
            style={{...IS,height:100,resize:"vertical"}} placeholder={"Produto 1|Descrição"} />
        </div>;
      case "condicao":
        return <>
          {F("Variável","variavel","text","Ex: resposta")}
          {Sel("Operador","operador",[
            {value:"igual",label:"É igual a"},{value:"diferente",label:"É diferente de"},
            {value:"contem",label:"Contém"},{value:"nao_contem",label:"Não contém"},
            {value:"comeca",label:"Começa com"},{value:"termina",label:"Termina com"},
            {value:"vazio",label:"Está vazio"},{value:"nao_vazio",label:"Não está vazio"},
            {value:"maior",label:"Maior que"},{value:"menor",label:"Menor que"},
          ])}
          {F("Valor","valor","text","Comparar com")}
        </>;
      case "variavel":
        return <>
          {F("Nome","nome","text","minhaVar")}
          {Sel("Tipo","tipo",[{value:"texto",label:"Texto"},{value:"numero",label:"Número"},{value:"booleano",label:"Booleano"},{value:"lista",label:"Lista"}])}
          {F("Valor","valor","text","{{outra}}")}
        </>;
      case "redirecionar": return F("URL","url","url","https://...");
      case "script": return T("Código JavaScript","codigo","// return true;",150);
      case "espera": return F("Segundos","segundos","number","3");
      case "teste_ab":
        return <div><label style={LS}>% para A</label>
          <input type="number" min={1} max={99} value={d.percentual_a||50} onChange={e=>u({percentual_a:Number(e.target.value)})} style={IS} />
          <p style={{color:"#6b7280",fontSize:10,margin:"4px 0 0"}}>B recebe {100-(d.percentual_a||50)}%</p>
        </div>;
      case "webhook":
        return <>
          {F("URL","url","url","https://...")}
          {Sel("Método","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
          {T("Headers JSON","headers",'{"Auth":"Bearer x"}',60)}
          {T("Body JSON","body",'{"key":"val"}',60)}
        </>;
      case "pular": case "retornar": return F("ID do nó alvo","alvo","text","ID do bloco");
      case "google_sheets":
        return <>
          {F("ID da Planilha","spreadsheet_id","text","ID sheets")}
          {F("Aba","aba","text","Sheet1")}
          {Sel("Ação","acao",[{value:"append",label:"Adicionar linha"},{value:"update",label:"Atualizar"},{value:"get",label:"Buscar"}])}
          {T("Dados ({{var1}},{{var2}})","dados","{{nome}},{{email}}",60)}
        </>;
      case "http_request":
        return <>
          {F("URL","url","url","https://api.exemplo.com")}
          {Sel("Método","metodo",[{value:"GET",label:"GET"},{value:"POST",label:"POST"},{value:"PUT",label:"PUT"},{value:"DELETE",label:"DELETE"}])}
          {T("Headers JSON","headers",'{"Content-Type":"application/json"}',60)}
          {T("Body JSON","body",'{"key":"{{var}}"}',60)}
          {F("Salvar resposta em","variavel","text","resposta_api")}
        </>;
      case "openai":
        return <>
          {F("API Key","apiKey","password","sk-...")}
          {Sel("Modelo","modelo",[{value:"gpt-4o",label:"GPT-4o"},{value:"gpt-4o-mini",label:"GPT-4o Mini"},{value:"gpt-3.5-turbo",label:"GPT-3.5"}])}
          {T("Prompt","prompt","Você é...",100)}
          {F("Salvar em","variavel","text","resposta_ia")}
        </>;
      case "claude_ai":
        return <>
          {F("API Key","apiKey","password","sk-ant-...")}
          {Sel("Modelo","modelo",[{value:"claude-opus-4-6",label:"Claude Opus 4"},{value:"claude-sonnet-4-6",label:"Claude Sonnet 4"},{value:"claude-haiku-4-5-20251001",label:"Claude Haiku"}])}
          {T("Prompt","prompt","Você é...",100)}
          {F("Salvar em","variavel","text","resposta_ia")}
        </>;
      case "gmail":
        return <>
          {F("Para","para","email","email@exemplo.com")}
          {F("Assunto","assunto","text","Assunto")}
          {T("Corpo","corpo","Olá {{nome}}...",120)}
        </>;
      case "inicio": return T("Mensagem de boas-vindas","mensagem","Olá! Como posso ajudar?",100);
      case "comando": return F("Comando","comando","text","/start");
      case "reply":
        return <div><label style={LS}>Palavras-chave (vírgula)</label>
          <input value={d.palavras||""} onChange={e=>u({palavras:e.target.value})} style={IS} placeholder="oi, olá, bom dia" />
        </div>;
      case "invalido": return T("Mensagem","mensagem","Não entendi...",80);
      case "transferir":
        return <>
          {Sel("Fila","fila",[{value:"Fila Principal",label:"Fila Principal"},{value:"Fila Suporte",label:"Fila Suporte"},{value:"Fila Vendas",label:"Fila Vendas"}])}
          {T("Mensagem","mensagem","Transferindo...",80)}
        </>;
      case "finalizar": return T("Mensagem","mensagem","Obrigado!",80);
      default: return <p style={{color:"#6b7280",fontSize:12}}>Sem propriedades.</p>;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  VIEW LISTA
  // ═══════════════════════════════════════════════════════════════
  if (view==="lista") return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#0a0a0a",color:"white"}}>
      {/* sidebar */}
      <div style={{width:220,background:"#111",borderRight:"1px solid #1f2937",display:"flex",flexDirection:"column",padding:16,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <img src="/logo1.png" alt="Wolf" style={{width:32,filter:"brightness(0) invert(1)"}} />
          <span style={{color:"white",fontWeight:"bold",fontSize:14}}>Wolf Chatbot</span>
        </div>
        <button onClick={()=>router.push("/chatbot")} style={{background:"#3b82f622",border:"1px solid #3b82f633",borderRadius:8,padding:"10px 14px",color:"#3b82f6",fontSize:13,fontWeight:"bold",cursor:"pointer",textAlign:"left"}}>💬 Conversas</button>
        <button style={{background:"#8b5cf622",border:"1px solid #8b5cf633",borderRadius:8,padding:"10px 14px",color:"#8b5cf6",fontSize:13,fontWeight:"bold",cursor:"pointer",textAlign:"left"}}>🤖 Fluxos</button>
        <button onClick={()=>router.push("/crm")} style={{background:"none",border:"none",borderRadius:8,padding:"10px 14px",color:"#6b7280",fontSize:13,cursor:"pointer",textAlign:"left",marginTop:"auto"}}>← CRM</button>
      </div>

      {/* conteúdo */}
      <div style={{flex:1,padding:32,overflowY:"auto"}}>
        {/* modal novo */}
        {showNovo && (
          <div style={{position:"fixed",inset:0,background:"#000c",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#111",borderRadius:16,padding:32,width:500,border:"1px solid #1f2937",display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <h2 style={{color:"white",fontSize:18,fontWeight:"bold",margin:0}}>➕ Novo Fluxo</h2>
                <button onClick={()=>setShowNovo(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:22,cursor:"pointer"}}>✕</button>
              </div>
              <div><label style={{...LS,fontSize:11}}>Nome *</label>
                <input autoFocus placeholder="Ex: Fluxo de Vendas" value={form.nome}
                  onChange={e=>setForm({...form,nome:e.target.value})}
                  onKeyDown={e=>e.key==="Enter"&&criarFluxo()}
                  style={{...IS,fontSize:14,padding:"10px 14px",background:"#1f2937"}} />
              </div>
              <div><label style={{...LS,fontSize:11}}>Descrição</label>
                <input placeholder="Objetivo" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} style={{...IS,background:"#1f2937"}} />
              </div>
              <div><label style={{...LS,fontSize:11}}>Quando Ativar</label>
                <select value={form.trigger_tipo} onChange={e=>setForm({...form,trigger_tipo:e.target.value})} style={{...IS,background:"#1f2937"}}>
                  <option value="qualquer_mensagem">Qualquer mensagem</option>
                  <option value="palavra_chave">Palavra-chave</option>
                  <option value="primeiro_contato">Primeiro contato</option>
                  <option value="fora_horario">Fora do horário</option>
                </select>
              </div>
              {form.trigger_tipo==="palavra_chave" && (
                <div><label style={{...LS,fontSize:11}}>Palavra-chave</label>
                  <input placeholder="oi, olá" value={form.trigger_valor} onChange={e=>setForm({...form,trigger_valor:e.target.value})} style={{...IS,background:"#1f2937"}} />
                </div>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowNovo(false)} style={{background:"none",color:"#9ca3af",border:"1px solid #374151",borderRadius:8,padding:"10px 20px",fontSize:13,cursor:"pointer"}}>Cancelar</button>
                <button onClick={criarFluxo} disabled={criando} style={{background:criando?"#6b21a8":"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,cursor:criando?"wait":"pointer",fontWeight:"bold"}}>
                  {criando?"⏳ Criando...":"🤖 Criar Fluxo"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h1 style={{color:"white",fontSize:22,fontWeight:"bold",margin:0}}>🤖 Meus Fluxos</h1>
            <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{fluxos.length} fluxo(s)</p>
          </div>
          <button onClick={()=>setShowNovo(true)} style={{background:"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,cursor:"pointer",fontWeight:"bold"}}>+ Novo Fluxo</button>
        </div>

        {fluxos.length===0 ? (
          <div style={{background:"#111",borderRadius:12,padding:64,textAlign:"center",border:"1px solid #1f2937"}}>
            <p style={{fontSize:64,margin:"0 0 16px"}}>🤖</p>
            <h3 style={{color:"white",fontSize:18,fontWeight:"bold",margin:"0 0 8px"}}>Nenhum fluxo criado</h3>
            <p style={{color:"#6b7280",fontSize:14,margin:"0 0 24px"}}>Crie fluxos de atendimento automático</p>
            <button onClick={()=>setShowNovo(true)} style={{background:"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"12px 28px",fontSize:14,cursor:"pointer",fontWeight:"bold"}}>+ Criar Primeiro Fluxo</button>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {fluxos.map(f=>(
              <div key={f.id} style={{background:"#111",borderRadius:12,padding:24,border:`1px solid ${f.ativo?"#8b5cf644":"#1f2937"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <h3 style={{color:"white",fontSize:15,fontWeight:"bold",margin:0}}>{f.nome}</h3>
                    {f.descricao&&<p style={{color:"#6b7280",fontSize:12,margin:"4px 0 0"}}>{f.descricao}</p>}
                  </div>
                  <span style={{background:f.ativo?"#8b5cf622":"#1f2937",color:f.ativo?"#8b5cf6":"#6b7280",fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:"bold",whiteSpace:"nowrap"}}>
                    {f.ativo?"🟢 Ativo":"⚫ Inativo"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <span style={{background:"#1f2937",color:"#9ca3af",fontSize:11,padding:"3px 8px",borderRadius:6}}>{f.nos?.length||0} blocos</span>
                  <span style={{background:"#1f2937",color:"#9ca3af",fontSize:11,padding:"3px 8px",borderRadius:6}}>
                    {f.trigger_tipo==="qualquer_mensagem"?"📨 Qualquer":f.trigger_tipo==="palavra_chave"?`🔑 "${f.trigger_valor}"`:f.trigger_tipo==="primeiro_contato"?"👋 1º":"🕐 Fora horário"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>abrirEditor(f)} style={{flex:1,background:"#8b5cf622",color:"#8b5cf6",border:"1px solid #8b5cf633",borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",fontWeight:"bold"}}>✏️ Editar</button>
                  <button onClick={()=>excluirFluxo(f.id!)} style={{background:"#dc262622",color:"#dc2626",border:"1px solid #dc262633",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  //  VIEW EDITOR
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Arial,sans-serif",background:"#0a0a0a",color:"white",overflow:"hidden"}}>

      {/* ── PAINEL ESQUERDO ── */}
      <div style={{width:210,background:"#111",borderRight:"1px solid #1f2937",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setView("lista")} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer",padding:0}}>←</button>
          <h3 style={{color:"white",fontSize:12,fontWeight:"bold",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{fluxoAtivo?.nome}</h3>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {GRUPOS_ORDEM.map(grupo=>{
            const tipos=(Object.entries(BLOCOS) as [TipoNo,BlocoConfig][]).filter(([,c])=>c.grupo===grupo);
            const aberto=grupoAberto===grupo;
            return (
              <div key={grupo}>
                <button onClick={()=>setGrupoAberto(aberto?"":grupo)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"7px 14px",background:"none",border:"none",cursor:"pointer",color:aberto?"#8b5cf6":"#9ca3af",fontSize:11,fontWeight:"bold",textTransform:"uppercase",letterSpacing:1}}>
                  <span>{grupo}</span><span style={{fontSize:9}}>{aberto?"▼":"▶"}</span>
                </button>
                {aberto && (
                  <div style={{padding:"2px 8px 8px"}}>
                    {tipos.map(([tipo,cfg])=>(
                      <button key={tipo} onClick={()=>adicionarNo(tipo)}
                        style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:"#1a1a1a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 10px",color:"white",fontSize:11,cursor:"pointer",marginBottom:3,textAlign:"left"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#1f2937")}
                        onMouseLeave={e=>(e.currentTarget.style.background="#1a1a1a")}>
                        <span style={{fontSize:14,width:20,textAlign:"center"}}>{cfg.icone}</span>
                        <span style={{flex:1}}>{cfg.label}</span>
                        <span style={{width:8,height:8,borderRadius:"50%",background:cfg.cor,flexShrink:0}} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{padding:10,borderTop:"1px solid #1f2937"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1a1a1a",borderRadius:8,padding:"7px 10px",marginBottom:8}}>
            <span style={{color:fluxoAtivo?.ativo?"#8b5cf6":"#6b7280",fontSize:11,fontWeight:"bold"}}>{fluxoAtivo?.ativo?"🟢 Ativo":"⚫ Inativo"}</span>
            <button onClick={toggleAtivo} style={{width:34,height:18,background:fluxoAtivo?.ativo?"#8b5cf6":"#374151",borderRadius:9,cursor:"pointer",border:"none",position:"relative"}}>
              <div style={{width:12,height:12,background:"white",borderRadius:"50%",position:"absolute",top:3,left:fluxoAtivo?.ativo?19:3,transition:"left 0.2s"}} />
            </button>
          </div>
          <button onClick={salvarFluxo} disabled={salvando} style={{width:"100%",background:salvando?"#6b21a8":"#8b5cf6",color:"white",border:"none",borderRadius:8,padding:"9px",fontSize:12,cursor:"pointer",fontWeight:"bold"}}>
            {salvando?"Salvando...":"💾 Salvar Fluxo"}
          </button>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div
        ref={canvasRef}
        style={{flex:1,position:"relative",overflow:"hidden",
          cursor: dragIdRef.current?"grabbing": panningRef.current?"grabbing": conectando?"crosshair":"default"}}
        onMouseDown={onMouseDownCanvas}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {/* grade */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          <defs>
            <pattern id="dots" width={24*scale} height={24*scale} patternUnits="userSpaceOnUse"
              x={offset.x%(24*scale)} y={offset.y%(24*scale)}>
              <circle cx={1} cy={1} r={0.8} fill="#1f2937"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>

        {/* conexões */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible"}}>
          {arestas.map(a=>{
            const nO=nos.find(n=>n.id===a.de);
            const nD=nos.find(n=>n.id===a.para);
            if (!nO||!nD) return null;
            const o=posConexao(nO,a.saidaIndex);
            const d2=posEntrada(nD);
            const ox=o.x*scale+offset.x, oy=o.y*scale+offset.y;
            const dx=d2.x*scale+offset.x, dy=d2.y*scale+offset.y;
            const cor=BLOCOS[nO.tipo]?.cor||"#4b5563";
            return (
              <g key={a.id} style={{pointerEvents:"all",cursor:"pointer"}} onClick={()=>setArestas(p=>p.filter(x=>x.id!==a.id))}>
                <path d={`M${ox} ${oy} C${ox+80*scale} ${oy} ${dx-80*scale} ${dy} ${dx} ${dy}`} stroke={cor} strokeWidth={2} fill="none" opacity={0.7}/>
                <path d={`M${ox} ${oy} C${ox+80*scale} ${oy} ${dx-80*scale} ${dy} ${dx} ${dy}`} stroke="transparent" strokeWidth={14} fill="none"/>
                <circle cx={dx} cy={dy} r={5} fill={cor}/>
              </g>
            );
          })}
          {conectando&&(()=>{
            const no=nos.find(n=>n.id===conectando.noId);
            if (!no) return null;
            const o=posConexao(no,conectando.saidaIndex);
            const ox=o.x*scale+offset.x, oy=o.y*scale+offset.y;
            const cor=BLOCOS[no.tipo]?.cor||"#8b5cf6";
            return <path d={`M${ox} ${oy} C${ox+80} ${oy} ${mousePos.x-80} ${mousePos.y} ${mousePos.x} ${mousePos.y}`} stroke={cor} strokeWidth={2} strokeDasharray="6 3" fill="none"/>;
          })()}
        </svg>

        {/* nós */}
        <div style={{position:"absolute",inset:0,transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`,transformOrigin:"0 0"}}>
          {nos.map(no=>{
            const cfg=BLOCOS[no.tipo];
            if (!cfg) return null;
            const sel=noSel?.id===no.id;
            return (
              <div key={no.id}
                style={{position:"absolute",left:no.x,top:no.y,width:220,background:"#111",borderRadius:10,
                  border:`2px solid ${sel?cfg.cor:"#2d2d2d"}`,
                  boxShadow:sel?`0 0 0 3px ${cfg.cor}33,0 4px 20px rgba(0,0,0,.5)`:"0 2px 8px rgba(0,0,0,.4)",
                  userSelect:"none",zIndex:sel?10:1}}
                onMouseDown={e=>onMouseDownNo(e,no.id)}
                onClick={e=>{e.stopPropagation();setNoSel(nos.find(n=>n.id===no.id)||null);}}
                onMouseUp={e=>finalizarConexao(e,no.id)}
              >
                {/* header */}
                <div style={{background:cfg.cor,borderRadius:"8px 8px 0 0",padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"grab"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13}}>{cfg.icone}</span>
                    <span style={{color:"white",fontSize:11,fontWeight:"bold"}}>{cfg.label}</span>
                    <span style={{background:"rgba(0,0,0,.2)",color:"rgba(255,255,255,.6)",fontSize:9,padding:"1px 6px",borderRadius:10}}>{cfg.grupo}</span>
                  </div>
                  {no.tipo!=="inicio"&&(
                    <button onClick={e=>{e.stopPropagation();excluirNo(no.id);}}
                      style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>✕</button>
                  )}
                </div>

                {/* preview */}
                <div style={{padding:"7px 10px",borderBottom:cfg.saidas.length?"1px solid #1f2937":"none",cursor:"grab"}}>
                  <p style={{color:"#9ca3af",fontSize:10,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{preview(no)}</p>
                </div>

                {/* entrada */}
                {no.tipo!=="inicio"&&(
                  <div style={{position:"absolute",left:-7,top:48+18-7,width:14,height:14,borderRadius:"50%",background:"#1f2937",border:`2px solid ${cfg.cor}`,cursor:"crosshair",zIndex:5}}
                    onMouseUp={e=>finalizarConexao(e,no.id)}/>
                )}

                {/* saídas */}
                {no.saidas.map((saida,idx)=>(
                  <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",height:36,borderTop:idx>0?"1px solid #1a1a1a":"none"}}>
                    <span style={{color:"#6b7280",fontSize:10}}>{saida}</span>
                    <div style={{width:14,height:14,borderRadius:"50%",background:cfg.cor,cursor:"crosshair",flexShrink:0,position:"relative",right:-18,border:"2px solid #111"}}
                      onMouseDown={e=>{e.stopPropagation();iniciarConexao(e,no.id,idx);}}/>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* barra inferior */}
        <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:8}}>
          <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 12px"}}>
            <p style={{color:"#6b7280",fontSize:10,margin:0}}>🖱️ Arraste blocos • Scroll zoom • ● conectar • Clique na linha para excluir</p>
          </div>
          <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 10px",display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{const s=Math.min(scaleRef.current*1.2,2.5);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16,lineHeight:1}}>+</button>
            <span style={{color:"#6b7280",fontSize:10}}>{Math.round(scale*100)}%</span>
            <button onClick={()=>{const s=Math.max(scaleRef.current*0.8,0.2);scaleRef.current=s;setScale(s);}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16,lineHeight:1}}>−</button>
            <button onClick={()=>{scaleRef.current=1;offsetRef.current={x:80,y:80};setScale(1);setOffset({x:80,y:80});}} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10}}>Reset</button>
          </div>
        </div>

        <div style={{position:"absolute",top:16,right:noSel?285:16,background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:"6px 12px"}}>
          <p style={{color:"#6b7280",fontSize:10,margin:0}}>{nos.length} blocos • {arestas.length} conexões</p>
        </div>
      </div>

      {/* ── PAINEL DIREITO ── */}
      {noSel&&(
        <div style={{width:270,background:"#111",borderLeft:"1px solid #1f2937",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:BLOCOS[noSel.tipo]?.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                {BLOCOS[noSel.tipo]?.icone}
              </div>
              <div>
                <h3 style={{color:"white",fontSize:13,fontWeight:"bold",margin:0}}>{BLOCOS[noSel.tipo]?.label}</h3>
                <p style={{color:"#6b7280",fontSize:10,margin:0}}>{BLOCOS[noSel.tipo]?.grupo}</p>
              </div>
            </div>
            <button onClick={()=>setNoSel(null)} style={{background:"none",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{padding:14,overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:12}}>
            <Propriedades/>
            {noSel.tipo!=="inicio"&&(
              <button onClick={()=>excluirNo(noSel.id)} style={{background:"#dc262611",color:"#dc2626",border:"1px solid #dc262633",borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",fontWeight:"bold",marginTop:"auto"}}>
                🗑️ Excluir Bloco
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}