export type OrdemAtendimentos = "recentes" | "antigos";

export function ordenarAtendimentos<T extends { id: number; created_at: string; updated_at?: string | null }>(
  atendimentos: readonly T[], ordem: OrdemAtendimentos,
): T[] {
  const direcao = ordem === "antigos" ? 1 : -1;
  const instante = (data: string) => Date.parse(data) || 0;
  return [...atendimentos].sort((a, b) => direcao * (
    instante(a.updated_at || a.created_at) - instante(b.updated_at || b.created_at) || a.id - b.id
  ));
}

export type PosicaoLista = { topo: number; ancoras: { id: string; deslocamento: number }[] };

export function capturarPosicaoLista(lista: HTMLElement, ignorarId?: number): PosicaoLista {
  const topo = lista.getBoundingClientRect().top;
  const linhas = Array.from(lista.querySelectorAll<HTMLElement>("[data-atendimento-id]"));
  return {
    topo: lista.scrollTop,
    ancoras: linhas.filter(el => {
      const rect = el.getBoundingClientRect();
      return el.dataset.atendimentoId !== String(ignorarId) && rect.bottom > topo && rect.top < topo + lista.clientHeight;
    }).map(el => ({ id: el.dataset.atendimentoId!, deslocamento: el.getBoundingClientRect().top - topo })),
  };
}

export function restaurarPosicaoLista(lista: HTMLElement, posicao: PosicaoLista) {
  if (posicao.topo === 0) { lista.scrollTop = 0; return; }
  const linhas = Array.from(lista.querySelectorAll<HTMLElement>("[data-atendimento-id]"));
  const topo = lista.getBoundingClientRect().top;
  for (const ancora of posicao.ancoras) {
    const linha = linhas.find(el => el.dataset.atendimentoId === ancora.id);
    if (!linha) continue;
    lista.scrollTop += linha.getBoundingClientRect().top - topo - ancora.deslocamento;
    return;
  }
  lista.scrollTop = posicao.topo;
}
