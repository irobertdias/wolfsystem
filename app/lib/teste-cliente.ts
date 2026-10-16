export type TesteCliente = { modo: "cliente" | "teste"; duracao_horas: number; iniciado_em: string | null; termina_em: string | null };
export type ConfigTesteCliente = { modo: "cliente" | "teste"; duracao_horas: number; renovar?: boolean };
export function lerTesteCliente(metadata: Record<string, any> | null | undefined): TesteCliente {
  const teste = metadata?.wolf_teste;
  if (teste?.modo !== "teste") return { modo: "cliente", duracao_horas: 24, iniciado_em: null, termina_em: null };
  return { modo: "teste", duracao_horas: Number(teste.duracao_horas) || 24, iniciado_em: teste.iniciado_em || null, termina_em: teste.termina_em || null };
}
export function testeEncerrado(teste: TesteCliente, agora = Date.now()) {
  return teste.modo === "teste" && (!teste.termina_em || !Number.isFinite(Date.parse(teste.termina_em)) || Date.parse(teste.termina_em) <= agora);
}
export function configurarTesteCliente(atual: TesteCliente, entrada: ConfigTesteCliente, agora = Date.now()): TesteCliente {
  if (!entrada || !["cliente", "teste"].includes(entrada.modo)) throw new Error("Tipo de acesso inválido.");
  if (entrada.modo === "cliente") return { modo: "cliente", duracao_horas: 24, iniciado_em: null, termina_em: null };
  const horas = Number(entrada.duracao_horas);
  if (!Number.isInteger(horas) || horas < 1 || horas > 8760) throw new Error("Informe um prazo entre 1 e 8760 horas.");
  if (atual.modo === "teste" && !entrada.renovar && atual.duracao_horas === horas) return atual;
  return { modo: "teste", duracao_horas: horas, iniciado_em: new Date(agora).toISOString(), termina_em: new Date(agora + horas * 3600000).toISOString() };
}
export function exigirTesteClienteAtivo(teste: TesteCliente) {
  if (testeEncerrado(teste)) throw Object.assign(new Error("Seu teste encerrou. Entre em contato para contratar ou renovar o período de teste."), { statusCode: 403 });
}
export async function buscarTesteDoDono(banco: any, ownerId: string): Promise<TesteCliente> {
  if (!ownerId) throw Object.assign(new Error("Não foi possível verificar o período de teste."), { statusCode: 503 });
  const { data, error } = await banco.auth.admin.getUserById(ownerId);
  if (error || !data?.user) throw Object.assign(new Error("Não foi possível verificar o período de teste."), { statusCode: 503 });
  return lerTesteCliente(data.user.app_metadata);
}
