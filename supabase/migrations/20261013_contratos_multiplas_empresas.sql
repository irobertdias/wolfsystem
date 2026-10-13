begin;

-- Preserva os IDs das empresas, representantes e snapshots dos contratos.
do $$
declare item record;
begin
  for item in
    select conname from pg_constraint
    where conrelid = 'public.assinatura_wolf_empresas'::regclass and contype = 'u'
      and conkey = array[(select attnum from pg_attribute
        where attrelid = 'public.assinatura_wolf_empresas'::regclass and attname = 'workspace_id')]::smallint[]
  loop
    execute format('alter table public.assinatura_wolf_empresas drop constraint %I', item.conname);
  end loop;
end $$;

create unique index if not exists assinatura_wolf_empresas_workspace_cnpj_idx
  on public.assinatura_wolf_empresas(workspace_id, (regexp_replace(cnpj, '[^0-9]', '', 'g')));

-- O cadastro completo é salvo em uma transação, sem desativar representantes
-- de outra empresa ou deixar alterações parciais quando um dado é inválido.
create or replace function public.assinatura_wolf_salvar_empresa(
  p_workspace_id text, p_empresa_id uuid, p_empresa jsonb, p_representantes jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  empresa public.assinatura_wolf_empresas;
  item jsonb;
  rep_id uuid;
  posicao integer := 0;
  indice_padrao integer;
  agora timestamptz := now();
begin
  if nullif(trim(p_workspace_id), '') is null then raise exception 'Workspace obrigatório'; end if;
  if length(trim(coalesce(p_empresa->>'razao_social', ''))) < 3
    or length(regexp_replace(coalesce(p_empresa->>'cnpj', ''), '[^0-9]', '', 'g')) <> 14
    or length(trim(coalesce(p_empresa->>'endereco_completo', ''))) < 10
    or coalesce(p_empresa->>'email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then raise exception 'Revise os dados da empresa'; end if;
  if p_representantes is null or jsonb_typeof(p_representantes) <> 'array' then
    raise exception 'Cadastre ao menos um representante';
  end if;
  if jsonb_array_length(p_representantes) = 0 then raise exception 'Cadastre ao menos um representante'; end if;
  if p_empresa_id is not null then
    select * into empresa from public.assinatura_wolf_empresas
      where id = p_empresa_id and workspace_id = p_workspace_id for update;
    if not found then raise exception 'Empresa não pertence ao workspace'; end if;
  end if;
  if (select count(*) from jsonb_array_elements(p_representantes) r where nullif(r->>'id', '') is not null)
     <> (select count(distinct (r->>'id')::uuid) from jsonb_array_elements(p_representantes) r where nullif(r->>'id', '') is not null)
  then raise exception 'Representante duplicado'; end if;
  for item in select value from jsonb_array_elements(p_representantes) loop
    posicao := posicao + 1;
    if length(trim(coalesce(item->>'nome', ''))) < 3
      or length(regexp_replace(coalesce(item->>'cpf', ''), '[^0-9]', '', 'g')) <> 11
      or length(trim(coalesce(item->>'cargo', ''))) < 2
      or length(regexp_replace(coalesce(item->>'numero', ''), '[^0-9]', '', 'g')) < 10
      or coalesce(item->>'email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then raise exception 'Revise os dados do representante %', posicao; end if;
    rep_id := nullif(item->>'id', '')::uuid;
    if rep_id is not null and not exists (select 1 from public.assinatura_wolf_representantes
      where id = rep_id and empresa_id = p_empresa_id and workspace_id = p_workspace_id)
    then raise exception 'Representante não pertence à empresa'; end if;
    if indice_padrao is null and item->>'padrao' = 'true' then indice_padrao := posicao; end if;
  end loop;
  indice_padrao := coalesce(indice_padrao, 1);
  if p_empresa_id is null then
    insert into public.assinatura_wolf_empresas(workspace_id,razao_social,nome_fantasia,cnpj,endereco_completo,email,telefone)
    values (p_workspace_id,trim(p_empresa->>'razao_social'),nullif(trim(p_empresa->>'nome_fantasia'),''),
      regexp_replace(p_empresa->>'cnpj','[^0-9]','','g'),trim(p_empresa->>'endereco_completo'),trim(p_empresa->>'email'),
      nullif(regexp_replace(coalesce(p_empresa->>'telefone',''),'[^0-9]','','g'),'')) returning * into empresa;
  else
    update public.assinatura_wolf_empresas set razao_social=trim(p_empresa->>'razao_social'),
      nome_fantasia=nullif(trim(p_empresa->>'nome_fantasia'),''), cnpj=regexp_replace(p_empresa->>'cnpj','[^0-9]','','g'),
      endereco_completo=trim(p_empresa->>'endereco_completo'),email=trim(p_empresa->>'email'),
      telefone=nullif(regexp_replace(coalesce(p_empresa->>'telefone',''),'[^0-9]','','g'),''),ativa=true,updated_at=agora
    where id=p_empresa_id and workspace_id=p_workspace_id returning * into empresa;
  end if;
  update public.assinatura_wolf_representantes set ativo=false,padrao=false,updated_at=agora
    where empresa_id=empresa.id and workspace_id=p_workspace_id;
  posicao := 0;
  for item in select value from jsonb_array_elements(p_representantes) loop
    posicao := posicao + 1;
    rep_id := nullif(item->>'id', '')::uuid;
    if rep_id is null then
      insert into public.assinatura_wolf_representantes(empresa_id,workspace_id,nome,cpf,cargo,email,numero,ativo,padrao)
      values (empresa.id,p_workspace_id,trim(item->>'nome'),regexp_replace(item->>'cpf','[^0-9]','','g'),
        trim(item->>'cargo'),trim(item->>'email'),regexp_replace(item->>'numero','[^0-9]','','g'),true,posicao=indice_padrao);
    else
      update public.assinatura_wolf_representantes set nome=trim(item->>'nome'),cpf=regexp_replace(item->>'cpf','[^0-9]','','g'),
        cargo=trim(item->>'cargo'),email=trim(item->>'email'),numero=regexp_replace(item->>'numero','[^0-9]','','g'),
        ativo=true,padrao=(posicao=indice_padrao),updated_at=agora
      where id=rep_id and empresa_id=empresa.id and workspace_id=p_workspace_id;
    end if;
  end loop;
  return jsonb_build_object('empresa',to_jsonb(empresa),'representantes',
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.padrao desc,r.nome),'[]'::jsonb)
      from public.assinatura_wolf_representantes r where r.empresa_id=empresa.id and r.workspace_id=p_workspace_id and r.ativo));
end $$;
revoke all on function public.assinatura_wolf_salvar_empresa(text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.assinatura_wolf_salvar_empresa(text,uuid,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
