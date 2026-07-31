-- Wolf Sign: permite exclusão lógica sem destruir arquivos e evidências.
alter table public.assinatura_wolf_sessoes
  drop constraint if exists assinatura_wolf_sessoes_status_check;

alter table public.assinatura_wolf_sessoes
  add constraint assinatura_wolf_sessoes_status_check
  check (status in ('pendente', 'concluida', 'recusada', 'expirada', 'revogada', 'erro', 'excluida'));