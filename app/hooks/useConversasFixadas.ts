"use client";
import { useEffect, useState } from "react";
import { chaveConversasFixadas, lerConversasFixadas } from "../lib/conversas-fixadas";

export function useConversasFixadas(workspaceId?: string | null, email?: string | null) {
  const chave = chaveConversasFixadas(workspaceId, email);
  const [estado, setEstado] = useState<{ chave: string; ids: number[] } | null>(null);
  useEffect(() => {
    if (!chave) return;
    const carregar = () => {
      try { setEstado({ chave, ids: lerConversasFixadas(localStorage.getItem(chave)) }); }
      catch { setEstado({ chave, ids: [] }); }
    };
    carregar();
    const aoAlterar = (e: StorageEvent) => { if (e.key === chave || e.key === null) carregar(); };
    window.addEventListener("storage", aoAlterar);
    return () => window.removeEventListener("storage", aoAlterar);
  }, [chave]);

  const carregadas = !!chave && estado?.chave === chave;
  const fixadas = new Set(carregadas ? estado.ids : []);
  const alternar = (id: number) => {
    if (!chave || !carregadas) return false;
    try {
      const ids = new Set(lerConversasFixadas(localStorage.getItem(chave)));
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      const novos = [...ids];
      localStorage.setItem(chave, JSON.stringify(novos));
      setEstado({ chave, ids: novos });
      return true;
    } catch { return false; }
  };
  return { fixadas, alternar, carregadas };
}
