"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Canal = { id: number; nome: string; tipo: string; waba_id: string; };
type Template = {
  id: number; workspace_id: string; canal_id: number; waba_id: string;
  meta_template_id: string; meta_template_name: string; nome_amigavel: string;
  categoria: string; idioma: string; status: string;
  componentes: any[]; motivo_rejeicao?: string;
  criado_por: string; ultima_sincronizacao?: string; enviado_meta_em?: string;
  aprovado_em?: string; created_at: string;
};

const CATEGORIAS = [
  { v: "MARKETING", l: "📢 Marketing", d: "Promoções, novidades, ofertas" },
  { v: "UTILITY", l: "🔧 Utility", d: "Confirmações, avisos de pedido, suporte" },
  { v: "AUTHENTICATION", l: "🔒 Authentication", d: "Códigos OTP, verificação 2FA" }
];
const IDIOMAS = [
  { v: "pt_BR", l: "🇧🇷 Português (Brasil)" },
  { v: "en_US", l: "🇺🇸 Inglês (EUA)" },
  { v: "es_ES", l: "🇪🇸 Espanhol" }
];
const STATUS_COLORS: Record<string, string> = {
  rascunho: "#6b7280", pendente: "#f59e0b", aprovado: "#16a34a",
  rejeitado: "#dc2626", pausado: "#f59e0b", desativado: "#6b7280",
  em_recurso: "#3b82f6", deletando: "#6b7280", deletado: "#6b7280"
};
const STATUS_LABELS: Record<string, string> = {
  rascunho: "📝 Rascunho", pendente: "⏳ Pendente", aprovado: "✅ Aprovado",
  rejeitado: "❌ Rejeitado", pausado: "⏸️ Pausado", desativado: "🚫 Desativado",
  em_recurso: "🔄 Em recurso", deletando: "🗑️ Deletando", deletado: "🗑️ Deletado"
};

export default function TemplatesPage() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [canais, setCanais] = useState<Canal[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [detalhe, setDetalhe] = useState<Template | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const podeAcessar = isDono;

  const formInicial = {
    canalId: "",
    nomeAmigavel: "",
    metaTemplateName: "",
    categoria: "MARKETING",
    idioma: "pt_BR",
    headerTipo: "none" as "none" | "text" | "image" | "video" | "document",
    headerTexto: "",
    headerUrl: "",
    body: "",
    footer: "",
    botoes: [] as { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phone_number?: string }[]
  };
  const [form, setForm] = useState(formInicial);

  const wa = async (rota: string, body?: object) => {
    if (body !== undefined) {
      const resp = await fetch(`/api/whatsapp?rota=${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return resp.json();
    }
    const resp = await fetch(`/api/whatsapp?rota=${rota}`);
    return resp.json();
  };

  const fetchCanais = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("conexoes").select("id, nome, tipo, waba_id").eq("workspace_id", wsId).eq("tipo", "waba");
    setCanais(data || []);
  };

  const fetchTemplates = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("templates_waba").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
    setTemplates(data || []);
  };

  useEffect(() => {
    if (!wsId) return;
    fetchCanais();
    fetchTemplates();

    // Realtime no Supabase
    const ch = supabase.channel("templates_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "templates_waba", filter: `workspace_id=eq.${wsId}` }, () => fetchTemplates())
      .subscribe();

    // Polling 30s (UI)
    const interval = setInterval(fetchTemplates, 30000);

    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [wsId]);

  // Monta o array de componentes no formato da Meta
  const montarComponentes = () => {
    const comps: any[] = [];
    if (form.headerTipo === "text" && form.headerTexto) {
      comps.push({ type: "HEADER", format: "TEXT", text: form.headerTexto });
    } else if (["image", "video", "document"].includes(form.headerTipo) && form.headerUrl) {
      comps.push({ type: "HEADER", format: form.headerTipo.toUpperCase(), example: { header_handle: [form.headerUrl] } });
    }
    if (form.body) comps.push({ type: "BODY", text: form.body });
    if (form.footer) comps.push({ type: "FOOTER", text: form.footer });
    if (form.botoes.length > 0) {
      comps.push({
        type: "BUTTONS",
        buttons: form.botoes.map(b => {
          if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
          if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
          if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
          return b;
        })
      });
    }
    return comps;
  };

  const enviarParaMeta = async () => {
    if (!form.canalId) return alert("Selecione um canal WABA!");
    if (!form.metaTemplateName.trim()) return alert("Digite o nome do template (snake_case)!");
    if (!form.body.trim()) return alert("O corpo da mensagem é obrigatório!");
    if (!/^[a-z0-9_]+$/.test(form.metaTemplateName)) {
      return alert("Nome do template deve ter só letras minúsculas, números e _\nExemplo: boas_vindas_cliente");
    }

    setEnviando(true);
    try {
      const resp = await wa("templates/criar", {
        workspaceId: wsId,
        canalId: parseInt(form.canalId),
        nomeAmigavel: form.nomeAmigavel || form.metaTemplateName,
        metaTemplateName: form.metaTemplateName,
        categoria: form.categoria,
        idioma: form.idioma,
        componentes: montarComponentes(),
        criadoPor: user?.email
      });

      if (resp.success) {
        alert(`✅ Template enviado pra Meta!\n\nAguarde a aprovação (geralmente 15-60 minutos).`);
        setShowModal(false); setForm(formInicial);
        fetchTemplates();
      } else {
        alert(`❌ Erro: ${resp.error}`);
      }
    } catch (e: any) { alert(`❌ Erro: ${e.message}`); }
    setEnviando(false);
  };

  const deletarTemplate = async (t: Template) => {
    if (!confirm(`Deletar o template "${t.nome_amigavel || t.meta_template_name}"?\n\nIsso vai remover ele da Meta também.`)) return;
    try {
      const resp = await wa("templates/deletar", { templateId: t.id });
      if (resp.success) { alert("✅ Template deletado!"); fetchTemplates(); }
      else alert(`❌ Erro: ${resp.error}`);
    } catch (e: any) { alert(`❌ Erro: ${e.message}`); }
  };

  const sincronizarAgora = async () => {
    setSincronizando(true);
    try {
      for (const c of canais) {
        await wa("templates/sincronizar", { canalId: c.id });
      }
      await fetchTemplates();
      alert("✅ Sincronização concluída!");
    } catch (e: any) { alert(`❌ Erro: ${e.message}`); }
    setSincronizando(false);
  };

  const adicionarBotao = () => {
    if (form.botoes.length >= 3) return alert("Máximo 3 botões por template");
    setForm(p => ({ ...p, botoes: [...p.botoes, { type: "QUICK_REPLY", text: "" }] }));
  };
  const removerBotao = (i: number) => setForm(p => ({ ...p, botoes: p.botoes.filter((_, idx) => idx !== i) }));
  const atualizarBotao = (i: number, campo: string, valor: string) => {
    setForm(p => ({ ...p, botoes: p.botoes.map((b, idx) => idx === i ? { ...b, [campo]: valor } : b) }));
  };

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  if (!podeAcessar) {
    return (
      <div style={{ padding: 32, textAlign: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <h1 style={{ color: "white", fontSize: 20 }}>🔒 Acesso Restrito</h1>
        <p style={{ color: "#9ca3af" }}>Apenas o dono do workspace pode gerenciar templates.</p>
      </div>
    );
  }

  // Contagem de variáveis detectadas no body
  const varsBody = (form.body.match(/\{\{\d+\}\}/g) || []).length;

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#0a0a0a", minHeight: "100vh", color: "white" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/chatbot")}
          style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>
          ← Voltar
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>📨 Templates WABA</h1>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
            Cadastre templates e envie pra aprovação da Meta. Templates aprovados podem ser usados em disparos.
          </p>
        </div>
        <button onClick={sincronizarAgora} disabled={sincronizando}
          style={{ background: "#1f2937", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px 18px", fontSize: 13, cursor: sincronizando ? "wait" : "pointer", fontWeight: "bold" }}>
          {sincronizando ? "⏳ Sincronizando..." : "🔄 Sincronizar agora"}
        </button>
        <button onClick={() => { setForm(formInicial); setShowModal(true); }}
          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
          + Novo Template
        </button>
      </div>

      {/* Info */}
      <div style={{ background: "#3b82f622", border: "1px solid #3b82f644", borderRadius: 10, padding: "12px 16px" }}>
        <p style={{ color: "#93c5fd", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <b>ℹ️ Como funciona:</b> Você cadastra aqui, o sistema envia pra Meta revisar.
          A Meta leva em média 15 a 60 minutos pra aprovar (pode levar até 24h).
          O sistema verifica o status a cada 30 minutos automaticamente.
          Você recebe notificação quando for aprovado ou rejeitado.
        </p>
      </div>

      {/* Canais disponíveis */}
      {canais.length === 0 ? (
        <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>
            ⚠️ Nenhum canal WABA conectado. Conecte um canal WABA em <b>Conexões</b> antes de criar templates.
          </p>
        </div>
      ) : null}

      {/* Lista de templates */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>📋 Meus Templates ({templates.length})</h2>
        {templates.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 32 }}>
            Nenhum template cadastrado ainda. Clique em <b>+ Novo Template</b> pra começar.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {templates.map(t => {
              const canal = canais.find(c => c.id === t.canal_id);
              const color = STATUS_COLORS[t.status] || "#6b7280";
              const bodyComp = (t.componentes || []).find((c: any) => c.type === "BODY");
              const bodyPreview = bodyComp?.text ? (bodyComp.text.length > 120 ? bodyComp.text.slice(0, 120) + "..." : bodyComp.text) : "";
              return (
                <div key={t.id} style={{ background: "#1f2937", borderRadius: 10, padding: 16, border: `1px solid ${color}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>
                        {t.nome_amigavel || t.meta_template_name}
                      </p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontFamily: "monospace" }}>
                        {t.meta_template_name} • {t.idioma} • {t.categoria}
                      </p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0" }}>
                        📱 {canal?.nome || "Canal removido"} • 👤 {t.criado_por}
                      </p>
                    </div>
                    <span style={{ background: color + "22", color, fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                  {bodyPreview && (
                    <p style={{ color: "#e5e7eb", fontSize: 12, margin: "0 0 10px", background: "#0a0a0a", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap" }}>
                      {bodyPreview}
                    </p>
                  )}
                  {t.motivo_rejeicao && (
                    <p style={{ color: "#fca5a5", fontSize: 11, margin: "0 0 10px" }}>
                      ❌ Motivo: {t.motivo_rejeicao}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setDetalhe(t)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>👁️ Detalhes</button>
                    <button onClick={() => deletarTemplate(t)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>🗑️ Deletar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal — Criar Template */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column", border: "1px solid #1f2937" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>➕ Novo Template</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Canal */}
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Canal WABA *</label>
                <select value={form.canalId} onChange={e => setForm(p => ({ ...p, canalId: e.target.value }))} style={IS}>
                  <option value="">Selecione o canal</option>
                  {canais.map(c => (<option key={c.id} value={c.id}>{c.nome} (WABA: {c.waba_id})</option>))}
                </select>
                <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>O template será cadastrado neste WABA específico.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nome Técnico *</label>
                  <input value={form.metaTemplateName} onChange={e => setForm(p => ({ ...p, metaTemplateName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} placeholder="boas_vindas_cliente" style={IS} />
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>Só minúsculas, números e _</p>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nome Amigável</label>
                  <input value={form.nomeAmigavel} onChange={e => setForm(p => ({ ...p, nomeAmigavel: e.target.value }))} placeholder="Boas-vindas ao cliente" style={IS} />
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>Pra aparecer no sistema</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Categoria *</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={IS}>
                    {CATEGORIAS.map(c => (<option key={c.v} value={c.v}>{c.l}</option>))}
                  </select>
                  <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0" }}>{CATEGORIAS.find(c => c.v === form.categoria)?.d}</p>
                </div>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Idioma *</label>
                  <select value={form.idioma} onChange={e => setForm(p => ({ ...p, idioma: e.target.value }))} style={IS}>
                    {IDIOMAS.map(i => (<option key={i.v} value={i.v}>{i.l}</option>))}
                  </select>
                </div>
              </div>

              {/* HEADER */}
              <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>HEADER (opcional)</p>
                <select value={form.headerTipo} onChange={e => setForm(p => ({ ...p, headerTipo: e.target.value as any }))} style={{ ...IS, marginBottom: 10 }}>
                  <option value="none">Sem cabeçalho</option>
                  <option value="text">📝 Texto</option>
                  <option value="image">🖼️ Imagem</option>
                  <option value="video">🎬 Vídeo</option>
                  <option value="document">📄 Documento</option>
                </select>
                {form.headerTipo === "text" && (
                  <input value={form.headerTexto} onChange={e => setForm(p => ({ ...p, headerTexto: e.target.value }))} placeholder="Ex: Olá, {{1}}!" maxLength={60} style={IS} />
                )}
                {["image", "video", "document"].includes(form.headerTipo) && (
                  <input value={form.headerUrl} onChange={e => setForm(p => ({ ...p, headerUrl: e.target.value }))} placeholder="URL do arquivo (exemplo pra Meta analisar)" style={IS} />
                )}
              </div>

              {/* BODY */}
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Mensagem (BODY) *</label>
                <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={5} placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado!" style={{ ...IS, resize: "vertical", minHeight: 120, fontFamily: "monospace" }} />
                <p style={{ color: varsBody > 0 ? "#16a34a" : "#6b7280", fontSize: 10, margin: "4px 0 0" }}>
                  {form.body.length}/1024 caracteres • {varsBody} variável(is) detectada(s) — use {"{{1}}"}, {"{{2}}"}, etc
                </p>
              </div>

              {/* FOOTER */}
              <div>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Rodapé (opcional)</label>
                <input value={form.footer} onChange={e => setForm(p => ({ ...p, footer: e.target.value }))} maxLength={60} placeholder="Ex: Responda STOP pra descadastrar" style={IS} />
              </div>

              {/* BUTTONS */}
              <div style={{ background: "#1f2937", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>BOTÕES (até 3, opcional)</p>
                  <button onClick={adicionarBotao} disabled={form.botoes.length >= 3} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>+ Adicionar</button>
                </div>
                {form.botoes.map((b, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 6, alignItems: "center" }}>
                      <select value={b.type} onChange={e => atualizarBotao(i, "type", e.target.value)} style={{ ...IS, fontSize: 12, padding: "8px 10px" }}>
                        <option value="QUICK_REPLY">Resposta Rápida</option>
                        <option value="URL">Link (URL)</option>
                        <option value="PHONE_NUMBER">Telefone</option>
                      </select>
                      <input value={b.text} onChange={e => atualizarBotao(i, "text", e.target.value)} placeholder="Texto do botão" maxLength={25} style={{ ...IS, fontSize: 12, padding: "8px 10px" }} />
                      <button onClick={() => removerBotao(i)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "8px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                    {b.type === "URL" && (
                      <input value={b.url || ""} onChange={e => atualizarBotao(i, "url", e.target.value)} placeholder="https://..." style={{ ...IS, fontSize: 12, padding: "8px 10px", marginTop: 6 }} />
                    )}
                    {b.type === "PHONE_NUMBER" && (
                      <input value={b.phone_number || ""} onChange={e => atualizarBotao(i, "phone_number", e.target.value)} placeholder="+5562999999999" style={{ ...IS, fontSize: 12, padding: "8px 10px", marginTop: 6 }} />
                    )}
                  </div>
                ))}
                {form.botoes.length === 0 && <p style={{ color: "#6b7280", fontSize: 11, margin: 0, textAlign: "center", padding: 10 }}>Nenhum botão adicionado</p>}
              </div>
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid #1f2937", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", color: "#9ca3af", border: "1px solid #374151", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={enviarParaMeta} disabled={enviando} style={{ background: enviando ? "#1d4ed8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
                {enviando ? "⏳ Enviando..." : "📤 Enviar pra Meta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Detalhes */}
      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", border: "1px solid #1f2937" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>{detalhe.nome_amigavel || detalhe.meta_template_name}</h3>
              <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div><p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase" }}>Status</p><p style={{ color: STATUS_COLORS[detalhe.status], fontSize: 14, fontWeight: "bold", margin: 0 }}>{STATUS_LABELS[detalhe.status]}</p></div>
              <div><p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase" }}>Nome Técnico (Meta)</p><p style={{ color: "white", fontSize: 13, fontFamily: "monospace", margin: 0 }}>{detalhe.meta_template_name}</p></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase" }}>Categoria</p><p style={{ color: "white", fontSize: 13, margin: 0 }}>{detalhe.categoria}</p></div>
                <div><p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase" }}>Idioma</p><p style={{ color: "white", fontSize: 13, margin: 0 }}>{detalhe.idioma}</p></div>
              </div>
              {detalhe.motivo_rejeicao && (
                <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 8, padding: 12 }}>
                  <p style={{ color: "#fca5a5", fontSize: 12, margin: 0, fontWeight: "bold" }}>❌ Motivo da rejeição:</p>
                  <p style={{ color: "#fca5a5", fontSize: 12, margin: "4px 0 0" }}>{detalhe.motivo_rejeicao}</p>
                </div>
              )}
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 6px", textTransform: "uppercase" }}>Componentes</p>
                <div style={{ background: "#1f2937", borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace", color: "#e5e7eb", whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
                  {JSON.stringify(detalhe.componentes, null, 2)}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 11 }}>
                <div><p style={{ color: "#6b7280", margin: "0 0 2px", textTransform: "uppercase" }}>Criado em</p><p style={{ color: "#e5e7eb", margin: 0 }}>{new Date(detalhe.created_at).toLocaleString("pt-BR")}</p></div>
                {detalhe.aprovado_em && <div><p style={{ color: "#6b7280", margin: "0 0 2px", textTransform: "uppercase" }}>Aprovado em</p><p style={{ color: "#16a34a", margin: 0 }}>{new Date(detalhe.aprovado_em).toLocaleString("pt-BR")}</p></div>}
                {detalhe.ultima_sincronizacao && <div><p style={{ color: "#6b7280", margin: "0 0 2px", textTransform: "uppercase" }}>Última sync</p><p style={{ color: "#e5e7eb", margin: 0 }}>{new Date(detalhe.ultima_sincronizacao).toLocaleString("pt-BR")}</p></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}