-- Log de transferência no chat, para todos os workspaces.
-- Toda vez que a fila ou o atendente de um atendimento muda por um processo
-- automático (bot, fluxo, IA, roleta, inatividade — tudo que roda no servidor
-- com a service role), grava uma mensagem "sistema" na conversa.
-- Mudanças feitas por um usuário logado no painel já gravam a própria mensagem
-- ("Chat transferido para: X, por: Y"), então aqui são ignoradas (auth.uid() presente).

create or replace function public.log_transferencia_atendimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mudou_fila boolean := coalesce(nullif(trim(new.fila), ''), '') is distinct from coalesce(nullif(trim(old.fila), ''), '')
                        and coalesce(nullif(trim(new.fila), ''), '') <> '';
  mudou_atendente boolean := coalesce(nullif(trim(new.atendente), ''), '') is distinct from coalesce(nullif(trim(old.atendente), ''), '')
                             and coalesce(nullif(trim(new.atendente), ''), '') <> '';
  nome_atendente text;
  texto text;
begin
  if auth.uid() is not null then
    return new;
  end if;
  if not (mudou_fila or mudou_atendente) then
    return new;
  end if;

  if mudou_atendente then
    select uw.nome into nome_atendente
      from usuarios_workspace uw
     where uw.workspace_id = new.workspace_id
       and lower(uw.email) = lower(trim(new.atendente))
     limit 1;
    nome_atendente := coalesce(nullif(trim(nome_atendente), ''), split_part(trim(new.atendente), '@', 1));
  end if;

  if mudou_fila and mudou_atendente then
    texto := format('Chat transferido para fila: %s, atendente: %s, por: Sistema (automático)', trim(new.fila), nome_atendente);
  elsif mudou_fila then
    texto := format('Chat transferido para fila: %s, por: Sistema (automático)', trim(new.fila));
  else
    texto := format('Chat transferido para: %s, por: Sistema (automático)', nome_atendente);
  end if;

  insert into mensagens (numero, mensagem, de, workspace_id, canal_id, tipo)
  values (new.numero, texto, 'sistema', new.workspace_id, new.canal_id, 'texto');

  return new;
exception when others then
  -- O log nunca pode impedir a transferência.
  return new;
end;
$$;

drop trigger if exists trg_log_transferencia_atendimento on public.atendimentos;
create trigger trg_log_transferencia_atendimento
  after update of fila, atendente on public.atendimentos
  for each row
  execute function public.log_transferencia_atendimento();
