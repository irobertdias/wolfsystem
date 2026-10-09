export type MensagemHistorico = {
  id?: number; created_at?: string; numero: string; mensagem: string; de: string;
  workspace_id?: string; canal_id?: number; origem?: string;
  provider_message_id?: string | null; status_entrega?: string | null;
};

export const chaveMensagem = (m: MensagemHistorico) => {
  if (m.id != null) return `id:${m.id}`;
  if (m.provider_message_id) return `provider:${m.provider_message_id}`;
  return `fallback:${m.workspace_id || ""}:${m.canal_id || ""}:${m.numero}:${m.de}:${m.created_at || ""}:${m.mensagem}`;
};

const ordemStatus = (status?: string | null) => {
  const s = String(status || "").toLowerCase();
  if (["played", "reproduzido"].includes(s)) return 4;
  if (["read", "lido", "lida", "visualizado", "visualizada"].includes(s)) return 3;
  if (["delivered", "entregue"].includes(s)) return 2;
  if (["sent", "enviado"].includes(s)) return 1;
  return 0;
};

export function mesclarMensagem<T extends MensagemHistorico>(anterior: T, nova: Partial<T>): T {
  const campos = Object.fromEntries(Object.entries(nova).filter(([, valor]) => valor !== undefined));
  const resultado = { ...anterior, ...campos } as T;
  // Um snapshot iniciado antes do recibo não pode desfazer uma entrega/leitura.
  if (ordemStatus(anterior.status_entrega) > ordemStatus(nova.status_entrega)) {
    resultado.status_entrega = anterior.status_entrega;
  }
  if (!resultado.provider_message_id && anterior.provider_message_id) {
    resultado.provider_message_id = anterior.provider_message_id;
  }
  return resultado;
}

export function mesclarHistorico<T extends MensagemHistorico>(anterior: T[], recebidas: T[]): T[] {
  const resultado: T[] = [];
  const ids = new Map<string, number>();
  const providers = new Map<string, number>();
  for (const m of [...anterior, ...recebidas]) {
    const pos = ids.get(chaveMensagem(m)) ?? (m.provider_message_id ? providers.get(m.provider_message_id) : undefined);
    const indice = pos ?? resultado.length;
    resultado[indice] = pos === undefined ? m : mesclarMensagem(resultado[indice], m);
    ids.set(chaveMensagem(m), indice);
    if (m.provider_message_id) providers.set(m.provider_message_id, indice);
  }
  return resultado.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

export function atualizarRecibo<T extends MensagemHistorico>(historico: T[], nova: Partial<T>): T[] {
  return historico.map(m => {
    const mesmoId = m.id != null && nova.id != null && String(m.id) === String(nova.id);
    const mesmoProvider = !!m.provider_message_id && m.provider_message_id === nova.provider_message_id;
    return mesmoId || mesmoProvider ? mesclarMensagem(m, nova) : m;
  });
}

// Cada conversa possui sua própria sessão. Encerrá-la invalida inclusive consultas
// que já terminaram no servidor mas ainda não entregaram a resposta ao navegador.
export function criarSincronizadorHistorico<T>(
  carregar: (inicial: boolean, signal: AbortSignal) => Promise<T>,
  publicar: (dados: T) => void,
  falhar: (erro: unknown) => void,
) {
  const abort = new AbortController();
  let inicial = true;
  let pendente: Promise<void> | null = null;
  return {
    atualizar(): Promise<void> {
      if (abort.signal.aborted) return Promise.resolve();
      if (pendente) return pendente;
      pendente = (async () => {
        try {
          const dados = await carregar(inicial, abort.signal);
          if (!abort.signal.aborted) { publicar(dados); inicial = false; }
        } catch (erro) {
          if (!abort.signal.aborted) falhar(erro);
        } finally { pendente = null; }
      })();
      return pendente;
    },
    encerrar() { abort.abort(); },
  };
}
