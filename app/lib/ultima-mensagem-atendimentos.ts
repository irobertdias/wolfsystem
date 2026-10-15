type Conversa = { numero: string; canal_id?: number | null; created_at: string };
type UltimaMensagem = { id?: number; numero: string; canal_id?: number | null; workspace_id?: string; created_at: string; mensagem: string; de: string };
const chave = (a: { numero: string; canal_id?: number | null }) => `${a.canal_id ?? "null"}:${a.numero}`;

// Consulta o histórico sem depender de alterações administrativas no atendimento.
// A carga inicial busca por canal/lotes; as próximas cargas consultam só mensagens novas.
export function criarIndiceUltimasMensagens(banco: any, workspaceId: string) {
  const ultimas = new Map<string, UltimaMensagem>();
  const carregadas = new Set<string>();
  let desde: string | null = null;
  let fila: Promise<unknown> = Promise.resolve();
  const registrar = (m: UltimaMensagem) => {
    if (m.workspace_id && m.workspace_id !== workspaceId) return;
    if (m.de === "sistema" || !Number.isFinite(Date.parse(m.created_at))) return;
    const anterior = ultimas.get(chave(m));
    if (!anterior || Date.parse(m.created_at) > Date.parse(anterior.created_at) ||
      (m.created_at === anterior.created_at && Number(m.id || 0) > Number(anterior.id || 0))) ultimas.set(chave(m), m);
  };
  const consulta = () => banco.from("mensagens").select("id,numero,canal_id,workspace_id,created_at,mensagem,de")
    .eq("workspace_id", workspaceId).neq("de", "sistema");
  const aplicar = <T extends Conversa>(lista: T[]) => lista.map(a => {
    const m = ultimas.get(chave(a));
    return { ...a, ultima_mensagem_em: m?.created_at || null, ...(m ? { mensagem: m.mensagem } : {}) };
  });
  const carregar = <T extends Conversa>(lista: T[]): Promise<Array<T & { ultima_mensagem_em: string | null; mensagem?: string }>> => {
    const trabalho = fila.catch(() => {}).then(async () => {
      if (!desde) {
        const { data, error } = await consulta().order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
        if (error) throw error;
        desde = data?.[0]?.created_at || new Date().toISOString();
      }
      const faltantes = lista.filter(a => !carregadas.has(chave(a)));
      const canais = [...new Set(faltantes.map(a => a.canal_id ?? null))];
      for (const canal of canais) {
        const numeros = [...new Set(faltantes.filter(a => (a.canal_id ?? null) === canal).map(a => a.numero))];
        for (let i = 0; i < numeros.length; i += 100) {
          let pendentes = numeros.slice(i, i + 100);
          while (pendentes.length) {
            let q = consulta().in("numero", pendentes);
            q = canal === null ? q.is("canal_id", null) : q.eq("canal_id", canal);
            const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1000);
            if (error) throw error;
            const mensagens = (data || []) as UltimaMensagem[];
            mensagens.forEach(registrar);
            const encontradas = new Set(mensagens.map(m => m.numero));
            // Números encontrados não voltam na próxima consulta, para que uma
            // conversa com milhares de mensagens não esconda as demais do lote.
            pendentes.forEach(numero => {
              if (encontradas.has(numero) || mensagens.length < 1000) carregadas.add(chave({ numero, canal_id: canal }));
            });
            if (mensagens.length < 1000) break;
            const restantes = pendentes.filter(numero => !encontradas.has(numero));
            if (restantes.length === pendentes.length) throw new Error("Não foi possível carregar a última mensagem das conversas.");
            pendentes = restantes;
          }
        }
      }
      const corte = new Date(Date.parse(desde!) - 60_000).toISOString();
      let inicio = 0;
      let maisRecente = desde!;
      while (true) {
        const { data, error } = await consulta().gte("created_at", corte)
          .order("created_at", { ascending: true }).order("id", { ascending: true }).range(inicio, inicio + 999);
        if (error) throw error;
        const mensagens = (data || []) as UltimaMensagem[];
        mensagens.forEach(m => {
          registrar(m);
          if (Date.parse(m.created_at) > Date.parse(maisRecente)) maisRecente = m.created_at;
        });
        if (mensagens.length < 1000) break;
        inicio += 1000;
      }
      desde = maisRecente;
      return aplicar(lista);
    });
    fila = trabalho;
    return trabalho;
  };
  return { carregar, registrar, aplicar };
}
