-- Retirada definitiva do módulo comercial antigo, após remoção das interfaces.
alter table public.cadastros drop column if exists modulo_vendedor_ia;
