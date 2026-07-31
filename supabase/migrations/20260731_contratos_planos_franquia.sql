-- Planos comerciais do módulo Wolf Contratos por workspace.
alter table public.cadastros
  add column if not exists modulo_contratos_plano text not null default 'essencial',
  add column if not exists modulo_contratos_com_crm boolean not null default true;

alter table public.cadastros
  drop constraint if exists cadastros_modulo_contratos_plano_check;

alter table public.cadastros
  add constraint cadastros_modulo_contratos_plano_check
  check (modulo_contratos_plano in ('essencial', 'profissional', 'empresarial'));

comment on column public.cadastros.modulo_contratos_plano is
  'Plano do Wolf Contratos: essencial (20/mês), profissional (100/mês) ou empresarial (ilimitado).';

comment on column public.cadastros.modulo_contratos_com_crm is
  'Define a tabela comercial aplicada: preço reduzido para cliente com CRM Wolf contratado.';

-- A proteção comercial já existente passa a abranger também plano e vínculo com CRM.
create or replace function public.proteger_modulo_contratos_wolf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    old.modulo_contratos_assinaturas is distinct from new.modulo_contratos_assinaturas
    or old.modulo_contratos_plano is distinct from new.modulo_contratos_plano
    or old.modulo_contratos_com_crm is distinct from new.modulo_contratos_com_crm
  ) and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'A configuração comercial de Contratos e Assinaturas é exclusiva do superadmin Wolf.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_modulo_contratos_wolf on public.cadastros;
create trigger trg_proteger_modulo_contratos_wolf
before update of modulo_contratos_assinaturas, modulo_contratos_plano, modulo_contratos_com_crm
on public.cadastros
for each row execute function public.proteger_modulo_contratos_wolf();
