"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";

type Atendimento = { id: number; created_at: string; numero: string; nome: string; mensagem: string; status: string; fila: string; atendente: string; workspace_id: string; };
type Mensagem = { id?: number; created_at?: string; numero: string; mensagem: string; de: string; workspace_id?: string; };
type Conexao = { id: number; nome: string; tipo: string; status: string; numero: string; modo: string; ia: string; fluxo_id: string; fluxo_nome: string; fila: string; api_key: string; prompt: string; parar_se_atendente: boolean; wab_token?: string; wab_phone_id?: string; waba_id?: string; webhook_token?: string; workspace_id: string; };
type FluxoItem = { id: number; nome: string; ativo: boolean; };

function ChatbotInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") || "chat";
  const setAba = (novaAba: string) => router.push(`/chatbot?aba=${novaAba}`);
  const { workspace } = useWorkspace();
const wsId = workspace?.username || workspace?.id?.toString() || "1";
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [menuAberto, setMenuAberto] = useState<string | null>("atendimentos");
  const [gravando, setGravando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [abaConversa, setAbaConversa] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Atendimento | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [showModalQR, setShowModalQR] = useState(false);
  const [showMenuEngrenagem, setShowMenuEngrenagem] = useState<number | null>(null);
  const [qrConexaoId, setQrConexaoId] = useState<number | null>(null);
  const [qrWsId, setQrWsId] = useState("1");
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrPolling, setQrPolling] = useState(false);
  const [qrConectado, setQrConectado] = useState(false);
  const [qrNumero, setQrNumero] = useState("");
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [fluxos, setFluxos] = useState<FluxoItem[]>([]);
  const [showModalNovoCanal, setShowModalNovoCanal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [testandoWABA, setTestandoWABA] = useState(false);
  const [wabaTeste, setWabaTeste] = useState<{ success: boolean; nome?: string; error?: string } | null>(null);

  const formInicial = { nome: "", tipo: "webjs", phoneNumberId: "", wabaId: "", token: "", webhookToken: "", modo: "nenhum", ia: "gpt", apiKey: "", prompt: "", fluxoId: "", fila: "Fila Principal", pararSeAtendente: true };
  const [form, setForm] = useState(formInicial);

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    { key: "automacao", icon: "🤖", label: "Automação", subitens: [{ key: "fluxos", label: "Chatbot / Fluxos" }, { key: "claude", label: "Claude AI" }, { key: "gpt", label: "ChatGPT" }] },
    { key: "cadastro", icon: "📋", label: "Cadastro", subitens: [{ key: "usuarios", label: "Usuários" }, { key: "departamentos", label: "Departamentos" }, { key: "etiquetas", label: "Etiquetas" }] },
    { key: "configuracoes", icon: "⚙️", label: "Configurações", subitens: [{ key: "roleta", label: "Roleta" }, { key: "relatorios", label: "Relatórios" }, { key: "respostas_rapidas", label: "Respostas Rápidas" }] },
  ];

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };
  const TA = { ...IS, height: 90, resize: "vertical" as const };

  useEffect(() => {
    if (!workspace?.id) return;
    fetchAtendimentos();
    fetchConexoes();
    fetchFluxos();
    const ch = supabase.channel("atendimentos_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => fetchAtendimentos())
      .subscribe();
    const ch2 = supabase.channel("conexoes_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes" }, () => fetchConexoes())
      .subscribe();
    const pollingConexoes = setInterval(async () => {
      try {
        const resp = await fetch(`https://api.wolfgyn.com.br/status`);
        const data = await resp.json();
        const sessoes = data.sessoes || [];
        for (const conexao of conexoes) {
          const sessao = sessoes.find((s: any) => s.workspaceId === conexao.workspace_id);
          if (!sessao || sessao.status === "desconectado") {
            await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", conexao.id);
          }
        }
        fetchConexoes();
      } catch (e) {}
    }, 30000);
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); clearInterval(pollingConexoes); };
  }, [workspace]);

  useEffect(() => {
    if (!atendimentoAtivo) return;
    setHistorico([]);
    fetchHistorico(atendimentoAtivo.numero);
    const num = atendimentoAtivo.numero;
    const ch = supabase.channel(`msgs_${num}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const m = payload.new as Mensagem;
        if (m.numero === num) { setHistorico(p => [...p, m]); setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [atendimentoAtivo?.numero]);

  useEffect(() => { setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [historico]);

  // ── POLLING QR ──
  useEffect(() => {
    if (!qrPolling || !showModalQR) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`https://api.wolfgyn.com.br/qr-data?workspaceId=${qrWsId}`);
        const data = await resp.json();
        if (data.qr) setQrImageUrl(data.qr);
        if (data.status === "conectado") {
          setQrConectado(true);
          setQrNumero(data.numero || "");
          setQrPolling(false);
          if (qrConexaoId) {
            await supabase.from("conexoes").update({ status: "conectado", numero: data.numero || "Conectado" }).eq("id", qrConexaoId);
            fetchConexoes();
          }
          setShowModalQR(false);
          setQrPolling(false);
          await fetchConexoes();
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [qrPolling, showModalQR, qrWsId, qrConexaoId]);

  const fetchAtendimentos = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("atendimentos").select("*").eq("workspace_id", workspace.username || workspace.id.toString()).order("created_at", { ascending: false });
    setAtendimentos(data || []);
  };

  const fetchConexoes = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("conexoes").select("*").eq("workspace_id", workspace.username || workspace.id.toString()).order("created_at", { ascending: false });
    setConexoes(data || []);
  };

  const fetchFluxos = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase.from("fluxos").select("id, nome, ativo").eq("workspace_id", workspace.username || workspace.id.toString()).order("created_at", { ascending: false });
    setFluxos(data || []);
  };

  const fetchHistorico = async (numero: string) => {
    const { data } = await supabase.from("mensagens").select("*").eq("numero", numero).order("created_at", { ascending: true });
    setHistorico(data || []);
  };

  const atendimentosFiltrados = atendimentos
    .filter(a => abaConversa === "abertos" ? a.status === "aberto" : abaConversa === "pendentes" ? a.status === "pendente" : abaConversa === "resolvidos" ? a.status === "resolvido" : true)
    .filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.numero?.includes(busca));

  const enviarMensagem = async () => {
    if (!mensagem || !atendimentoAtivo) return;
    setEnviandoMsg(true);
    try { await wa("enviar", { numero: atendimentoAtivo.numero, mensagem, workspaceId: wsId }); setMensagem(""); }
    catch { alert("Erro ao enviar!"); }
    setEnviandoMsg(false);
  };

  const assumirChat = async (numero: string) => {
    await wa("assumir", { numero, workspaceId: wsId });
    fetchAtendimentos();
  };

  const finalizarChat = async (numero: string) => {
    await wa("finalizar", { numero, workspaceId: wsId });
    fetchAtendimentos(); setAtendimentoAtivo(null); setHistorico([]);
  };

  const devolverBot = async (numero: string) => {
    await wa("devolver", { numero, workspaceId: wsId });
    fetchAtendimentos();
  };

  const testarWABA = async () => {
    if (!form.phoneNumberId || !form.token) { alert("Preencha Phone Number ID e Token!"); return; }
    setTestandoWABA(true); setWabaTeste(null);
    try {
      const resp = await fetch(`/api/whatsapp?rota=waba/testar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumberId: form.phoneNumberId, token: form.token }) });
      setWabaTeste(await resp.json());
    } catch { setWabaTeste({ success: false, error: "Erro ao conectar!" }); }
    setTestandoWABA(false);
  };

  const abrirEditar = (c: Conexao) => {
    setEditandoId(c.id);
    setForm({
      nome: c.nome, tipo: c.tipo, phoneNumberId: c.wab_phone_id || "", wabaId: c.waba_id || "",
      token: c.wab_token || "", webhookToken: c.webhook_token || "", modo: c.modo, ia: c.ia,
      apiKey: c.api_key || "", prompt: c.prompt || "", fluxoId: c.fluxo_id || "",
      fila: c.fila, pararSeAtendente: c.parar_se_atendente,
    });
    fetchFluxos();
    setShowModalNovoCanal(true);
    setShowMenuEngrenagem(null);
  };

  const salvarCanal = async () => {
    if (!form.nome.trim()) { alert("Digite o nome do canal!"); return; }
    if (form.tipo === "waba" && (!form.phoneNumberId || !form.token)) { alert("Preencha Phone Number ID e Token!"); return; }
    if (form.modo === "ia" && !form.apiKey) { alert("Digite a API Key da IA!"); return; }
    setSalvandoCanal(true);
    try {
      const fluxoSel = fluxos.find(f => f.id.toString() === form.fluxoId);
      await wa("configurar-ia", { ia: form.ia, apiKey: form.apiKey || "", prompt: form.prompt || "Você é um atendente virtual.", workspaceId: wsId, fila: form.fila, modo: form.modo });
      const payload = {
        nome: form.nome, modo: form.modo, ia: form.ia,
        fluxo_id: form.fluxoId, fluxo_nome: fluxoSel?.nome || "",
        fila: form.fila, api_key: form.apiKey, prompt: form.prompt,
        parar_se_atendente: form.pararSeAtendente,
      };
      if (editandoId) {
        await supabase.from("conexoes").update(payload).eq("id", editandoId);
        setEditandoId(null);
        alert("✅ Canal atualizado!");
      } else {
        if (form.tipo === "waba") {
          const webhookToken = form.webhookToken || `wolf_${wsId}_${Date.now()}`;
          const resp = await fetch(`/api/whatsapp?rota=waba/salvar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: wsId, nome: form.nome, phoneNumberId: form.phoneNumberId, wabaId: form.wabaId, token: form.token, webhookToken }) });
          const vpsData = await resp.json();
          if (!vpsData.success) throw new Error(vpsData.error);
          await supabase.from("conexoes").insert([{ workspace_id: wsId, tipo: "waba", status: "conectado", numero: wabaTeste?.nome || form.phoneNumberId, wab_token: form.token, wab_phone_id: form.phoneNumberId, waba_id: form.wabaId, webhook_token: webhookToken, ...payload }]);
        } else {
          await supabase.from("conexoes").insert([{ workspace_id: wsId, tipo: "webjs", status: "desconectado", numero: "", ...payload }]);
        }
        alert("✅ Canal criado com sucesso!");
      }
      await fetchConexoes();
      setShowModalNovoCanal(false);
      setForm(formInicial);
      setWabaTeste(null);
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoCanal(false);
  };

  const abrirQR = async (id: number) => {
    const wsIdAtual = wsId;
    setQrWsId(wsIdAtual);
    setQrConexaoId(id);
    setResetando(true);
    setShowModalQR(true);
    setQrImageUrl("");
    setQrConectado(false);
    setQrNumero("");
    const canal = conexoes.find(c => c.id === id);
    if (canal?.modo === "ia" && canal.api_key) {
      try { await wa("configurar-ia", { ia: canal.ia, apiKey: canal.api_key, prompt: canal.prompt || "Você é um atendente virtual.", workspaceId: wsIdAtual, fila: canal.fila }); } catch (e) {}
    }
    try { await wa("resetar", { workspaceId: wsIdAtual }); } catch (e) {}
    await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", id);
    await fetchConexoes();
    setResetando(false);
    setQrPolling(true);
  };

  const excluirCanal = async (id: number) => {
    if (!confirm("Excluir esse canal?")) return;
    await supabase.from("conexoes").delete().eq("id", id);
    await fetchConexoes();
    setShowMenuEngrenagem(null);
  };

  const tempoRelativo = (data: string) => { const d = Math.floor((Date.now() - new Date(data).getTime()) / 60000); return d < 1 ? "agora" : d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}d`; };
  const horaMsg = (data: string) => new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const modoColor: Record<string,string> = { nenhum: "#6b7280", ia: "#10b981", fluxo: "#8b5cf6" };
  const iaLabel: Record<string,string> = { gpt: "ChatGPT", claude: "Claude AI", gemini: "Gemini", deepseek: "DeepSeek" };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{ width: 44, height: 24, background: value ? "#16a34a" : "#374151", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s" }} />
    </button>
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0a0a0a" }}>

      {/* SIDEBAR */}
      <div style={{ width: 240, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: 14 }}>Wolf Chatbot</span>
        </div>
        <div style={{ padding: 8, flex: 1 }}>
          {menus.map(menu => (
            <div key={menu.key}>
              <button onClick={() => setMenuAberto(menuAberto === menu.key ? null : menu.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: menuAberto === menu.key ? "#3b82f6" : "#9ca3af", fontSize: 13, fontWeight: "bold", textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{menu.icon} {menu.label}</span>
                <span style={{ fontSize: 10 }}>{menuAberto === menu.key ? "▼" : "▶"}</span>
              </button>
              {menuAberto === menu.key && (
                <div style={{ paddingLeft: 12, marginBottom: 4 }}>
                  {menu.subitens.map(sub => (
                    <button key={sub.key} onClick={() => router.push(`/chatbot?aba=${sub.key}`)} style={{ display: "block", width: "100%", padding: "8px 12px", background: aba === sub.key ? "#3b82f622" : "none", border: "none", borderRadius: 8, cursor: "pointer", color: aba === sub.key ? "#3b82f6" : "#6b7280", fontSize: 12, textAlign: "left", fontWeight: aba === sub.key ? "bold" : "normal" }}>{sub.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #1f2937" }}>
          <button onClick={() => router.push("/crm")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#6b7280", fontSize: 12 }}>← Voltar ao CRM</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* CHAT */}
        {aba === "chat" && (
          <div style={{ display: "flex", flex: 1, height: "100vh" }}>
            <div style={{ width: 310, background: "#111", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>
                <input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...IS, padding: "8px 12px", fontSize: 12 }} />
              </div>
              <div style={{ padding: "6px 12px", borderBottom: "1px solid #1f2937", display: "flex", gap: 6 }}>
                <button onClick={fetchAtendimentos} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>🔄</button>
                <button onClick={() => setShowChatInterno(!showChatInterno)} style={{ background: showChatInterno ? "#8b5cf622" : "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: "5px 9px", color: showChatInterno ? "#8b5cf6" : "#9ca3af", cursor: "pointer", fontSize: 14 }}>💭</button>
              </div>
              <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
                {[{ key: "abertos", label: "Abertos", color: "#3b82f6", count: atendimentos.filter(a => a.status === "aberto").length },
                  { key: "pendentes", label: "Pendentes", color: "#f59e0b", count: atendimentos.filter(a => a.status === "pendente").length },
                  { key: "resolvidos", label: "Resolvidos", color: "#16a34a", count: atendimentos.filter(a => a.status === "resolvido").length }
                ].map(t => (
                  <button key={t.key} onClick={() => setAbaConversa(t.key)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", color: abaConversa === t.key ? t.color : "#6b7280", fontSize: 11, fontWeight: "bold", cursor: "pointer", borderBottom: abaConversa === t.key ? `2px solid ${t.color}` : "2px solid transparent" }}>
                    {t.label}{t.count > 0 && <span style={{ background: t.color, color: "white", borderRadius: 8, padding: "0 5px", fontSize: 9, marginLeft: 3 }}>{t.count}</span>}
                  </button>
                ))}
              </div>
              {showChatInterno ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937" }}><span style={{ color: "#8b5cf6", fontSize: 13, fontWeight: "bold" }}>💭 Chat Interno</span></div>
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
                    <input placeholder="Mensagem interna..." value={mensagemInterna} onChange={e => setMensagemInterna(e.target.value)} style={{ flex: 1, background: "#1f2937", border: "none", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12 }} />
                    <button style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>➤</button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {atendimentosFiltrados.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center" }}><p style={{ fontSize: 32, margin: "0 0 8px" }}>💬</p><p style={{ color: "#6b7280", fontSize: 13 }}>Nenhum atendimento</p></div>
                  ) : atendimentosFiltrados.map(a => (
                    <div key={a.id} onClick={() => { setAtendimentoAtivo(a); setHistorico([]); fetchHistorico(a.numero); }} style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937", cursor: "pointer", background: atendimentoAtivo?.id === a.id ? "#1f2937" : "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>{a.nome}</span>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{tempoRelativo(a.created_at)}</span>
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{a.fila}</span>
                        <span style={{ background: a.atendente === "BOT" ? "#8b5cf622" : "#16a34a22", color: a.atendente === "BOT" ? "#8b5cf6" : "#16a34a", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{a.atendente === "BOT" ? "🤖 BOT" : "👤 " + a.atendente}</span>
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
                      {(atendimentoAtivo.atendente === "BOT" || atendimentoAtivo.status === "pendente") && <button onClick={() => assumirChat(atendimentoAtivo.numero)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>👤 Assumir</button>}
                      {atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && <button onClick={() => devolverBot(atendimentoAtivo.numero)} style={{ background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🤖 Devolver ao Bot</button>}
                      {atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && <button onClick={() => window.open(`/proposta?nome=${encodeURIComponent(atendimentoAtivo.nome)}&numero=${encodeURIComponent(atendimentoAtivo.numero.replace(/\D/g, ""))}`, "_blank")} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>💰 Finalizar Venda</button>}
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setShowTransferir(!showTransferir)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>↗️ Transferir</button>
                        {showTransferir && (
                          <div style={{ position: "absolute", top: 40, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 12, padding: 16, zIndex: 100, width: 220 }}>
                            {["Fila Principal", "Fila Suporte", "Fila Vendas"].map(f => <button key={f} onClick={() => { alert(`Transferido para ${f}`); setShowTransferir(false); }} style={{ display: "block", width: "100%", background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>📋 {f}</button>)}
                          </div>
                        )}
                      </div>
                      <button onClick={() => finalizarChat(atendimentoAtivo.numero)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>✓ Finalizar</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "#0d0d0d", display: "flex", flexDirection: "column", gap: 10 }}>
                    {historico.length === 0
                      ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ color: "#374151", fontSize: 13 }}>Nenhuma mensagem ainda</p></div>
                      : historico.map((msg, i) => {
                          const isCliente = msg.de === "cliente"; const isBot = msg.de === "bot";
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: isCliente ? "flex-start" : "flex-end" }}>
                              <div style={{ maxWidth: "65%", padding: "10px 14px", borderRadius: isCliente ? "12px 12px 12px 2px" : "12px 12px 2px 12px", background: isCliente ? "#1f2937" : isBot ? "#1e3a2f" : "#1e2a4a" }}>
                                {!isCliente && <p style={{ color: isBot ? "#16a34a" : "#3b82f6", fontSize: 10, margin: "0 0 4px", fontWeight: "bold" }}>{isBot ? "🤖 BOT" : "👤 Você"}</p>}
                                <p style={{ color: "white", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{msg.mensagem}</p>
                                {msg.created_at && <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", textAlign: "right" }}>{horaMsg(msg.created_at)}</p>}
                              </div>
                            </div>
                          );
                        })}
                    <div ref={chatBottomRef} />
                  </div>
                  {showRespostas && (
                    <div style={{ background: "#1f2937", borderTop: "1px solid #374151", padding: 12, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {respostasRapidas.map((r, i) => <button key={i} onClick={() => { setMensagem(r.mensagem); setShowRespostas(false); }} style={{ background: "#111", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 10 }}><span style={{ color: "#3b82f6", fontWeight: "bold", minWidth: 60 }}>{r.atalho}</span><span style={{ color: "#9ca3af" }}>{r.mensagem}</span></button>)}
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid #1f2937", background: "#111", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => setShowRespostas(!showRespostas)} style={{ background: showRespostas ? "#3b82f622" : "#1f2937", color: showRespostas ? "#3b82f6" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>⚡</button>
                    <input placeholder="Digite uma mensagem ou / para respostas rápidas..." value={mensagem}
                      onChange={e => { setMensagem(e.target.value); if (e.target.value === "/") setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }}
                      onKeyDown={e => e.key === "Enter" && enviarMensagem()}
                      style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "10px 16px", color: "white", fontSize: 14 }} />
                    <button onClick={() => setGravando(!gravando)} style={{ background: gravando ? "#dc262622" : "#1f2937", color: gravando ? "#dc2626" : "#6b7280", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>{gravando ? "⏹" : "🎤"}</button>
                    <button onClick={enviarMensagem} disabled={enviandoMsg} style={{ background: enviandoMsg ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>{enviandoMsg ? "..." : "➤"}</button>
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

            {/* Modal QR */}
            {showModalQR && (
              <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 400, border: "1px solid #1f2937", textAlign: "center" }}>
                  <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 8px" }}>📱 Conectar WhatsApp</h2>
                  <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Escaneie o QR Code com seu WhatsApp</p>
                  <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    {resetando ? (
                      <p style={{ color: "#f59e0b", fontSize: 14 }}>⏳ Iniciando sessão...</p>
                    ) : qrConectado ? (
                      <div><p style={{ fontSize: 48, margin: "0 0 8px" }}>✅</p><p style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold", margin: 0 }}>WhatsApp Conectado!</p>{qrNumero && <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0 0" }}>{qrNumero}</p>}</div>
                    ) : qrImageUrl ? (
                      <img src={qrImageUrl} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 8 }} />
                    ) : (
                      <div><p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 8px" }}>⏳ Gerando QR Code...</p><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>Aguarde alguns segundos</p></div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={() => { setShowModalQR(false); setQrPolling(false); setQrImageUrl(""); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Fechar</button>
                    {!qrConectado && (
                      <button onClick={async () => {
                        if (qrConexaoId) {
                          await supabase.from("conexoes").update({ status: "conectado", numero: qrNumero || "Conectado" }).eq("id", qrConexaoId);
                          await fetchConexoes();
                        }
                        setShowModalQR(false); setQrPolling(false);
                      }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Já Conectei!</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Novo Canal / Editar */}
            {showModalNovoCanal && (
              <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#111", borderRadius: 16, width: "100%", maxWidth: 640, border: "1px solid #1f2937", display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden" }}>
                  <div style={{ padding: "20px 28px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{editandoId ? "✏️ Editar Canal" : "➕ Novo Canal"}</h2>
                      <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{editandoId ? "Altere as configurações do canal" : "Configure o canal e como ele vai atender seus leads"}</p>
                    </div>
                    <button onClick={() => { setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null); setEditandoId(null); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

                    {!editandoId && (
                      <div>
                        <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>1. Tipo de Canal</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          {[{ key: "webjs", icon: "📱", label: "WhatsApp Web", desc: "Conexão via QR Code — gratuita" }, { key: "waba", icon: "🔗", label: "API Meta (WABA)", desc: "API oficial do WhatsApp Business" }].map(t => (
                            <button key={t.key} onClick={() => setForm(p => ({ ...p, tipo: t.key }))} style={{ background: form.tipo === t.key ? "#16a34a22" : "#1f2937", border: `2px solid ${form.tipo === t.key ? "#16a34a" : "#374151"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
                              <p style={{ color: "white", fontSize: 20, margin: "0 0 4px" }}>{t.icon}</p>
                              <p style={{ color: form.tipo === t.key ? "#16a34a" : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 2px" }}>{t.label}</p>
                              <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{t.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>{editandoId ? "1" : "2"}. Nome do Canal</p>
                      <input placeholder="Ex: WhatsApp Vendas..." value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} style={IS} />
                    </div>

                    {!editandoId && form.tipo === "waba" && (
                      <div>
                        <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>3. Credenciais da API Meta</p>
                        <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Phone Number ID *</label><input placeholder="123456789012345" value={form.phoneNumberId} onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))} style={IS} /></div>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>WABA ID</label><input placeholder="123456789012345" value={form.wabaId} onChange={e => setForm(p => ({ ...p, wabaId: e.target.value }))} style={IS} /></div>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Token Permanente *</label><input type="password" placeholder="EAAxxxxx..." value={form.token} onChange={e => setForm(p => ({ ...p, token: e.target.value }))} style={IS} /></div>
                          <button onClick={testarWABA} disabled={testandoWABA} style={{ background: testandoWABA ? "#1d4ed8" : "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: 9, fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{testandoWABA ? "⏳ Testando..." : "🔍 Testar Conexão"}</button>
                          {wabaTeste && <div style={{ background: wabaTeste.success ? "#16a34a22" : "#dc262622", border: `1px solid ${wabaTeste.success ? "#16a34a33" : "#dc262633"}`, borderRadius: 8, padding: 10 }}><p style={{ color: wabaTeste.success ? "#16a34a" : "#dc2626", fontSize: 13, margin: 0, fontWeight: "bold" }}>{wabaTeste.success ? `✅ ${wabaTeste.nome}` : `❌ ${wabaTeste.error}`}</p></div>}
                          <div style={{ background: "#111", borderRadius: 8, padding: 12 }}>
                            <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase" }}>URL do Webhook (cole na Meta)</p>
                            <p style={{ color: "#16a34a", fontSize: 12, fontWeight: "bold", margin: 0, wordBreak: "break-all" }}>https://api.wolfgyn.com.br/webhook/meta</p>
                          </div>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Token de Verificação</label><input placeholder="meu_token_secreto" value={form.webhookToken} onChange={e => setForm(p => ({ ...p, webhookToken: e.target.value }))} style={IS} /></div>
                        </div>
                      </div>
                    )}

                    <div>
                      <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                        {editandoId ? "2" : form.tipo === "waba" ? "4" : "3"}. Automação
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                        {[{ key: "nenhum", icon: "🚫", label: "Sem automação", desc: "Só humano" }, { key: "ia", icon: "🤖", label: "Usar IA", desc: "Claude, GPT..." }, { key: "fluxo", icon: "🔀", label: "Usar Fluxo", desc: "Chatbot visual" }].map(m => (
                          <button key={m.key} onClick={() => setForm(p => ({ ...p, modo: m.key }))} style={{ background: form.modo === m.key ? "#8b5cf622" : "#1f2937", border: `2px solid ${form.modo === m.key ? "#8b5cf6" : "#374151"}`, borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center" }}>
                            <p style={{ color: "white", fontSize: 22, margin: "0 0 4px" }}>{m.icon}</p>
                            <p style={{ color: form.modo === m.key ? "#8b5cf6" : "white", fontSize: 12, fontWeight: "bold", margin: "0 0 2px" }}>{m.label}</p>
                            <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{m.desc}</p>
                          </button>
                        ))}
                      </div>
                      {form.modo === "ia" && (
                        <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <p style={{ color: "#10b981", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🤖 Configurar IA</p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {[{ key: "gpt", label: "💬 ChatGPT", sub: "OpenAI", cor: "#10b981" }, { key: "claude", label: "🧠 Claude AI", sub: "Anthropic", cor: "#8b5cf6" }, { key: "gemini", label: "✨ Gemini", sub: "Google", cor: "#f59e0b" }, { key: "deepseek", label: "🔍 DeepSeek", sub: "DeepSeek AI", cor: "#3b82f6" }].map(ia => (
                              <button key={ia.key} onClick={() => setForm(p => ({ ...p, ia: ia.key, apiKey: "" }))} style={{ background: form.ia === ia.key ? `${ia.cor}22` : "#111", border: `2px solid ${form.ia === ia.key ? ia.cor : "#374151"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                                <p style={{ color: form.ia === ia.key ? ia.cor : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 2px" }}>{ia.label}</p>
                                <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{ia.sub}</p>
                              </button>
                            ))}
                          </div>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>API Key</label><input type="password" placeholder="Cole sua API Key aqui" value={form.apiKey} onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))} style={IS} /></div>
                          <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Prompt do sistema</label><textarea placeholder="Você é um atendente virtual da empresa X..." value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))} style={TA} /></div>
                        </div>
                      )}
                      {form.modo === "fluxo" && (
                        <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🔀 Selecionar Fluxo</p>
                          {fluxos.length === 0 ? (
                            <div style={{ background: "#111", borderRadius: 8, padding: 16, textAlign: "center" }}>
                              <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 10px" }}>Nenhum fluxo criado ainda</p>
                              <button onClick={() => { router.push("/fluxos"); setShowModalNovoCanal(false); }} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🔀 Criar Fluxo agora</button>
                            </div>
                          ) : fluxos.map(f => (
                            <button key={f.id} onClick={() => setForm(p => ({ ...p, fluxoId: f.id.toString() }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: form.fluxoId === f.id.toString() ? "#8b5cf622" : "#111", border: `2px solid ${form.fluxoId === f.id.toString() ? "#8b5cf6" : "#374151"}`, borderRadius: 8, padding: "12px 16px", cursor: "pointer", textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18 }}>🔀</span>
                                <div>
                                  <p style={{ color: form.fluxoId === f.id.toString() ? "#8b5cf6" : "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>{f.nome}</p>
                                  <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{f.ativo ? "🟢 Ativo" : "⚫ Inativo"}</p>
                                </div>
                              </div>
                              {form.fluxoId === f.id.toString() && <span style={{ color: "#8b5cf6", fontSize: 18 }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>
                        {editandoId ? "3" : form.tipo === "waba" ? "5" : "4"}. Fila / Departamento
                      </p>
                      <select value={form.fila} onChange={e => setForm(p => ({ ...p, fila: e.target.value }))} style={IS}>
                        <option value="Fila Principal">Fila Principal</option>
                        <option value="Fila Suporte">Fila Suporte</option>
                        <option value="Fila Vendas">Fila Vendas</option>
                        <option value="Fila Técnico">Fila Técnico</option>
                      </select>
                    </div>

                    <div>
                      <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                        {editandoId ? "4" : form.tipo === "waba" ? "6" : "5"}. Comportamento
                      </p>
                      <div style={{ background: "#1f2937", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: 0 }}>🛑 Parar automação quando atendente assumir</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>A IA e o fluxo param automaticamente</p>
                        </div>
                        <Toggle value={form.pararSeAtendente} onChange={() => setForm(p => ({ ...p, pararSeAtendente: !p.pararSeAtendente }))} />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "16px 28px", borderTop: "1px solid #1f2937", display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null); setEditandoId(null); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={salvarCanal} disabled={salvandoCanal} style={{ background: salvandoCanal ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvandoCanal ? "⏳ Salvando..." : editandoId ? "💾 Salvar Alterações" : "✅ Criar Canal"}</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📱 Conexões</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Workspace: {workspace?.nome || "Carregando..."}</p></div>
              <button onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); fetchFluxos(); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Canal</button>
            </div>

            {conexoes.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
                <p style={{ fontSize: 48, margin: "0 0 16px" }}>📱</p>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px" }}>Nenhum canal conectado</h3>
                <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Crie seu primeiro canal para começar a atender</p>
                <button onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); fetchFluxos(); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Canal</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {conexoes.map(c => (
                  <div key={c.id} style={{ background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${c.status === "conectado" ? "#16a34a44" : "#1f2937"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 28 }}>{c.tipo === "webjs" ? "📱" : "🔗"}</span>
                        <div><p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{c.nome}</p><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.tipo === "webjs" ? "WhatsApp Web" : "API Meta (WABA)"}</p></div>
                      </div>
                      <span style={{ background: c.status === "conectado" ? "#16a34a22" : "#dc262622", color: c.status === "conectado" ? "#16a34a" : "#dc2626", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.status === "conectado" ? "🟢 Conectado" : "🔴 Desconectado"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Automação:</span><span style={{ color: modoColor[c.modo] || "#6b7280", fontSize: 12, fontWeight: "bold" }}>{c.modo === "ia" ? `🤖 IA (${iaLabel[c.ia] || c.ia})` : c.modo === "fluxo" ? `🔀 ${c.fluxo_nome}` : "🚫 Sem automação"}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Fila:</span><span style={{ color: "#3b82f6", fontSize: 12 }}>{c.fila}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Para se assumir:</span><span style={{ color: c.parar_se_atendente ? "#16a34a" : "#6b7280", fontSize: 12 }}>{c.parar_se_atendente ? "✅ Sim" : "❌ Não"}</span></div>
                      {c.numero && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Número:</span><span style={{ color: "white", fontSize: 12 }}>{c.numero}</span></div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {c.tipo === "webjs" && (c.status === "desconectado"
                        ? <button onClick={() => abrirQR(c.id)} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: 9, fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📷 Escanear QR</button>
                        : <><button disabled style={{ flex: 1, background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: 9, fontSize: 12, fontWeight: "bold" }}>✅ Conectado</button><button onClick={async () => { await wa("desconectar", { workspaceId: wsId }); await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", c.id); fetchConexoes(); }} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "9px 14px", fontSize: 12, cursor: "pointer" }}>Desconectar</button></>
                      )}
                      {c.tipo === "waba" && <button disabled style={{ flex: 1, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: 9, fontSize: 12, fontWeight: "bold" }}>🔗 API Ativa</button>}
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setShowMenuEngrenagem(showMenuEngrenagem === c.id ? null : c.id)} style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", fontSize: 14, cursor: "pointer" }}>⚙️</button>
                        {showMenuEngrenagem === c.id && (
                          <div style={{ position: "absolute", bottom: 44, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, overflow: "hidden", zIndex: 100, minWidth: 160 }}>
                            <button onClick={() => abrirEditar(c)} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>✏️ Editar Canal</button>
                            {c.tipo === "webjs" && <button onClick={() => { setShowMenuEngrenagem(null); abrirQR(c.id); }} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>📷 Novo QR Code</button>}
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
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Dashboard</h1>
            <div style={{ display: "flex", gap: 16 }}>
              {[{ label: "Abertos", value: atendimentos.filter(a => a.status === "aberto").length, color: "#3b82f6", icon: "💬" }, { label: "Em Atendimento", value: atendimentos.filter(a => a.status === "em_atendimento").length, color: "#f59e0b", icon: "👤" }, { label: "Resolvidos", value: atendimentos.filter(a => a.status === "resolvido").length, color: "#16a34a", icon: "✅" }, { label: "Total", value: atendimentos.length, color: "#8b5cf6", icon: "📊" }].map(card => (
                <div key={card.label} style={{ flex: 1, background: "#111", borderRadius: 12, padding: 20, border: `1px solid ${card.color}33` }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase" }}>{card.icon} {card.label}</p>
                  <p style={{ color: card.color, fontSize: 28, fontWeight: "bold", margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "fluxos" && (<div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center", justifyContent: "center", flex: 1 }}><span style={{ fontSize: 64 }}>🤖</span><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Chatbot / Fluxos</h1><p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Crie fluxos de atendimento automático</p><button onClick={() => router.push("/fluxos")} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 16, cursor: "pointer", fontWeight: "bold" }}>🤖 Abrir Editor de Fluxos →</button></div>)}
        {aba === "empresas" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Empresas</h1></div>)}
        {aba === "filas" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Filas</h1></div>)}
        {aba === "usuarios" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Usuários</h1></div>)}
        {aba === "departamentos" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Departamentos</h1></div>)}
        {aba === "roleta" && (<div style={{ padding: 32 }}><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>Roleta</h1></div>)}
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

        {(aba === "claude" || aba === "gpt") && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>{aba === "claude" ? "🤖 Claude AI" : "💬 ChatGPT"}</h1>
            <div style={{ background: "#111", borderRadius: 12, padding: 32, border: "1px solid #1f2937", maxWidth: 600, display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>API Key</label><input placeholder={aba === "gpt" ? "sk-..." : "sk-ant-..."} style={IS} type="password" /></div>
              <div><label style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prompt</label><textarea placeholder="Você é um atendente virtual..." style={TA} /></div>
              <button style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: 12, fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>💾 Salvar</button>
            </div>
          </div>
        )}

        {aba === "respostas_rapidas" && (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>Respostas Rápidas</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Digite / no chat para usar</p></div>
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

export default function Chatbot() {
  return (
    <Suspense fallback={<div style={{ background: "#0a0a0a", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#6b7280" }}>Carregando...</p></div>}>
      <ChatbotInner />
    </Suspense>
  );
}