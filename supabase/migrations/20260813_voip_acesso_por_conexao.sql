-- Wolf Telefonia: controle de acesso individual por conexao/canal VOIP.
-- Preserva o comportamento atual: usuarios existentes recebem acesso aos
-- canais que ja existem no workspace. Canais novos exigem liberacao explicita.

do $$
declare
  coluna_ja_existia boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios_workspace'
      and column_name = 'voip_conexoes_acesso'
  ) into coluna_ja_existia;

  if not coluna_ja_existia then
    alter table public.usuarios_workspace
      add column voip_conexoes_acesso bigint[] not null default '{}'::bigint[];

    update public.usuarios_workspace as usuario
    set voip_conexoes_acesso = coalesce(
      (
        select array_agg(conexao.id order by conexao.id)
        from public.conexoes_voip as conexao
        where conexao.workspace_id = usuario.workspace_id
      ),
      '{}'::bigint[]
    );
  end if;
end
$$;

create index if not exists usuarios_workspace_voip_conexoes_acesso_gin_idx
  on public.usuarios_workspace using gin (voip_conexoes_acesso);

comment on column public.usuarios_workspace.voip_conexoes_acesso is
  'IDs das conexoes VOIP que o usuario pode visualizar e usar no softphone.';
