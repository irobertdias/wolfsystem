"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Canal = { id: number; nome: string; tipo: string; status: string; waba_id?: string; };
type Template = {
  id: number; canal_id: number; meta_template_name: string; nome_amigavel: string;
  categoria: string; idioma: string; status: string; componentes: any[];
};
type Disparo = {
  id: number; workspace_id: string; canal_id: number; criado_por: string; nome: string;
  mensagem: string; delay_min_seg: number; delay_max_seg: number; status: string;
  total_contatos: number; total_enviados: number; total_falhas: number;
  pausado_motivo?: string; erro_msg?: string;
  tipo?: string; template_name?: string;
  iniciado_em?: string; finalizado_em?: string; created_at: string;
};
type ContatoWaba = { numero: string; vars: Record<string, string>; };

export default function DisparosPage() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [tipoDisparo, setTipoDisparo] = useState<"webjs" | "waba">("webjs");
  const [canais, setCanais] = useState<Canal[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [disparos, setDisparos] = useState<Disparo[]>([]);

  const [canalSelecionado, setCanalSelecionado] = useState<number | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [numerosTexto, setNumerosTexto] = useState("");

  // WABA: variáveis fixas (pra todos) e contatos com variáveis individuais
  const [varsFixas, setVarsFixas] = useState<Record<string, string>>({});
  const [contatosWaba, setContatosWaba] = useState<ContatoWaba[]>([]);

  const [delayMin, setDelayMin] = useState(60);
  const [delayMax, setDelayMax] = useState(120);
  const [enviando, setEnviando] = useState(false);
  const [disparoDetalhe, setDisparoDetalhe] = useState<Disparo | null>(null);
  const [contatosDetalhe, setContatosDetalhe] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const podeDisparar = isDono || permissoes.supervisor;

  // Ajusta delays default quando muda tipo
  useEffect(() => {
    if (tipoDisparo === "waba") {
      setDelayMin(1); setDelayMax(3);
    } else {
      setDelayMin(60); setDelayMax(120);
    }
    setCanalSelecionado(null);
    setTemplateSelecionado(null);
    setVarsFixas({});
    setContatosWaba([]);
    setNumerosTexto("");
  }, [tipoDisparo]);

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
    const filtro = tipoDisparo === "webjs" ? "webjs" : "waba";
    const { data } = await supabase.from("conexoes")
      .select("id, nome, tipo, status, waba_id")
      .eq("workspace_id", wsId).eq("tipo", filtro);
    setCanais(data || []);
  };

  const fetchTemplatesAprovados = async () => {
    if (!wsId || !canalSelecionado) { setTemplates([]); return; }
    const { data } = await supabase.from("templates_waba")
      .select("*").eq("workspace_id", wsId).eq("canal_id", canalSelecionado).eq("status", "aprovado")
      .order("created_at", { ascending: false });
    setTemplates(data || []);
  };

  const fetchDisparos = async () => {
    if (!wsId) return;
    const { data } = await supabase.from("disparos").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50);
    setDisparos(data || []);
  };

  useEffect(() => {
    if (!wsId) return;
    fetchCanais();
    fetchDisparos();
    const ch = supabase.channel("disparos_rt_" + wsId)
      .on("postgres_changes", { event: "*", schema: "public", table: "disparos", filter: `workspace_id=eq.${wsId}` }, () => fetchDisparos())
      .subscribe();
    const interval = setInterval(() => { fetchDisparos(); fetchCanais(); }, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [wsId, tipoDisparo]);

  useEffect(() => { fetchTemplatesAprovados(); }, [canalSelecionado, wsId]);

  // Polling do disparo aberto
  useEffect(() => {
    if (!disparoDetalhe) return;
    const fetchContatos = async () => {
      const { data } = await supabase.from("disparo_contatos").select("*").eq("disparo_id", disparoDetalhe.id).order("id");
      setContatosDetalhe(data || []);
    };
    fetchContatos();
    const i = setInterval(fetchContatos, 3000);
    return () => clearInterval(i);
  }, [disparoDetalhe?.id]);

  const processarNumeros = (texto: string): string[] => {
    return texto
      .split(/[\n,;]+/)
      .map(n => n.replace(/\D/g, ""))
      .filter(n => n.length >= 10 && n.length <= 15);
  };

  // Extrai as variáveis usadas no template (body + header)
  const extrairVariaveisTemplate = (): string[] => {
    const tpl = templates.find(t => t.id === templateSelecionado);
    if (!tpl) return [];
    const vars = new Set<string>();
    for (const comp of tpl.componentes || []) {
      if ((comp.type === "BODY" && comp.text) || (comp.type === "HEADER" && comp.format === "TEXT" && comp.text)) {
        const matches = comp.text.matchAll(/\{\{(\d+)\}\}/g);
        for (const m of matches) vars.add(m[1]);
      }
    }
    return Array.from(vars).sort((a, b) => parseInt(a) - parseInt(b));
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      const linhas = txt.split(/[\r\n]+/).filter(l => l.trim());

      if (tipoDisparo === "webjs") {
        // WebJS: pega só primeira coluna (número)
        const numeros = linhas
          .map(l => l.split(/[,;]/)[0])
          .map(n => n.replace(/\D/g, ""))
          .filter(n => n.length >= 10 && n.length <= 15);
        setNumerosTexto(numeros.join("\n"));
        alert(`✅ ${numeros.length} número(s) importado(s)`);
      } else {
        // WABA: primeira coluna = número, demais = vars {{1}}, {{2}}, ...
        const varsTemplate = extrairVariaveisTemplate();
        const contatos: ContatoWaba[] = [];
        for (const linha of linhas) {
          const cols = linha.split(/[,;]/).map(c => c.trim());
          const numero = cols[0]?.replace(/\D/g, "") || "";
          if (numero.length < 10 || numero.length > 15) continue;
          const vars: Record<string, string> = {};
          varsTemplate.forEach((varNum, idx) => {
            if (cols[idx + 1] !== undefined) vars[varNum] = cols[idx + 1];
          });
          contatos.push({ numero, vars });
        }
        setContatosWaba(contatos);
        alert(`✅ ${contatos.length} contato(s) importado(s) com ${varsTemplate.length} variável(is) por linha`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Monta lista de contatos WABA a partir dos números digitados manualmente
  const montarContatosWabaDoTexto = (): ContatoWaba[] => {
    const numeros = processarNumeros(numerosTexto);
    return numeros.map(n => ({ numero: n, vars: {} }));
  };

  const iniciarDisparoWebjs = async () => {
    const numeros = processarNumeros(numerosTexto);
    if (!canalSelecionado) return alert("Selecione um canal!");
    if (!mensagem.trim()) return alert("Digite a mensagem!");
    if (numeros.length === 0) return alert("Nenhum número válido!");
    if (numeros.length > 1000) return alert("Máximo 1000 números por disparo!");
    if (delayMin < 30) return alert("Delay mínimo deve ser pelo menos 30 segundos");
    if (delayMin > delayMax) return alert("Delay mínimo não pode ser maior que o máximo");

    const avisoDelay = delayMin < 60 ? `\n\n⚠️ ATENÇÃO: Delay abaixo de 60s aumenta MUITO o risco de banimento!` : "";
    const tempoEstimadoMin = Math.ceil((numeros.length * (delayMin + delayMax) / 2) / 60);
    if (!confirm(`Iniciar disparo WebJS?\n\n📱 Números: ${numeros.length}\n⏱️ Delay: ${delayMin}-${delayMax}s\n⏳ Estimado: ~${tempoEstimadoMin}min${avisoDelay}`)) return;

    setEnviando(true);
    try {
      const resp = await wa("disparos/criar", {
        workspaceId: wsId, canalId: canalSelecionado, criadoPor: user?.email,
        nome: nome || null, mensagem, numeros,
        delayMinSeg: delayMin, delayMaxSeg: delayMax
      });
      if (resp.success) {
        alert(`✅ Disparo iniciado!\n\n${resp.totalContatos} números na fila.`);
        setMensagem(""); setNumerosTexto(""); setNome("");
        fetchDisparos();
      } else alert("❌ Erro: " + (resp.error || "desconhecido"));
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEnviando(false);
  };

  const iniciarDisparoWaba = async () => {
    if (!canalSelecionado) return alert("Selecione um canal WABA!");
    if (!templateSelecionado) return alert("Selecione um template aprovado!");

    const contatosFinal = contatosWaba.length > 0 ? contatosWaba : montarContatosWabaDoTexto();
    if (contatosFinal.length === 0) return alert("Adicione pelo menos 1 contato!");
    if (contatosFinal.length > 5000) return alert("Máximo 5000 contatos por disparo WABA");

    const varsTemplate = extrairVariaveisTemplate();
    // Verifica se todas as variáveis têm valor (em varsFixas ou em cada contato)
    const varsSemValor: string[] = [];
    for (const v of varsTemplate) {
      const temValorFixo = varsFixas[v] && varsFixas[v].trim();
      const algumContatoSemValor = contatosFinal.some(c => !c.vars[v] && !temValorFixo);
      if (algumContatoSemValor && !temValorFixo) varsSemValor.push(v);
    }
    if (varsSemValor.length > 0) {
      if (!confirm(`⚠️ As variáveis {{${varsSemValor.join("}}, {{")}}} não têm valor definido.\n\nElas serão enviadas LITERALMENTE ({{1}}, etc) se não tiverem valor. Continuar mesmo assim?`)) return;
    }

    if (!confirm(`Iniciar disparo WABA?\n\n📱 Contatos: ${contatosFinal.length}\n📋 Template: ${templates.find(t => t.id === templateSelecionado)?.nome_amigavel}\n⏱️ Delay: ${delayMin}-${delayMax}s`)) return;

    setEnviando(true);
    try {
      const resp = await wa("disparos/criar-waba", {
        workspaceId: wsId, canalId: canalSelecionado, criadoPor: user?.email,
        nome: nome || null,
        templateId: templateSelecionado,
        varsFixas,
        contatos: contatosFinal,
        delayMinSeg: delayMin, delayMaxSeg: delayMax
      });
      if (resp.success) {
        alert(`✅ Disparo WABA iniciado!\n\n${resp.totalContatos} contatos na fila.`);
        setNome(""); setVarsFixas({}); setContatosWaba([]); setNumerosTexto("");
        fetchDisparos();
      } else alert("❌ Erro: " + (resp.error || "desconhecido"));
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEnviando(false);
  };

  const iniciarDisparo = () => {
    if (tipoDisparo === "webjs") iniciarDisparoWebjs();
    else iniciarDisparoWaba();
  };

  const pausarDisparo = async (id: number) => { await wa("disparos/pausar", { disparoId: id }); fetchDisparos(); };
  const retomarDisparo = async (id: number) => { await wa("disparos/retomar", { disparoId: id }); fetchDisparos(); };
  const cancelarDisparo = async (id: number) => {
    if (!confirm("Cancelar esse disparo?")) return;
    await wa("disparos/cancelar", { disparoId: id });
    fetchDisparos();
  };

  const numerosValidos = tipoDisparo === "webjs"
    ? processarNumeros(numerosTexto)
    : (contatosWaba.length > 0 ? contatosWaba.map(c => c.numero) : processarNumeros(numerosTexto));
  const canalEscolhido = canais.find(c => c.id === canalSelecionado);
  const canalConectado = canalEscolhido?.status === "conectado";
  const templateEscolhido = templates.find(t => t.id === templateSelecionado);
  const varsTemplate = extrairVariaveisTemplate();

  const statusColor: Record<string, string> = {
    pendente: "#f59e0b", rodando: "#3b82f6", pausado: "#f59e0b",
    concluido: "#16a34a", cancelado: "#6b7280", erro: "#dc2626"
  };
  const statusLabel: Record<string, string> = {
    pendente: "⏳ Pendente", rodando: "🚀 Enviando", pausado: "⏸️ Pausado",
    concluido: "✅ Concluído", cancelado: "🛑 Cancelado", erro: "❌ Erro"
  };

  const IS = { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "white", fontSize: 13, boxSizing: "border-box" as const };

  if (!podeDisparar) {
    return (
      <div style={{ padding: 32, textAlign: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <h1 style={{ color: "white", fontSize: 20 }}>🔒 Acesso Restrito</h1>
        <p style={{ color: "#9ca3af" }}>Apenas o dono ou supervisor podem acessar disparos em massa.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, background: "#0a0a0a", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/chatbot")} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>
          ← Voltar ao Chatbot
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>📢 Disparos em Massa</h1>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
            Envie mensagens em lote via WhatsApp Web (risco de ban) ou via API Oficial Meta (template aprovado, sem banimento).
          </p>
        </div>
      </div>

      {/* TOGGLE TIPO */}
      <div style={{ background: "#111", borderRadius: 12, padding: 16, border: "1px solid #1f2937" }}>
        <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 10px" }}>Tipo de disparo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={() => setTipoDisparo("webjs")}
            style={{ background: tipoDisparo === "webjs" ? "#3b82f622" : "#1f2937", border: `2px solid ${tipoDisparo === "webjs" ? "#3b82f6" : "#374151"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
            <p style={{ fontSize: 22, margin: "0 0 4px" }}>📱</p>
            <p style={{ color: tipoDisparo === "webjs" ? "#3b82f6" : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>WhatsApp Web</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: 0, lineHeight: 1.4 }}>Texto livre. Delays longos obrigatórios. Alto risco de banimento.</p>
          </button>
          <button onClick={() => setTipoDisparo("waba")}
            style={{ background: tipoDisparo === "waba" ? "#16a34a22" : "#1f2937", border: `2px solid ${tipoDisparo === "waba" ? "#16a34a" : "#374151"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
            <p style={{ fontSize: 22, margin: "0 0 4px" }}>🔗</p>
            <p style={{ color: tipoDisparo === "waba" ? "#16a34a" : "white", fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>API Oficial (WABA)</p>
            <p style={{ color: "#6b7280", fontSize: 11, margin: 0, lineHeight: 1.4 }}>Usa template aprovado pela Meta. Sem banimento. Até 5000/disparo.</p>
          </button>
        </div>
      </div>

      {/* AVISO */}
      {tipoDisparo === "webjs" ? (
        <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 10, padding: "12px 16px" }}>
          <p style={{ color: "#fca5a5", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            <b>⚠️ Aviso:</b> Disparo por WhatsApp Web é a principal causa de banimento. Use delays ≥60s, não dispare pra quem nunca te mandou mensagem, e limite 100-200/dia por número novo.
          </p>
        </div>
      ) : (
        <div style={{ background: "#16a34a22", border: "1px solid #16a34a44", borderRadius: 10, padding: "12px 16px" }}>
          <p style={{ color: "#86efac", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            <b>✅ Via API Oficial:</b> Templates aprovados pela Meta não causam banimento. O preço por mensagem varia por categoria (Marketing/Utility/Authentication). Delay padrão 1-3s é suficiente.
          </p>
        </div>
      )}

      {/* FORMULÁRIO */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>🚀 Novo Disparo {tipoDisparo === "webjs" ? "WebJS" : "WABA"}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Canal {tipoDisparo === "webjs" ? "WhatsApp Web" : "WABA"}</label>
            <select value={canalSelecionado || ""} onChange={e => setCanalSelecionado(parseInt(e.target.value) || null)} style={IS}>
              <option value="">Selecione um canal</option>
              {canais.map(c => (
                <option key={c.id} value={c.id} disabled={c.status !== "conectado"}>
                  {c.status === "conectado" ? "🟢" : "🔴"} {c.nome}
                </option>
              ))}
            </select>
            {canalSelecionado && !canalConectado && (
              <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0" }}>⚠️ Canal desconectado.</p>
            )}
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Nome da Campanha (opcional)</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Black Friday" style={IS} />
          </div>
        </div>

        {/* WABA: seleção de template */}
        {tipoDisparo === "waba" && canalSelecionado && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>📋 Template Aprovado</label>
            {templates.length === 0 ? (
              <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 8, padding: 16, textAlign: "center" }}>
                <p style={{ color: "#fca5a5", fontSize: 13, margin: "0 0 10px" }}>⚠️ Nenhum template aprovado pra esse canal.</p>
                <button onClick={() => router.push("/chatbot/templates")} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>📨 Criar Template Agora</button>
              </div>
            ) : (
              <select value={templateSelecionado || ""} onChange={e => setTemplateSelecionado(parseInt(e.target.value) || null)} style={IS}>
                <option value="">Selecione um template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    ✅ {t.nome_amigavel || t.meta_template_name} ({t.categoria}, {t.idioma})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* WABA: preview do template */}
        {tipoDisparo === "waba" && templateEscolhido && (
          <div style={{ background: "#1f2937", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 8px" }}>📋 Preview do Template</p>
            {(templateEscolhido.componentes || []).map((c: any, i: number) => {
              if (c.type === "HEADER" && c.format === "TEXT") return <p key={i} style={{ color: "#86efac", fontSize: 12, margin: "0 0 6px", fontWeight: "bold" }}>📌 {c.text}</p>;
              if (c.type === "HEADER") return <p key={i} style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 6px" }}>📎 {c.format} (mídia anexada)</p>;
              if (c.type === "BODY") return <p key={i} style={{ color: "#e5e7eb", fontSize: 13, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{c.text}</p>;
              if (c.type === "FOOTER") return <p key={i} style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 6px", fontStyle: "italic" }}>{c.text}</p>;
              if (c.type === "BUTTONS") return <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {(c.buttons || []).map((b: any, j: number) => (
                  <span key={j} style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>{b.text}</span>
                ))}
              </div>;
              return null;
            })}
          </div>
        )}

        {/* WABA: variáveis fixas */}
        {tipoDisparo === "waba" && templateEscolhido && varsTemplate.length > 0 && (
          <div style={{ background: "#1f2937", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", margin: "0 0 4px" }}>🔧 Variáveis Fixas (valor pra TODOS)</p>
            <p style={{ color: "#6b7280", fontSize: 10, margin: "0 0 12px" }}>Deixe vazio se quer definir por contato no CSV (última coluna por variável).</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {varsTemplate.map(v => (
                <div key={v}>
                  <label style={{ color: "#9ca3af", fontSize: 10, display: "block", marginBottom: 2 }}>{"{{"}{v}{"}}"}</label>
                  <input
                    value={varsFixas[v] || ""}
                    onChange={e => setVarsFixas(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={`Valor pra {{${v}}}`}
                    style={{ ...IS, padding: "7px 10px", fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WebJS: mensagem */}
        {tipoDisparo === "webjs" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>💬 Mensagem</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Digite a mensagem..." rows={5} style={{ ...IS, resize: "vertical", minHeight: 100 }} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>{mensagem.length} caracteres</p>
          </div>
        )}

        {/* Delays */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>⏱️ Delay Mínimo (seg)</label>
            <input type="number" min={tipoDisparo === "webjs" ? 30 : 0} max={300} value={delayMin} onChange={e => setDelayMin(parseInt(e.target.value) || 0)} style={IS} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>
              {tipoDisparo === "webjs" ? "Mínimo 30s, recomendado 60s+" : "WABA: pode ser 0-5s"}
            </p>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>⏱️ Delay Máximo (seg)</label>
            <input type="number" min={tipoDisparo === "webjs" ? 30 : 0} max={300} value={delayMax} onChange={e => setDelayMax(parseInt(e.target.value) || 0)} style={IS} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>Máx: 300s</p>
          </div>
        </div>

        {/* Números / Contatos */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>
            📱 {tipoDisparo === "webjs" ? "Números (um por linha)" : "Contatos"}
            {tipoDisparo === "waba" && varsTemplate.length > 0 && <span style={{ color: "#f59e0b", marginLeft: 8 }}>• CSV: numero,var1,var2...</span>}
          </label>

          {tipoDisparo === "waba" && contatosWaba.length > 0 ? (
            <div style={{ background: "#1f2937", borderRadius: 8, padding: 12, maxHeight: 240, overflowY: "auto" }}>
              <p style={{ color: "#86efac", fontSize: 11, margin: "0 0 8px", fontWeight: "bold" }}>✅ {contatosWaba.length} contato(s) importado(s) via CSV</p>
              <div style={{ fontSize: 11, color: "#e5e7eb", fontFamily: "monospace" }}>
                {contatosWaba.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid #374151" }}>
                    {c.numero} {Object.entries(c.vars).map(([k, v]) => <span key={k} style={{ color: "#8b5cf6" }}>| {"{{"}{k}{"}}"}: {v}</span>)}
                  </div>
                ))}
                {contatosWaba.length > 5 && <div style={{ color: "#6b7280", padding: "6px 0" }}>... e +{contatosWaba.length - 5} contato(s)</div>}
              </div>
              <button onClick={() => setContatosWaba([])} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", marginTop: 10 }}>🗑️ Limpar e usar campo de texto</button>
            </div>
          ) : (
            <>
              <textarea value={numerosTexto} onChange={e => { setNumerosTexto(e.target.value); if (tipoDisparo === "waba") setContatosWaba([]); }}
                placeholder={tipoDisparo === "webjs" ? "5562981519991\n5562987654321" : "5562981519991\n5562987654321\n\nOu importe CSV com colunas pra preencher variáveis por contato."}
                rows={8} style={{ ...IS, fontFamily: "monospace", resize: "vertical", minHeight: 160 }} />
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <p style={{ color: numerosValidos.length > (tipoDisparo === "webjs" ? 1000 : 5000) ? "#dc2626" : "#16a34a", fontSize: 11, margin: 0, fontWeight: "bold" }}>
              {numerosValidos.length} número(s) válido(s)
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                📂 Importar CSV {tipoDisparo === "waba" && varsTemplate.length > 0 && "(com vars)"}
              </button>
            </div>
          </div>
          {tipoDisparo === "waba" && varsTemplate.length > 0 && (
            <p style={{ color: "#6b7280", fontSize: 10, margin: "6px 0 0" }}>
              💡 <b>Formato CSV:</b> <code>numero,valor_var1,valor_var2,...</code> — ex: <code>5562981519991,João,Pedido#1234</code>
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => { setMensagem(""); setNumerosTexto(""); setNome(""); setVarsFixas({}); setContatosWaba([]); }}
            style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            🗑️ Limpar
          </button>
          <button onClick={iniciarDisparo} disabled={enviando || !canalConectado}
            style={{ background: enviando || !canalConectado ? "#1d4ed8" : (tipoDisparo === "waba" ? "#16a34a" : "#3b82f6"), color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            {enviando ? "⏳ Criando..." : `🚀 ENVIAR ${tipoDisparo === "waba" ? "WABA" : "WEBJS"}`}
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>📊 Histórico de Disparos</h2>

        {disparos.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 24 }}>Nenhum disparo criado ainda.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {disparos.map(d => {
              const progresso = d.total_contatos ? Math.round(((d.total_enviados + d.total_falhas) / d.total_contatos) * 100) : 0;
              const ehWaba = d.tipo === "waba";
              return (
                <div key={d.id} style={{ background: "#1f2937", borderRadius: 10, padding: 16, border: `1px solid ${statusColor[d.status] || "#374151"}44` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>
                        {ehWaba ? "🔗" : "📱"} {d.nome || `Disparo #${d.id}`}
                      </p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0" }}>
                        {ehWaba ? `Template: ${d.template_name}` : "Texto livre"} • 👤 {d.criado_por} • 🕐 {new Date(d.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <span style={{ background: statusColor[d.status] + "22", color: statusColor[d.status], fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {statusLabel[d.status]}
                    </span>
                  </div>
                  <div style={{ background: "#374151", borderRadius: 20, height: 8, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ background: statusColor[d.status], height: "100%", width: `${progresso}%`, transition: "width 0.3s" }} />
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 10px" }}>
                    {d.total_enviados + d.total_falhas} / {d.total_contatos} processados ({progresso}%) • ✅ {d.total_enviados} • ❌ {d.total_falhas}
                  </p>
                  {d.pausado_motivo && <p style={{ color: "#f59e0b", fontSize: 11, margin: "0 0 8px" }}>⚠️ {d.pausado_motivo}</p>}
                  {d.erro_msg && <p style={{ color: "#dc2626", fontSize: 11, margin: "0 0 8px" }}>❌ {d.erro_msg}</p>}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setDisparoDetalhe(d)} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>👁️ Detalhes</button>
                    {d.status === "rodando" && <button onClick={() => pausarDisparo(d.id)} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>⏸️ Pausar</button>}
                    {d.status === "pausado" && <button onClick={() => retomarDisparo(d.id)} style={{ background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a44", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>▶️ Retomar</button>}
                    {["rodando", "pausado", "pendente"].includes(d.status) && <button onClick={() => cancelarDisparo(d.id)} style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>🛑 Cancelar</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal detalhes */}
      {disparoDetalhe && (
        <div onClick={() => setDisparoDetalhe(null)} style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", border: "1px solid #1f2937" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: 0 }}>
                {disparoDetalhe.tipo === "waba" ? "🔗" : "📱"} {disparoDetalhe.nome || `Disparo #${disparoDetalhe.id}`}
              </h3>
              <button onClick={() => setDisparoDetalhe(null)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", background: "#1f2937" }}>
              <p style={{ color: "#e9edef", fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>
                {disparoDetalhe.tipo === "waba" ? `📋 Template: ${disparoDetalhe.template_name}\n\n` : ""}
                {disparoDetalhe.mensagem}
              </p>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <h4 style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: "0 0 10px" }}>📋 Contatos ({contatosDetalhe.length})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {contatosDetalhe.map(c => {
                  const statusIcon = c.status === "enviado" ? "✅" : c.status === "falha" ? "❌" : "⏳";
                  const statusCor = c.status === "enviado" ? "#16a34a" : c.status === "falha" ? "#dc2626" : "#f59e0b";
                  return (
                    <div key={c.id} style={{ background: "#1f2937", padding: "8px 12px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "white", fontFamily: "monospace" }}>{statusIcon} {c.numero}
                        {c.variaveis && Object.keys(c.variaveis).length > 0 && <span style={{ color: "#8b5cf6", marginLeft: 6 }}>({Object.entries(c.variaveis).map(([k,v]) => `{{${k}}}: ${v}`).join(", ")})</span>}
                      </span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {c.enviado_em && <span style={{ color: "#6b7280", fontSize: 10 }}>{new Date(c.enviado_em).toLocaleTimeString("pt-BR")}</span>}
                        {c.erro && <span style={{ color: "#dc2626", fontSize: 10 }} title={c.erro}>erro</span>}
                        <span style={{ color: statusCor, fontWeight: "bold", fontSize: 10 }}>{c.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}