-- Seleção de portfólio empresarial na Central Ads.
-- Cada workspace enxerga somente as contas do portfólio escolhido.

alter table public.meta_ads_conexoes
  add column if not exists selected_business_id text,
  add column if not exists selected_business_name text,
  add column if not exists businesses_snapshot jsonb not null default '[]'::jsonb;

comment on column public.meta_ads_conexoes.selected_business_id is
  'ID do portfólio empresarial escolhido exclusivamente para este workspace.';

comment on column public.meta_ads_conexoes.businesses_snapshot is
  'Lista resumida de portfólios disponíveis no último sincronismo com a Meta.';