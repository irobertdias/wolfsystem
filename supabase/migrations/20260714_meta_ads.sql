-- Central Meta Ads da Wolf — conexão por workspace.
-- Tokens são criptografados no backend antes de chegar a esta tabela.

create table if not exists public.meta_ads_conexoes (
  workspace_id text primary key,
  meta_user_id text not null,
  meta_user_name text,
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  selected_ad_account_id text,
  selected_ad_account_name text,
  currency text,
  timezone_name text,
  accounts_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'conectado' check (status in ('conectado', 'token_expirado', 'erro')),
  connected_by uuid,
  connected_by_email text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_ads_conexoes_status_idx
  on public.meta_ads_conexoes (status);

alter table public.meta_ads_conexoes enable row level security;

-- O navegador não consulta esta tabela. Todo acesso passa pelo Wolf-meta,
-- que valida o usuário do Supabase e o workspace antes de usar service_role.
revoke all on table public.meta_ads_conexoes from anon, authenticated;

comment on table public.meta_ads_conexoes is
  'Conexões criptografadas e multi-tenant da Central Meta Ads da Wolf.';

comment on column public.meta_ads_conexoes.access_token_encrypted is
  'Token AES-256-GCM; nunca armazenar token puro.';
