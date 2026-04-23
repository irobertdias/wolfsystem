"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

type Canal = { id: number; nome: string; tipo: string; status: string; };
type Disparo = {
  id: number; workspace_id: string; canal_id: number; criado_por: string; nome: string;
  mensagem: string; delay_min_seg: number; delay_max_seg: number; status: string;
  total_contatos: number; total_enviados: number; total_falhas: number;
  pausado_motivo?: string; erro_msg?: string;
  iniciado_em?: string; finalizado_em?: string; created_at: string;
};

export default function DisparosPage() {
  const router = useRouter();
  const { workspace, wsId, user } = useWorkspace();
  const { isDono, permissoes } = usePermissao();

  const [canais, setCanais] = useState<Canal[]>([]);
  const [disparos, setDisparos] = useState<Disparo[]>([]);
  const [canalSelecionado, setCanalSelecionado] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [numerosTexto, setNumerosTexto] = useState("");
  const [delayMin, setDelayMin] = useState(60);
  const [delayMax, setDelayMax] = useState(120);
  const [enviando, setEnviando] = useState(false);
  const [disparoDetalhe, setDisparoDetalhe] = useState<Disparo | null>(null);
  const [contatosDetalhe, setContatosDetalhe] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permissão: só dono ou supervisor
  const podeDisparar = isDono || permissoes.supervisor;

  const WA_BASE = process.env.NEXT_PUBLIC_WHATSAPP_URL || "";

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
    const { data } = await supabase.from("conexoes").select("id, nome, tipo, status").eq("workspace_id", wsId).eq("tipo", "webjs");
    setCanais(data || []);
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
  }, [wsId]);

  // Polling de contatos do disparo aberto
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

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      // Extrai primeira coluna de cada linha (suporta CSV com ; , ou só número por linha)
      const numeros = txt.split(/[\r\n]+/)
        .map(l => l.split(/[,;]/)[0])
        .map(n => n.replace(/\D/g, ""))
        .filter(n => n.length >= 10 && n.length <= 15);
      setNumerosTexto(numeros.join("\n"));
      alert(`✅ ${numeros.length} número(s) importado(s) do CSV`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const iniciarDisparo = async () => {
    if (!canalSelecionado) return alert("Selecione um canal!");
    if (!mensagem.trim()) return alert("Digite a mensagem!");
    const numeros = processarNumeros(numerosTexto);
    if (numeros.length === 0) return alert("Nenhum número válido encontrado!");
    if (numeros.length > 1000) return alert("Máximo 1000 números por disparo!");
    if (delayMin < 30) return alert("Delay mínimo deve ser pelo menos 30 segundos");
    if (delayMin > delayMax) return alert("Delay mínimo não pode ser maior que o máximo");

    const avisoDelay = delayMin < 60
      ? `\n\n⚠️ ATENÇÃO: Delay abaixo de 60 segundos aumenta MUITO o risco de banimento do seu WhatsApp!`
      : "";

    const tempoEstimadoMin = Math.ceil((numeros.length * (delayMin + delayMax) / 2) / 60);
    if (!confirm(
      `Iniciar disparo?\n\n` +
      `📱 Números: ${numeros.length}\n` +
      `⏱️ Delay: ${delayMin}s - ${delayMax}s\n` +
      `⏳ Tempo estimado: ~${tempoEstimadoMin} minutos\n` +
      avisoDelay
    )) return;

    setEnviando(true);
    try {
      const resp = await wa("disparos/criar", {
        workspaceId: wsId,
        canalId: canalSelecionado,
        criadoPor: user?.email,
        nome: nome || null,
        mensagem,
        numeros,
        delayMinSeg: delayMin,
        delayMaxSeg: delayMax,
      });
      if (resp.success) {
        alert(`✅ Disparo iniciado!\n\n${resp.totalContatos} números na fila.\nAcompanhe o progresso na tabela abaixo.`);
        setMensagem(""); setNumerosTexto(""); setNome("");
        fetchDisparos();
      } else {
        alert("❌ Erro: " + (resp.error || "desconhecido"));
      }
    } catch (e: any) { alert("❌ Erro: " + e.message); }
    setEnviando(false);
  };

  const pausarDisparo = async (id: number) => {
    await wa("disparos/pausar", { disparoId: id });
    fetchDisparos();
  };
  const retomarDisparo = async (id: number) => {
    await wa("disparos/retomar", { disparoId: id });
    fetchDisparos();
  };
  const cancelarDisparo = async (id: number) => {
    if (!confirm("Cancelar esse disparo? Os números ainda não enviados NÃO serão enviados.")) return;
    await wa("disparos/cancelar", { disparoId: id });
    fetchDisparos();
  };

  const numerosValidos = processarNumeros(numerosTexto);
  const canalConectado = canais.find(c => c.id === canalSelecionado)?.status === "conectado";

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
        <button onClick={() => router.push("/chatbot")}
          style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>
          ← Voltar ao Chatbot
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>📢 Disparos em Massa</h1>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
            Envie mensagens em lote via WhatsApp Web. Use delays altos pra evitar banimento.
          </p>
        </div>
      </div>

      {/* Aviso sobre banimento */}
      <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 10, padding: "12px 16px" }}>
        <p style={{ color: "#fca5a5", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <b>⚠️ Aviso importante:</b> Disparo em massa é a principal causa de banimento de números WhatsApp.
          Respeite os delays (mínimo 60s recomendado), não dispare pra números que nunca te mandaram mensagem antes,
          e limite a 100-200 disparos/dia por número novo. Use por sua conta e risco.
        </p>
      </div>

      {/* Formulário de novo disparo */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>🚀 Novo Disparo</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Canal WhatsApp Web</label>
            <select value={canalSelecionado || ""} onChange={e => setCanalSelecionado(parseInt(e.target.value) || null)} style={IS}>
              <option value="">Selecione um canal</option>
              {canais.map(c => (
                <option key={c.id} value={c.id} disabled={c.status !== "conectado"}>
                  {c.status === "conectado" ? "🟢" : "🔴"} {c.nome} {c.status !== "conectado" ? "(desconectado)" : ""}
                </option>
              ))}
            </select>
            {canalSelecionado && !canalConectado && (
              <p style={{ color: "#dc2626", fontSize: 11, margin: "4px 0 0" }}>⚠️ Canal desconectado. Conecte antes de disparar.</p>
            )}
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Nome da Campanha (opcional)</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Promoção Black Friday" style={IS} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>⏱️ Delay Mínimo (seg)</label>
            <input type="number" min={30} max={300} value={delayMin} onChange={e => setDelayMin(parseInt(e.target.value) || 30)} style={IS} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>Mínimo: 30s (recomendado 60s+)</p>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>⏱️ Delay Máximo (seg)</label>
            <input type="number" min={30} max={300} value={delayMax} onChange={e => setDelayMax(parseInt(e.target.value) || 60)} style={IS} />
            <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>Máximo: 300s (5 min)</p>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>💬 Mensagem</label>
          <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Digite a mensagem que será enviada..." rows={5} style={{ ...IS, resize: "vertical", minHeight: 100 }} />
          <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>{mensagem.length} caracteres</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#9ca3af", fontSize: 11, display: "block", marginBottom: 4, textTransform: "uppercase" }}>📱 Números (um por linha ou separados por vírgula)</label>
          <textarea value={numerosTexto} onChange={e => setNumerosTexto(e.target.value)} placeholder="5562981519991&#10;5562987654321&#10;5511999887766" rows={8} style={{ ...IS, fontFamily: "monospace", resize: "vertical", minHeight: 160 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <p style={{ color: numerosValidos.length > 1000 ? "#dc2626" : "#16a34a", fontSize: 11, margin: 0, fontWeight: "bold" }}>
              {numerosValidos.length} número(s) válido(s) {numerosValidos.length > 1000 ? "(limite: 1000!)" : ""}
            </p>
            <div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>
                📂 Importar CSV
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => { setMensagem(""); setNumerosTexto(""); setNome(""); }}
            style={{ background: "#dc262622", color: "#dc2626", border: "1px solid #dc262644", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            🗑️ Limpar
          </button>
          <button onClick={iniciarDisparo} disabled={enviando || !canalConectado || numerosValidos.length === 0}
            style={{ background: enviando || !canalConectado || numerosValidos.length === 0 ? "#1d4ed8" : "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>
            {enviando ? "⏳ Criando..." : "🚀 ENVIAR"}
          </button>
        </div>
      </div>

      {/* Histórico de disparos */}
      <div style={{ background: "#111", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 16px" }}>📊 Histórico de Disparos</h2>

        {disparos.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 24 }}>Nenhum disparo criado ainda.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {disparos.map(d => {
              const canal = canais.find(c => c.id === d.canal_id);
              const progresso = d.total_contatos ? Math.round(((d.total_enviados + d.total_falhas) / d.total_contatos) * 100) : 0;
              return (
                <div key={d.id} style={{ background: "#1f2937", borderRadius: 10, padding: 16, border: `1px solid ${statusColor[d.status] || "#374151"}44` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ color: "white", fontSize: 14, fontWeight: "bold", margin: 0 }}>{d.nome || `Disparo #${d.id}`}</p>
                      <p style={{ color: "#9ca3af", fontSize: 11, margin: "4px 0 0" }}>
                        📱 {canal?.nome || "Canal removido"} • 👤 {d.criado_por} • 🕐 {new Date(d.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <span style={{ background: statusColor[d.status] + "22", color: statusColor[d.status], fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {statusLabel[d.status]}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ background: "#374151", borderRadius: 20, height: 8, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ background: statusColor[d.status], height: "100%", width: `${progresso}%`, transition: "width 0.3s" }} />
                  </div>
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 10px" }}>
                    {d.total_enviados + d.total_falhas} / {d.total_contatos} processados ({progresso}%)
                    • ✅ {d.total_enviados} enviados • ❌ {d.total_falhas} falhas
                  </p>
                  {d.pausado_motivo && (
                    <p style={{ color: "#f59e0b", fontSize: 11, margin: "0 0 8px" }}>
                      ⚠️ Pausado: {d.pausado_motivo === "canal_desconectado" ? "Canal desconectado" : d.pausado_motivo === "muitas_falhas" ? "3 falhas seguidas" : "Pausado manualmente"}
                    </p>
                  )}
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
                {disparoDetalhe.nome || `Disparo #${disparoDetalhe.id}`}
              </h3>
              <button onClick={() => setDisparoDetalhe(null)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", background: "#1f2937" }}>
              <p style={{ color: "#e9edef", fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{disparoDetalhe.mensagem}</p>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <h4 style={{ color: "white", fontSize: 13, fontWeight: "bold", margin: "0 0 10px" }}>📋 Contatos ({contatosDetalhe.length})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {contatosDetalhe.map(c => {
                  const statusIcon = c.status === "enviado" ? "✅" : c.status === "falha" ? "❌" : "⏳";
                  const statusColor = c.status === "enviado" ? "#16a34a" : c.status === "falha" ? "#dc2626" : "#f59e0b";
                  return (
                    <div key={c.id} style={{ background: "#1f2937", padding: "8px 12px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "white", fontFamily: "monospace" }}>{statusIcon} {c.numero}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {c.enviado_em && <span style={{ color: "#6b7280", fontSize: 10 }}>{new Date(c.enviado_em).toLocaleTimeString("pt-BR")}</span>}
                        {c.erro && <span style={{ color: "#dc2626", fontSize: 10 }} title={c.erro}>erro</span>}
                        <span style={{ color: statusColor, fontWeight: "bold", fontSize: 10 }}>{c.status}</span>
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