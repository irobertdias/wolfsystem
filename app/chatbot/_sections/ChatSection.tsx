"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Atendimento = {
  id: number; created_at: string; numero: string; nome: string; mensagem: string;
  status: string; fila: string; atendente: string; workspace_id: string;
  email?: string; notas?: string; avaliacao?: number;
  bloqueado_ia?: boolean; bloqueado_fluxo?: boolean; bloqueado_typebot?: boolean; bloqueado_contato?: boolean;
  funil_etapa?: string; kanban_coluna?: string; demanda?: string; valor?: number;
};
type Mensagem = { id?: number; created_at?: string; numero: string; mensagem: string; de: string; workspace_id?: string; };
type Etiqueta = { id: number; nome: string; cor: string; icone: string; };
type UsuarioWs = { email: string; nome: string; };

const WA_BG_DARK = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' opacity='0.04'><g fill='%23ffffff'><path d='M40 40 l10 0 l0 10 l-10 0 z'/><circle cx='70' cy='75' r='4'/><path d='M110 35 l15 -5 l5 15 l-15 5 z' opacity='0.6'/><circle cx='150' cy='55' r='3'/><path d='M30 110 l8 8 l-8 8 l-8 -8 z'/><circle cx='80' cy='135' r='5'/><path d='M130 115 l10 0 l-5 10 z' opacity='0.7'/><circle cx='165' cy='150' r='4'/><path d='M50 170 l12 0 l-6 12 z'/><circle cx='100' cy='180' r='3'/></g></svg>")`;

// ═══ Player de áudio custom (estilo WhatsApp) ═══
function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

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
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const v = parseFloat(e.target.value);
    a.currentTime = v;
    setCurrent(v);
  };

  const format = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const cor = isOwn ? "#a3e4d0" : "#00a884";
  const fundoTrilha = isOwn ? "#134e3a" : "#2a3942";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 240, padding: "2px 0" }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />
      {/* Avatar redondo */}
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isOwn ? "#00a88433" : "#8696a033", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
        {isOwn ? "👤" : "🧑"}
      </div>
      {/* Botão play/pause */}
      <button onClick={toggle}
        style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "none", color: cor, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {playing ? "⏸" : "▶"}
      </button>
      {/* Barra de progresso */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <input type="range" min={0} max={duration || 0.01} step={0.01} value={current}
          onChange={seek}
          style={{
            width: "100%", height: 3, appearance: "none", background: `linear-gradient(to right, ${cor} 0%, ${cor} ${duration ? (current / duration) * 100 : 0}%, ${fundoTrilha} ${duration ? (current / duration) * 100 : 0}%, ${fundoTrilha} 100%)`,
            borderRadius: 2, outline: "none", cursor: "pointer",
          }} />
        <span style={{ fontSize: 10, color: isOwn ? "#a3e4d0" : "#8696a0" }}>
          {loaded ? format(duration - current) : "carregando…"}
        </span>
      </div>
    </div>
  );
}

export function ChatSection() {
  const { workspace, wsId, user } = useWorkspace();
  const { permissoes, isDono } = usePermissao();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [mensagem, setMensagem] = useState("");
  const [mensagemInterna, setMensagemInterna] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [showChatInterno, setShowChatInterno] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showMenuTresPontos, setShowMenuTresPontos] = useState(false);
  const [abaConversa, setAbaConversa] = useState<"automatico" | "aguardando" | "abertos" | "finalizados">("aguardando");
  const [busca, setBusca] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Atendimento | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [enviandoMsg, setEnviandoMsg] = useState(false);

  // ═══ Gravação de áudio ═══
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0); // segundos
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Usuários
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [meuNome, setMeuNome] = useState("");

  // Painel Dados do Contato
  const [showPainelContato, setShowPainelContato] = useState(false);
  const [abaPainel, setAbaPainel] = useState<"perfil" | "protocolo" | "funil" | "ia" | "utils" | "etiquetas">("perfil");
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Etiquetas
  const [etiquetasWorkspace, setEtiquetasWorkspace] = useState<Etiqueta[]>([]);
  const [etiquetasAtendimento, setEtiquetasAtendimento] = useState<number[]>([]);

  // Filtros avançados
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

  const fetchAtendimentos = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("atendimentos").select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setAtendimentos(data || []);
  };

  const fetchHistorico = async (numero: string) => {
    const { data } = await supabase.from("mensagens").select("*").eq("numero", numero).order("created_at", { ascending: true });
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
    if (workspace?.owner_email) {
      subs.push({ email: workspace.owner_email, nome: workspace.nome || "Dono" });
    }
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
        await supabase.from("atendimento_etiquetas").delete()
          .eq("atendimento_id", atendimentoAtivo.id).eq("etiqueta_id", etiquetaId);
        setEtiquetasAtendimento(prev => prev.filter(id => id !== etiquetaId));
      } else {
        await supabase.from("atendimento_etiquetas").insert([{ atendimento_id: atendimentoAtivo.id, etiqueta_id: etiquetaId }]);
        setEtiquetasAtendimento(prev => [...prev, etiquetaId]);
      }
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoContato(false);
  };

  const inserirMensagemSistema = async (numero: string, texto: string) => {
    try {
      await supabase.from("mensagens").insert([{
        numero, mensagem: texto, de: "sistema", workspace_id: wsId,
      }]);
    } catch (e) { console.error("Erro ao inserir mensagem de sistema:", e); }
  };

  useEffect(() => {
    if (!wsId) return;
    fetchAtendimentos();
    fetchEtiquetasWorkspace();
    fetchUsuariosWorkspace();
    const ch = supabase.channel("atendimentos_chat_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos", filter: `workspace_id=eq.${wsId}` }, () => fetchAtendimentos())
      .on("postgres_changes", { event: "*", schema: "public", table: "etiquetas", filter: `workspace_id=eq.${wsId}` }, () => fetchEtiquetasWorkspace())
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios_workspace", filter: `workspace_id=eq.${wsId}` }, () => fetchUsuariosWorkspace())
      .subscribe();
    const polling = setInterval(() => fetchAtendimentos(), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [wsId, workspace?.owner_email, user?.email]);

  useEffect(() => {
    if (!atendimentoAtivo) { setEtiquetasAtendimento([]); return; }
    setHistorico([]);
    fetchHistorico(atendimentoAtivo.numero);
    fetchEtiquetasAtendimento(atendimentoAtivo.id);
    const num = atendimentoAtivo.numero;
    const ch = supabase.channel(`msgs_${num}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const m = payload.new as Mensagem;
        if (m.numero === num) { setHistorico(p => [...p, m]); setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
      }).subscribe();
    const polling = setInterval(() => fetchHistorico(num), 3000);
    return () => { supabase.removeChannel(ch); clearInterval(polling); };
  }, [atendimentoAtivo?.numero, atendimentoAtivo?.id]);

  useEffect(() => { setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [historico]);

  const filas = [...new Set(atendimentos.map(a => a.fila))].filter(Boolean);
  const atendentesEmails = [...new Set(atendimentos.map(a => a.atendente))].filter(Boolean);
  const podeVerTudo = isDono || permissoes.chat_todos;

  const classificarAba = (a: Atendimento): "automatico" | "aguardando" | "abertos" | "finalizados" => {
    if (a.status === "resolvido") return "finalizados";
    if (a.atendente === "BOT") return "automatico";
    if (a.status === "pendente") return "aguardando";
    return "abertos";
  };

  const contadoresAbas = { automatico: 0, aguardando: 0, abertos: 0, finalizados: 0 };
  atendimentos.forEach(a => {
    const aba = classificarAba(a);
    if (aba === "abertos" && !podeVerTudo) {
      if (a.atendente !== user?.email) return;
    }
    contadoresAbas[aba]++;
  });

  const atendimentosFiltrados = atendimentos
    .filter(a => classificarAba(a) === abaConversa)
    .filter(a => {
      if (abaConversa === "abertos" && !podeVerTudo) {
        return a.atendente === user?.email;
      }
      return true;
    })
    .filter(a => !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.numero?.includes(busca))
    .filter(a => filtroFila === "todas" || a.fila === filtroFila)
    .filter(a => filtroAtendente === "todos" || a.atendente === filtroAtendente);

  const temFiltroAtivo = filtroFila !== "todas" || filtroAtendente !== "todos" || filtroEtiqueta !== "todas";

  const enviarMensagem = async () => {
    if (!mensagem || !atendimentoAtivo) return;
    setEnviandoMsg(true);
    try {
      const nomeHeader = meuNome ? `*${meuNome}*\n` : "";
      const mensagemFinal = nomeHeader + mensagem;
      await wa("enviar", { numero: atendimentoAtivo.numero, mensagem: mensagemFinal, workspaceId: wsId });
      setMensagem("");
    }
    catch { alert("Erro ao enviar!"); }
    setEnviandoMsg(false);
  };

  // ═══ GRAVAÇÃO DE ÁUDIO ═══
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
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000);
    } catch (err: any) {
      alert("Não foi possível acessar o microfone.\n\n" + (err.message || "Verifique as permissões do navegador."));
    }
  };

  const pararStream = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cancelarGravacao = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    audioChunksRef.current = [];
    pararStream();
    setGravando(false);
    setTempoGravacao(0);
  };

  const enviarAudioGravado = async () => {
    if (!atendimentoAtivo || !mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;
    setEnviandoAudio(true);

    // Aguarda o recorder finalizar e disparar onstop
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try { recorder.stop(); } catch { resolve(); }
    });
    pararStream();
    setGravando(false);

    try {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];

      const form = new FormData();
      form.append("audio", blob);
      form.append("numero", atendimentoAtivo.numero);
      form.append("workspaceId", wsId);

      const resp = await fetch("/api/whatsapp-audio", { method: "POST", body: form });
      const data = await resp.json();
      if (!data.success) alert("Erro ao enviar áudio: " + (data.error || "desconhecido"));
    } catch (e: any) {
      alert("Erro ao enviar áudio: " + e.message);
    }

    setEnviandoAudio(false);
    setTempoGravacao(0);
  };

  // Ações
  const assumirChatDaLista = async (e: React.MouseEvent, a: Atendimento) => {
    e.stopPropagation();
    await wa("assumir", { numero: a.numero, workspaceId: wsId });
    await inserirMensagemSistema(a.numero, `Chat assumido por: ${meuNome}`);
    await fetchAtendimentos();
  };

  const pararBotDaLista = async (e: React.MouseEvent, a: Atendimento) => {
    e.stopPropagation();
    if (!confirm(`Parar o BOT para ${a.nome}?\n\nO BOT vai parar de responder automaticamente. Você assume o atendimento.`)) return;
    try {
      await supabase.from("atendimentos").update({
        bloqueado_ia: true, bloqueado_fluxo: true, bloqueado_typebot: true,
      }).eq("id", a.id);
      await wa("assumir", { numero: a.numero, workspaceId: wsId });
      await inserirMensagemSistema(a.numero, `BOT interrompido. Chat assumido por: ${meuNome}`);
      await fetchAtendimentos();
      alert("✅ BOT parado. Você assumiu o atendimento.");
    } catch (err: any) { alert("Erro: " + err.message); }
  };

  const assumirChat = async (numero: string) => {
    await wa("assumir", { numero, workspaceId: wsId });
    await inserirMensagemSistema(numero, `Chat assumido por: ${meuNome}`);
    fetchAtendimentos();
  };
  const finalizarChat = async (numero: string) => {
    await wa("finalizar", { numero, workspaceId: wsId });
    await inserirMensagemSistema(numero, `Chat finalizado por: ${meuNome}`);
    fetchAtendimentos();
    setAtendimentoAtivo(null);
    setHistorico([]);
  };
  const devolverBot = async (numero: string) => {
    await wa("devolver", { numero, workspaceId: wsId });
    await inserirMensagemSistema(numero, `Chat devolvido ao BOT por: ${meuNome}`);
    fetchAtendimentos();
  };
  const transferirParaFila = async (fila: string) => {
    if (!atendimentoAtivo) return;
    try {
      await supabase.from("atendimentos").update({ fila }).eq("id", atendimentoAtivo.id);
      await inserirMensagemSistema(atendimentoAtivo.numero, `Chat transferido para fila: ${fila}, por: ${meuNome}`);
      await fetchAtendimentos();
      setShowTransferir(false);
      alert(`✅ Transferido para ${fila}`);
    } catch (e: any) { alert("Erro: " + e.message); }
  };
  const limparFiltros = () => { setFiltroFila("todas"); setFiltroAtendente("todos"); setFiltroEtiqueta("todas"); };

  const tempoRelativo = (data: string) => { const d = Math.floor((Date.now() - new Date(data).getTime()) / 60000); return d < 1 ? "agora" : d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}d`; };
  const horaMsg = (data: string) => new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataHoraMsg = (data: string) => new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatTempo = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const salvarCampoContato = async (campo: string, valor: any) => {
    if (!atendimentoAtivo) return;
    setSalvandoContato(true);
    try {
      const { error } = await supabase.from("atendimentos").update({ [campo]: valor }).eq("id", atendimentoAtivo.id);
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
      <p><b>Número:</b> ${atendimentoAtivo.numero}<br><b>Fila:</b> ${atendimentoAtivo.fila || "—"}<br><b>Exportado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <hr>
      ${historico.map(m => `<div class="msg ${m.de === "cliente" ? "cliente" : m.de === "bot" ? "bot" : m.de === "sistema" ? "sistema" : "atendente"}">
        <div>${isAudioMsg(m.mensagem) ? "🎤 [Áudio]" : (m.mensagem || "").replace(/</g, "&lt;")}</div>
        <div class="meta">${m.de === "cliente" ? "Cliente" : m.de === "bot" ? "BOT" : m.de === "sistema" ? "Sistema" : "Atendente"} • ${m.created_at ? new Date(m.created_at).toLocaleString("pt-BR") : ""}</div>
      </div>`).join("")}
      </body></html>`;
    janela.document.write(html);
    janela.document.close();
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
    if (aba === "automatico") {
      return <button onClick={(e) => pararBotDaLista(e, a)} title="Parar BOT e assumir"
        style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>⏹ Parar BOT</button>;
    }
    if (aba === "aguardando") {
      return <button onClick={(e) => assumirChatDaLista(e, a)} title="Assumir atendimento"
        style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>Atender</button>;
    }
    return null;
  };

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
              style={{ flex: 1, padding: "10px 2px", background: "none", border: "none",
                color: abaConversa === t.key ? t.color : "#8696a0",
                fontSize: 10, fontWeight: "bold", cursor: "pointer",
                borderBottom: abaConversa === t.key ? `3px solid ${t.color}` : "3px solid transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.count > 0 && (
                <span style={{ background: t.color, color: "white", borderRadius: 10, padding: "0 6px", fontSize: 9, minWidth: 16 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, background: "#111b21" }}>
          {atendimentosFiltrados.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>{abas.find(a => a.key === abaConversa)?.icon}</p>
              <p style={{ color: "#8696a0", fontSize: 13 }}>
                {temFiltroAtivo ? "Nenhum resultado para os filtros" : `Nenhum atendimento em ${abas.find(a => a.key === abaConversa)?.label.toLowerCase()}`}
              </p>
            </div>
          ) : atendimentosFiltrados.map(a => {
            const aba = classificarAba(a);
            return (
              <div key={a.id} onClick={() => { setAtendimentoAtivo(a); setHistorico([]); fetchHistorico(a.numero); }}
                style={{ padding: "12px 14px", borderBottom: "1px solid #1f2c33", cursor: "pointer",
                  background: atendimentoAtivo?.id === a.id ? "#2a3942" : "transparent" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: 14 }}>
                    {a.nome?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, gap: 8 }}>
                      <span style={{ color: "#e9edef", fontSize: 14, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{a.nome}</span>
                      <span style={{ color: "#8696a0", fontSize: 11, flexShrink: 0 }}>{tempoRelativo(a.created_at)}</span>
                    </div>
                    <p style={{ color: "#8696a0", fontSize: 12, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📱 {numeroSanitizado(a.numero)}
                    </p>
                    <p style={{ color: "#8696a0", fontSize: 12, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isAudioMsg(a.mensagem) ? "🎤 Mensagem de áudio" : a.mensagem}
                    </p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {a.fila && <span style={{ background: "#00a88422", color: "#00a884", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>{a.fila}</span>}
                        {aba === "automatico" && (
                          <span style={{ background: "#8b5cf622", color: "#8b5cf6", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>🤖 BOT</span>
                        )}
                        {aba === "aguardando" && (
                          <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>⏳ Aguardando</span>
                        )}
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0b141a", backgroundImage: WA_BG_DARK, backgroundRepeat: "repeat" }}>
        {atendimentoAtivo ? (
          <>
            {/* HEADER */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #222d34", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: 14 }}>
                  {atendimentoAtivo.nome?.charAt(0).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ color: "#e9edef", fontSize: 15, fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{atendimentoAtivo.nome}</h3>
                  <p style={{ color: "#8696a0", fontSize: 11, margin: 0 }}>
                    {atendimentoAtivo.fila || "—"} • {atendimentoAtivo.numero}
                    {atendimentoAtivo.atendente && atendimentoAtivo.atendente !== "BOT" && (
                      <> • 👨‍💼 {nomeDoAtendente(atendimentoAtivo.atendente)}</>
                    )}
                  </p>
                  {etiquetasAplicadas.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {etiquetasAplicadas.slice(0, 3).map(et => (
                        <span key={et.id} style={{ background: et.cor + "22", border: `1px solid ${et.cor}`, color: et.cor, fontSize: 10, padding: "1px 7px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <span>{et.icone}</span> {et.nome}
                        </span>
                      ))}
                      {etiquetasAplicadas.length > 3 && (
                        <span style={{ color: "#8696a0", fontSize: 10 }}>+{etiquetasAplicadas.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative" }}>
                <button onClick={() => fetchHistorico(atendimentoAtivo.numero)} title="Atualizar mensagens"
                  style={{ background: "none", border: "none", color: "#aebac1", cursor: "pointer", fontSize: 16, padding: 8, borderRadius: 6 }}>🔄</button>
                <button onClick={() => setShowTransferir(!showTransferir)} title="Encaminhar"
                  style={{ background: showTransferir ? "#00a88422" : "none", border: "none", color: showTransferir ? "#00a884" : "#aebac1", cursor: "pointer", fontSize: 16, padding: 8, borderRadius: 6 }}>↗️</button>
                <button onClick={() => setShowMenuTresPontos(!showMenuTresPontos)} title="Mais opções"
                  style={{ background: "none", border: "none", color: "#aebac1", cursor: "pointer", fontSize: 20, padding: 6 }}>⋮</button>

                {showMenuTresPontos && (
                  <div style={{ position: "absolute", top: 44, right: 0, background: "#233138", border: "1px solid #2a3942", borderRadius: 8, minWidth: 240, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                    <button onClick={() => { setShowPainelContato(true); setShowMenuTresPontos(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#e9edef", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                      <span>👤</span> Dados do Contato
                    </button>
                    <button onClick={() => { fetchHistorico(atendimentoAtivo.numero); setShowMenuTresPontos(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#e9edef", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                      <span>🔄</span> Atualizar mensagens
                    </button>
                    {(atendimentoAtivo.atendente === "BOT" || atendimentoAtivo.status === "pendente") && (
                      <button onClick={() => { assumirChat(atendimentoAtivo.numero); setShowMenuTresPontos(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#e9edef", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                        <span>👤</span> Assumir atendimento
                      </button>
                    )}
                    {atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && (
                      <button onClick={() => { devolverBot(atendimentoAtivo.numero); setShowMenuTresPontos(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#e9edef", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                        <span>🤖</span> Devolver ao Bot
                      </button>
                    )}
                    <button onClick={() => { setShowTransferir(true); setShowMenuTresPontos(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#e9edef", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                      <span>↗️</span> Encaminhar
                    </button>
                    {(permissoes.vendas_proprio || permissoes.vendas_equipe) && atendimentoAtivo.atendente !== "BOT" && atendimentoAtivo.status !== "pendente" && (
                      <button onClick={() => { window.open(`/crm/proposta?nome=${encodeURIComponent(atendimentoAtivo.nome)}&numero=${encodeURIComponent(numeroSanitizado(atendimentoAtivo.numero))}`, "_blank"); setShowMenuTresPontos(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#16a34a", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                        <span>💰</span> Finalizar Venda
                      </button>
                    )}
                    <button onClick={() => { finalizarChat(atendimentoAtivo.numero); setShowMenuTresPontos(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: "#dc2626", padding: "12px 16px", fontSize: 13, cursor: "pointer", textAlign: "left", borderTop: "1px solid #2a3942" }}>
                      <span>✓</span> Finalizar atendimento
                    </button>
                  </div>
                )}

                {showTransferir && (
                  <div style={{ position: "absolute", top: 44, right: 0, background: "#233138", border: "1px solid #2a3942", borderRadius: 8, padding: 12, zIndex: 110, width: 240 }}>
                    <p style={{ color: "#8696a0", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>Encaminhar para fila:</p>
                    {(filas.length > 0 ? filas : ["—"]).map(f => (
                      <button key={f} onClick={() => transferirParaFila(f)}
                        style={{ display: "block", width: "100%", background: "#111b21", border: "1px solid #2a3942", borderRadius: 6, padding: "8px 12px", color: "#e9edef", fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 4 }}>📋 {f}</button>
                    ))}
                    <button onClick={() => setShowTransferir(false)} style={{ background: "none", color: "#8696a0", border: "none", padding: "6px", fontSize: 11, cursor: "pointer", width: "100%" }}>Cancelar</button>
                  </div>
                )}
              </div>
            </div>

            {/* MENSAGENS */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 8%", display: "flex", flexDirection: "column", gap: 6 }}>
              {historico.length === 0
                ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ color: "#8696a0", fontSize: 13 }}>Nenhuma mensagem ainda</p></div>
                : historico.map((msg, i) => {
                    if (msg.de === "sistema") {
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                          <div style={{ background: "#182229", color: "#8696a0", fontSize: 11, padding: "6px 14px", borderRadius: 10, maxWidth: "80%", textAlign: "center", fontStyle: "italic" }}>
                            {msg.mensagem}
                            {msg.created_at && (
                              <div style={{ fontSize: 9, color: "#667781", marginTop: 2 }}>{dataHoraMsg(msg.created_at)}</div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isCliente = msg.de === "cliente"; const isBot = msg.de === "bot";
                    const ehAudio = isAudioMsg(msg.mensagem);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: isCliente ? "flex-start" : "flex-end" }}>
                        <div style={{
                          maxWidth: ehAudio ? 320 : "65%", padding: "6px 10px 8px",
                          borderRadius: isCliente ? "8px 8px 8px 2px" : "8px 8px 2px 8px",
                          background: isCliente ? "#202c33" : "#005c4b",
                          boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
                        }}>
                          {!isCliente && !ehAudio && (
                            <p style={{ color: "#8edfc3", fontSize: 10, margin: "0 0 2px", fontWeight: "bold" }}>
                              {isBot ? "🤖 BOT" : "👤 Você"}
                            </p>
                          )}
                          {ehAudio ? (
                            <AudioPlayer src={audioUrl(audioFilename(msg.mensagem))} isOwn={!isCliente} />
                          ) : (
                            <p style={{ color: "#e9edef", fontSize: 13.5, margin: 0, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.mensagem}</p>
                          )}
                          {msg.created_at && (
                            <p style={{ color: isCliente ? "#8696a0" : "#a3e4d0", fontSize: 10, margin: "2px 0 0", textAlign: "right" }}>
                              {horaMsg(msg.created_at)}{!isCliente && " ✓✓"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              <div ref={chatBottomRef} />
            </div>

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

            {/* BARRA DE INPUT — se gravando, mostra barra de gravação */}
            {gravando ? (
              <div style={{ background: "#202c33", padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={cancelarGravacao} disabled={enviandoAudio} title="Cancelar gravação"
                  style={{ background: "#dc2626", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "#2a3942", borderRadius: 20, padding: "10px 18px" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", animation: "pulse 1s infinite" }} />
                  <span style={{ color: "#e9edef", fontSize: 14, fontWeight: "bold" }}>Gravando...</span>
                  <span style={{ color: "#8696a0", fontSize: 13, fontFamily: "monospace", marginLeft: "auto" }}>{formatTempo(tempoGravacao)}</span>
                </div>
                <button onClick={enviarAudioGravado} disabled={enviandoAudio} title="Enviar áudio"
                  style={{ background: enviandoAudio ? "#047857" : "#00a884", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {enviandoAudio ? "…" : "➤"}
                </button>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
              </div>
            ) : (
              <div style={{ background: "#202c33", padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                {permissoes.respostas_rapidas && (
                  <button onClick={() => setShowRespostas(!showRespostas)} title="Respostas rápidas"
                    style={{ background: showRespostas ? "#00a88422" : "none", color: showRespostas ? "#00a884" : "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>⚡</button>
                )}
                <button title="Emoji" style={{ background: "none", color: "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 20, cursor: "pointer" }}>😊</button>
                <button title="Anexar" style={{ background: "none", color: "#8696a0", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>📎</button>
                <input placeholder={meuNome ? `Mensagem (vai com *${meuNome}* no topo)` : "Mensagem"} value={mensagem}
                  onChange={e => { setMensagem(e.target.value); if (e.target.value === "/" && permissoes.respostas_rapidas) setShowRespostas(true); else if (!e.target.value) setShowRespostas(false); }}
                  onKeyDown={e => e.key === "Enter" && enviarMensagem()}
                  style={{ flex: 1, background: "#2a3942", border: "none", borderRadius: 20, padding: "10px 16px", color: "#e9edef", fontSize: 14 }} />
                {mensagem ? (
                  <button onClick={enviarMensagem} disabled={enviandoMsg} title="Enviar"
                    style={{ background: "#00a884", color: "white", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer", fontWeight: "bold" }}>{enviandoMsg ? "…" : "➤"}</button>
                ) : (
                  <button onClick={iniciarGravacao} title="Gravar áudio"
                    style={{ background: "none", color: "#8696a0", border: "none", borderRadius: "50%", width: 42, height: 42, fontSize: 18, cursor: "pointer" }}>🎤</button>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#222e35" }}>
            <span style={{ fontSize: 80, opacity: 0.5 }}>💬</span>
            <h2 style={{ color: "#e9edef", fontSize: 28, fontWeight: "300", margin: 0 }}>Wolf Chatbot</h2>
            <p style={{ color: "#8696a0", fontSize: 14, margin: 0, maxWidth: 400, textAlign: "center" }}>
              Selecione uma conversa à esquerda pra começar a atender
            </p>
            {meuNome && <p style={{ color: "#00a884", fontSize: 12, margin: 0 }}>👋 Olá, {meuNome}!</p>}
          </div>
        )}
      </div>

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
            {[
              { key: "perfil", icon: "👤" }, { key: "protocolo", icon: "📋" }, { key: "funil", icon: "🎯" },
              { key: "etiquetas", icon: "🏷️" }, { key: "ia", icon: "🤖" }, { key: "utils", icon: "🔧" },
            ].map(a => (
              <button key={a.key} onClick={() => setAbaPainel(a.key as any)}
                style={{ flex: 1, padding: "10px 4px", background: abaPainel === a.key ? "#2a3942" : "none", border: "none", borderBottom: abaPainel === a.key ? "2px solid #00a884" : "2px solid transparent", color: abaPainel === a.key ? "#00a884" : "#8696a0", fontSize: 15, cursor: "pointer", position: "relative" }}>
                {a.icon}
                {a.key === "etiquetas" && etiquetasAtendimento.length > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, background: "#dc2626", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                    {etiquetasAtendimento.length}
                  </span>
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
                {[
                  { key: "bloqueado_ia", label: "🤖 ChatGPT / IA", cor: "#16a34a" },
                  { key: "bloqueado_typebot", label: "🔀 TypeBOT", cor: "#3b82f6" },
                ].map(item => {
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
                <button onClick={exportarPDF} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "12px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                  📄 Exportar Histórico em PDF
                </button>
                <button onClick={() => { navigator.clipboard.writeText(numeroSanitizado(atendimentoAtivo.numero)); alert("Copiado!"); }} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  📋 Copiar número
                </button>
                <button onClick={() => window.open(`https://wa.me/${numeroSanitizado(atendimentoAtivo.numero)}`, "_blank")} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  📞 Abrir no WhatsApp Web
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}