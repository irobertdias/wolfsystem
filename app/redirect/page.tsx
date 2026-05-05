"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Checa sessão no localStorage do Supabase (client-side)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Tá logado → vai pro painel
        router.replace("/crm");
      } else {
        // Não tá logado → vai pro login
        router.replace("/login");
      }
    })();
  }, [router]);

  // Tela de carregamento enquanto checa
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #1f2937",
            borderTopColor: "#16a34a",
            borderRadius: "50%",
            margin: "0 auto 16px",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>Carregando...</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}