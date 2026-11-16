"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, Btn, Field, Row, inputSm } from "../crm/financeiro/_sections/_ui";

// Ajustes da loja → chave de IA usada só no cadastro de produtos
// (a IA do atendimento continua em Conexões, separada).

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ""; }

export default function ChaveIALoja({ wsId }: { wsId: string }) {
  const [atual, setAtual] = useState<{ ia: string | null; final: string }>({ ia: null, final: "" });
  const [ia, setIa] = useState<"gpt" | "claude">("gpt");
  const [chave, setChave] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const r = await fetch(`/api/loja/ia-chave?ws=${encodeURIComponent(wsId)}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await r.json().catch(() => ({}));
      if (j.success) { setAtual({ ia: j.ia, final: j.final }); if (j.ia) setIa(j.ia); }
    })();
  }, [wsId]);

  async function enviar(remover = false) {
    setSalvando(true); setMsg("");
    const r = await fetch("/api/loja/ia-chave", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ ws: wsId, ia, chave, remover }) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!j.success) { setMsg("Erro: " + (j.error || "não foi possível salvar")); return; }
    setAtual({ ia: j.ia, final: j.final }); setChave("");
    setMsg(remover ? "Chave removida." : "Chave salva. A busca com IA já pode ser usada no cadastro de produtos.");
  }

  const nome = (x: string | null) => (x === "claude" ? "Claude (Anthropic)" : "ChatGPT (OpenAI)");
  return (
    <Card titulo="IA no cadastro de produtos">
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>
        Chave usada só pelo botão <b>✨ Cadastrar com IA</b> do catálogo (pesquisa o produto e traz fotos). É separada da IA do atendimento.
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: atual.ia ? "var(--w-700)" : "#B45309" }}>
        {atual.ia ? `Ativa: ${nome(atual.ia)} · chave terminando em …${atual.final}` : "Nenhuma chave cadastrada."}
      </div>
      <Row>
        <Field label="Provedor" flex="0 1 200px">
          <select style={inputSm} value={ia} onChange={(e) => setIa(e.target.value as any)}>
            <option value="gpt">ChatGPT (OpenAI)</option>
            <option value="claude">Claude (Anthropic)</option>
          </select>
        </Field>
        <Field label={atual.ia ? "Nova chave (deixe vazio para manter)" : "Chave da API"} flex="2 1 300px">
          <input style={inputSm} type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder={ia === "claude" ? "sk-ant-…" : "sk-…"} />
        </Field>
      </Row>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn onClick={() => enviar(false)} disabled={salvando || chave.trim().length < 20}>{salvando ? "Salvando…" : "Salvar chave"}</Btn>
        {atual.ia && <a onClick={() => !salvando && enviar(true)} style={{ fontSize: 12.5, color: "#94A3B8", cursor: "pointer" }}>remover chave</a>}
        {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: msg.startsWith("Erro") ? "#B45309" : "var(--w-700)" }}>{msg}</span>}
      </div>
    </Card>
  );
}
