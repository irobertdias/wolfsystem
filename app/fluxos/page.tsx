"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TipoNo =
  | "inicio" | "mensagem" | "pergunta" | "condicao" | "transferir"
  | "etiqueta" | "finalizar" | "aguardar" | "imagem" | "video" | "lista" | "botoes";

type No = {
  id: string;
  tipo: TipoNo;
  x: number;
  y: number;
  dados: Record<string, any>;
  saidas: string[];
};

type Conexao = {
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
  conexoes: Conexao[];
  workspace_id: string;
};

const COR_NO: Record<TipoNo, string> = {
  inicio: "#16a34a", mensagem: "#3b82f6", pergunta: "#8b5cf6",
  condicao: "#f59e0b", transferir: "#06b6d4", etiqueta: "#ec4899",
  finalizar: "#dc2626", aguardar: "#6b7280", imagem: "#10b981",
  video: "#f97316", lista: "#84cc16", botoes: "#a855f7",
};

const ICONE_NO: Record<TipoNo, string> = {
  inicio: "🚀", mensagem: "💬", pergunta: "❓", condicao: "🔀",
  transferir: "👤", etiqueta: "🏷️", finalizar: "🏁", aguardar: "⏳",
  imagem: "🖼️", video: "🎥", lista: "📋", botoes: "🔘",
};

const LABEL_NO: Record<TipoNo, string> = {
  inicio: "Início", mensagem: "Mensagem", pergunta: "Pergunta",
  condicao: "Condição", transferir: "Transferir", etiqueta: "Etiqueta",
  finalizar: "Finalizar", aguardar: "Aguardar", imagem: "Imagem",
  video: "Vídeo", lista: "Lista", botoes: "Botões",
};

const SAIDAS_NO: Record<TipoNo, string[]> = {
  inicio: ["Próximo"], mensagem: ["Próximo"], pergunta: ["Resposta recebida"],
  condicao: ["Se verdadeiro", "Se falso"], transferir: ["Próximo"],
  etiqueta: ["Próximo"], finalizar: [], aguardar: ["Continuar"],
  imagem: ["Próximo"], video: ["Próximo"], lista: ["Opção selecionada"],
  botoes: ["Botão 1", "Botão 2", "Botão 3"],
};

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: ws } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
  return ws ? ws.id.toString() : null;
}

export default function FluxosPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [wsId, setWsId] = useState<string | null>(null);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [fluxoAtivo, setFluxoAtivo] = useState<Fluxo | null>(null);
  const [nos, setNos] = useState<No[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [noSelecionado, setNoSelecionado] = useState<No | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [view, setView] = useState<"lista" | "editor">("lista");
  const [showNovoFluxo, setShowNovoFluxo] = useState(false);
  const [formNovoFluxo, setFormNovoFluxo] = useState({ nome: "", descricao: "", trigger_tipo: "qualquer_mensagem", trigger_valor: "" });
  const [criando, setCriando] = useState(false);

  const [draggingNo, setDraggingNo] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [conectando, setConectando] = useState<{ noId: string; saidaIndex: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const init = async () => {
      const id = await getWorkspaceId();
      setWsId(id);
      if (id) {
        const { data } = await supabase.from("fluxos").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
        setFluxos((data || []).map(f => ({ ...f, nos: f.nos || [], conexoes: f.conexoes || [] })));
      }
    };
    init();
  }, []);

  const fetchFluxos = async () => {
    const id = wsId || await getWorkspaceId();
    if (!id) return;
    const { data } = await supabase.from("fluxos").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
    setFluxos((data || []).map(f => ({ ...f, nos: f.nos || [], conexoes: f.conexoes || [] })));
  };

  const criarFluxo = async () => {
    if (!formNovoFluxo.nome.trim()) { alert("Digite o nome do fluxo!"); return; }
    setCriando(true);
    try {
      const id = wsId || await getWorkspaceId();
      if (!id) { alert("Workspace não encontrado! Tente recarregar a página."); return; }

      const noInicio: No = {
        id: gerarId(), tipo: "inicio", x: 200, y: 200,
        dados: { mensagem: "Olá! Como posso te ajudar?" },
        saidas: ["Próximo"],
      };

      const novoFluxo = {
        nome: formNovoFluxo.nome.trim(),
        descricao: formNovoFluxo.descricao,
        ativo: false,
        trigger_tipo: formNovoFluxo.trigger_tipo,
        trigger_valor: formNovoFluxo.trigger_valor,
        nos: [noInicio],
        conexoes: [],
        workspace_id: id,
      };

      const { data, error } = await supabase.from("fluxos").insert([novoFluxo]).select().single();
      if (error) { alert("Erro ao criar: " + error.message); return; }
      if (data) {
        setWsId(id);
        await fetchFluxos();
        abrirEditor({ ...novoFluxo, id: data.id } as Fluxo);
        setShowNovoFluxo(false);
        setFormNovoFluxo({ nome: "", descricao: "", trigger_tipo: "qualquer_mensagem", trigger_valor: "" });
      }
    } finally {
      setCriando(false);
    }
  };

  const abrirEditor = (fluxo: Fluxo) => {
    setFluxoAtivo(fluxo);
    setNos(fluxo.nos || []);
    setConexoes(fluxo.conexoes || []);
    setNoSelecionado(null);
    setView("editor");
  };

  const salvarFluxo = async () => {
    if (!fluxoAtivo?.id) return;
    setSalvando(true);
    await supabase.from("fluxos").update({
      nos, conexoes, nome: fluxoAtivo.nome, descricao: fluxoAtivo.descricao,
      ativo: fluxoAtivo.ativo, trigger_tipo: fluxoAtivo.trigger_tipo, trigger_valor: fluxoAtivo.trigger_valor,
    }).eq("id", fluxoAtivo.id);
    await fetchFluxos();
    setSalvando(false);
    alert("✅ Fluxo salvo!");
  };

  const adicionarNo = (tipo: TipoNo) => {
    const novoNo: No = {
      id: gerarId(), tipo,
      x: 300 - canvasOffset.x / canvasScale,
      y: 300 - canvasOffset.y / canvasScale,
      dados: getDadosPadrao(tipo),
      saidas: [...SAIDAS_NO[tipo]],
    };
    setNos(prev => [...prev, novoNo]);
  };

  const getDadosPadrao = (tipo: TipoNo): Record<string, any> => {
    switch (tipo) {
      case "mensagem": return { texto: "Digite sua mensagem aqui..." };
      case "pergunta": return { texto: "Qual é a sua dúvida?", variavel: "resposta" };
      case "condicao": return { variavel: "resposta", operador: "contem", valor: "" };
      case "transferir": return { fila: "Fila Principal", mensagem: "Transferindo para atendente..." };
      case "etiqueta": return { etiqueta: "Lead Quente" };
      case "finalizar": return { mensagem: "Atendimento finalizado. Obrigado!" };
      case "aguardar": return { segundos: 2 };
      case "imagem": return { url: "", legenda: "" };
      case "video": return { url: "", legenda: "" };
      case "lista": return { titulo: "Selecione uma opção:", itens: ["Opção 1", "Opção 2", "Opção 3"] };
      case "botoes": return { texto: "Escolha uma opção:", botoes: ["Botão 1", "Botão 2"] };
      default: return {};
    }
  };

  const excluirNo = (id: string) => {
    if (nos.find(n => n.id === id)?.tipo === "inicio") { alert("Não é possível excluir o nó de início!"); return; }
    setNos(prev => prev.filter(n => n.id !== id));
    setConexoes(prev => prev.filter(c => c.de !== id && c.para !== id));
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

  const handleMouseDownNo = (e: React.MouseEvent, noId: string) => {
    e.stopPropagation();
    if (conectando) return;
    const no = nos.find(n => n.id === noId);
    if (!no) return;
    setDraggingNo(noId);
    setNoSelecionado(no);
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

  const handleMouseUp = () => { setDraggingNo(null); setIsPanning(false); };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggingNo && !conectando) setIsPanning(true);
    if (conectando) setConectando(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCanvasScale(prev => Math.min(Math.max(prev * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 2));
  };

  const iniciarConexao = (e: React.MouseEvent, noId: string, saidaIndex: number) => {
    e.stopPropagation();
    setConectando({ noId, saidaIndex });
  };

  const finalizarConexao = (e: React.MouseEvent, noId: string) => {
    e.stopPropagation();
    if (!conectando || conectando.noId === noId) { setConectando(null); return; }
    setConexoes(prev => {
      const filtered = prev.filter(c => !(c.de === conectando.noId && c.saidaIndex === conectando.saidaIndex));
      return [...filtered, { id: gerarId(), de: conectando.noId, saidaIndex: conectando.saidaIndex, para: noId }];
    });
    setConectando(null);
  };

  const getPosConexao = (no: No, saidaIndex: number) => ({
    x: no.x + 200,
    y: no.y + 44 + 40 * saidaIndex + 20,
  });

  const getPosEntrada = (no: No) => ({ x: no.x, y: no.y + 64 });

  const inputStyle = { width: "100%", background: "#0d0d0d", border: "1px solid #374151", borderRadius: 6, padding: "8px 10px", color: "white", fontSize: 12, boxSizing: "border-box" as const };

  // ==================== LISTA ====================
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

          {/* Modal Novo Fluxo */}
          {showNovoFluxo && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 500, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>➕ Novo Fluxo</h2>
                  <button onClick={() => setShowNovoFluxo(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome *</label>
                  <input
                    placeholder="Ex: Fluxo de Vendas"
                    value={formNovoFluxo.nome}
                    onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, nome: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && criarFluxo()}
                    style={{ ...inputStyle, fontSize: 14, padding: "10px 14px" }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Descrição</label>
                  <input placeholder="Descreva o objetivo do fluxo" value={formNovoFluxo.descricao} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, descricao: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Quando Ativar</label>
                  <select value={formNovoFluxo.trigger_tipo} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, trigger_tipo: e.target.value })} style={inputStyle}>
                    <option value="qualquer_mensagem">Qualquer mensagem recebida</option>
                    <option value="palavra_chave">Palavra-chave específica</option>
                    <option value="primeiro_contato">Primeiro contato</option>
                    <option value="fora_horario">Fora do horário</option>
                  </select>
                </div>
                {formNovoFluxo.trigger_tipo === "palavra_chave" && (
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Palavra-chave</label>
                    <input placeholder="Ex: oi, olá, inicio" value={formNovoFluxo.trigger_valor} onChange={(e) => setFormNovoFluxo({ ...formNovoFluxo, trigger_valor: e.target.value })} style={inputStyle} />
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
              <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px 0" }}>Crie fluxos de atendimento automático sem precisar de IA</p>
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
                    <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>{fluxo.nos?.length || 0} nós</span>
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

  // ==================== EDITOR ====================
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a", color: "white", overflow: "hidden" }}>

      {/* Painel esquerdo */}
      <div style={{ width: 200, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937" }}>
          <button onClick={() => setView("lista")} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer", padding: 0 }}>← Voltar</button>
          <h3 style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: "6px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fluxoAtivo?.nome}</h3>
        </div>
        <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
          <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", margin: "0 0 8px 0" }}>Blocos</p>
          {(Object.keys(LABEL_NO) as TipoNo[]).filter(t => t !== "inicio").map((tipo) => (
            <button key={tipo} onClick={() => adicionarNo(tipo)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#1f2937", border: "none", borderRadius: 8, padding: "8px 10px", color: "white", fontSize: 12, cursor: "pointer", marginBottom: 6, textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>{ICONE_NO[tipo]}</span>
              <span>{LABEL_NO[tipo]}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1f2937", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
            <span style={{ color: fluxoAtivo?.ativo ? "#8b5cf6" : "#6b7280", fontSize: 12, fontWeight: "bold" }}>{fluxoAtivo?.ativo ? "🟢 Ativo" : "⚫ Inativo"}</span>
            <button onClick={toggleAtivo} style={{ width: 36, height: 20, background: fluxoAtivo?.ativo ? "#8b5cf6" : "#374151", borderRadius: 10, cursor: "pointer", border: "none", position: "relative" }}>
              <div style={{ width: 14, height: 14, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: fluxoAtivo?.ativo ? 19 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
          <button onClick={salvarFluxo} disabled={salvando} style={{ width: "100%", background: salvando ? "#1d4ed8" : "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            {salvando ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : conectando ? "crosshair" : "default", background: "#0a0a0a" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Grade */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="grid" width={20 * canvasScale} height={20 * canvasScale} patternUnits="userSpaceOnUse" x={canvasOffset.x % (20 * canvasScale)} y={canvasOffset.y % (20 * canvasScale)}>
              <circle cx={1} cy={1} r={0.5} fill="#1f2937" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Conexões */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {conexoes.map((con) => {
            const noOrigem = nos.find(n => n.id === con.de);
            const noDestino = nos.find(n => n.id === con.para);
            if (!noOrigem || !noDestino) return null;
            const origem = getPosConexao(noOrigem, con.saidaIndex);
            const destino = getPosEntrada(noDestino);
            const ox = origem.x * canvasScale + canvasOffset.x;
            const oy = origem.y * canvasScale + canvasOffset.y;
            const dx = destino.x * canvasScale + canvasOffset.x;
            const dy = destino.y * canvasScale + canvasOffset.y;
            return (
              <g key={con.id}>
                <path d={`M ${ox} ${oy} C ${ox + 80 * canvasScale} ${oy} ${dx - 80 * canvasScale} ${dy} ${dx} ${dy}`} stroke="#4b5563" strokeWidth={2} fill="none" />
                <circle cx={dx} cy={dy} r={4} fill="#4b5563" />
              </g>
            );
          })}
          {conectando && (() => {
            const no = nos.find(n => n.id === conectando.noId);
            if (!no) return null;
            const origem = getPosConexao(no, conectando.saidaIndex);
            const ox = origem.x * canvasScale + canvasOffset.x;
            const oy = origem.y * canvasScale + canvasOffset.y;
            return <path d={`M ${ox} ${oy} C ${ox + 80} ${oy} ${mousePos.x - 80} ${mousePos.y} ${mousePos.x} ${mousePos.y}`} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" fill="none" />;
          })()}
        </svg>

        {/* Nós */}
        <div style={{ position: "absolute", inset: 0, transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`, transformOrigin: "0 0" }}>
          {nos.map((no) => {
            const cor = COR_NO[no.tipo];
            const selecionado = noSelecionado?.id === no.id;
            return (
              <div
                key={no.id}
                style={{ position: "absolute", left: no.x, top: no.y, width: 200, background: "#111", borderRadius: 10, border: `2px solid ${selecionado ? cor : "#374151"}`, boxShadow: selecionado ? `0 0 0 3px ${cor}33` : "none", cursor: draggingNo === no.id ? "grabbing" : "grab", userSelect: "none", zIndex: selecionado ? 10 : 1 }}
                onMouseDown={(e) => handleMouseDownNo(e, no.id)}
                onClick={(e) => { e.stopPropagation(); setNoSelecionado(no); }}
                onMouseUp={(e) => finalizarConexao(e, no.id)}
              >
                {/* Header */}
                <div style={{ background: cor, borderRadius: "8px 8px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{ICONE_NO[no.tipo]}</span>
                    <span style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>{LABEL_NO[no.tipo]}</span>
                  </div>
                  {no.tipo !== "inicio" && (
                    <button onClick={(e) => { e.stopPropagation(); excluirNo(no.id); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                  )}
                </div>

                {/* Preview */}
                <div style={{ padding: "8px 12px", minHeight: 36 }}>
                  {no.tipo === "mensagem" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{no.dados.texto}</p>}
                  {no.tipo === "pergunta" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{no.dados.texto}</p>}
                  {no.tipo === "condicao" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>SE {no.dados.variavel} {no.dados.operador} "{no.dados.valor}"</p>}
                  {no.tipo === "transferir" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>→ {no.dados.fila}</p>}
                  {no.tipo === "etiqueta" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>🏷️ {no.dados.etiqueta}</p>}
                  {no.tipo === "finalizar" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{no.dados.mensagem}</p>}
                  {no.tipo === "aguardar" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>⏳ {no.dados.segundos}s</p>}
                  {no.tipo === "imagem" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{no.dados.legenda || "Sem legenda"}</p>}
                  {no.tipo === "video" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{no.dados.legenda || "Sem legenda"}</p>}
                  {no.tipo === "lista" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{no.dados.itens?.length || 0} opções</p>}
                  {no.tipo === "botoes" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{no.dados.botoes?.length || 0} botões</p>}
                  {no.tipo === "inicio" && <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>Início do atendimento</p>}
                </div>

                {/* Entrada esquerda */}
                {no.tipo !== "inicio" && (
                  <div style={{ position: "absolute", left: -8, top: 60, width: 16, height: 16, borderRadius: "50%", background: "#374151", border: "2px solid #111", cursor: "pointer", zIndex: 5 }} onMouseUp={(e) => finalizarConexao(e, no.id)} />
                )}

                {/* Saídas direita */}
                {no.saidas.map((saida, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 0 8px", height: 40, borderTop: "1px solid #1f2937" }}>
                    <span style={{ color: "#6b7280", fontSize: 10 }}>{saida}</span>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: cor, cursor: "crosshair", flexShrink: 0, position: "relative", right: -20 }} onMouseDown={(e) => { e.stopPropagation(); iniciarConexao(e, no.id, idx); }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Dica */}
        <div style={{ position: "absolute", bottom: 16, left: 16, background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "8px 12px" }}>
          <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>🖱️ Arraste os blocos • Scroll para zoom • Clique no ● para conectar</p>
        </div>
      </div>

      {/* Painel direito - Propriedades */}
      {noSelecionado && (
        <div style={{ width: 280, background: "#111", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{ICONE_NO[noSelecionado.tipo]}</span>
              <h3 style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{LABEL_NO[noSelecionado.tipo]}</h3>
            </div>
            <button onClick={() => setNoSelecionado(null)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            {(noSelecionado.tipo === "mensagem" || noSelecionado.tipo === "inicio") && (
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Texto da mensagem</label>
                <textarea value={noSelecionado.dados.texto || noSelecionado.dados.mensagem || ""} onChange={(e) => atualizarNo(noSelecionado.id, noSelecionado.tipo === "inicio" ? { mensagem: e.target.value } : { texto: e.target.value })} style={{ ...inputStyle, height: 100, resize: "vertical" as const }} />
              </div>
            )}
            {noSelecionado.tipo === "pergunta" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Pergunta</label>
                <textarea value={noSelecionado.dados.texto || ""} onChange={(e) => atualizarNo(noSelecionado.id, { texto: e.target.value })} style={{ ...inputStyle, height: 80, resize: "vertical" as const }} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Salvar resposta em variável</label>
                <input value={noSelecionado.dados.variavel || ""} onChange={(e) => atualizarNo(noSelecionado.id, { variavel: e.target.value })} style={inputStyle} placeholder="Ex: nome, email, telefone" />
              </div>
            </>)}
            {noSelecionado.tipo === "condicao" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Variável</label>
                <input value={noSelecionado.dados.variavel || ""} onChange={(e) => atualizarNo(noSelecionado.id, { variavel: e.target.value })} style={inputStyle} placeholder="Ex: resposta" />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Operador</label>
                <select value={noSelecionado.dados.operador || "contem"} onChange={(e) => atualizarNo(noSelecionado.id, { operador: e.target.value })} style={inputStyle}>
                  <option value="contem">Contém</option>
                  <option value="igual">É igual a</option>
                  <option value="diferente">É diferente de</option>
                  <option value="comeca">Começa com</option>
                  <option value="termina">Termina com</option>
                  <option value="vazio">Está vazio</option>
                  <option value="nao_vazio">Não está vazio</option>
                </select>
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Valor</label>
                <input value={noSelecionado.dados.valor || ""} onChange={(e) => atualizarNo(noSelecionado.id, { valor: e.target.value })} style={inputStyle} placeholder="Valor para comparar" />
              </div>
            </>)}
            {noSelecionado.tipo === "transferir" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila de destino</label>
                <select value={noSelecionado.dados.fila || ""} onChange={(e) => atualizarNo(noSelecionado.id, { fila: e.target.value })} style={inputStyle}>
                  <option value="Fila Principal">Fila Principal</option>
                  <option value="Fila Suporte">Fila Suporte</option>
                  <option value="Fila Vendas">Fila Vendas</option>
                </select>
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Mensagem ao transferir</label>
                <textarea value={noSelecionado.dados.mensagem || ""} onChange={(e) => atualizarNo(noSelecionado.id, { mensagem: e.target.value })} style={{ ...inputStyle, height: 80, resize: "vertical" as const }} />
              </div>
            </>)}
            {noSelecionado.tipo === "etiqueta" && (
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Etiqueta</label>
                <select value={noSelecionado.dados.etiqueta || ""} onChange={(e) => atualizarNo(noSelecionado.id, { etiqueta: e.target.value })} style={inputStyle}>
                  <option value="Lead Quente">🔴 Lead Quente</option>
                  <option value="Lead Frio">🔵 Lead Frio</option>
                  <option value="Agendado">🟡 Agendado</option>
                  <option value="Fechado">🟢 Fechado</option>
                  <option value="Retornar">🟣 Retornar</option>
                </select>
              </div>
            )}
            {noSelecionado.tipo === "finalizar" && (
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Mensagem de encerramento</label>
                <textarea value={noSelecionado.dados.mensagem || ""} onChange={(e) => atualizarNo(noSelecionado.id, { mensagem: e.target.value })} style={{ ...inputStyle, height: 80, resize: "vertical" as const }} />
              </div>
            )}
            {noSelecionado.tipo === "aguardar" && (
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Aguardar (segundos)</label>
                <input type="number" min={1} max={60} value={noSelecionado.dados.segundos || 2} onChange={(e) => atualizarNo(noSelecionado.id, { segundos: Number(e.target.value) })} style={inputStyle} />
              </div>
            )}
            {noSelecionado.tipo === "imagem" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL da imagem</label>
                <input value={noSelecionado.dados.url || ""} onChange={(e) => atualizarNo(noSelecionado.id, { url: e.target.value })} style={inputStyle} placeholder="https://..." />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Legenda</label>
                <input value={noSelecionado.dados.legenda || ""} onChange={(e) => atualizarNo(noSelecionado.id, { legenda: e.target.value })} style={inputStyle} placeholder="Legenda opcional" />
              </div>
            </>)}
            {noSelecionado.tipo === "video" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL do vídeo</label>
                <input value={noSelecionado.dados.url || ""} onChange={(e) => atualizarNo(noSelecionado.id, { url: e.target.value })} style={inputStyle} placeholder="https://..." />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Legenda</label>
                <input value={noSelecionado.dados.legenda || ""} onChange={(e) => atualizarNo(noSelecionado.id, { legenda: e.target.value })} style={inputStyle} placeholder="Legenda opcional" />
              </div>
            </>)}
            {noSelecionado.tipo === "lista" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Título</label>
                <input value={noSelecionado.dados.titulo || ""} onChange={(e) => atualizarNo(noSelecionado.id, { titulo: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Opções (uma por linha)</label>
                <textarea value={(noSelecionado.dados.itens || []).join("\n")} onChange={(e) => atualizarNo(noSelecionado.id, { itens: e.target.value.split("\n").filter(Boolean) })} style={{ ...inputStyle, height: 100, resize: "vertical" as const }} placeholder={"Opção 1\nOpção 2\nOpção 3"} />
              </div>
            </>)}
            {noSelecionado.tipo === "botoes" && (<>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Texto</label>
                <textarea value={noSelecionado.dados.texto || ""} onChange={(e) => atualizarNo(noSelecionado.id, { texto: e.target.value })} style={{ ...inputStyle, height: 80, resize: "vertical" as const }} />
              </div>
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Botões (um por linha, máx 3)</label>
                <textarea
                  value={(noSelecionado.dados.botoes || []).join("\n")}
                  onChange={(e) => {
                    const botoes = e.target.value.split("\n").filter(Boolean).slice(0, 3);
                    atualizarNo(noSelecionado.id, { botoes });
                    setNos(prev => prev.map(n => n.id === noSelecionado.id ? { ...n, saidas: botoes.length > 0 ? botoes : ["Botão 1"] } : n));
                  }}
                  style={{ ...inputStyle, height: 80, resize: "vertical" as const }}
                  placeholder={"Sim\nNão\nTalvez"}
                />
              </div>
            </>)}
            {noSelecionado.tipo !== "inicio" && (
              <button onClick={() => excluirNo(noSelecionado.id)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold", marginTop: "auto" }}>
                🗑️ Excluir Nó
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}