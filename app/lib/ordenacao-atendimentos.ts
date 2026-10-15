export type OrdemAtendimentos = "recentes" | "antigos";

export function ordenarAtendimentos<T extends { id: number; created_at: string }>(
  atendimentos: readonly T[], ordem: OrdemAtendimentos,
): T[] {
  const direcao = ordem === "antigos" ? 1 : -1;
  const instante = (data: string) => Date.parse(data) || 0;
  return [...atendimentos].sort((a, b) => direcao * (
    instante(a.created_at) - instante(b.created_at) || a.id - b.id
  ));
}
