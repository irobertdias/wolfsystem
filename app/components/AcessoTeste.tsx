"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import type { TesteCliente } from "../lib/teste-cliente";

type Estado = { teste: TesteCliente | null; encerrado: boolean; carregando: boolean; erro: string | null; restante: number | null };
const ContextoTeste = createContext<Estado>({ teste: null, encerrado: false, carregando: true, erro: null, restante: null });
export const useAcessoTeste = () => useContext(ContextoTeste);
export default function AcessoTeste({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const protegido = /^\/(crm|chatbot|admin|meu-perfil)(\/|$)/.test(pathname || "");
  const [estado, setEstado] = useState<Estado>({ teste: null, encerrado: false, carregando: true, erro: null, restante: null });
  const atualizarRef = useRef<() => void>(() => {});
  useEffect(() => {
    let ativo = true;
    let sequencia = 0;
    let usuarioAtual: string | null = null;
    let timerFim: ReturnType<typeof setTimeout> | undefined;
    const atualizar = async () => {
      const pedido = ++sequencia;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!ativo || pedido !== sequencia) return;
        usuarioAtual = session?.user.id || null;
        if (!session) {
          clearTimeout(timerFim);
          setEstado({ teste: null, encerrado: false, carregando: false, erro: null, restante: null });
          return;
        }
        const resp = await fetch("/api/acesso-teste", { cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(15000) });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || "Não foi possível verificar seu acesso.");
        if (!ativo || pedido !== sequencia) return;
        clearTimeout(timerFim);
        const restante = data.teste.modo === "teste" && data.teste.termina_em ? Date.parse(data.teste.termina_em) - Date.parse(data.agora) : null;
        setEstado({ teste: data.teste, encerrado: data.encerrado, carregando: false, erro: null, restante });
        if (!data.encerrado && restante !== null && restante > 0) {
          timerFim = setTimeout(() => {
            if (restante > 2147483647) { void atualizar(); return; }
            setEstado(prev => ({ ...prev, encerrado: true, restante: 0 }));
          }, Math.min(restante, 2147483647));
        }
      } catch (error) {
        if (ativo && pedido === sequencia) setEstado(prev => ({ ...prev, carregando: false, erro: error instanceof Error ? error.message : "Não foi possível verificar seu acesso." }));
      }
    };
    atualizarRef.current = () => { void atualizar(); };
    void atualizar();
    const timer = setInterval(atualizar, 60000);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if ((session?.user.id || null) !== usuarioAtual) {
        sequencia++;
        clearTimeout(timerFim);
        setEstado({ teste: null, encerrado: false, carregando: true, erro: null, restante: null });
      }
      // A consulta sai do callback de Auth para não bloquear a renovação da sessão.
      setTimeout(() => { if (ativo) void atualizar(); }, 0);
    });
    const aoVoltar = () => { if (document.visibilityState === "visible") void atualizar(); };
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { ativo = false; clearTimeout(timerFim); clearInterval(timer); auth.subscription.unsubscribe(); window.removeEventListener("focus", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, []);
  return <ContextoTeste.Provider value={estado}>
    {protegido && (estado.carregando || estado.encerrado || estado.erro) ? (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#f1f5f9" }}>
        <section style={{ maxWidth: 480, width: "100%", padding: 32, borderRadius: 20, background: "white", textAlign: "center", boxShadow: "0 12px 40px #0f172a12" }}>
          <h1 style={{ fontSize: 26, fontWeight: 750, color: "#0f172a" }}>{estado.encerrado ? "Seu teste encerrou" : estado.erro ? "Não foi possível verificar seu acesso" : "Verificando acesso…"}</h1>
          {!estado.carregando && <>
            <p style={{ margin: "16px 0", color: "#475569" }}>{estado.encerrado ? "Seu período de avaliação terminou. Entre em contato para contratar o sistema ou solicitar um novo período de teste." : estado.erro}</p>
            {estado.encerrado && <a href="https://wa.me/5562981519991?text=Olá!%20Meu%20teste%20encerrou%20e%20gostaria%20de%20continuar%20usando%20o%20Wolf%20System." target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: 12, borderRadius: 8, background: "#16a34a", color: "white", marginBottom: 12 }}>Falar com a equipe</a>}
            <button onClick={() => atualizarRef.current()} style={{ padding: 10, cursor: "pointer" }}>Verificar novamente</button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.assign("/login"); }} style={{ padding: 10, cursor: "pointer" }}>Sair da conta</button>
          </>}
        </section>
      </main>
    ) : children}
  </ContextoTeste.Provider>;
}
