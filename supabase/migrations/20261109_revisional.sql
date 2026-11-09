-- Módulo Revisional (rev.wolfgyn.com.br)
-- Propostas de revisão de juros enviadas ao cliente por link com expiração.
-- Acesso só pelo backend (service role): sem políticas para anon/authenticated.

create table if not exists public.revisional_propostas (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  numero text not null,
  token text not null unique,
  tipo text not null check (tipo in ('imovel', 'veiculo')),
  status text not null default 'enviada'
    check (status in ('enviada', 'visualizada', 'aceita', 'recusada', 'cancelada')),
  cliente_nome text not null,
  cliente_documento text not null default '',
  cliente_telefone text not null default '',
  consultor_nome text not null default '',
  consultor_email text not null default '',
  dados jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  empresa jsonb not null default '{}'::jsonb,
  expira_em timestamptz not null,
  visualizada_em timestamptz,
  visualizacoes integer not null default 0,
  respondida_em timestamptz,
  resposta_ip text,
  resposta_user_agent text,
  motivo_recusa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revisional_propostas_ws_idx
  on public.revisional_propostas (workspace_id, created_at desc);

create table if not exists public.revisional_config (
  workspace_id text primary key,
  empresa_nome text not null default '',
  empresa_cnpj text not null default '',
  whatsapp_contato text not null default '',
  validade_horas integer not null default 24 check (validade_horas between 1 and 720),
  percentual_imovel numeric(6,2) not null default 35,
  percentual_veiculo numeric(6,2) not null default 35,
  taxa_veiculo numeric(8,4) not null default 1.5,
  metodo_veiculo text not null default 'percentual' check (metodo_veiculo in ('percentual', 'taxa')),
  updated_at timestamptz not null default now()
);

alter table public.revisional_propostas enable row level security;
alter table public.revisional_config enable row level security;
revoke all on public.revisional_propostas from anon, authenticated;
revoke all on public.revisional_config from anon, authenticated;
