"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { usePermissao } from "../hooks/usePermissao";

type ConexaoVoip = {
  id: number;
  workspace_id: string;
  provider: "twilio" | "zenvia";
  nome: string;
  status: string;
  erro_msg?: string;
  numero_bina?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_api_key_sid?: string;
  twilio_api_key_secret?: string;
  twilio_twiml_app_sid?: string;
  twilio_numero_did?: string;
  zenvia_access_token?: string;
  zenvia_did_id?: number;
  zenvia_numero_did?: string;
  permite_gravacao: boolean;
  horario_inicio?: string;
  horario_fim?: string;
  dias_permitidos?: string[];
  created_at: string;
};

export default function ConexoesVoipSection() {
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [conexoes, setConexoes] = useState<ConexaoVoip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<ConexaoVoip | null>(null);
  const [providerEscolhido, setProviderEscolhido] = useState<"twilio" | "zenvia" | null>(null);

  // Campos do form
  const [nome, setNome] = useState("");
  const [numeroBina, setNumeroBina] = useState("");
  const [permiteGravacao, setPermiteGravacao] = useState(true);
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [diasPermitidos, setDiasPermitidos] = useState<string[]>(["seg","ter","qua","qui","sex","sab"]);

  // Twilio
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioApiKeySid, setTwilioApiKeySid] = useState("");
  const [twilioApiKeySecret, setTwilioApiKeySecret] = useState("");
  const [twilioTwimlAppSid, setTwilioTwimlAppSid] = useState("");
  const [twilioNumeroDid, setTwilioNumeroDid] = useState("");

  // Zenvia
  const [zenviaAccessToken, setZenviaAccessToken] = useState("");
  const [zenviaDidId, setZenviaDidId] = useState("");
  const [zenviaNumeroDid, setZenviaNumeroDid] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [mostrarAjuda, setMostrarAjuda] = useState<"twilio" | "zenvia" | null>(null);

  // Permissão — só dono ou admin pode gerenciar conexões VOIP
  const podeGerenciar = isDono || permissoes.administrador;

  const wa = async (rota: string, body?: object) => {
    const opts: any = body !== undefined
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : { method: "GET" };
    const resp = await fetch(`/api/whatsapp?rota=${rota}`, opts);
    return resp.json();
  };

  const fetchConexoes = async () => {
    if (!wsId) return;
    setLoading(true);
    const resp = await wa(`voip/conexoes/listar&workspaceId=${wsId}`);
    // Nota: como o proxy /api/whatsapp usa query string ?rota=XXX, quando a rota tem seu próprio
    // query, a gente cola com &. Mas pode ser mais seguro fazer via body:
    if (!resp.success) {
      // Fallback: buscar direto no Supabase (sem mascarar tokens, mas ainda filtra por workspace)
      const { data } = await supabase.from("conexoes_voip").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
      setConexoes(data || []);
    } else {
      setConexoes(resp.conexoes || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!wsId) return;
    fetchConexoes();
    const ch = supabase.channel("voip_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "conexoes_voip", filter: `workspace_id=eq.${wsId}` }, () => fetchConexoes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId]);

  const limparForm = () => {
    setNome(""); setNumeroBina(""); setPermiteGravacao(true);
    setHorarioInicio("09:00"); setHorarioFim("18:00"); setDiasPermitidos(["seg","ter","qua","qui","sex","sab"]);
    setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioApiKeySid("");
    setTwilioApiKeySecret(""); setTwilioTwimlAppSid(""); setTwilioNumeroDid("");
    setZenviaAccessToken(""); setZenviaDidId(""); setZenviaNumeroDid("");
    setModoEdicao(null); setProviderEscolhido(null);
  };

  const abrirParaEditar = (c: ConexaoVoip) => {
    setModoEdicao(c);
    setProviderEscolhido(c.provider);
    setNome(c.nome);
    setNumeroBina(c.numero_bina || "");
    setPermiteGravacao(c.permite_gravacao);
    setHorarioInicio(c.horario_inicio || "09:00");
    setHorarioFim(c.horario_fim || "18:00");
    setDiasPermitidos(c.dias_permitidos || []);
    if (c.provider === "twilio") {
      setTwilioAccountSid(c.twilio_account_sid || "");
      setTwilioAuthToken(""); // não mostra o mascarado, user digita novo se quiser trocar
      setTwilioApiKeySid(c.twilio_api_key_sid || "");
      setTwilioApiKeySecret("");
      setTwilioTwimlAppSid(c.twilio_twiml_app_sid || "");
      setTwilioNumeroDid(c.twilio_numero_did || "");
    } else if (c.provider === "zenvia") {
      setZenviaAccessToken("");
      setZenviaDidId(c.zenvia_did_id?.toString() || "");
      setZenviaNumeroDid(c.zenvia_numero_did || "");
    }
    setShowModal(true);
  };

  const salvar = async () => {
    if (!nome.trim()) { alert("Digite um nome pra conexão"); return; }
    if (!providerEscolhido) { alert("Escolha o provedor"); return; }

    setEnviando(true);
    try {
      const config: any = {
        numero_bina: numeroBina,
        permite_gravacao: permiteGravacao,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_permitidos: diasPermitidos
      };

      if (providerEscolhido === "twilio") {
        if (!modoEdicao && (!twilioAccountSid || !twilioAuthToken)) {
          alert("Account SID e Auth Token são obrigatórios"); setEnviando(false); return;
        }
        if (twilioAccountSid) config.twilio_account_sid = twilioAccountSid;
        if (twilioAuthToken) config.twilio_auth_token = twilioAuthToken;
        if (twilioApiKeySid) config.twilio_api_key_sid = twilioApiKeySid;
        if (twilioApiKeySecret) config.twilio_api_key_secret = twilioApiKeySecret;
        if (twilioTwimlAppSid) config.twilio_twiml_app_sid = twilioTwimlAppSid;
        if (twilioNumeroDid) config.twilio_numero_did = twilioNumeroDid;
      } else if (providerEscolhido === "zenvia") {
        if (!modoEdicao && !zenviaAccessToken) {
          alert("Access Token é obrigatório"); setEnviando(false); return;
        }
        if (zenviaAccessToken) config.zenvia_access_token = zenviaAccessToken;
        if (zenviaDidId) config.zenvia_did_id = parseInt(zenviaDidId);
        if (zenviaNumeroDid) config.zenvia_numero_did = zenviaNumeroDid;
      }

      let resp;
      if (modoEdicao) {
        resp = await wa("voip/conexao/atualizar", {
          conexaoId: modoEdicao.id,
          campos: { nome, ...config }
        });
      } else {
        resp = await wa("voip/conexao/criar", {
          workspaceId: wsId,
          provider: providerEscolhido,
          nome,
          config
        });
      }

      if (!resp.success) {
        alert("❌ Erro: " + (resp.error || "desconhecido"));
      } else {
        alert(modoEdicao ? "✅ Conexão atualizada!" : `✅ Conexão criada e testada!${resp.info_conta?.nome_conta ? "\n\nConta: " + resp.info_conta.nome_conta : ""}`);
        setShowModal(false);
        limparForm();
        fetchConexoes();
      }
    } catch (e: any) {
      alert("❌ Erro: " + e.message);
    }
    setEnviando(false);
  };

  const testarConexao = async (c: ConexaoVoip) => {
    const resp = await wa("voip/conexao/testar", { conexaoId: c.id });
    if (resp.success) {
      const info = resp.info || {};
      alert(`✅ Conexão OK!\n\n${c.provider === "twilio" ? `Conta: ${info.nome_conta}\nStatus: ${info.status_conta}` : `Email: ${info.email}\nSaldo: R$ ${info.saldo || "?"}`}`);
    } else {
      alert(`❌ Conexão falhou: ${resp.info?.erro || resp.error}`);
    }
    fetchConexoes();
  };

  const deletar = async (c: ConexaoVoip) => {
    if (!confirm(`Deletar conexão "${c.nome}"?\n\nIsso remove as credenciais. Ligações antigas continuam no histórico.`)) return;
    const resp = await wa("voip/conexao/deletar", { conexaoId: c.id });
    if (resp.success) fetchConexoes();
    else alert("Erro ao deletar: " + resp.error);
  };

  const toggleDia = (dia: string) => {
    setDiasPermitidos(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const corStatus = (s: string) => s === "conectado" ? "#16a34a" : s === "erro" ? "#dc2626" : s === "testando" ? "#f59e0b" : "#6b7280";
  const emojiStatus = (s: string) => s === "conectado" ? "🟢" : s === "erro" ? "🔴" : s === "testando" ? "🟡" : "⚫";

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  if (!podeGerenciar) {
    return (
      <div style={{ padding: 32, textAlign: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <h1 style={{ color: "white", fontSize: 20 }}>🔒 Acesso Restrito</h1>
        <p style={{ color: "#9ca3af" }}>Apenas o dono ou administrador pode gerenciar conexões VOIP.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#0a0a0a", minHeight: "100vh", color: "white" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>📞 Telefonia VOIP</h1>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
          Conecte um provedor VOIP (Twilio ou Zenvia) pra fazer ligações pelo sistema. Cada workspace tem suas próprias conexões.
        </p>
      </div>

      {/* Avisos importantes */}
      <div style={{ background: "#f59e0b22", border: "1px solid #f59e0b44", borderRadius: 10, padding: 14 }}>
        <p style={{ color: "#fbbf24", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <b>⚠️ Importante:</b> ligação em massa pra quem não autorizou é proibido no Brasil (LGPD + Anatel).
          Os contatos marcados como "sem opt-in" serão <b>automaticamente ignorados</b> nas campanhas. Você pode marcar o opt-in
          no cadastro de cada cliente ou importá-lo via CSV.
        </p>
      </div>

      {/* Lista de conexões */}
      {loading ? (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: 40 }}>Carregando...</p>
      ) : conexoes.length === 0 ? (
        <div style={{ background: "#111", borderRadius: 12, padding: 40, textAlign: "center", border: "1px dashed #374151" }}>
          <p style={{ fontSize: 48, margin: "0 0 10px" }}>📞</p>
          <h3 style={{ color: "white", fontSize: 15, margin: "0 0 4px" }}>Nenhum provedor conectado ainda</h3>
          <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 16px" }}>Conecte Twilio ou Zenvia pra começar a fazer ligações.</p>
          <button onClick={() => { limparForm(); setShowModal(true); }}
            style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            + Conectar Provedor
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {conexoes.map(c => (
            <div key={c.id} style={{ background: "#111", borderRadius: 12, padding: 18, border: `1px solid ${corStatus(c.status)}33` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <p style={{ color: "white", fontSize: 15, fontWeight: "bold", margin: 0 }}>
                    {c.provider === "twilio" ? "🌐" : "🇧🇷"} {c.nome}
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0", textTransform: "uppercase" }}>
                    {c.provider === "twilio" ? "Twilio" : "Zenvia"} • ID {c.id}
                  </p>
                </div>
                <span style={{ background: corStatus(c.status) + "22", color: corStatus(c.status), fontSize: 11, padding: "3px 10px", borderRadius: 10, fontWeight: "bold" }}>
                  {emojiStatus(c.status)} {c.status}
                </span>
              </div>

              {c.numero_bina && (
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0" }}>
                  📱 Bina: <code style={{ color: "#16a34a", fontFamily: "monospace" }}>{c.numero_bina}</code>
                </p>
              )}
              {c.provider === "twilio" && c.twilio_numero_did && (
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0" }}>
                  ☎️ DID: <code style={{ color: "#3b82f6", fontFamily: "monospace" }}>{c.twilio_numero_did}</code>
                </p>
              )}
              {c.provider === "zenvia" && c.zenvia_numero_did && (
                <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0" }}>
                  ☎️ DID: <code style={{ color: "#3b82f6", fontFamily: "monospace" }}>{c.zenvia_numero_did}</code>
                </p>
              )}

              <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0" }}>
                🕘 Horário: {c.horario_inicio}–{c.horario_fim} • {(c.dias_permitidos || []).length} dias
              </p>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: "6px 0 14px" }}>
                {c.permite_gravacao ? "🎙️ Gravação ativa" : "🔇 Sem gravação"}
              </p>

              {c.erro_msg && (
                <p style={{ background: "#dc262622", color: "#fca5a5", padding: "6px 10px", borderRadius: 6, fontSize: 11, margin: "0 0 10px" }}>
                  ⚠️ {c.erro_msg}
                </p>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => testarConexao(c)} title="Re-testar credenciais"
                  style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                  🔄 Testar
                </button>
                <button onClick={() => abrirParaEditar(c)}
                  style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                  ✏️ Editar
                </button>
                <button onClick={() => deletar(c)}
                  style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                  🗑️ Deletar
                </button>
              </div>
            </div>
          ))}
          {/* Botão "adicionar" sempre visível */}
          <button onClick={() => { limparForm(); setShowModal(true); }}
            style={{ background: "#111", border: "1px dashed #374151", borderRadius: 12, padding: 40, cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: "bold" }}>
            + Adicionar provedor
          </button>
        </div>
      )}

      {/* MODAL — criar/editar */}
      {showModal && (
        <div onClick={() => !enviando && setShowModal(false)}
          style={{ position: "fixed", inset: 0, background: "#000e", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column", border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>
                {modoEdicao ? "✏️ Editar conexão" : "➕ Nova conexão VOIP"}
              </h2>
              <button onClick={() => setShowModal(false)} disabled={enviando}
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: enviando ? "not-allowed" : "pointer" }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* Seletor de provedor (só na criação) */}
              {!modoEdicao && !providerEscolhido && (
                <div>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 10px", textTransform: "uppercase", fontWeight: "bold" }}>
                    Escolha o provedor
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button onClick={() => setProviderEscolhido("twilio")}
                      style={{ background: "#1f2937", border: "2px solid #374151", borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 28, margin: "0 0 6px" }}>🌐</p>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: "0 0 4px" }}>Twilio</p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                        Internacional • Docs em inglês • Preços em USD<br/>
                        Fixo BR ~R$ 0,08/min • Móvel BR ~R$ 0,30/min
                      </p>
                    </button>
                    <button onClick={() => setProviderEscolhido("zenvia")}
                      style={{ background: "#1f2937", border: "2px solid #374151", borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 28, margin: "0 0 6px" }}>🇧🇷</p>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: "0 0 4px" }}>Zenvia</p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                        Brasileiro • Docs em PT • Suporte BR<br/>
                        Fixo R$ 0,09/min • Móvel R$ 0,35/min
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário */}
              {providerEscolhido && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid #1f2937" }}>
                    <span style={{ fontSize: 24 }}>{providerEscolhido === "twilio" ? "🌐" : "🇧🇷"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>
                        {providerEscolhido === "twilio" ? "Twilio" : "Zenvia"}
                      </p>
                      <button onClick={() => setMostrarAjuda(providerEscolhido)}
                        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        📖 Como obter as credenciais?
                      </button>
                    </div>
                    {!modoEdicao && (
                      <button onClick={() => setProviderEscolhido(null)}
                        style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer" }}>
                        trocar
                      </button>
                    )}
                  </div>

                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Nome da conexão *</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Twilio Vendas" style={IS} />
                  </div>

                  {/* Campos Twilio */}
                  {providerEscolhido === "twilio" && (
                    <>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Account SID * {modoEdicao && <span style={{ color: "#f59e0b", textTransform: "none" }}>(já salvo, só substitui se mudar)</span>}</label>
                        <input value={twilioAccountSid} onChange={e => setTwilioAccountSid(e.target.value)} placeholder="AC•••••••••••••••••••••••••••" style={IS} />
                      </div>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Auth Token * {modoEdicao && <span style={{ color: "#f59e0b", textTransform: "none" }}>(deixe vazio pra manter)</span>}</label>
                        <input type="password" value={twilioAuthToken} onChange={e => setTwilioAuthToken(e.target.value)} placeholder="••••••••••••••••••••••••••••••••" style={IS} />
                      </div>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Número DID (Caller ID)</label>
                        <input value={twilioNumeroDid} onChange={e => setTwilioNumeroDid(e.target.value)} placeholder="+5511999999999" style={IS} />
                        <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>Número comprado na Twilio que aparece no celular de quem recebe.</p>
                      </div>
                      <details style={{ background: "#1f2937", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ cursor: "pointer", color: "#9ca3af", fontSize: 12, fontWeight: "bold" }}>⚙️ Campos avançados (pra softphone)</summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                          <div>
                            <label style={{ color: "#9ca3af", fontSize: 10 }}>API Key SID</label>
                            <input value={twilioApiKeySid} onChange={e => setTwilioApiKeySid(e.target.value)} placeholder="SK•••••" style={IS} />
                          </div>
                          <div>
                            <label style={{ color: "#9ca3af", fontSize: 10 }}>API Key Secret</label>
                            <input type="password" value={twilioApiKeySecret} onChange={e => setTwilioApiKeySecret(e.target.value)} placeholder="•••••" style={IS} />
                          </div>
                          <div>
                            <label style={{ color: "#9ca3af", fontSize: 10 }}>TwiML App SID</label>
                            <input value={twilioTwimlAppSid} onChange={e => setTwilioTwimlAppSid(e.target.value)} placeholder="AP•••••" style={IS} />
                          </div>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>
                            Necessários na Fase 2 (softphone no navegador). Pode deixar vazio agora — vai funcionar a ligação via API.
                          </p>
                        </div>
                      </details>
                    </>
                  )}

                  {/* Campos Zenvia */}
                  {providerEscolhido === "zenvia" && (
                    <>
                      <div>
                        <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Access Token * {modoEdicao && <span style={{ color: "#f59e0b", textTransform: "none" }}>(deixe vazio pra manter)</span>}</label>
                        <input type="password" value={zenviaAccessToken} onChange={e => setZenviaAccessToken(e.target.value)} placeholder="••••••••••••••••••••••••••••••••" style={IS} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                        <div>
                          <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>DID ID</label>
                          <input value={zenviaDidId} onChange={e => setZenviaDidId(e.target.value)} placeholder="123" style={IS} />
                        </div>
                        <div>
                          <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>Número DID (Caller ID)</label>
                          <input value={zenviaNumeroDid} onChange={e => setZenviaNumeroDid(e.target.value)} placeholder="+5511999999999" style={IS} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Config comum */}
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>📱 Bina (opcional)</label>
                    <input value={numeroBina} onChange={e => setNumeroBina(e.target.value)} placeholder="+5562981519991" style={IS} />
                    <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>Número alternativo que aparece no celular de quem recebe. Se vazio, usa o DID.</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>🕘 Horário início</label>
                      <input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} style={IS} />
                    </div>
                    <div>
                      <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase", fontWeight: "bold" }}>🕘 Horário fim</label>
                      <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} style={IS} />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 6, textTransform: "uppercase", fontWeight: "bold" }}>📅 Dias permitidos pra ligação</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[["seg","Seg"],["ter","Ter"],["qua","Qua"],["qui","Qui"],["sex","Sex"],["sab","Sáb"],["dom","Dom"]].map(([id, label]) => {
                        const ativo = diasPermitidos.includes(id);
                        return (
                          <button key={id} onClick={() => toggleDia(id)}
                            style={{ background: ativo ? "#16a34a33" : "#1f2937", border: `1px solid ${ativo ? "#16a34a" : "#374151"}`, color: ativo ? "#16a34a" : "#9ca3af", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={permiteGravacao} onChange={e => setPermiteGravacao(e.target.checked)} />
                    <span style={{ color: "#e5e7eb", fontSize: 13 }}>🎙️ Gravar chamadas automaticamente</span>
                  </label>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "-8px 0 0" }}>
                    Por LGPD, você deve avisar o cliente de que a ligação é gravada no início da chamada.
                  </p>
                </div>
              )}
            </div>

            {providerEscolhido && (
              <div style={{ padding: "14px 24px", borderTop: "1px solid #1f2937", display: "flex", justifyContent: "flex-end", gap: 10, background: "#0a0a0a" }}>
                <button onClick={() => setShowModal(false)} disabled={enviando}
                  style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: enviando ? "not-allowed" : "pointer" }}>
                  Cancelar
                </button>
                <button onClick={salvar} disabled={enviando}
                  style={{ background: enviando ? "#047857" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: enviando ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                  {enviando ? "⏳ Testando e salvando..." : modoEdicao ? "💾 Salvar" : "🔌 Conectar e testar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL AJUDA — como obter credenciais */}
      {mostrarAjuda && (
        <div onClick={() => setMostrarAjuda(null)}
          style={{ position: "fixed", inset: 0, background: "#000e", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", border: "1px solid #1f2937", padding: 28 }}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 16px" }}>
              {mostrarAjuda === "twilio" ? "🌐 Como obter credenciais Twilio" : "🇧🇷 Como obter credenciais Zenvia"}
            </h2>

            {mostrarAjuda === "twilio" ? (
              <ol style={{ color: "#e5e7eb", fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>Acesse <a href="https://www.twilio.com/try-twilio" target="_blank" style={{ color: "#3b82f6" }}>twilio.com/try-twilio</a> e crie uma conta (trial tem USD 15 grátis).</li>
                <li>No painel, copie o <b>Account SID</b> e <b>Auth Token</b> da página inicial.</li>
                <li>Menu esquerdo → <b>Phone Numbers → Buy a Number</b> → compra um número BR (~USD 1/mês).</li>
                <li>Cole o número no campo <b>DID (Caller ID)</b> com prefixo internacional: <code style={{ background: "#1f2937", padding: "2px 6px" }}>+55...</code></li>
                <li>Pronto! Com Account SID + Auth Token + Número você já faz ligações via API.</li>
                <li><b>(Opcional, pra softphone no navegador)</b>: vai em <b>API Keys</b> e gera uma chave com permissão Voice. Depois cria um <b>TwiML App</b> apontando pra <code>https://api.wolfgyn.com.br/voip/twiml</code>. Mas isso só precisa na Fase 2.</li>
              </ol>
            ) : (
              <ol style={{ color: "#e5e7eb", fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>Acesse <a href="https://zenvia.com" target="_blank" style={{ color: "#3b82f6" }}>zenvia.com</a> e solicite demonstração comercial (é pay-as-you-go após setup).</li>
                <li>Após ativar a conta, entre no painel <a href="https://app.zenvia.com" target="_blank" style={{ color: "#3b82f6" }}>app.zenvia.com</a>.</li>
                <li>Menu → <b>API Tokens</b> → gere um token com permissão de <b>Voice</b>.</li>
                <li>Menu → <b>DIDs</b> → aluga um número brasileiro. Anote o <b>ID do DID</b> e o <b>número</b>.</li>
                <li>Cole o token, DID ID e o número nos campos aqui.</li>
                <li>Pronto! Lembrete: Zenvia cobra setup inicial + minutagem. Confirme os valores com o comercial deles.</li>
              </ol>
            )}

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setMostrarAjuda(null)}
                style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}