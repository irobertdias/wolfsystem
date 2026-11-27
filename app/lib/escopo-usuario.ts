// ═══════════════════════════════════════════════════════════════════════
// Quem vê o quê (vale para todos os workspaces)
//   Dono, super admin, Administrador e Supervisor → veem tudo do workspace.
//   Grupo com "Ver todos os atendimentos" / "Ver propostas de todos" → idem.
//   Os demais (atendente, vendedor, consultor) → só os contatos que atenderam
//   e as propostas que criaram ou que estão no nome deles.
// ═══════════════════════════════════════════════════════════════════════

type Acesso = { isSuperAdmin?: boolean; isDono?: boolean; perfil?: string; permissoes?: any };

const gestor = (a: Acesso) =>
  !!(a.isSuperAdmin || a.isDono || a.perfil === "Administrador" || a.perfil === "Supervisor" || a.perfil === "dono" || a.perfil === "super_admin" || a.permissoes?.administrador);

/** Vê os contatos/atendimentos de todos? */
export const veTodosAtendimentos = (a: Acesso) => gestor(a) || !!a.permissoes?.chat_todos;

/** Vê as propostas de todos? */
export const veTodasPropostas = (a: Acesso) => gestor(a) || !!a.permissoes?.revisional_todas || !!a.permissoes?.vendas_equipe;

const igual = (x: any, y: string) => !!y && String(x ?? "").trim().toLowerCase() === y;

/** O valor (atendente, vendedor, criado_por...) é o usuário logado (e-mail ou nome)? */
export function ehDoUsuario(valor: any, email?: string | null, nome?: string | null) {
  const e = String(email || "").trim().toLowerCase(), n = String(nome || "").trim().toLowerCase();
  return igual(valor, e) || igual(valor, n);
}

/** Proposta criada pelo usuário ou no nome dele. */
export function propostaDoUsuario(p: any, email?: string | null, nome?: string | null) {
  const dc = p?.dados_customizados || {};
  return [p?.vendedor, p?.vendedor_email, p?.criado_por, p?.consultor, dc.criado_por, dc.vendedor, dc.consultor_email]
    .some((v) => ehDoUsuario(v, email, nome));
}

/** Telefone reduzido a DDD + 8 últimos dígitos (ignora 55 e o 9 extra). */
export function chaveFone(x: any) {
  let d = String(x ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : "";
}

/** Proposta sem dono humano (criada pela IA ou sem vendedor). */
export function propostaSemDono(p: any) {
  const v = String(p?.vendedor ?? "").trim(), c = String(p?.dados_customizados?.criado_por ?? "").trim();
  const ehIA = (s: string) => !s || (!s.includes("@") && /(^|[^a-z])(ia|bot)([^a-z]|$)|vendedora ia|ia_/i.test(s));
  return ehIA(v) && ehIA(c);
}

/** Números (chave DDD + 8) dos clientes que o usuário atende ou já atendeu no workspace. */
export async function numerosAtendidos(supabase: any, wsIds: string | string[], email?: string | null, nomes: (string | null | undefined)[] = []) {
  const quem = [email, ...nomes].map((x) => String(x || "").trim()).filter(Boolean);
  const out = new Set<string>();
  if (!quem.length) return out;
  const ws = (Array.isArray(wsIds) ? wsIds : [wsIds]).filter(Boolean);
  if (!ws.length) return out;
  for (let de = 0; de < 20000; de += 1000) {
    const { data, error } = await supabase.from("atendimentos").select("numero").in("workspace_id", ws).in("atendente", quem).range(de, de + 999);
    if (error || !data?.length) break;
    for (const a of data) { const k = chaveFone(a.numero); if (k) out.add(k); }
    if (data.length < 1000) break;
  }
  return out;
}

/** Proposta da IA (sem dono) de um cliente que o usuário assumiu no atendimento. */
export function propostaDeClienteAtendido(p: any, numeros: Set<string>) {
  if (!numeros.size || !propostaSemDono(p)) return false;
  const dc = p?.dados_customizados || {};
  return [p?.telefone1, p?.telefone2, p?.telefone, dc.telefone, dc.solar?.telefone].some((t) => { const k = chaveFone(t); return !!k && numeros.has(k); });
}

/** Só os atendimentos dos contatos que o usuário atendeu (todo o histórico desses números). */
export function atendimentosDoUsuario<T extends { numero?: string | null; atendente?: string | null }>(lista: T[], email?: string | null, nome?: string | null): T[] {
  const meus = new Set(lista.filter((a) => ehDoUsuario(a.atendente, email, nome)).map((a) => a.numero));
  return lista.filter((a) => meus.has(a.numero));
}
