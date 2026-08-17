-- Wolf Telefonia - URA e discador automatico multi-tenant.
-- Modulo isolado: nao altera conexoes_voip, ligacoes nem o softphone existente.

create extension if not exists pgcrypto;

create table if not exists public.voip_ura_fluxos (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  configuracao jsonb not null default '{"inicio":"boas_vindas","nos":[]}'::jsonb,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voip_ura_campanhas (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  conexao_id bigint not null references public.conexoes_voip(id) on delete restrict,
  fluxo_id uuid not null references public.voip_ura_fluxos(id) on delete restrict,
  nome text not null,
  status text not null default 'rascunho' check (status in ('rascunho','agendada','executando','pausada','concluida','cancelada','erro')),
  webhook_token uuid not null default gen_random_uuid(),
  agendada_para timestamptz,
  horario_inicio time not null default '09:00',
  horario_fim time not null default '18:00',
  dias_permitidos text[] not null default array['seg','ter','qua','qui','sex'],
  simultaneas integer not null default 1 check (simultaneas between 1 and 20),
  intervalo_segundos integer not null default 5 check (intervalo_segundos between 1 and 3600),
  max_tentativas integer not null default 2 check (max_tentativas between 1 and 10),
  intervalo_tentativas_minutos integer not null default 60 check (intervalo_tentativas_minutos between 1 and 10080),
  total_contatos integer not null default 0,
  total_processados integer not null default 0,
  total_atendidos integer not null default 0,
  total_falhas integer not null default 0,
  criado_por text,
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  ultimo_disparo_em timestamptz,
  erro_msg text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, webhook_token)
);

create table if not exists public.voip_ura_contatos (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  campanha_id uuid not null references public.voip_ura_campanhas(id) on delete cascade,
  nome text,
  telefone text not null,
  variaveis jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','discando','chamando','atendeu','nao_atendeu','ocupado','falha','opt_out','transferido','concluido','cancelado')),
  tentativas integer not null default 0,
  proxima_tentativa_em timestamptz,
  provider_call_id text,
  ultimo_digito text,
  resultado text,
  erro_msg text,
  iniciado_em timestamptz,
  atendido_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campanha_id, telefone)
);

create table if not exists public.voip_ura_eventos (
  id bigserial primary key,
  workspace_id text not null,
  campanha_id uuid references public.voip_ura_campanhas(id) on delete cascade,
  contato_id uuid references public.voip_ura_contatos(id) on delete cascade,
  tipo text not null,
  no_id text,
  digito text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voip_ura_fluxos_workspace_idx on public.voip_ura_fluxos(workspace_id, updated_at desc);
create index if not exists voip_ura_campanhas_workspace_idx on public.voip_ura_campanhas(workspace_id, created_at desc);
create index if not exists voip_ura_campanhas_worker_idx on public.voip_ura_campanhas(status, agendada_para, ultimo_disparo_em);
create index if not exists voip_ura_contatos_worker_idx on public.voip_ura_contatos(campanha_id, status, proxima_tentativa_em, created_at);
create index if not exists voip_ura_contatos_call_idx on public.voip_ura_contatos(provider_call_id) where provider_call_id is not null;
create index if not exists voip_ura_eventos_contato_idx on public.voip_ura_eventos(contato_id, created_at desc);

alter table public.voip_ura_fluxos enable row level security;
alter table public.voip_ura_campanhas enable row level security;
alter table public.voip_ura_contatos enable row level security;
alter table public.voip_ura_eventos enable row level security;

comment on table public.voip_ura_fluxos is 'Fluxos de URA por workspace. Acesso somente pelo backend Wolf com service role.';
comment on table public.voip_ura_campanhas is 'Campanhas de ligacao automatica isoladas por workspace e conexao VOIP.';
comment on table public.voip_ura_contatos is 'Lista higienizada de contatos e resultado individual da URA.';
comment on table public.voip_ura_eventos is 'Trilha tecnica de chamadas, teclas DTMF, transferencias e erros.';
