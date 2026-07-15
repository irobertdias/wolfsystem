"use client";

import { useEffect } from "react";

export default function MetaAdsOAuthCallbackPage() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const payload = {
      type: "wolf-meta-ads-oauth",
      accessToken: fragment.get("access_token"),
      state: fragment.get("state") || query.get("state"),
      error: fragment.get("error_description") || query.get("error_description") || fragment.get("error") || query.get("error"),
    };

    if (window.opener) window.opener.postMessage(payload, window.location.origin);
    window.setTimeout(() => window.close(), 250);
  }, []);

  return <div style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#475569", fontSize: 13 }}>Finalizando conexão com a Meta...</div>;
}
