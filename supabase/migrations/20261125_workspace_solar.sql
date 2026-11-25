-- Novo tipo de workspace: Energia Solar (venda e instalação de sistemas fotovoltaicos).
alter table public.workspaces drop constraint if exists workspaces_vertical_check;
alter table public.workspaces
  add constraint workspaces_vertical_check
  check (vertical in ('telecom', 'revisional', 'consignado', 'vendas', 'roupas', 'informatica', 'solar'));
