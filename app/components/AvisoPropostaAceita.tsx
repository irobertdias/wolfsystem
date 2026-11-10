"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { useModulos } from "../hooks/useModulos";
import Icone from "./a2/Icone";

// Aviso ao vendedor: o cliente aceitou a proposta revisional e falta gerar o contrato.
// Confere a cada minuto; o cartão abre a tela de Contratos já preenchida.
type Aceita = { id: string; cliente_nome: string; numero: string; respondida_em: string; total: number };
const CHAVE = "wolf_aceitas_vistas";

function vistas(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
}

export default function AvisoPropostaAceita() {
  const router = useRouter();
  const pathname = usePathname();
  const { wsId } = useWorkspace();
  const { modulos, carregado } = useModulos();
  const [pendentes, setPendentes] = useState<Aceita[]>([]);

  useEffect(() => {
    if (!wsId || !carregado || !modulos.revisional) return;
    let parar = false;
    const conferir = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetch(`/api/revisional/propostas?workspace=${encodeURIComponent(wsId)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const semana = Date.now() - 7 * 86400_000;
        const ja = vistas();
        const lista: Aceita[] = (j.propostas || [])
          .filter((p: any) => p.status === "aceita" && !p.dados?.contrato_gerado && p.respondida_em && new Date(p.respondida_em).getTime() > semana && !ja.includes(p.id))
          .map((p: any) => ({ id: p.id, cliente_nome: p.cliente_nome, numero: p.numero, respondida_em: p.respondida_em, total: Number(p.tipo === "imovel" ? p.resultado?.diferenca_total : p.resultado?.economia_total) || 0 }));
        if (!parar) setPendentes(lista);
      } catch { /* tenta de novo no próximo minuto */ }
    };
    conferir();
    const t = setInterval(conferir, 60_000);
    return () => { parar = true; clearInterval(t); };
  }, [wsId, carregado, modulos.revisional]);

  if (!pendentes.length || pathname.startsWith("/crm/contratos")) return null;
  const p = pendentes[0];
  const dispensar = () => {
    try { localStorage.setItem(CHAVE, JSON.stringify([...vistas(), p.id].slice(-200))); } catch {}
    setPendentes((l) => l.slice(1));
  };

  return (
    <div role="alert" style={{ position: "fixed", right: 20, bottom: 86, zIndex: 2500, width: 340, maxWidth: "calc(100vw - 40px)", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 6px rgba(16,24,40,.08), 0 24px 48px -20px rgba(16,24,40,.45)" }}>
      <div style={{ padding: "14px 16px 12px", background: "linear-gradient(130deg, #10B981 0%, #059669 45%, #065F46 100%)", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="check" tamanho={18} espessura={2.4} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 14.5 }}>Proposta aceita!</b>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)" }}>{new Date(p.respondida_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{pendentes.length > 1 ? ` · +${pendentes.length - 1} aguardando` : ""}</span>
        </div>
        <button onClick={dispensar} title="Dispensar" style={{ border: 0, background: "rgba(255,255,255,.16)", color: "#fff", width: 28, height: 28, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={14} /></button>
      </div>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
          <b style={{ color: "#0F172A" }}>{p.cliente_nome}</b> aceitou a proposta nº {p.numero}
          {p.total > 0 && <> com benefício estimado de <b style={{ color: "#047857" }}>{p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b></>}.
          O cliente já está no CRM; falta o contrato.
        </div>
        <button onClick={() => { dispensar(); router.push(`/crm/contratos?revisional=${p.id}`); }}
          style={{ height: 44, border: 0, borderRadius: 13, cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)", boxShadow: "0 12px 24px -12px rgba(5,150,105,.75)" }}>
          <Icone nome="documento" tamanho={16} /> Gerar contrato agora
        </button>
      </div>
    </div>
  );
}
