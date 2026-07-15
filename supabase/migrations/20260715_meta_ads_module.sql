alter table public.cadastros
  add column if not exists modulo_meta_ads boolean not null default false;

comment on column public.cadastros.modulo_meta_ads is
  'Libera o acesso comercial do workspace a Central Meta ADS.';
