create extension if not exists pgcrypto;

create table if not exists public.assinatura_wolf_sessoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  canal_id bigint not null,
  numero text not null,
  fluxo_id bigint,
  fluxo_sessao_id bigint,
  no_id text not null,
  token_hash text not null unique,
  status text not null default 'pendente'
    check (status in ('pendente', 'concluida', 'recusada', 'expirada', 'revogada', 'erro')),
  nome_signatario text not null,
  cpf_ultimos4 text,
  email_signatario text,
  contrato_nome text not null,
  contrato_arquivo_original text not null,
  contrato_arquivo_assinado text,
  contrato_hash_original text not null,
  contrato_hash_assinado text,
  assinatura_hash text,
  selfie_hash text,
  selfie_capturada boolean not null default false,
  exigir_localizacao boolean not null default false,
  biometria_status text not null default 'nao_verificada',
  otp_hash text,
  otp_expira_em timestamptz,
  otp_enviado_em timestamptz,
  otp_envios integer not null default 0,
  otp_tentativas integer not null default 0,
  otp_confirmado_em timestamptz,
  consentimento_versao text,
  consentimento_texto text,
  consentimento_em timestamptz,
  assinatura_em timestamptz,
  ip_assinatura text,
  user_agent text,
  latitude numeric,
  longitude numeric,
  precisao_localizacao numeric,
  auditoria jsonb not null default '{}'::jsonb,
  auditoria_hmac text,
  expira_em timestamptz not null,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assinatura_wolf_workspace_status_idx
  on public.assinatura_wolf_sessoes (workspace_id, status, created_at desc);

create index if not exists assinatura_wolf_atendimento_idx
  on public.assinatura_wolf_sessoes (workspace_id, canal_id, numero, created_at desc);

alter table public.assinatura_wolf_sessoes enable row level security;

comment on table public.assinatura_wolf_sessoes is
  'Sessões privadas de assinatura eletrônica Wolf. Acesso somente pelo backend com chave de serviço.';

comment on column public.assinatura_wolf_sessoes.biometria_status is
  'nao_verificada ou selfie_evidencia; somente usar biometria_verificada após integração real de prova de vida/comparação facial.';

