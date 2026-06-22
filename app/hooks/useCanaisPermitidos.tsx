"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { usePermissao } from "./usePermissao";

// ═══════════════════════════════════════════════════════════════════════════
// 📡 useCanaisPermitidos — quais canais o usuário pode ver/atender
// ───────────────────────────────────────────────────────────────────────────
// Reproduz a lógica do UnitaSystem no Wolf:
//
//   1. Lê `usuarios_workspace.canais_acesso` (array de IDs)
//   2. Lê `grupos_permissao.canais_acesso` do grupo do usuário (array de IDs)
//   3. SOMA os dois sets — usuário vê tudo que ele OU o grupo dele liberou
//
//   BYPASS — ignora a trava e vê tudo:
//     • Dono do workspace
//     • Super Admin Wolf (robert.dias@live.com)
//     • Usuário com permissão `chat_todos`
//
// USO:
//   const { veTudoCanais, canaisPermitidos, filtrarPorCanal } = useCanaisPermitidos();
//
//   // Em qualquer tela que liste atendimentos/mensagens/conversas:
//   const visiveis = filtrarPorCanal(atendimentos, a => a.canal_id);
//
//   // Ou manual:
//   if (!veTudoCanais && canaisPermitidos) {
//     listaFinal = listaFinal.filter(a => canaisPermitidos.has(Number(a.canal_id)));
//   }
// ═══════════════════════════════════════════════════════════════════════════

export type EstadoCanaisPermitidos = {
  /** Set de IDs (number) que o usuário pode ver. null = ainda carregando. */
  canaisPermitidos: Set<number> | null;
  /** True = bypass total (dono/super/chat_todos). Quando true, ignora a trava. */
  veTudoCanais: boolean;
  /** True enquanto ainda está carregando do banco. */
  loading: boolean;
  /** Helper: filtra um array pegando canal_id de cada item. */
  filtrarPorCanal: <T>(itens: T[], getCanalId: (item: T) => number | null | undefined) => T[];
  /** Recarrega do banco (use após editar grupo/usuário). */
  refetch: () => Promise<void>;
};

export function useCanaisPermitidos(): EstadoCanaisPermitidos {
  const { permissoes, isDono, isSuperAdmin, loading: permLoading } = usePermissao();
  const [canaisPermitidos, setCanaisPermitidos] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(true);

  // Bypass: dono / super admin / chat_todos
  const veTudoCanais = isDono || isSuperAdmin || !!permissoes?.chat_todos;

  const carregar = useCallback(async () => {
    try {
      setLoading(true);

      // Bypass não precisa carregar — vê tudo
      if (veTudoCanais) {
        setCanaisPermitidos(null);  // null = sem restrição (a aplicação interpreta como "tudo")
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCanaisPermitidos(new Set());  // sem login = vê nada
        setLoading(false);
        return;
      }

      // 1. Canais liberados direto no usuário
      let canaisUser: number[] = [];
      let grupoId: number | null = null;
      const { data: u } = await supabase.from("usuarios_workspace")
        .select("canais_acesso, grupo_id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (u) {
        if (Array.isArray(u.canais_acesso)) canaisUser = (u.canais_acesso as any[]).map(Number);
        grupoId = u.grupo_id ?? null;
      }

      // 2. Canais liberados via grupo
      let canaisGrupo: number[] = [];
      if (grupoId) {
        const { data: g } = await supabase.from("grupos_permissao")
          .select("canais_acesso")
          .eq("id", grupoId)
          .maybeSingle();
        if (Array.isArray(g?.canais_acesso)) canaisGrupo = (g!.canais_acesso as any[]).map(Number);
      }

      // 3. União dos dois sets
      setCanaisPermitidos(new Set([...canaisUser, ...canaisGrupo]));
    } catch (e) {
      console.error("[useCanaisPermitidos] erro:", e);
      setCanaisPermitidos(new Set());  // em erro: vê nada (mais seguro)
    } finally {
      setLoading(false);
    }
  }, [veTudoCanais]);

  useEffect(() => {
    if (permLoading) return;  // espera o usePermissao terminar
    carregar();
  }, [permLoading, carregar]);

  // Helper: filtra um array pegando canal_id de cada item
  const filtrarPorCanal = useCallback(<T,>(itens: T[], getCanalId: (item: T) => number | null | undefined): T[] => {
    if (veTudoCanais) return itens;
    if (!canaisPermitidos) return itens;  // ainda carregando — devolve tudo (evita "sumir" itens)
    return itens.filter(item => {
      const cid = getCanalId(item);
      if (cid === null || cid === undefined) return false;  // sem canal_id = filtra fora
      return canaisPermitidos.has(Number(cid));
    });
  }, [veTudoCanais, canaisPermitidos]);

  return {
    canaisPermitidos,
    veTudoCanais,
    loading: loading || permLoading,
    filtrarPorCanal,
    refetch: carregar,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 📂 Helper: canais que aparecem em determinado módulo do sistema
// ───────────────────────────────────────────────────────────────────────────
// A coluna `conexoes.modulos` é JSONB com array de strings tipo
// ["cobranca", "rh", "suporte", "chatbot"].
// Define em quais TELAS o canal aparece (controlado em Configurações > Conexões).
//
// USO:
//   const canaisDoModulo = canaisDoModuloFiltro(conexoes, "cobranca");
//   // canaisDoModulo é um Set<number> com os IDs dos canais marcados pra "cobranca"
// ═══════════════════════════════════════════════════════════════════════════

export function canaisDoModuloFiltro(
  conexoes: { id: number; modulos?: string[] | null }[],
  moduloFiltro: string
): Set<number> {
  const ids = conexoes
    .filter(c => Array.isArray(c.modulos) && c.modulos.includes(moduloFiltro))
    .map(c => Number(c.id));
  return new Set(ids);
}