"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

type Conexao = {
  id: number; nome: string; tipo: string; status: string; numero: string;
  modo: string; ia: string; fluxo_id: string; fluxo_nome: string;
  fila: string; api_key: string; prompt: string; parar_se_atendente: boolean;
  phone_number_id?: string; waba_id?: string; token_waba?: string; webhook_token?: string;
  workspace_id: string;
};
type FluxoItem = { id: number; nome: string; ativo: boolean; };
type LimitesPlano = { conexoes: number; webjs: boolean; waba: boolean; instagram: boolean; };

export function ConexoesSection() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();

  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [fluxos, setFluxos] = useState<FluxoItem[]>([]);
  const [showModalQR, setShowModalQR] = useState(false);
  const [showMenuEngrenagem, setShowMenuEngrenagem] = useState<number | null>(null);
  const [qrCanalId, setQrCanalId] = useState<number | null>(null);
  const [resetando, setResetando] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrPolling, setQrPolling] = useState(false);
  const [qrConectado, setQrConectado] = useState(false);
  const [qrNumero, setQrNumero] = useState("");
  const [showModalNovoCanal, setShowModalNovoCanal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [testandoWABA, setTestandoWABA] = useState(false);
  const [wabaTeste, setWabaTeste] = useState<{ success: boolean; nome?: string; error?: string } | null>(null);

  const [encerrandoMassa, setEncerrandoMassa] = useState(false);
  const [registrandoWaba, setRegistrandoWaba] = useState(false);

  const [limites, setLimites] = useState<LimitesPlano>({ conexoes: 1, webjs: true, waba: false, instagram: false });

  const formInicial = { nome: "", tipo: "webjs", phoneNumberId: "", wabaId: "", token: "", webhookToken: "", modo: "nenhum", ia: "gpt", apiKey: "", prompt: "", fluxoId: "", fila: "Fila Principal", pararSeAtendente: true };
  const [form, setForm] = useState(formInicial);

  const [apiKeyTocada, setApiKeyTocada] = useState(false);
  const [tokenTocado, setTokenTocado] = useState(false);

  const wsIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids: string[] = [];
    if (workspace?.username) ids.push(workspace.username);
    if (workspace?.id) ids.push(workspace.id.toString());
    wsIdsRef.current = ids;
  }, [workspace]);

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };
  const TA = { ...IS, height: 90, resize: "vertical" as const };

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const fetchLimites = async () => {
    if (!user?.email && !workspace?.owner_email) return;
    const emailAlvo = workspace?.owner_email || user?.email;
    if (!emailAlvo) return;
    try {
      const { data } = await supabase.from("cadastros").select("conexoes_liberadas, permite_webjs, permite_waba, permite_instagram").eq("email", emailAlvo).maybeSingle();
      if (data) {
        setLimites({
          conexoes: data.conexoes_liberadas || 1,
          webjs: data.permite_webjs !== false,
          waba: !!data.permite_waba,
          instagram: !!data.permite_instagram,
        });
      }
    } catch (e) {}
  };

  const fetchConexoes = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    const { data } = await supabase.from("conexoes").select("*").in("workspace_id", ids).order("created_at", { ascending: false });
    setConexoes(data || []);
  };

  const fetchFluxos = async () => {
    const ids = wsIdsRef.current;
    if (ids.length === 0) return;
    const { data } = await supabase.from("fluxos").select("id, nome, ativo").in("workspace_id", ids).order("created_at", { ascending: false });
    setFluxos(data || []);
  };

  const verificarStatusWaba = async (canalId: number) => {
    try {
      const resp = await fetch(`https://api.wolfgyn.com.br/waba/verificar-status?canalId=${canalId}`);
      return await resp.json();
    } catch (e) { return { success: false, status: "desconectado" }; }
  };

  useEffect(() => {
    if (!workspace?.id) return;
    fetchConexoes();
    fetchFluxos();
    fetchLimites();

    const ch = supabase.channel("conexoes_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes" }, () => fetchConexoes())
      .subscribe();

    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`https://api.wolfgyn.com.br/status`);
        const data = await resp.json();
        if (data.sessoes && Array.isArray(data.sessoes)) {
          const ids = wsIdsRef.current;
          if (ids.length === 0) return;
          const { data: canaisBanco } = await supabase.from("conexoes").select("*").in("workspace_id", ids);
          if (!canaisBanco) return;
          for (const c of canaisBanco) {
            if (c.tipo === "webjs") {
              const sessaoVPS = data.sessoes.find((s: any) => s.canalId === c.id);
              if (!sessaoVPS) continue;
              const statusReal = sessaoVPS.status === "conectado" ? "conectado" : "desconectado";
              const numeroReal = sessaoVPS.numero || "";
              if (c.status !== statusReal || (statusReal === "conectado" && c.numero !== numeroReal)) {
                await supabase.from("conexoes").update({ status: statusReal, numero: numeroReal }).eq("id", c.id);
              }
            } else if (c.tipo === "waba") {
              const wabaStatus = await verificarStatusWaba(c.id);
              if (wabaStatus.success) {
                const statusReal = wabaStatus.status;
                const numeroReal = wabaStatus.numero || c.numero;
                if (c.status !== statusReal || c.numero !== numeroReal) {
                  await supabase.from("conexoes").update({ status: statusReal, numero: numeroReal }).eq("id", c.id);
                }
              }
            }
          }
        }
      } catch (e) {}
      fetchConexoes();
    }, 5000);

    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [workspace, user?.email]);

  useEffect(() => {
    if (!qrPolling || !showModalQR || !qrCanalId) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`https://api.wolfgyn.com.br/qr-data?canalId=${qrCanalId}`);
        const data = await resp.json();
        if (data.qr) setQrImageUrl(data.qr);
        if (data.status === "conectado") {
          setQrConectado(true); setQrNumero(data.numero || ""); setQrPolling(false);
          await supabase.from("conexoes").update({ status: "conectado", numero: data.numero || "Conectado" }).eq("id", qrCanalId);
          fetchConexoes();
          setShowModalQR(false);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [qrPolling, showModalQR, qrCanalId]);

  const registrarNumeroWaba = async (c: Conexao) => {
    const usarPinPadrao = confirm(
      `🟢 Ativar o número na Meta?\n\n` +
      `Canal: ${c.nome}\n` +
      `Número: ${c.numero}\n\n` +
      `Clique OK pra usar o PIN padrão (000000).\n` +
      `Clique CANCELAR se você configurou um PIN personalizado (2FA).`
    );
    let pin = "000000";
    if (!usarPinPadrao) {
      const pinCustom = prompt("Digite seu PIN de 6 dígitos (2FA):", "");
      if (!pinCustom) return;
      if (!/^\d{6}$/.test(pinCustom)) { alert("❌ PIN deve ter exatamente 6 dígitos!"); return; }
      pin = pinCustom;
    }
    setRegistrandoWaba(true); setShowMenuEngrenagem(null);
    try {
      const resp = await fetch(`/api/whatsapp?rota=waba/registrar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canalId: c.id, pin }),
      });
      const data = await resp.json();
      if (data.success) {
        alert(`✅ Número ativado com sucesso na Meta!\n\nAgora ele está ONLINE e pode receber mensagens.`);
        await fetchConexoes();
      } else {
        const codigo = data.codigo;
        let mensagemErro = data.error || "Erro desconhecido";
        let dica = "";
        if (codigo === 131000 || mensagemErro.includes("PIN")) dica = "\n\n💡 Dica: o número tem 2FA. Clique Cancelar no primeiro popup pra digitar PIN.";
        else if (mensagemErro.toLowerCase().includes("too many")) dica = "\n\n💡 Aguarde uns minutos antes de tentar de novo.";
        else if (codigo === 133010) dica = "\n\n💡 Número já está registrado!";
        alert(`❌ ${mensagemErro}${dica}`);
      }
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setRegistrandoWaba(false);
  };

  const encerrarAtendimentosEmMassa = async (tipo: "aguardando" | "abertos", c: Conexao) => {
    const statusAlvo = tipo === "aguardando" ? ["pendente"] : ["aberto", "em_atendimento"];
    const labelTipo = tipo === "aguardando" ? "aguardando" : "abertos";
    const { data: atendimentos, error: errBusca } = await supabase.from("atendimentos").select("id, numero, nome").eq("workspace_id", c.workspace_id).eq("canal_id", c.id).in("status", statusAlvo);
    if (errBusca) { alert("Erro: " + errBusca.message); return; }
    const total = atendimentos?.length || 0;
    if (total === 0) { alert(`✅ Não há atendimentos ${labelTipo} em "${c.nome}".`); setShowMenuEngrenagem(null); return; }
    const confirmacao = confirm(`⚠️ ATENÇÃO — Canal: ${c.nome}\n\nVocê está prestes a ENCERRAR ${total} atendimento(s) ${labelTipo}.\n\nDeseja continuar?`);
    if (!confirmacao) return;
    setEncerrandoMassa(true); setShowMenuEngrenagem(null);
    try {
      const meuNome = user?.email ? user.email.split("@")[0] : "Sistema";
      const { error: errUpdate } = await supabase.from("atendimentos").update({ status: "resolvido" }).eq("workspace_id", c.workspace_id).eq("canal_id", c.id).in("status", statusAlvo);
      if (errUpdate) throw errUpdate;
      const mensagensSistema = (atendimentos || []).map(a => ({ numero: a.numero, mensagem: `Chat encerrado em massa (${labelTipo}) por: ${meuNome}`, de: "sistema", workspace_id: c.workspace_id, canal_id: c.id }));
      if (mensagensSistema.length > 0) { for (let i = 0; i < mensagensSistema.length; i += 100) { const lote = mensagensSistema.slice(i, i + 100); await supabase.from("mensagens").insert(lote); } }
      try { await supabase.from("fluxo_sessoes").update({ status: "finalizado" }).eq("workspace_id", c.workspace_id).eq("status", "ativo"); } catch (e) {}
      alert(`✅ ${total} atendimento(s) ${labelTipo} encerrado(s)!`);
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEncerrandoMassa(false);
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
    setForm({ nome: c.nome, tipo: c.tipo, phoneNumberId: c.phone_number_id || "", wabaId: c.waba_id || "", token: "", webhookToken: c.webhook_token || "", modo: c.modo, ia: c.ia, apiKey: "", prompt: c.prompt || "", fluxoId: c.fluxo_id || "", fila: c.fila, pararSeAtendente: c.parar_se_atendente });
    setApiKeyTocada(false); setTokenTocado(false); setShowModalNovoCanal(true); setShowMenuEngrenagem(null); fetchFluxos();
  };

  const salvarCanal = async () => {
    if (!wsId) { alert("Aguarde o workspace carregar!"); return; }
    if (!form.nome.trim()) { alert("Digite o nome do canal!"); return; }
    if (!editandoId && form.tipo === "waba" && (!form.phoneNumberId || !form.token)) { alert("Preencha Phone Number ID e Token!"); return; }
    if (!editandoId && form.modo === "ia" && !form.apiKey) { alert("Digite a API Key da IA!"); return; }

    // Validação de limite do plano
    if (!editandoId) {
      if (conexoes.length >= limites.conexoes) {
        alert(`❌ Limite do plano atingido!\n\nSeu plano permite até ${limites.conexoes} canal(is). Você já tem ${conexoes.length}.\n\nFaça upgrade pra criar mais canais.`);
        return;
      }
      if (form.tipo === "webjs" && !limites.webjs) { alert("❌ Seu plano não inclui WhatsApp Web!"); return; }
      if (form.tipo === "waba" && !limites.waba) { alert("❌ Seu plano não inclui API Meta (WABA)!\n\nFaça upgrade pro plano Intermediário ou Ultra."); return; }
    }

    setSalvandoCanal(true);
    try {
      const fluxoSel = fluxos.find(f => f.id.toString() === form.fluxoId);

      const payload: any = {
        nome: form.nome, modo: form.modo, ia: form.ia, fluxo_id: form.fluxoId, fluxo_nome: fluxoSel?.nome || "",
        fila: form.fila, prompt: form.prompt, parar_se_atendente: form.pararSeAtendente
      };
      if (apiKeyTocada || !editandoId) payload.api_key = form.apiKey;

      if (editandoId) {
        await supabase.from("conexoes").update(payload).eq("id", editandoId);
        setEditandoId(null);
        // Atualiza configuração do canal no VPS (caso modo IA tenha mudado)
        try { await wa("configurar-ia", { canalId: editandoId, ia: form.ia, apiKey: form.apiKey, prompt: form.prompt, fila: form.fila, modo: form.modo }); } catch (e) {}
        alert("✅ Canal atualizado!");
      } else {
        let novoId: number | null = null;
        if (form.tipo === "waba") {
          const webhookToken = form.webhookToken || `wolf_${wsId}_${Date.now()}`;
          const { data: inserted, error: insErr } = await supabase.from("conexoes").insert([{
            workspace_id: wsId, tipo: "waba", status: "desconectado",
            numero: wabaTeste?.nome || form.phoneNumberId,
            phone_number_id: form.phoneNumberId, waba_id: form.wabaId,
            token_waba: form.token, webhook_token: webhookToken,
            ...payload
          }]).select().single();
          if (insErr) throw insErr;
          novoId = inserted.id;
        } else {
          const { data: inserted, error: insErr } = await supabase.from("conexoes").insert([{
            workspace_id: wsId, tipo: "webjs", status: "desconectado", numero: "", ...payload
          }]).select().single();
          if (insErr) throw insErr;
          novoId = inserted.id;
        }

        // Pede pro VPS criar a sessão pro novo canal
        if (novoId) {
          try { await wa("canal/criar", { canalId: novoId }); } catch (e) { console.error("Erro ao criar sessão no VPS:", e); }
        }
        alert("✅ Canal criado com sucesso!");
      }
      await fetchConexoes();
      setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null);
      setApiKeyTocada(false); setTokenTocado(false);
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvandoCanal(false);
  };

  const abrirQR = async (id: number) => {
    const canal = conexoes.find(c => c.id === id);
    if (!canal) return;
    setQrCanalId(id); setResetando(true); setShowModalQR(true);
    setQrImageUrl(""); setQrConectado(false); setQrNumero("");
    try { await wa("resetar", { canalId: id }); } catch (e) {}
    await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", id);
    await fetchConexoes(); setResetando(false); setQrPolling(true);
  };

  const desconectarCanal = async (c: Conexao) => {
    if (!confirm(`Desconectar ${c.nome}? Isso vai desconectar o WhatsApp.`)) return;
    try {
      await wa("desconectar", { canalId: c.id });
      await supabase.from("conexoes").update({ status: "desconectado", numero: "" }).eq("id", c.id);
      await fetchConexoes();
      alert("✅ Desconectado!");
    } catch (e: any) { alert("Erro: " + e.message); }
  };

  const excluirCanal = async (id: number) => {
    if (!confirm("Excluir esse canal?\n\nTodo o histórico vai ser preservado mas o canal será removido.")) return;
    const canal = conexoes.find(c => c.id === id);
    if (canal?.tipo === "webjs") { try { await wa("desconectar", { canalId: id }); } catch (e) {} }
    await supabase.from("conexoes").delete().eq("id", id);
    await fetchConexoes(); setShowMenuEngrenagem(null);
  };

  const modoColor: Record<string, string> = { nenhum: "#6b7280", ia: "#10b981", fluxo: "#8b5cf6" };
  const iaLabel: Record<string, string> = { gpt: "ChatGPT", claude: "Claude AI", gemini: "Gemini", deepseek: "DeepSeek" };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{ width: 44, height: 24, background: value ? "#16a34a" : "#374151", borderRadius: 12, cursor: "pointer", border: "none", position: "relative", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s" }} />
    </button>
  );

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", height: "100vh" }}>

      {showModalQR && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111", borderRadius: 16, padding: 32, width: 400, border: "1px solid #1f2937", textAlign: "center" }}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 8px" }}>📱 Conectar WhatsApp</h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Escaneie o QR Code com seu WhatsApp</p>
            <div style={{ background: "#0a0a0a", borderRadius: 12, padding: 16, minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              {resetando ? <p style={{ color: "#f59e0b", fontSize: 14 }}>⏳ Iniciando sessão...</p>
                : qrConectado ? <div><p style={{ fontSize: 48, margin: "0 0 8px" }}>✅</p><p style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold", margin: 0 }}>WhatsApp Conectado!</p>{qrNumero && <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0 0" }}>{qrNumero}</p>}</div>
                : qrImageUrl ? <img src={qrImageUrl} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 8 }} />
                : <div><p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 8px" }}>⏳ Gerando QR Code...</p><p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>Aguarde alguns segundos</p></div>}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setShowModalQR(false); setQrPolling(false); setQrImageUrl(""); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Fechar</button>
              {!qrConectado && <button onClick={async () => { if (qrCanalId) { await supabase.from("conexoes").update({ status: "conectado", numero: qrNumero || "Conectado" }).eq("id", qrCanalId); await fetchConexoes(); } setShowModalQR(false); setQrPolling(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>✅ Já Conectei!</button>}
            </div>
          </div>
        </div>
      )}

      {showModalNovoCanal && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", borderRadius: 16, width: "100%", maxWidth: 640, border: "1px solid #1f2937", display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden" }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: 0 }}>{editandoId ? "✏️ Editar Canal" : "➕ Novo Canal"}</h2>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>{editandoId ? "Altere as configurações" : `${conexoes.length} de ${limites.conexoes} canais usados`}</p>
              </div>
              <button onClick={() => { setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null); setEditandoId(null); setApiKeyTocada(false); setTokenTocado(false); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
              {!editandoId && (
                <div>
                  <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>1. Tipo de Canal</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { key: "webjs", icon: "📱", label: "WhatsApp Web", desc: "Conexão via QR Code", disabled: !limites.webjs },
                      { key: "waba", icon: "🔗", label: "API Meta (WABA)", desc: "API oficial do WhatsApp", disabled: !limites.waba }
                    ].map(t => (
                      <button key={t.key}
                        onClick={() => !t.disabled && setForm(p => ({ ...p, tipo: t.key }))}
                        disabled={t.disabled}
                        title={t.disabled ? "Seu plano não inclui esse tipo" : ""}
                        style={{
                          background: form.tipo === t.key ? "#16a34a22" : "#1f2937",
                          border: `2px solid ${form.tipo === t.key ? "#16a34a" : "#374151"}`,
                          borderRadius: 10, padding: "14px 16px",
                          cursor: t.disabled ? "not-allowed" : "pointer",
                          textAlign: "left", opacity: t.disabled ? 0.4 : 1
                        }}>
                        <p style={{ color: "white", fontSize: 20, margin: "0 0 4px" }}>{t.icon}</p>
                        <p style={{ color: form.tipo === t.key ? "#16a34a" : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 2px" }}>{t.label}</p>
                        <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{t.disabled ? "🔒 Upgrade necessário" : t.desc}</p>
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
                    <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Token Permanente *</label><input type="password" placeholder="EAAxxxxx..." value={form.token} onChange={e => { setForm(p => ({ ...p, token: e.target.value })); setTokenTocado(true); }} style={IS} /></div>
                    <button onClick={testarWABA} disabled={testandoWABA} style={{ background: testandoWABA ? "#1d4ed8" : "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: 9, fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{testandoWABA ? "⏳ Testando..." : "🔍 Testar Conexão"}</button>
                    {wabaTeste && <div style={{ background: wabaTeste.success ? "#16a34a22" : "#dc262622", border: `1px solid ${wabaTeste.success ? "#16a34a33" : "#dc262633"}`, borderRadius: 8, padding: 10 }}><p style={{ color: wabaTeste.success ? "#16a34a" : "#dc2626", fontSize: 13, margin: 0, fontWeight: "bold" }}>{wabaTeste.success ? `✅ ${wabaTeste.nome}` : `❌ ${wabaTeste.error}`}</p></div>}
                    <div style={{ background: "#111", borderRadius: 8, padding: 12 }}>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase" }}>URL do Webhook</p>
                      <p style={{ color: "#16a34a", fontSize: 12, fontWeight: "bold", margin: 0, wordBreak: "break-all" }}>https://api.wolfgyn.com.br/webhook/meta</p>
                    </div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Token de Verificação</label><input placeholder="meu_token_secreto" value={form.webhookToken} onChange={e => setForm(p => ({ ...p, webhookToken: e.target.value }))} style={IS} /></div>
                    <div style={{ background: "#16a34a22", borderRadius: 8, padding: 12, border: "1px solid #16a34a33" }}>
                      <p style={{ color: "#16a34a", fontSize: 11, fontWeight: "bold", margin: "0 0 4px", textTransform: "uppercase" }}>💡 Importante</p>
                      <p style={{ color: "#86efac", fontSize: 11, margin: 0, lineHeight: 1.5 }}>Depois de criar o canal, clique em <b>🟢 Ativar Número na Meta</b> pra deixar seu número online.</p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>{editandoId ? "2" : form.tipo === "waba" ? "4" : "3"}. Automação</p>
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
                        <button key={ia.key} onClick={() => { setForm(p => ({ ...p, ia: ia.key, apiKey: "" })); setApiKeyTocada(true); }} style={{ background: form.ia === ia.key ? `${ia.cor}22` : "#111", border: `2px solid ${form.ia === ia.key ? ia.cor : "#374151"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <p style={{ color: form.ia === ia.key ? ia.cor : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 2px" }}>{ia.label}</p>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{ia.sub}</p>
                        </button>
                      ))}
                    </div>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>
                        API Key {editandoId && !apiKeyTocada && <span style={{ color: "#10b981", fontSize: 10 }}>(já salva)</span>}
                      </label>
                      <input type="password" placeholder={editandoId ? "Deixe vazio pra manter" : "Cole sua API Key"} value={form.apiKey} onChange={e => { setForm(p => ({ ...p, apiKey: e.target.value })); setApiKeyTocada(true); }} style={IS} />
                    </div>
                    <div><label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4 }}>Prompt do sistema</label><textarea placeholder="Ex: Você é um atendente virtual..." value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))} style={TA} /></div>
                  </div>
                )}
                {form.modo === "fluxo" && (
                  <div style={{ background: "#1f2937", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>🔀 Selecionar Fluxo</p>
                    {fluxos.length === 0 ? (
                      <div style={{ background: "#111", borderRadius: 8, padding: 16, textAlign: "center" }}>
                        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 10px" }}>Nenhum fluxo criado ainda</p>
                        <button onClick={() => { router.push("/chatbot/fluxos"); setShowModalNovoCanal(false); }} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🔀 Criar Fluxo</button>
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
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>{editandoId ? "3" : form.tipo === "waba" ? "5" : "4"}. Fila / Departamento</p>
                <select value={form.fila} onChange={e => setForm(p => ({ ...p, fila: e.target.value }))} style={IS}>
                  <option value="Fila Principal">Fila Principal</option>
                  <option value="Fila Suporte">Fila Suporte</option>
                  <option value="Fila Vendas">Fila Vendas</option>
                  <option value="Fila Técnico">Fila Técnico</option>
                </select>
              </div>
              <div>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>{editandoId ? "4" : form.tipo === "waba" ? "6" : "5"}. Comportamento</p>
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
              <button onClick={() => { setShowModalNovoCanal(false); setForm(formInicial); setWabaTeste(null); setEditandoId(null); setApiKeyTocada(false); setTokenTocado(false); }} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvarCanal} disabled={salvandoCanal} style={{ background: salvandoCanal ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>{salvandoCanal ? "⏳ Salvando..." : editandoId ? "💾 Salvar" : "✅ Criar Canal"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: 0 }}>📱 Conexões</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
            Workspace: {workspace?.nome || "Carregando..."} • {conexoes.length} de {limites.conexoes} canais
          </p>
        </div>
        <button
          onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); setApiKeyTocada(false); setTokenTocado(false); fetchFluxos(); }}
          disabled={conexoes.length >= limites.conexoes}
          style={{ background: conexoes.length >= limites.conexoes ? "#374151" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: conexoes.length >= limites.conexoes ? "not-allowed" : "pointer", fontWeight: "bold" }}>
          + Novo Canal {conexoes.length >= limites.conexoes && "(limite)"}
        </button>
      </div>

      {conexoes.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1f2937" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>📱</p>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px" }}>Nenhum canal conectado</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>Crie seu primeiro canal pra começar</p>
          <button onClick={() => { setShowModalNovoCanal(true); setEditandoId(null); setForm(formInicial); setApiKeyTocada(false); setTokenTocado(false); fetchFluxos(); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>+ Novo Canal</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {conexoes.map(c => (
            <div key={c.id} style={{ background: "#111", borderRadius: 12, padding: 24, border: `1px solid ${c.status === "conectado" ? "#16a34a44" : "#1f2937"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{c.tipo === "webjs" ? "📱" : "🔗"}</span>
                  <div>
                    <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{c.nome}</p>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{c.tipo === "webjs" ? "WhatsApp Web" : "API Meta (WABA)"} • ID {c.id}</p>
                  </div>
                </div>
                <span style={{ background: c.status === "conectado" ? "#16a34a22" : "#dc262622", color: c.status === "conectado" ? "#16a34a" : "#dc2626", fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: "bold" }}>{c.status === "conectado" ? "🟢 Conectado" : "🔴 Desconectado"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Automação:</span><span style={{ color: modoColor[c.modo] || "#6b7280", fontSize: 12, fontWeight: "bold" }}>{c.modo === "ia" ? `🤖 IA (${iaLabel[c.ia] || c.ia})` : c.modo === "fluxo" ? `🔀 ${c.fluxo_nome}` : "🚫 Sem automação"}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Fila:</span><span style={{ color: "#3b82f6", fontSize: 12 }}>{c.fila}</span></div>
                {c.numero && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280", fontSize: 12 }}>Número:</span><span style={{ color: "white", fontSize: 12 }}>{c.numero}</span></div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {c.tipo === "webjs" && (c.status === "desconectado"
                  ? <button onClick={() => abrirQR(c.id)} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: 9, fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📷 Escanear QR</button>
                  : <><button disabled style={{ flex: 1, background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: 9, fontSize: 12, fontWeight: "bold" }}>✅ Conectado</button><button onClick={() => desconectarCanal(c)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262633", borderRadius: 8, padding: "9px 14px", fontSize: 12, cursor: "pointer" }}>Desconectar</button></>
                )}
                {c.tipo === "waba" && (c.status === "conectado"
                  ? <button disabled style={{ flex: 1, background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a33", borderRadius: 8, padding: 9, fontSize: 12, fontWeight: "bold" }}>🔗 API Conectada</button>
                  : <button onClick={() => registrarNumeroWaba(c)} style={{ flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: 9, fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>🟢 Ativar Número na Meta</button>
                )}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowMenuEngrenagem(showMenuEngrenagem === c.id ? null : c.id)} disabled={encerrandoMassa || registrandoWaba}
                    style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", fontSize: 14, cursor: (encerrandoMassa || registrandoWaba) ? "wait" : "pointer" }}>
                    {(encerrandoMassa || registrandoWaba) ? "⏳" : "⚙️"}
                  </button>
                  {showMenuEngrenagem === c.id && (
                    <div style={{ position: "absolute", bottom: 44, right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: 10, overflow: "hidden", zIndex: 100, minWidth: 240 }}>
                      <button onClick={() => abrirEditar(c)} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>✏️ Editar Canal</button>
                      {c.tipo === "webjs" && <button onClick={() => { setShowMenuEngrenagem(null); abrirQR(c.id); }} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "white", fontSize: 13, cursor: "pointer", textAlign: "left" }}>📷 Novo QR Code</button>}
                      {c.tipo === "waba" && <button onClick={() => registrarNumeroWaba(c)} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "#16a34a", fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: "bold" }}>🟢 Ativar Número na Meta</button>}
                      <button onClick={() => encerrarAtendimentosEmMassa("aguardando", c)} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "#f59e0b", fontSize: 13, cursor: "pointer", textAlign: "left" }}>⏳ Encerrar Aguardando</button>
                      <button onClick={() => encerrarAtendimentosEmMassa("abertos", c)} style={{ display: "block", width: "100%", background: "none", border: "none", borderBottom: "1px solid #374151", padding: "10px 16px", color: "#3b82f6", fontSize: 13, cursor: "pointer", textAlign: "left" }}>💬 Encerrar Abertos</button>
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
  );
}