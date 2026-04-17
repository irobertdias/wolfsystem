"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";

type Atendimento = {
  id: number;
  created_at: string;
  numero: string;
  nome: string;
  mensagem: string;
  status: string;
  fila: string;
  atendente: string;
  workspace_id: string;
};

type Mensagem = {
  id?: number;
  created_at?: string;
  numero: string;
  mensagem: string;
  de: string;
  workspace_id?: string;
};

type Conexao = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  numero: string;
  ia: string;
  fila: string;
  apiKey: string;
  prompt: string;
  typebotUrl: string;
  typebotKey: string;
  wabToken?: string;
  wabPhoneId?: string;
  wabaId?: string;
  webhookToken?: string;
};

export default function Chatbot() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [menuAberto, setMenuAberto] = useState<string | null>("atendimentos");
  const [aba, setAba] = useState("chat");
  const [gravando, setGravando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showFiltro, setShowFiltro] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [abaConversa, setAbaConversa] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Atendimento | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [showModalConexao, setShowModalConexao] = useState(false);
  const [showModalQR, setShowModalQR] = useState(false);
  const [showModalWABA, setShowModalWABA] = useState(false);
  const [showMenuEngrenagem, setShowMenuEngrenagem] = useState<number | null>(null);
  const [qrConexaoId, setQrConexaoId] = useState<number | null>(null);
  const [salvandoConexao, setSalvandoConexao] = useState(false);
  const [salvandoWABA, setSalvandoWABA] = useState(false);
  const [testandoWABA, setTestendoWABA] = useState(false);
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [statusWhatsapp, setStatusWhatsapp] = useState("desconectado");
  const [numeroWhatsapp, setNumeroWhatsapp] = useState("");
  const [wabaTeste, setWabaTeste] = useState<{ success: boolean; nome?: string; error?: string } | null>(null);

  const [formConexao, setFormConexao] = useState({
    nome: "", tipo: "webjs", ia: "gpt", apiKey: "", prompt: "",
    typebotUrl: "", typebotKey: "", fila: "", grupo: "",
  });

  const [formWABA, setFormWABA] = useState({
    nome: "", phoneNumberId: "", wabaId: "", token: "",
    webhookToken: "", ia: "gpt", apiKey: "", prompt: "", fila: "",
  });

  const [conexoes, setConexoes] = useState<Conexao[]>([]);

  const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const respostasRapidas = [
    { atalho: "/oi", mensagem: "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?" },
    { atalho: "/planos", mensagem: "Temos planos a partir de R$ 89,90. Posso te passar mais detalhes!" },
    { atalho: "/aguarda", mensagem: "Por favor, aguarde um momento que já vou te atender!" },
    { atalho: "/encerrar", mensagem: "Obrigado pelo contato! Tenha um ótimo dia!" },
  ];

  const mensagensInternas = [
    { de: "Pedro Lima", texto: "Robert, o cliente está perguntando sobre desconto", hora: "10:05" },
    { de: "Você", texto: "Pode oferecer 10% para ele!", hora: "10:06" },
  ];

  const menus = [
    { key: "atendimentos", icon: "💬", label: "Atendimentos", subitens: [{ key: "chat", label: "Conversas" }, { key: "dashboard_atendimentos", label: "Dashboard" }] },
    { key: "empresa_filas", icon: "🏢", label: "Empresas & Filas", subitens: [{ key: "empresas", label: "Empresas" }, { key: "filas", label: "Filas" }, { key: "conexoes", label: "Conexões" }] },
    { key: "automacao", icon: "🤖", label: "Automação", subitens: [{ key: "fluxos", label: "Chatbot / Fluxos" }, { key: "claude", label: "Claude AI" }, { key: "gpt", label: "ChatGPT" }, { key: "typebot", label: "Typebot" }] },
    { key: "cadastro", icon: "📋", label: "Cadastro", subitens: [{ key: "usuarios", label: "Usuários" }, { key: "departamentos", label: "Departamentos" }, { key: "etiquetas", label: "Etiquetas" }] },
    { key: "configuracoes", icon: "⚙️", label: "Configurações", subitens: [{ key: "roleta", label: "Roleta" }, { key: "relatorios", label: "Relatórios" }, { key: "respostas_rapidas", label: "Respostas Rápidas" }] },
  ];

  const inputStyle = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 14, boxSizing: "border-box" as const };
  const textareaStyle = { ...inputStyle, height: 100, resize: "vertical" as const };
  const iaLabel: Record<string, string> = { gpt: "ChatGPT", claude: "Claude AI", gemini: "Gemini", typebot: "Typebot", nenhum: "Nenhum" };
  const iaColor: Record<string, string> = { gpt: "#10b981", claude: "#8b5cf6", gemini: "#f59e0b", typebot: "#3b82f6", nenhum: "#6b7280" };

  useEffect(() => {
    fetchAtendimentos();
    consultarStatusWhatsapp();
    const channel = supabase
      .channel("atendimentos_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => fetchAtendimentos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace]);

  useEffect(() => {
    if (!atendimentoAtivo) return;
    setHistorico([]);
    fetchHistorico(atendimentoAtivo.numero);
    const numeroAtual = atendimentoAtivo.numero;
    const channel = supabase
      .channel(`mensagens_${numeroAtual}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const novaMensagem = payload.new as Mensagem;
        if (novaMensagem.numero === numeroAtual) {
          setHistorico(prev => [...prev, novaMensagem]);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [atendimentoAtivo?.numero]);

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [historico]);

  useEffect(() => {
    if (!showModalQR) return;
    const interval = setInterval(async () => {
      const data = await consultarStatusWhatsapp();
      if (data.status === "conectado" && qrConexaoId) {
        setConexoes(prev => prev.map(c => c.id === qrConexaoId ? { ...c, status: "conectado", numero: data.numero || "Conectado via QR" } : c));
        setShowModalQR(false);
        setResetando(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [showModalQR, qrConexaoId]);

  const consultarStatusWhatsapp = async () => {
    try {
      const wsId = workspace?.id?.toString() || "1";
      const data = await wa(`whatsapp-status&workspaceId=${wsId}`);
      const status = data.status || "desconectado";
      const numero = data.numero || "";
      setStatusWhatsapp(status);
      setNumeroWhatsapp(numero);
      return { status, numero };
    } catch {
      setStatusWhatsapp("desconectado");
      setNumeroWhatsapp("");
      return { status: "desconectado", numero: "" };
    }
  };

  const fetchAtendimentos = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("atendimentos").select("*").eq("workspace_id", workspace.id.toString()).order("created_at", { ascending: false });
    setAtendimentos(data || []);
  };

  const fetchHistorico = async (numero: string) => {
    const { data } = await supabase.from("mensagens").select("*").eq("numero", numero).order("created_at", { ascending: true });
    setHistorico(data || []);
  };

  const selecionarAtendimento = (a: Atendimento) => {
    setAtendimentoAtivo(a);
    setHistorico([]);
    fetchHistorico(a.numero);
  };

  const atendimentosFiltrados = atendimentos
    .filter(a => {
      if (abaConversa === "abertos") return a.status === "aberto";
      if (abaConversa === "pendentes") return a.status === "em_atendimento";
      if (abaConversa === "resolvidos") return a.status === "resolvido";
      return true;
    })
    .filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.numero?.includes(busca));

  const enviarMensagem = async () => {
    if (!mensagem || !atendimentoAtivo) return;
    setEnviandoMsg(true);
    try {
      await wa("enviar", { numero: atendimentoAtivo.numero, mensagem, workspaceId: workspace?.id?.toString() || "1" });
      setMensagem("");
    } catch { alert("Erro ao enviar!"); }
    setEnviandoMsg(false);
  };

  const assumirChat = async (numero: string) => {
    try {
      await wa("assumir", { numero, workspaceId: workspace?.id?.toString() || "1" });
      fetchAtendimentos();
      alert("✅ Chat assumido! O bot parou de responder.");
    } catch { alert("Erro!"); }
  };

  const finalizarChat = async (numero: string) => {
    try {
      await wa("finalizar", { numero, workspaceId: workspace?.id?.toString() || "1" });
      fetchAtendimentos();
      setAtendimentoAtivo(null);
      setHistorico([]);
    } catch { alert("Erro!"); }
  };

  const devolverBot = async (numero: string) => {
    try {
      await wa("devolver", { numero, workspaceId: workspace?.id?.toString() || "1" });
      fetchAtendimentos();
      alert("✅ Devolvido ao bot!");
    } catch { alert("Erro!"); }
  };

  const salvarConexao = async () => {
    if (!formConexao.nome) { alert("Digite o nome!"); return; }
    if (formConexao.ia !== "nenhum" && !formConexao.apiKey && formConexao.ia !== "typebot") { alert("Digite a API Key da IA!"); return; }
    setSalvandoConexao(true);
    try {
      if (formConexao.ia !== "nenhum" && formConexao.ia !== "typebot" && formConexao.apiKey) {
        await wa("configurar-ia", {
          ia: formConexao.ia, apiKey: formConexao.apiKey,
          prompt: formConexao.prompt || "Você é um atendente virtual. Seja simpático e profissional.",
          workspaceId: workspace?.id?.toString() || "1",
          fila: formConexao.fila || "Fila Principal",
        });
      }
    } catch (e) { console.warn("IA será configurada ao conectar o QR."); }
    const novaConexao: Conexao = {
      id: conexoes.length + 1, nome: formConexao.nome, tipo: formConexao.tipo,
      status: "desconectado", numero: "Aguardando...", ia: formConexao.ia,
      fila: formConexao.fila || "Sem fila", apiKey: formConexao.apiKey,
      prompt: formConexao.prompt, typebotUrl: formConexao.typebotUrl, typebotKey: formConexao.typebotKey,
    };
    setConexoes([...conexoes, novaConexao]);
    setSalvandoConexao(false);
    setShowModalConexao(false);
    setFormConexao({ nome: "", tipo: "webjs", ia: "gpt", apiKey: "", prompt: "", typebotUrl: "", typebotKey: "", fila: "", grupo: "" });
  };

  const testarWABA = async () => {
    if (!formWABA.phoneNumberId || !formWABA.token) { alert("Preencha o Phone Number ID e o Token!"); return; }
    setTestendoWABA(true);
    setWabaTeste(null);
    try {
      const resp = await fetch(`/api/whatsapp?rota=waba/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: formWABA.phoneNumberId, token: formWABA.token }),
      });
      const data = await resp.json();
      setWabaTeste(data);
    } catch { setWabaTeste({ success: false, error: "Erro ao conectar!" }); }
    setTestendoWABA(false);
  };

  const salvarWABA = async () => {
    if (!formWABA.nome || !formWABA.phoneNumberId || !formWABA.token) { alert("Preencha nome, Phone Number ID e Token!"); return; }
    setSalvandoWABA(true);
    try {
      const wsId = workspace?.id?.toString() || "1";
      const webhookToken = formWABA.webhookToken || `wolf_${wsId}_${Date.now()}`;

      // Salva no servidor
      const resp = await fetch(`/api/whatsapp?rota=waba/salvar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: wsId,
          nome: formWABA.nome,
          phoneNumberId: formWABA.phoneNumberId,
          wabaId: formWABA.wabaId,
          token: formWABA.token,
          webhookToken,
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);

      // Configura IA se tiver
      if (formWABA.ia !== "nenhum" && formWABA.apiKey) {
        await wa("configurar-ia", {
          ia: formWABA.ia, apiKey: formWABA.apiKey,
          prompt: formWABA.prompt || "Você é um atendente virtual. Seja simpático e profissional.",
          workspaceId: wsId, fila: formWABA.fila || "Fila Principal",
        });
      }

      // Adiciona na lista de conexões
      setConexoes([...conexoes, {
        id: conexoes.length + 1, nome: formWABA.nome, tipo: "waba",
        status: "conectado", numero: wabaTeste?.nome || formWABA.phoneNumberId,
        ia: formWABA.ia, fila: formWABA.fila || "Fila Principal",
        apiKey: formWABA.apiKey, prompt: formWABA.prompt,
        typebotUrl: "", typebotKey: "",
        wabToken: formWABA.token, wabPhoneId: formWABA.phoneNumberId,
        wabaId: formWABA.wabaId, webhookToken,
      }]);

      setShowModalWABA(false);
      setFormWABA({ nome: "", phoneNumberId: "", wabaId: "", token: "", webhookToken: "", ia: "gpt", apiKey: "", prompt: "", fila: "" });
      setWabaTeste(null);
      alert("✅ API Meta configurada com sucesso!");
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoWABA(false);
  };

  const abrirQR = async (id: number) => {
    setQrConexaoId(id);
    setResetando(true);
    setShowModalQR(true);
    setStatusWhatsapp("desconectado");
    setNumeroWhatsapp("");
    const canal = conexoes.find(c => c.id === id);
    const wsId = workspace?.id?.toString() || "1";
    if (canal && canal.ia !== "nenhum" && canal.ia !== "typebot" && canal.apiKey) {
      try {
        await wa("configurar-ia", {
          ia: canal.ia, apiKey: canal.apiKey,
          prompt: canal.prompt || "Você é um atendente virtual.",
          workspaceId: wsId, fila: canal.fila || "Fila Principal",
        });
      } catch (e) { console.warn("Erro ao configurar IA:", e); }
    }
    try { await wa("resetar", { workspaceId: wsId }); } catch (e) { console.warn("Erro ao resetar:", e); }
    setConexoes(prev => prev.map(c => c.id === id ? { ...c, status: "desconectado", numero: "Aguardando QR..." } : c));
    setResetando(false);
    setIframeKey(prev => prev + 1);
  };

  const confirmarConexaoQR = () => {
    setConexoes(prev => prev.map(c => c.id === qrConexaoId ? { ...c, status: "conectado", numero: numeroWhatsapp || "Conectado via QR" } : c));
    setShowModalQR(false);
  };

  const excluirCanal = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esse canal?")) {
      setConexoes(prev => prev.filter(c => c.id !== id));
      setShowMenuEngrenagem(null);
    }
  };

  const tempoRelativo = (data: string) => {
    const diff = Math.floor((Date.now() - new Date(data).getTime()) / 1000 / 60);
    if (diff < 1) return "agora";
    if (diff < 60) return `${diff} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const horaMsg = (data: string) => new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const wsId = workspace?.id?.toString() || "1";

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>

      {/* SIDEBAR */}
      <div style={{ width: 240, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: 14 }}>Wolf Chatbot</span>
        </div>
        <div style={{ padding: "8px", flex: 1 }}>
          {menus.map((menu) => (
            <div key={menu.key}>
              <button onClick={() => setMenuAberto(menuAberto === menu.key ? null : menu.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: menuAberto === menu.key ? "#3b82f6" : "#9ca3af", fontSize: 13, fontWeight: "bold", textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>{menu.icon}</span> {menu.label}</span>
                <span style={{ fontSize: 10 }}>{menuAberto === menu.key ? "▼" : "▶"}</span>
              </button>
              {menuAberto === menu.key && (
                <div style={{ paddingLeft: 12, marginBottom: 4 }}>
                  {menu.subitens.map((sub) => (
                    <button key={sub.key} onClick={() => setAba(sub.key)} style={{ display: "block", width: "100%", padding: "8px 12px", background: aba === sub.key ? "#3b82f622" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === sub.key ? "#3b82f6" : "#6b7280", fontSize: 12, textAlign: "left", fontWeight: aba === sub.key ? "bold" : "normal" }}>{sub.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px", borderTop: "1px solid #1f2937" }}>
          <button onClick={() => router.push("/crm")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#6b7280", fontSize: 12 }}>← Voltar ao CRM</button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* CHAT */}
        {aba === "chat" && (
          <div style={{ display: "flex", flex: 1, height: "100vh" }}>
            <div style={{ width: 310, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>
                <input placeholder="Buscar por nome, número..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inputStyle, padding: "8px 12px", fontSize: 12 }} />
              </div>
              <div style={{ padding: "6px 12px", borderBottom: "1px solid #1f2937", display: "flex", gap: 6 }}>
                <button onClick={fetchAtendimentos} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔄</button>
                <button onClick={() => setShowFiltro(!showFiltro)} style={{ background: showFiltro ? "#3b82f622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showFiltro ? "#3b82f6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔍</button>
                <button onClick={() => setShowChatInterno(!showChatInterno)} style={{ background: showChatInterno ? "#8b5cf622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showChatInterno ? "#8b5cf6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>💭</button>
              </div>
              <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
                {[
                  { key: "abertos", label: "Abertos", color: "#3b82f6", count: atendimentos.filter(a => a.status === "aberto").length },
                  { key: "pendentes", label: "Pendentes", color: "#f59e0b", count: atendimentos.filter(a => a.status === "em_atendimento").length },
                  { key: "resolvidos", label: "Resolvidos", color: "#16a34a", count: atendimentos.filter(a => a.status === "resolvido").length },
                ].map((t) => (
                  <button key={t.key} onClick={() => setAbaConversa(t.key)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", color: abaConversa === t.key ? t.color : "#6b7280", fontSize: 11, fontWeight: "bold", cursor: "pointer", borderBottom: abaConversa === t.key ? `2px solid ${t.color}` : "2px solid transparent" }}>
                    {t.label}{t.count > 0 && <span style={{ background: t.color, color: "white", borderRadius: 8, padding: "0px 5px", fontSize: 9, marginLeft: 3 }}>{t.count}</span>}
                  </button>
                ))}
              </div>
              {showChatInterno ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937" }}>
                    <span style={{ color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>💭 Chat Interno</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {mensagensInternas.map((msg, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.de === "Você" ? "flex-end" : "flex-start" }}>
                        {msg.de !== "Você" && <span style={{ color: "#8b5cf6", fontSize: 10, marginBottom: 2, fontWeight: "bold" }}>{msg.de}</span>}
                        <div style={{ background: msg.de === "Você" ? "#8b5cf6" : "#1f2937", borderRadius: 10, padding: "8px 12px", maxWidth: "85%" }}>
                          <p style={{ color: "white", fontSize: 12, margin: 0 }}>{msg.texto}</p>
                          <p style={{ color: "#ddd6fe", fontSize: 10, margin: "3px 0 0 0", textAlign: "right" }}>{msg.hora}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 10, borderTop: "1px solid #1f2937", display: "flex", gap: 8 }}>
                    <input placeholder="Mensagem interna..." value={mensagemInterna} onChange={(e) => setMensagemInterna(e.target.value)} style={{ flex: 1, background: "#1f2937", border: "none", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12 }} />
                    <button style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>➤</button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {atendimentosFiltrados.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center" }}>
                      <p style={{ fontSize: 32, margin: "0 0 8px 0" }}>💬</p>
                      <p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum atendimento</p>
                    </div>
                  ) : atendimentosFiltrados.map((a) => (
                    <div key={a.id} onClick={() => selecionarAtendimento(a)} style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937", cursor: "pointer", background: atendimentoAtivo?.id === a.id ? "#1f2937" : "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</span>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{tempoRelativo(a.created_at)}</span>
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{a.fila}</span>
                        <span style={{ background: a.atendente === "BOT" ? "#8b5cf622" : "#16a34a22", color: a.atendente === "BOT" ? "#8b5cf6" : "#16a34a", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>
                          {a.atendente === "BOT" ? "🤖 BOT" : "👤 " + a.atendente}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {atendimentoAtivo ? (
                <>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #1f2937", background: "#111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>{atendimentoAtivo.nome}</h3>
                      <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{atendimentoAtivo.fila} • {atendimentoAtivo.numero}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {atendimentoAtivo.atendente === "BOT" && (
                        <button onClick={() => assumirChat(atendimentoAtivo.numero)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>👤 Assumir</button>
                      )}
                      {atendimentoAtivo.atendente !== "BOT" && (
                        <button onClick={() => devolverBot(atendimentoAtivo.numero)} style={{ background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🤖 Devolver ao Bot</button>
                      )}
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setShowTransferir(!showTransferir)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>↗️ Transferir</button>
                        {showTransferir && (
                          <div style={{ position: "absolute", top: 40, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 12, padding: 16, zIndex: 100, width: 360, display: "flex", gap: 16 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px 0" }}>Departamento</p>
                              {["Vendas", "Suporte", "Técnico"].map((dep) => (<button key={dep} onClick={() => { alert(`Transferido para ${dep}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>🏢 {dep}</button>))}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 8px 0" }}>Fila</p>
                              {["Fila Principal", "Fila Suporte"].map((f) => (<button key={f} onClick={() => { alert(`Devolvido para ${f}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>📋 {f}</button>))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => finalizarChat(atendimentoAtivo.numero)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✓ Finalizar</button>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "#0d0d0d", display: "flex", flexDirection: "column", gap: 10 }}>
                    {historico.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 40 }}>
                        <p style={{ color: "#374151", fontSize: 13 }}>Nenhuma mensagem ainda</p>
                      </div>
                    ) : historico.map((msg, i) => {
                      const isCliente = msg.de === "cliente";
                      const isBot = msg.de === "bot";
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: isCliente ? "flex-start" : "flex-end" }}>
                          <div style={{ maxWidth: "65%", padding: "10px 14px", borderRadius: isCliente ? "12px 12px 12px 2px" : "12px 12px 2px 12px", background: isCliente ? "#1f2937" : isBot ? "#1e3a2f" : "#1e2a4a" }}>
                            {!isCliente && <p style={{ color: isBot ? "#16a34a" : "#3b82f6", fontSize: 10, margin: "0 0 4px 0", fontWeight: "bold" }}>{isBot ? "🤖 BOT" : "👤 Você"}</p>}
                            <p style={{ color: "white", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{msg.mensagem}</p>
                            {msg.created_at && <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0 0", textAlign: "right" }}>{horaMsg(msg.created_at)}</p>}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  {showRespostas && (
                    <div style={{ background: "#1f2937", borderTop: "1px solid #374151", padding: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                      {respostasRapidas.map((r, i) => (
                        <button key={i} onClick={() => { setMensagem(r.mensagem); setShowRespostas(false); }} style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 10 }}>
                          <span style={{ color: "#3b82f6", fontWeight: "bold", minWidth: 60 }}>{r.atalho}</span>
                          <span style={{ color: "#9ca3af" }}>{r.mensagem}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ borderTop: "1px solid #1f2937", background: "#111", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => setShowRespostas(!showRespostas)} style={{ background: showRespostas ? "#3b82f622" : "#1f2937", color: showRespostas ? "#3b82f6" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>⚡</button>
                    <input placeholder="Digite uma mensagem ou / para respostas rápidas..." value={mensagem}
                      onChange={(e) => { setMensagem(e.target.value); if (e.target.value === "/") setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }}
                      onKeyDown={(e) => e.key === "Enter" && enviarMensagem()}
                      style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "10px 16px", color: "white", fontSize: 14 }} />
                    <button onClick={() => setGravando(!gravando)} style={{ background: gravando ? "#dc262622" : "#1f2937", color: gravando ? "#dc2626" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>{gravando ? "⏹" : "🎤"}</button>
                    <button onClick={enviarMensagem} disabled={enviandoMsg} style={{ background: enviandoMsg ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>
                      {enviandoMsg ? "..." : "➤"}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                  <span style={{ fontSize: 64 }}>💬</span>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>Selecione um atendimento</h2>
                  <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Clique em uma conversa para começar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONEXÕES */}
        {aba === "conexoes" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" }}>

            {/* Modal QR Code */}
            {showModalQR && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 440, border: "1px solid #1f2937", textAlign: "center" }}>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 8px 0" }}>📱 Conectar WhatsApp Web</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px 0" }}>Escaneie o QR Code com seu WhatsApp</p>
                  {resetando ? (
                    <div style={{ padding: 40 }}>
                      <p style={{ color: "#f59e0b", fontSize: 16 }}>⏳ Gerando QR Code...</p>
                    </div>
                  ) : (
                    <iframe key={iframeKey} src={`${WHATSAPP_URL}/qr?workspaceId=${wsId}&t=${Date.now()}`} style={{ width: "100%", height: 340, border: "none", borderRadius: 12, background: "#0a0a0a" }} />
                  )}
                  <div style={{ marginTop: 12 }}>
                    <p style={{ color: statusWhatsapp === "conectado" ? "#16a34a" : "#9ca3af", fontSize: 12, margin: 0 }}>
                      {statusWhatsapp === "conectado" ? "✅ Conectado!" : "⏳ Aguardando leitura..."}
                    </p>
                    {!!numeroWhatsapp && <p style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 0 0" }}>Número: {numeroWhatsapp}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
                    <button onClick={() => setShowModalQR(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Fechar</button>
                    <button onClick={confirmarConexaoQR} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Já Conectei!</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal API Meta WABA */}
            {showModalWABA && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 620, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>🔗 API Meta (WhatsApp Business)</h2>
                      <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>Conecte seu número oficial da Meta</p>
                    </div>
                    <button onClick={() => { setShowModalWABA(false); setWabaTeste(null); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                  </div>

                  {/* Dados da API */}
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ color: "#3b82f6", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>📋 Credenciais da API Meta</p>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nome do Canal *</label><input placeholder="Ex: WhatsApp Vendas" value={formWABA.nome} onChange={(e) => setFormWABA({ ...formWABA, nome: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Phone Number ID *</label><input placeholder="Ex: 123456789012345" value={formWABA.phoneNumberId} onChange={(e) => setFormWABA({ ...formWABA, phoneNumberId: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>WABA ID</label><input placeholder="Ex: 123456789012345" value={formWABA.wabaId} onChange={(e) => setFormWABA({ ...formWABA, wabaId: e.target.value })} style={inputStyle} /></div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Token de Acesso Permanente *</label><input placeholder="EAAxxxxxxxxxxxxx..." value={formWABA.token} onChange={(e) => setFormWABA({ ...formWABA, token: e.target.value })} style={inputStyle} type="password" /></div>
                    <button onClick={testarWABA} disabled={testandoWABA} style={{ background: testandoWABA ? "#1d4ed8" : "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                      {testandoWABA ? "⏳ Testando..." : "🔍 Testar Conexão"}
                    </button>
                    {wabaTeste && (
                      <div style={{ background: wabaTeste.success ? "#16a34a22" : "#dc262622", border: `1px solid ${wabaTeste.success ? "#16a34a33" : "#dc262633"}`, borderRadius: 8, padding: 12 }}>
                        <p style={{ color: wabaTeste.success ? "#16a34a" : "#dc2626", fontSize: 13, margin: 0, fontWeight: "bold" }}>
                          {wabaTeste.success ? `✅ Conectado! Número: ${wabaTeste.nome}` : `❌ Erro: ${wabaTeste.error}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Webhook */}
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ color: "#8b5cf6", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🔗 Configuração do Webhook</p>
                    <div style={{ background: "#111", borderRadius: 8, padding: 12 }}>
                      <p style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", margin: "0 0 6px 0" }}>URL do Webhook (cole na Meta)</p>
                      <p style={{ color: "#16a34a", fontSize: 13, fontWeight: "bold", margin: 0, wordBreak: "break-all" }}>
                        https://api.wolfgyn.com.br/api/webhook/meta
                      </p>
                    </div>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Token de Verificação do Webhook</label>
                      <input placeholder="Ex: meu_token_secreto_123" value={formWABA.webhookToken} onChange={(e) => setFormWABA({ ...formWABA, webhookToken: e.target.value })} style={inputStyle} />
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0 0" }}>Use esse token no campo "Verify Token" da Meta</p>
                    </div>
                  </div>

                  {/* IA */}
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ color: "#10b981", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🤖 Chatbot / IA</p>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>IA</label>
                      <select value={formWABA.ia} onChange={(e) => setFormWABA({ ...formWABA, ia: e.target.value, apiKey: "" })} style={inputStyle}>
                        <option value="gpt">💬 ChatGPT (OpenAI)</option>
                        <option value="claude">🤖 Claude AI</option>
                        <option value="gemini">✨ Gemini</option>
                        <option value="nenhum">🚫 Nenhum</option>
                      </select>
                    </div>
                    {formWABA.ia !== "nenhum" && (
                      <>
                        <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key da IA</label><input placeholder={formWABA.ia === "gpt" ? "sk-..." : formWABA.ia === "claude" ? "sk-ant-..." : "AIzaSy..."} value={formWABA.apiKey} onChange={(e) => setFormWABA({ ...formWABA, apiKey: e.target.value })} style={inputStyle} type="password" /></div>
                        <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt</label><textarea placeholder="Você é um atendente virtual..." value={formWABA.prompt} onChange={(e) => setFormWABA({ ...formWABA, prompt: e.target.value })} style={textareaStyle} /></div>
                      </>
                    )}
                    <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label><select value={formWABA.fila} onChange={(e) => setFormWABA({ ...formWABA, fila: e.target.value })} style={inputStyle}><option value="">Selecione...</option><option>Fila Principal</option><option>Fila Suporte</option></select></div>
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowModalWABA(false); setWabaTeste(null); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={salvarWABA} disabled={salvandoWABA} style={{ background: salvandoWABA ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                      {salvandoWABA ? "Salvando..." : "💾 Salvar e Ativar"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal escolha WhatsApp Web */}
            {showModalConexao && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000bb", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 580, border: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>📱 Adicionar Canal WhatsApp Web</h2>
                    <button onClick={() => setShowModalConexao(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                  </div>
                  <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nome do Canal *</label><input placeholder="Ex: WhatsApp Principal" value={formConexao.nome} onChange={(e) => setFormConexao({ ...formConexao, nome: e.target.value })} style={inputStyle} /></div>
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Chatbot / IA</label>
                    <select value={formConexao.ia} onChange={(e) => setFormConexao({ ...formConexao, ia: e.target.value, apiKey: "", prompt: "" })} style={inputStyle}>
                      <option value="gpt">💬 ChatGPT (OpenAI)</option>
                      <option value="claude">🤖 Claude AI (Anthropic)</option>
                      <option value="gemini">✨ Gemini (Google)</option>
                      <option value="typebot">🔗 Typebot</option>
                      <option value="nenhum">🚫 Nenhum</option>
                    </select>
                  </div>
                  {formConexao.ia !== "nenhum" && formConexao.ia !== "typebot" && (
                    <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key *</label><input placeholder={formConexao.ia === "gpt" ? "sk-..." : formConexao.ia === "claude" ? "sk-ant-..." : "AIzaSy..."} value={formConexao.apiKey} onChange={(e) => setFormConexao({ ...formConexao, apiKey: e.target.value })} style={inputStyle} type="password" /></div>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt do Sistema</label><textarea placeholder="Você é um atendente virtual..." value={formConexao.prompt} onChange={(e) => setFormConexao({ ...formConexao, prompt: e.target.value })} style={textareaStyle} /></div>
                    </div>
                  )}
                  {formConexao.ia === "typebot" && (
                    <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL do Typebot</label><input placeholder="https://typebot.io/meu-bot" value={formConexao.typebotUrl} onChange={(e) => setFormConexao({ ...formConexao, typebotUrl: e.target.value })} style={inputStyle} /></div>
                      <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sua-api-key" value={formConexao.typebotKey} onChange={(e) => setFormConexao({ ...formConexao, typebotKey: e.target.value })} style={inputStyle} type="password" /></div>
                    </div>
                  )}
                  <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fila</label><select value={formConexao.fila} onChange={(e) => setFormConexao({ ...formConexao, fila: e.target.value })} style={inputStyle}><option value="">Selecione...</option><option>Fila Principal</option><option>Fila Suporte</option></select></div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowModalConexao(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={salvarConexao} disabled={salvandoConexao} style={{ background: salvandoConexao ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                      {salvandoConexao ? "Salvando..." : "💾 Salvar Canal"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Header com dois botões */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📱 Conexões</h1>
                <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>Workspace: {workspace?.nome || "Carregando..."}</p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowModalConexao(true)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                  📱 WhatsApp Web (QR)
                </button>
                <button onClick={() => setShowModalWABA(true)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                  🔗 API Meta (WABA)
                </button>
              </div>
            </div>

            {/* Cards de conexões */}
            {conexoes.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
                <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>📱</p>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Nenhum canal conectado</h3>
                <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px 0" }}>Conecte seu WhatsApp via QR Code ou API Meta</p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={() => setShowModalConexao(true)} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>📱 WhatsApp Web</button>
                  <button onClick={() => setShowModalWABA(true)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>🔗 API Meta</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {conexoes.map((c) => (
                  <div key={c.id} style={{ background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${c.status === "conectado" ? "#16a34a44" : "#1f2937"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 28 }}>{c.tipo === "webjs" ? "📱" : "🔗"}</span>
                        <div>
                          <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{c.nome}</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.tipo === "webjs" ? "WhatsApp Web" : "API Meta (WABA)"}</p>
                        </div>
                      </div>
                      <span style={{ background: c.status === "conectado" ? "#16a34a22" : "#dc262622", color: c.status === "conectado" ? "#16a34a" : "#dc2626", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: "bold" }}>
                        {c.status === "conectado" ? "🟢 Conectado" : "🔴 Desconectado"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Número:</span><span style={{ color: "white", fontSize: 12 }}>{c.numero}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>IA:</span><span style={{ color: iaColor[c.ia] || "#6b7280", fontSize: 12, fontWeight: "bold" }}>{iaLabel[c.ia] || c.ia}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Fila:</span><span style={{ color: "#3b82f6", fontSize: 12 }}>{c.fila}</span></div>
                      {c.tipo === "waba" && c.webhookToken && (
                        <div style={{ background: "#1f2937", borderRadius: 6, padding: "8px 10px", marginTop: 4 }}>
                          <p style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", margin: "0 0 4px 0" }}>Webhook Token</p>
                          <p style={{ color: "#8b5cf6", fontSize: 11, margin: 0, wordBreak: "break-all" }}>{c.webhookToken}</p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {c.tipo === "webjs" && (
                        c.status === "desconectado" ? (
                          <button onClick={() => abrirQR(c.id)} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "9px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📷 Escanear QR</button>
                        ) : (
                          <>
                            <button disabled style={{ flex: 1, background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "9px", fontSize: 12, cursor: "default", fontWeight: "bold" }}>✅ Conectado</button>
                            <button onClick={() => setConexoes(prev => prev.map(con => con.id === c.id ? { ...con, status: "desconectado", numero: "Aguardando..." } : con))} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "9px 14px", fontSize: 12, cursor: "pointer" }}>Desconectar</button>
                          </>
                        )
                      )}
                      {c.tipo === "waba" && (
                        <button disabled style={{ flex: 1, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "9px", fontSize: 12, cursor: "default", fontWeight: "bold" }}>🔗 API Ativa</button>
                      )}
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setShowMenuEngrenagem(showMenuEngrenagem === c.id ? null : c.id)} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", fontSize: 14, cursor: "pointer" }}>⚙️</button>
                        {showMenuEngrenagem === c.id && (
                          <div style={{ position: "absolute", bottom: 44, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, overflow: "hidden", zIndex: 100, minWidth: 160 }}>
                            {c.tipo === "webjs" && <button onClick={() => { setShowMenuEngrenagem(null); abrirQR(c.id); }} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>📷 Novo QR Code</button>}
                            {c.tipo === "waba" && <button onClick={() => { setShowMenuEngrenagem(null); setFormWABA({ nome: c.nome, phoneNumberId: c.wabPhoneId || "", wabaId: c.wabaId || "", token: c.wabToken || "", webhookToken: c.webhookToken || "", ia: c.ia, apiKey: c.apiKey, prompt: c.prompt, fila: c.fila }); setShowModalWABA(true); }} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>✏️ Editar API</button>}
                            <button onClick={() => excluirCanal(c.id)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 16px", color: "#dc2626", fontSize: 13, cursor: "pointer", textAlign: "left" }}>🗑️ Excluir Canal</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === "dashboard_atendimentos" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Dashboard de Atendimentos</h1>
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { label: "Abertos", value: atendimentos.filter(a => a.status === "aberto").length, color: "#3b82f6", icon: "💬" },
                { label: "Em Atendimento", value: atendimentos.filter(a => a.status === "em_atendimento").length, color: "#f59e0b", icon: "👤" },
                { label: "Resolvidos", value: atendimentos.filter(a => a.status === "resolvido").length, color: "#16a34a", icon: "✅" },
                { label: "Total", value: atendimentos.length, color: "#8b5cf6", icon: "📊" },
              ].map((card) => (
                <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px 0", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                  <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "empresas" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Empresas</h1></div>)}
        {aba === "filas" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Filas</h1></div>)}
        {aba === "fluxos" && (
  <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center", justifyContent: "center", flex: 1 }}>
    <span style={{ fontSize: 64 }}>🤖</span>
    <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Chatbot / Fluxos</h1>
    <p style={{ color: "#6b7280", fontSize: 14, margin: 0, textAlign: "center" }}>Crie fluxos de atendimento automático sem precisar de IA</p>
    <button
      onClick={() => router.push("/fluxos")}
      style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 16, cursor: "pointer", fontWeight: "bold" }}
    >
      🤖 Abrir Editor de Fluxos →
    </button>
  </div>
)}
        {aba === "usuarios" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Usuários</h1></div>)}
        {aba === "departamentos" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Departamentos</h1></div>)}
        {aba === "roleta" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Roleta de Distribuição</h1></div>)}
        {aba === "relatorios" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Relatórios</h1></div>)}

        {aba === "etiquetas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Etiquetas</h1>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Etiqueta</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[{ nome: "Lead Quente", cor: "#dc2626" }, { nome: "Lead Frio", cor: "#3b82f6" }, { nome: "Agendado", cor: "#f59e0b" }, { nome: "Fechado", cor: "#16a34a" }, { nome: "Retornar", cor: "#8b5cf6" }].map((e, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 10, padding: "12px 20px", border: `2px solid ${e.cor}44`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: e.cor }} />
                  <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{e.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(aba === "claude" || aba === "gpt" || aba === "typebot") && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>{aba === "claude" ? "🤖 Claude AI" : aba === "gpt" ? "💬 ChatGPT" : "🔗 Typebot"}</h1>
            <div style={{ background: "#111", borderRadius: 12, padding: 32, border: "1px solid #1f2937", maxWidth: 600, display: "flex", flexDirection: "column", gap: 16 }}>
              {aba === "gpt" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sk-..." style={inputStyle} type="password" /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Modelo</label><select style={inputStyle}><option>gpt-4o</option><option>gpt-4o-mini</option></select></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt</label><textarea placeholder="Você é um atendente virtual..." style={textareaStyle} /></div></>)}
              {aba === "claude" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sk-ant-..." style={inputStyle} type="password" /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt</label><textarea placeholder="Você é um atendente virtual..." style={textareaStyle} /></div></>)}
              {aba === "typebot" && (<><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL</label><input placeholder="https://typebot.io/..." style={inputStyle} /></div><div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder="sua-api-key" style={inputStyle} type="password" /></div></>)}
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
            </div>
          </div>
        )}

        {aba === "respostas_rapidas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Respostas Rápidas</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 0" }}>Digite / no chat para usar</p></div>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Nova Resposta</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {respostasRapidas.map((r, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 10, padding: "16px 20px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, padding: "4px 12px", borderRadius: 8, fontWeight: "bold", whiteSpace: "nowrap" }}>{r.atalho}</span>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, flex: 1 }}>{r.mensagem}</p>
                  <button style={{ background: "none", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}