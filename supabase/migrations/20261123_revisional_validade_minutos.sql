-- Validade do link da proposta revisional em MINUTOS (antes era em horas, máx. 720).
-- Cria a coluna nova já convertida; a antiga validade_horas fica só por compatibilidade.
alter table revisional_config add column if not exists validade_minutos integer;
update revisional_config set validade_minutos = validade_horas * 60 where validade_minutos is null;
alter table revisional_config alter column validade_minutos set default 1440;
alter table revisional_config alter column validade_minutos set not null;
alter table revisional_config drop constraint if exists revisional_config_validade_minutos_check;
alter table revisional_config add constraint revisional_config_validade_minutos_check check (validade_minutos between 1 and 43200);
notify pgrst, 'reload schema';
