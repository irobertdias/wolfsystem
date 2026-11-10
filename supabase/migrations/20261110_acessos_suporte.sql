-- Histórico do botão "Acessar como cliente" (tela Clientes Wolf).
-- Só o servidor (service role) grava e lê.
create table if not exists public.acessos_suporte (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_email text not null,
  cliente_email text not null,
  workspace text
);
alter table public.acessos_suporte enable row level security;
revoke all on public.acessos_suporte from anon, authenticated;
