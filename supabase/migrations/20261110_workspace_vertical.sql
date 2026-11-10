-- Tipo de negócio de cada workspace, escolhido no cadastro do cliente (tela Clientes Wolf).
-- Muda o vocabulário e as telas iniciais: telecom (padrão), revisional (Financeiro),
-- consignado, vendas e roupas.
alter table public.workspaces
  add column if not exists vertical text not null default 'telecom';

alter table public.workspaces drop constraint if exists workspaces_vertical_check;
alter table public.workspaces
  add constraint workspaces_vertical_check
  check (vertical in ('telecom', 'revisional', 'consignado', 'vendas', 'roupas'));

-- Workspaces que já tinham tipo definido no código.
update public.workspaces set vertical = 'revisional' where lower(username) in ('teste1', 'aproveconsultoria');
update public.workspaces set vertical = 'consignado' where lower(username) = 'blennerjuridico';
