-- Apaga os dados fictícios do workspace de demonstração (só do workspace 'demo').
-- O login e o workspace continuam; para remover o cliente use o painel.
DO $$
DECLARE ws text := 'demo';
BEGIN
  DELETE FROM atendimento_etiquetas WHERE atendimento_id IN (SELECT id FROM atendimentos WHERE workspace_id = ws);
  DELETE FROM mensagens WHERE workspace_id = ws;
  DELETE FROM atendimentos WHERE workspace_id = ws;
  DELETE FROM etiquetas WHERE workspace_id = ws;
  DELETE FROM proposta WHERE workspace_id = ws;
  DELETE FROM respostas_rapidas WHERE workspace_id = ws;
  DELETE FROM funcionarios WHERE workspace_id = ws;
  DELETE FROM fin_lancamentos WHERE workspace_id = ws;
  RAISE NOTICE 'Dados demo de % apagados.', ws;
END $$;
