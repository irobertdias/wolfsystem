export function chaveConversasFixadas(workspaceId?: string | null, email?: string | null) {
  return workspaceId && email ? `wolf_conversas_fixadas_v1:${JSON.stringify([workspaceId, email.trim().toLowerCase()])}` : null;
}

export function lerConversasFixadas(valor: string | null): number[] {
  try {
    const dados: unknown = JSON.parse(valor || "[]");
    return Array.isArray(dados) ? [...new Set(dados.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0))] : [];
  } catch { return []; }
}
