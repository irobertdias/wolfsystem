alter table public.cadastros
  add column if not exists modulo_vendedor_ia boolean not null default false;

comment on column public.cadastros.modulo_vendedor_ia is
  'Libera o módulo avulso Vendedor IA (R$ 2.500,00), fora dos planos padrão.';

-- Mantém o módulo liberado para todos os clientes que já estão ativos.
-- O administrador pode bloquear um por um na tela CRM > Clientes.
update public.cadastros
set modulo_vendedor_ia = true
where autorizado = true;
