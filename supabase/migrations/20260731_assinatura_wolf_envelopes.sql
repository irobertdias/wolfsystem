create extension if not exists pgcrypto;

alter table public.assinatura_wolf_sessoes drop constraint if exists assinatura_wolf_sessoes_status_check;
alter table public.assinatura_wolf_sessoes add constraint assinatura_wolf_sessoes_status_check
  check (status in ('pendente','concluida','recusada','expirada','revogada','erro','excluida'));
alter table public.assinatura_wolf_sessoes
  add column if not exists modo_assinatura text not null default 'legado',
  add column if not exists contrato_arquivo_intermediario text;

create table if not exists public.assinatura_wolf_empresas (
  id uuid primary key default gen_random_uuid(), workspace_id text not null unique,
  razao_social text not null, nome_fantasia text, cnpj text not null,
  endereco_completo text not null, email text not null, telefone text,
  ativa boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.assinatura_wolf_representantes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.assinatura_wolf_empresas(id) on delete cascade,
  workspace_id text not null, nome text not null, cpf text not null, cargo text not null,
  email text not null, numero text not null, ativo boolean not null default true,
  padrao boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists assinatura_wolf_representantes_workspace_idx on public.assinatura_wolf_representantes(workspace_id, ativo, nome);

create table if not exists public.assinatura_wolf_signatarios (
  id uuid primary key default gen_random_uuid(), sessao_id uuid not null references public.assinatura_wolf_sessoes(id) on delete cascade,
  workspace_id text not null, papel text not null check (papel in ('empresa','cliente')), ordem integer not null check (ordem in (1,2)),
  nome text not null, cpf_ultimos4 text, email text not null, numero text not null,
  empresa_snapshot jsonb, token_hash text not null unique, token_cifrado text not null,
  status text not null default 'aguardando' check (status in ('aguardando','pendente','concluida','expirada','recusada','revogada')),
  otp_hash text, otp_expira_em timestamptz, otp_enviado_em timestamptz, otp_envios integer not null default 0, otp_tentativas integer not null default 0,
  assinatura_arquivo text, assinatura_hash text, selfie_arquivo text, selfie_hash text,
  biometria_status text not null default 'nao_verificada', consentimento_em timestamptz,
  assinatura_em timestamptz, ip_assinatura text, user_agent text, latitude numeric, longitude numeric, precisao_localizacao numeric,
  auditoria jsonb not null default '{}'::jsonb, auditoria_hmac text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(sessao_id, papel)
);
create index if not exists assinatura_wolf_signatarios_sessao_idx on public.assinatura_wolf_signatarios(sessao_id, ordem);
create index if not exists assinatura_wolf_signatarios_workspace_idx on public.assinatura_wolf_signatarios(workspace_id, status, created_at desc);

alter table public.assinatura_wolf_empresas enable row level security;
alter table public.assinatura_wolf_representantes enable row level security;
alter table public.assinatura_wolf_signatarios enable row level security;

comment on table public.assinatura_wolf_signatarios is 'Participantes sequenciais dos envelopes Wolf Sign; empresa assina primeiro e cliente depois.';