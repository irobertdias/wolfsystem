-- Revisional: novo tipo de análise "emprestimo" (empréstimo pessoal e consignado).
alter table public.revisional_propostas drop constraint if exists revisional_propostas_tipo_check;
alter table public.revisional_propostas
  add constraint revisional_propostas_tipo_check check (tipo in ('imovel', 'veiculo', 'emprestimo'));
