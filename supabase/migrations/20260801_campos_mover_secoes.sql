-- Permite mover campos padrao para qualquer secao no Editor de Proposta.

alter table public.proposta_campos_padrao_config
  add column if not exists secao_customizada text;

comment on column public.proposta_campos_padrao_config.secao_customizada is
  'Secao escolhida pelo workspace para um campo padrao. Nulo usa a secao original.';
