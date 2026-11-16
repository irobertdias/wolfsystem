"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, Field, Row, inputSm } from "../crm/financeiro/_sections/_ui";

// Ajustes da loja → Vendedora IA no WhatsApp e avisos automáticos do pedido.
// Fica em fin_config.config.loja.ia_vendas (salvo junto com o resto dos Ajustes).

export type IAVendasConfig = {
  avisos?: boolean;                       // avisos automáticos de etapa (padrão: ligado)
  canal_id?: number | null;               // canal usado quando o cliente não tem atendimento
  mensagens?: Partial<Record<"pago" | "separacao" | "enviado" | "retirada" | "entregue", string>>;
  instrucoes?: string;                    // regras extras para a vendedora IA
};

const PADRAO = {
  pago: "Olá, {nome}! ✅ Recebemos o pagamento do pedido nº {numero} ({total}). Ele já está em separação e avisamos assim que sair.",
  separacao: "Olá, {nome}! Seu pedido nº {numero} está em separação. Avisamos assim que sair. 📦",
  enviado: "📦 {nome}, seu pedido nº {numero} foi enviado!{rastreio}",
  retirada: "✅ {nome}, seu pedido nº {numero} está pronto para retirada na {empresa}.",
  entregue: "Pedido nº {numero} entregue. Obrigado pela compra, {nome}! Qualquer coisa é só chamar aqui. 😊",
};
const ROTULO = { pago: "Pagamento aprovado (online)", separacao: "Em separação", enviado: "Enviado / saiu para entrega", retirada: "Pronto para retirada", entregue: "Entregue / concluído" };

export default function ConfigIAVendas({ wsId, valor, onChange }: { wsId: string; valor: IAVendasConfig; onChange: (v: IAVendasConfig) => void }) {
  const c = valor || {};
  const set = (p: Partial<IAVendasConfig>) => onChange({ ...c, ...p });
  const [canais, setCanais] = useState<{ id: number; nome: string; tipo: string }[]>([]);
  useEffect(() => {
    if (!wsId) return;
    supabase.from("conexoes").select("id,nome,tipo").eq("workspace_id", wsId).order("id").then(({ data }) => setCanais(((data as any[]) || []).filter((x) => !["instagram", "messenger"].includes(x.tipo))));
  }, [wsId]);
  const avisos = c.avisos !== false;
  return (
    <Card titulo="Vendedora IA no WhatsApp e avisos do pedido">
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10, lineHeight: 1.55 }}>
        A vendedora IA atende no WhatsApp consultando o sistema da loja: produtos, preços, estoque, frete, fecha o pedido e manda o link de pagamento.
        Depois, o cliente recebe um aviso a cada etapa: pago → em separação → enviado → entregue.
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
        <input type="checkbox" checked={avisos} onChange={(e) => set({ avisos: e.target.checked })} /> Avisar o cliente no WhatsApp quando o pedido mudar de etapa
      </label>
      <Row>
        <Field label="Canal de WhatsApp para os avisos (quando o cliente ainda não tem conversa)" flex="1 1 320px">
          <select style={inputSm} value={c.canal_id || ""} onChange={(e) => set({ canal_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— usar só o canal da conversa do cliente —</option>
            {canais.map((x) => <option key={x.id} value={x.id}>{x.nome} ({x.tipo})</option>)}
          </select>
        </Field>
      </Row>
      {avisos && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "#94A3B8" }}>Pode usar: {"{nome} {numero} {total} {empresa} {rastreio}"}</span>
          {(Object.keys(PADRAO) as (keyof typeof PADRAO)[]).map((k) => (
            <Field key={k} label={ROTULO[k]}>
              <textarea style={{ ...inputSm, minHeight: 52, resize: "vertical" }} value={c.mensagens?.[k] ?? PADRAO[k]} onChange={(e) => set({ mensagens: { ...(c.mensagens || {}), [k]: e.target.value } })} />
            </Field>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Field label="Instruções extras para a vendedora IA (tom, promoções, horário, o que nunca prometer…)">
          <textarea style={{ ...inputSm, minHeight: 80, resize: "vertical" }} value={c.instrucoes || ""} onChange={(e) => set({ instrucoes: e.target.value })} placeholder="Ex.: Atendemos de seg a sáb, 9h às 18h. Parcelamos em até 10x sem juros no cartão. Não prometa prazo de entrega menor que o do frete." />
        </Field>
      </div>
    </Card>
  );
}
