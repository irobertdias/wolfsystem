type AtendimentoNotificacao = {
  workspace_id?: string;
  atendente?: string | null;
  status?: string;
  canal_id?: number | null;
};

export type ContextoNotificacao = {
  workspaceId: string;
  email?: string;
  podeAcessarChat: boolean;
  todosCanais: boolean;
  carregandoCanais: boolean;
  canaisPermitidos: Set<number> | null;
  canaisExcluidos?: Set<number>;
};

export function deveNotificarAtendimento(a: AtendimentoNotificacao, contexto: ContextoNotificacao): boolean {
  const email = contexto.email?.trim().toLowerCase();
  if (!email || !contexto.workspaceId || !contexto.podeAcessarChat) return false;
  if (a.workspace_id !== contexto.workspaceId || a.status === "resolvido") return false;
  // Poder visualizar outras conversas não significa receber seus sons.
  if (a.atendente?.trim().toLowerCase() !== email) return false;
  const canal = Number(a.canal_id);
  if (!Number.isInteger(canal) || canal <= 0 || contexto.canaisExcluidos?.has(canal)) return false;
  if (!contexto.todosCanais && (contexto.carregandoCanais || !contexto.canaisPermitidos?.has(canal))) return false;
  return true;
}
