-- Secoes personalizadas do Editor de Proposta por workspace.
-- Cada campo pode pertencer explicitamente a uma secao criada pelo cliente.

alter table public.proposta_campos_customizados
  add column if not exists secao_customizada text;

comment on column public.proposta_campos_customizados.secao_customizada is
  'Nome da secao personalizada do workspace. Nulo preserva a heranca antiga por ordem.';

create index if not exists proposta_campos_customizados_workspace_secao_idx
  on public.proposta_campos_customizados (workspace_id, secao_customizada, ordem)
  where ativo is distinct from false;
