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

/** Só os atendimentos dos contatos que o usuário atendeu (todo o histórico desses números). */
export function atendimentosDoUsuario<T extends { numero?: string | null; atendente?: string | null }>(lista: T[], email?: string | null, nome?: string | null): T[] {
  const meus = new Set(lista.filter((a) => ehDoUsuario(a.atendente, email, nome)).map((a) => a.numero));
  return lista.filter((a) => meus.has(a.numero));
}
