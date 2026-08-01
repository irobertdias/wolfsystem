-- Cor visual das secoes personalizadas por workspace.

alter table public.proposta_campos_customizados
  add column if not exists secao_cor text;

alter table public.proposta_campos_customizados
  drop constraint if exists proposta_campos_customizados_secao_cor_check;

alter table public.proposta_campos_customizados
  add constraint proposta_campos_customizados_secao_cor_check
  check (secao_cor is null or secao_cor ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.proposta_campos_customizados.secao_cor is
  'Cor hexadecimal da secao personalizada, compartilhada pelos campos da mesma secao.';
