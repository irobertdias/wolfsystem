-- Contratos e Assinaturas Wolf: módulo comercial isolado por workspace.
alter table public.cadastros
  add column if not exists modulo_contratos_assinaturas boolean not null default false;

comment on column public.cadastros.modulo_contratos_assinaturas is
  'Liberação comercial por workspace do módulo Contratos e Assinaturas Wolf. Alteração exclusiva via API service_role do superadmin.';

alter table public.assinatura_wolf_sessoes
  add column if not exists origem text not null default 'fluxo',
  add column if not exists proposta_id bigint,
  add column if not exists criado_por text;

create index if not exists assinatura_wolf_proposta_idx
  on public.assinatura_wolf_sessoes (workspace_id, proposta_id, created_at desc)
  where proposta_id is not null;

-- Impede que usuários comuns liberem comercialmente o próprio workspace via cliente Supabase.
create or replace function public.proteger_modulo_contratos_wolf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.modulo_contratos_assinaturas is distinct from new.modulo_contratos_assinaturas
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'A liberação de Contratos e Assinaturas é exclusiva do superadmin Wolf.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_modulo_contratos_wolf on public.cadastros;
create trigger trg_proteger_modulo_contratos_wolf
before update of modulo_contratos_assinaturas on public.cadastros
for each row execute function public.proteger_modulo_contratos_wolf();