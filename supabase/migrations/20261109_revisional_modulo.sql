-- Módulo Revisional liberado por cliente (cadastros), igual aos demais módulos.
-- Só o super admin liga/desliga na tela Clientes Wolf.
alter table public.cadastros
  add column if not exists modulo_revisional boolean not null default false;
