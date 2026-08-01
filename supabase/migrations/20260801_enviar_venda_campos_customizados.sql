-- Aplica de forma atômica o mapeamento manual do bloco Enviar Venda
-- aos campos personalizados do CRM, sem alterar o motor estável do fluxo.

create or replace function public.wolf_mapear_campos_customizados_proposta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  fluxo_nos jsonb;
  no_fluxo jsonb;
  mapeamento record;
  destino text;
  origem text;
  valor jsonb;
begin
  if new.fluxo_id is null or new.workspace_id is null then
    return new;
  end if;

  select to_jsonb(f.nos)
    into fluxo_nos
    from public.fluxos f
   where f.id = new.fluxo_id
     and f.workspace_id = new.workspace_id
   limit 1;

  if fluxo_nos is null or jsonb_typeof(fluxo_nos) <> 'array' then
    return new;
  end if;

  for no_fluxo in
    select value
      from jsonb_array_elements(fluxo_nos)
  loop
    if no_fluxo ->> 'tipo' <> 'enviar_venda'
       or coalesce(no_fluxo #>> '{dados,modo_mapeamento}', 'automatico') <> 'manual'
       or jsonb_typeof(no_fluxo #> '{dados,mapeamento}') <> 'object' then
      continue;
    end if;

    for mapeamento in
      select key, value
        from jsonb_each_text(no_fluxo #> '{dados,mapeamento}')
    loop
      destino := regexp_replace(trim(mapeamento.key), '^custom\.', '');
      origem := trim(mapeamento.value);

      if destino = '' or origem = '' then
        continue;
      end if;

      if not exists (
        select 1
          from public.proposta_campos_customizados c
         where c.workspace_id = new.workspace_id
           and c.slug = destino
           and c.ativo is distinct from false
      ) then
        continue;
      end if;

      -- O motor preserva as variáveis em dados_customizados. Se a origem
      -- também for uma coluna fixa, busca o valor diretamente na proposta.
      valor := coalesce(
        to_jsonb(new.dados_customizados) -> origem,
        to_jsonb(new) -> origem
      );

      if valor is null or valor = 'null'::jsonb then
        continue;
      end if;

      new.dados_customizados := jsonb_set(
        coalesce(to_jsonb(new.dados_customizados), '{}'::jsonb),
        array[destino],
        valor,
        true
      );
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_wolf_mapear_campos_customizados_proposta
  on public.proposta;

create trigger trg_wolf_mapear_campos_customizados_proposta
before insert on public.proposta
for each row
execute function public.wolf_mapear_campos_customizados_proposta();

comment on function public.wolf_mapear_campos_customizados_proposta() is
  'Conector isolado que aplica o mapeamento do Enviar Venda em dados_customizados.';
