"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { numerosAtendidos } from "../lib/escopo-usuario";

/** Números (DDD + 8) dos clientes que o usuário atende — para liberar as propostas da IA desses clientes. */
export function useNumerosAtendidos(wsIds: string | string[], email?: string | null, nome?: string | null, ativo = true) {
  const [numeros, setNumeros] = useState<Set<string>>(new Set());
  const chave = (Array.isArray(wsIds) ? wsIds : [wsIds]).filter(Boolean).join(",");
  useEffect(() => {
    if (!ativo || !chave || !email) { setNumeros(new Set()); return; }
    let cancelado = false;
    numerosAtendidos(supabase, chave.split(","), email, [nome]).then((s) => { if (!cancelado) setNumeros(s); }).catch(() => {});
    return () => { cancelado = true; };
  }, [chave, email, nome, ativo]);
  return numeros;
}
