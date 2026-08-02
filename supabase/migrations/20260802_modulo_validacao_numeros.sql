-- Modulo comercial independente: Validacao de numeros
alter table public.cadastros
  add column if not exists modulo_validacao_numeros boolean not null default false;

comment on column public.cadastros.modulo_validacao_numeros is
  'Libera a higienizacao de listas por WhatsApp Web para o workspace do cliente.';
