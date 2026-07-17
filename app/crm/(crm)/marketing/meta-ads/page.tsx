"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { supabase } from "../../../../lib/supabase";

const META_BASE = process.env.NEXT_PUBLIC_META_URL || "https://meta.api.wolfgyn.com.br";

export default function MetaAdsOAuthCallbackPage() {
  const { wsId, wsPronto } = useWorkspace();
  const [mensagem, setMensagem] = useState("Finalizando conexão com a Meta...");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const state = fragment.get("state") || query.get("state") || "";
    const accessToken = fragment.get("access_token");
    const error = fragment.get("error_description") || query.get("error_description") || fragment.get("error") || query.get("error");
    const payload = { type: "wolf-meta-ads-oauth", accessToken, state, error };

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.setTimeout(() => window.close(), 250);
      return;
    }

    if (error) {
      setMensagem(`A Meta não concluiu a conexão: ${error}`);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (!accessToken || !wsPronto || !wsId) return;

    let cancelado = false;
    const concluirSemPopup = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente no sistema.");
        const endpoint = state.startsWith("instagram:") ? "/instagram/conectar" : "/conectar";
        const response = await fetch(`${META_BASE}/ads${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ workspaceId: wsId, accessToken }),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.sucesso === false) throw new Error(data.erro || "Não foi possível concluir a conexão.");
        if (cancelado) return;
        window.history.replaceState(null, "", window.location.pathname);
        window.location.replace("/crm/meta-ads?meta_conectada=1");
      } catch (erroConexao) {
        if (cancelado) return;
        setMensagem(erroConexao instanceof Error ? erroConexao.message : "Não foi possível concluir a conexão com a Meta.");
        window.history.replaceState(null, "", window.location.pathname);
      }
    };

    concluirSemPopup();
    return () => { cancelado = true; };
  }, [wsId, wsPronto]);

  return <div style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#475569", fontSize: 13 }}>{mensagem}</div>;
}
