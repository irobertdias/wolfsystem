"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, Btn, Field, Row, inputSm } from "../crm/financeiro/_sections/_ui";

// Ajustes da loja → pagamento online com o gateway do próprio lojista.
// O cliente paga pelo link do orçamento (PIX, cartão ou boleto) e o pedido baixa sozinho.

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ""; }
type Estado = { gateway: "mercadopago" | "asaas" | null; ambiente: string; ativo: boolean; final: string; webhook: string };

const AJUDA = {
  mercadopago: { onde: "Mercado Pago → Seu negócio → Configurações → Credenciais → Credenciais de produção → Access Token (começa com APP_USR-). Para teste, use o de teste (TEST-).", ph: "APP_USR-…" },
  asaas: { onde: "Asaas → Integrações → Chave de API (começa com $aact_). Depois, em Integrações → Webhooks, cadastre o endereço abaixo para os eventos de cobrança.", ph: "$aact_…" },
};

export default function GatewayLoja({ wsId }: { wsId: string }) {
  const [st, setSt] = useState<Estado | null>(null);
  const [gw, setGw] = useState<"mercadopago" | "asaas">("mercadopago");
  const [amb, setAmb] = useState("producao");
  const [chave, setChave] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const r = await fetch(`/api/loja/gateway?ws=${encodeURIComponent(wsId)}`, { headers: { Authorization: `Bearer ${await token()}` } }).then((x) => x.json()).catch(() => ({}));
      if (r.success) { setSt(r); if (r.gateway) setGw(r.gateway); setAmb(r.ambiente || "producao"); }
    })();
  }, [wsId]);

  async function enviar(extra: any) {
    setSalvando(true); setMsg("");
    const r = await fetch("/api/loja/gateway", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ ws: wsId, gateway: gw, ambiente: amb, token: chave, ativo: st?.ativo ?? true, ...extra }) }).then((x) => x.json()).catch(() => ({ success: false, error: "Sem conexão" }));
    setSalvando(false);
    if (!r.success) { setMsg("Erro: " + (r.error || "não foi possível salvar")); return; }
    setSt(r); setChave(""); setMsg(extra.remover ? "Pagamento online desligado." : "Salvo. O link do orçamento já oferece o pagamento online.");
  }

  const nome = (g?: string | null) => (g === "asaas" ? "Asaas" : "Mercado Pago");
  const ligado = !!st?.gateway && st.ativo;
  const op = (a: boolean): any => ({ flex: "1 1 200px", textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: "pointer", border: 0, background: a ? "var(--w-50)" : "#F7FAF9", boxShadow: a ? "inset 0 0 0 2px var(--w-500)" : "inset 0 0 0 1px #E6ECEA" });
  return (
    <Card titulo="Pagamento online (gateway da loja)">
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>
        Com o gateway ligado, o link do orçamento ganha a opção <b>“Pagar online (PIX, cartão ou boleto)”</b>. O dinheiro cai direto na conta da loja; quando o pagamento é aprovado, o pedido avança sozinho, dá baixa no estoque e fica marcado como pago.
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: ligado ? "#047857" : "#B45309" }}>
        {st?.gateway ? `${ligado ? "Ligado" : "Desligado"}: ${nome(st.gateway)}${st.ambiente === "sandbox" ? " (teste)" : ""} · chave terminando em …${st.final}` : "Nenhum gateway configurado."}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" style={op(gw === "mercadopago")} onClick={() => setGw("mercadopago")}><b style={{ display: "block", fontSize: 14 }}>Mercado Pago</b><span style={{ fontSize: 12.5, color: "#64748B" }}>Checkout com PIX, cartão em até 12x e boleto</span></button>
        <button type="button" style={op(gw === "asaas")} onClick={() => setGw("asaas")}><b style={{ display: "block", fontSize: 14 }}>Asaas</b><span style={{ fontSize: 12.5, color: "#64748B" }}>Fatura com PIX, cartão e boleto (pede CPF/CNPJ)</span></button>
      </div>
      <Row>
        <Field label={st?.gateway === gw ? "Nova chave (deixe vazio para manter)" : gw === "asaas" ? "Chave de API" : "Access Token"} flex="2 1 300px">
          <input style={inputSm} type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder={AJUDA[gw].ph} />
        </Field>
        {gw === "asaas" && (
          <Field label="Ambiente" flex="0 1 170px">
            <select style={inputSm} value={amb} onChange={(e) => setAmb(e.target.value)}><option value="producao">Produção</option><option value="sandbox">Teste (sandbox)</option></select>
          </Field>
        )}
      </Row>
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Onde pegar: {AJUDA[gw].onde}</div>
      {gw === "asaas" && st?.webhook && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>Webhook do Asaas:</span>
          <input readOnly value={st.webhook.replace(/g=[a-z]+$/, "g=asaas")} onFocus={(e) => e.currentTarget.select()} style={{ ...inputSm, flex: "1 1 320px", width: "auto", fontSize: 12 }} />
          <a onClick={async () => { await navigator.clipboard.writeText(st.webhook.replace(/g=[a-z]+$/, "g=asaas")); setCopiado(true); }} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--w-700)", cursor: "pointer" }}>{copiado ? "copiado ✓" : "copiar"}</a>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Btn onClick={() => enviar({ ativo: true })} disabled={salvando || (chave.trim().length < 20 && st?.gateway !== gw)}>{salvando ? "Salvando…" : ligado && st?.gateway === gw ? "Salvar" : "Salvar e ligar"}</Btn>
        {st?.gateway && <Btn variante="ghost" onClick={() => enviar({ ativo: !st.ativo, gateway: st.gateway })} disabled={salvando}>{st.ativo ? "Desligar" : "Ligar"}</Btn>}
        {st?.gateway && <a onClick={() => !salvando && confirm("Remover a chave do gateway?") && enviar({ remover: true })} style={{ fontSize: 12.5, color: "#94A3B8", cursor: "pointer" }}>remover chave</a>}
        {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: msg.startsWith("Erro") ? "#B45309" : "#047857" }}>{msg}</span>}
      </div>
    </Card>
  );
}
