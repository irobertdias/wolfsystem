-- Módulos próprios de cada nicho (Informática, Vendas, Roupas, Consignado…),
-- ligados/desligados pelo admin no cadastro do cliente.
alter table public.cadastros add column if not exists nicho_opcoes jsonb not null default '{}'::jsonb;
