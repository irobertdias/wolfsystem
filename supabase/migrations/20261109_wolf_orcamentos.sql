-- Orçamentos comerciais do Wolf System com aceite online.
-- O cliente abre /orcamento/<token>, aceita, vê os dados de pagamento e envia
-- os dados de implantação (empresa, usuários, WhatsApp). Só o super admin cria.
-- Acesso apenas pelo backend (service role).

create table if not exists public.wolf_orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  token text not null unique,
  cliente_nome text not null,
  cliente_telefone text not null default '',
  itens jsonb not null default '[]'::jsonb,
  usuarios_incluidos integer not null default 10,
  mensalidade numeric(12,2) not null,
  configuracao numeric(12,2) not null,
  pagamento jsonb not null default '{}'::jsonb,
  status text not null default 'enviado'
    check (status in ('enviado', 'visualizado', 'aceito', 'recusado', 'cancelado')),
  expira_em timestamptz not null,
  visualizado_em timestamptz,
  visualizacoes integer not null default 0,
  aceito_em timestamptz,
  aceite_ip text,
  aceite_user_agent text,
  implantacao jsonb,
  implantacao_em timestamptz,
  criado_por text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wolf_orcamentos_created_idx on public.wolf_orcamentos (created_at desc);

alter table public.wolf_orcamentos enable row level security;
revoke all on public.wolf_orcamentos from anon, authenticated;
