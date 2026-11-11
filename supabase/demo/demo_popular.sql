-- ═══════════════════════════════════════════════════════════════════════
-- WORKSPACE DE DEMONSTRAÇÃO — dados 100% fictícios para gravar o vídeo.
--
-- Antes: crie o cliente no painel (CRM → Clientes → Novo cliente) com o
-- usuário "demo", tipo Telecom e todos os módulos ligados.
-- Depois: cole este script no Supabase → SQL Editor e clique em Run.
-- Para trocar o workspace, mude o valor de ws logo abaixo.
-- Pode rodar de novo: ele apaga os dados demo anteriores antes de criar.
-- Para apagar tudo depois do vídeo: demo_limpar.sql.
-- ═══════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  ws text := 'demo';
  nomes text[] := ARRAY['Mariana Alves Costa','Rafael Teixeira','Juliana Moreira','Lucas Ferreira Dias','Patrícia Gomes','Thiago Ribeiro','Camila Duarte','Felipe Nunes','Aline Barbosa','Gustavo Cardoso','Renata Pires','Diego Martins','Larissa Fonseca','Bruno Azevedo','Fernanda Rocha','Rodrigo Campos','Beatriz Lopes','André Carvalho','Vanessa Prado','Marcelo Freitas','Priscila Souza','Eduardo Lima','Tatiane Reis','Leandro Castro'];
  cidades text[] := ARRAY['Goiânia','Anápolis','Aparecida de Goiânia','Brasília','Uberlândia','Rio Verde','Catalão','Trindade'];
  ufs text[] := ARRAY['GO','GO','GO','DF','MG','GO','GO','GO'];
  vendedores text[] := ARRAY['Ana Souza','Bruno Lima','Carla Mendes','Daniel Rocha'];
  planos text[] := ARRAY['Fibra 500 Mega','Fibra 700 Mega','Fibra 1 Giga','Combo Fibra + TV','Móvel 50GB'];
  precos numeric[] := ARRAY[99.90,119.90,149.90,189.90,69.90];
  status_v text[] := ARRAY['INSTALADA','INSTALADA','INSTALADA','GERADA','PENDENTE','AGUARDANDO AUDITORIA','INSTALADA','CANCELADA','REPROVADA','GERADA'];
  msgs_cli text[] := ARRAY['Oi, vi o anúncio da fibra, quanto fica o plano de 500 mega?','Boa tarde! Quero saber se tem cobertura no meu endereço','Minha internet está caindo, consegue me ajudar?','Quero mudar meu plano para 1 giga','Vocês atendem em Anápolis?','Qual o prazo de instalação?','Preciso da segunda via do boleto','Tem plano com TV junto?'];
  msgs_at text[] := ARRAY['Olá! Tudo bem? Sou da equipe comercial, vou te ajudar 😊','Temos sim! Me passa seu CEP que eu confirmo a cobertura','Perfeito, o plano de 500 Mega sai por R$ 99,90 no débito automático','A instalação é em até 3 dias úteis depois da aprovação','Já gerei sua proposta, vou te mandar o link agora'];
  st_at text[] := ARRAY['aberto','em_atendimento','pendente','resolvido','resolvido','em_atendimento'];
  i int; n text; tel text; et_ids bigint[] := '{}'; at_id bigint; d timestamptz;
BEGIN
  -- ── limpa execução anterior ──
  BEGIN
    DELETE FROM atendimento_etiquetas WHERE atendimento_id IN (SELECT id FROM atendimentos WHERE workspace_id = ws);
    DELETE FROM mensagens WHERE workspace_id = ws;
    DELETE FROM atendimentos WHERE workspace_id = ws;
    DELETE FROM etiquetas WHERE workspace_id = ws;
    DELETE FROM proposta WHERE workspace_id = ws;
  EXCEPTION WHEN others THEN RAISE NOTICE 'limpeza atendimento/proposta: %', SQLERRM; END;

  -- ── etiquetas ──
  BEGIN
    WITH ins AS (
      INSERT INTO etiquetas (workspace_id, nome, cor, icone) VALUES
        (ws,'Lead quente','#EA580C','🔥'),(ws,'Venda gerada','#059669','✅'),
        (ws,'Aguardando retorno','#CA8A04','⏳'),(ws,'Suporte','#0EA5E9','🛠️'),
        (ws,'Sem viabilidade','#64748B','🚫')
      RETURNING id)
    SELECT array_agg(id) INTO et_ids FROM ins;
  EXCEPTION WHEN others THEN RAISE NOTICE 'etiquetas: %', SQLERRM; END;

  -- ── contatos / conversas do atendimento ──
  BEGIN
    FOR i IN 1..18 LOOP
      n := nomes[i];
      tel := '55629' || lpad((90000000 + i * 137)::text, 8, '0');
      d := now() - ((i * 7) || ' hours')::interval;
      INSERT INTO atendimentos (workspace_id, numero, nome, mensagem, status, fila, atendente, created_at)
      VALUES (ws, tel, n, msgs_cli[1 + (i % 8)], st_at[1 + (i % 6)],
              CASE WHEN i % 3 = 0 THEN 'Suporte' ELSE 'Comercial' END,
              CASE WHEN i % 5 = 0 THEN 'BOT' ELSE vendedores[1 + (i % 4)] END, d)
      RETURNING id INTO at_id;

      BEGIN
        INSERT INTO mensagens (workspace_id, numero, mensagem, de, created_at) VALUES
          (ws, tel, msgs_cli[1 + (i % 8)], 'cliente', d),
          (ws, tel, msgs_at[1], 'atendente', d + interval '2 minutes'),
          (ws, tel, 'Claro! Meu CEP é 74000-000', 'cliente', d + interval '5 minutes'),
          (ws, tel, msgs_at[2 + (i % 4)], 'atendente', d + interval '7 minutes');
      EXCEPTION WHEN others THEN RAISE NOTICE 'mensagens: %', SQLERRM; END;

      IF array_length(et_ids, 1) > 0 THEN
        INSERT INTO atendimento_etiquetas (atendimento_id, etiqueta_id) VALUES (at_id, et_ids[1 + (i % array_length(et_ids, 1))]);
      END IF;
    END LOOP;
  EXCEPTION WHEN others THEN RAISE NOTICE 'atendimentos: %', SQLERRM; END;

  -- ── vendas / propostas (CRM, funil e dashboard) ──
  BEGIN
    FOR i IN 1..24 LOOP
      INSERT INTO proposta (workspace_id, data_proposta, nome, cpf, email, endereco, cep, cidade, estado,
        telefone1, vencimento, forma_pagamento, plano, valor_plano, data_agendamento, periodo_instalacao,
        vendedor, status_venda, data_instalacao, operadora, dados_customizados)
      VALUES (ws,
        (current_date - (i * 2))::date,
        nomes[i],
        '000.000.' || lpad((100 + i)::text, 3, '0') || '-00',
        lower(replace(split_part(nomes[i], ' ', 1), 'í', 'i')) || i || '@exemplo.com',
        'Rua Exemplo, ' || (i * 10) || ' — Setor Demonstração',
        '74' || lpad((i * 111)::text, 3, '0') || '-000',
        cidades[1 + (i % 8)], ufs[1 + (i % 8)],
        '(62) 9' || lpad((9000 + i)::text, 4, '0') || '-' || lpad((i * 37)::text, 4, '0'),
        (ARRAY['05','10','15','20'])[1 + (i % 4)],
        (ARRAY['Débito automático','Boleto','Cartão de crédito'])[1 + (i % 3)],
        planos[1 + (i % 5)], precos[1 + (i % 5)],
        CASE WHEN i % 3 <> 0 THEN (current_date - (i * 2) + 2)::date END,
        (ARRAY['Manhã','Tarde'])[1 + (i % 2)],
        vendedores[1 + (i % 4)],
        status_v[1 + (i % 10)],
        CASE WHEN status_v[1 + (i % 10)] = 'INSTALADA' THEN (current_date - (i * 2) + 3)::date END,
        (ARRAY['Claro','Vivo','TIM'])[1 + (i % 3)],
        '{}'::jsonb);
    END LOOP;
  EXCEPTION WHEN others THEN RAISE NOTICE 'proposta: %', SQLERRM; END;

  -- ── respostas rápidas ──
  BEGIN
    DELETE FROM respostas_rapidas WHERE workspace_id = ws;
    INSERT INTO respostas_rapidas (workspace_id, atalho, mensagem) VALUES
      (ws, '/oi', 'Olá! Tudo bem? Sou da equipe comercial, como posso te ajudar? 😊'),
      (ws, '/planos', 'Nossos planos: 500 Mega R$ 99,90 · 700 Mega R$ 119,90 · 1 Giga R$ 149,90'),
      (ws, '/docs', 'Para gerar sua proposta preciso de: nome completo, CPF, CEP e e-mail.');
  EXCEPTION WHEN others THEN RAISE NOTICE 'respostas_rapidas: %', SQLERRM; END;

  -- ── RH: funcionários ──
  BEGIN
    DELETE FROM funcionarios WHERE workspace_id = ws;
    INSERT INTO funcionarios (workspace_id, nome, cpf, email, telefone, cargo, departamento, admissao, salario, status) VALUES
      (ws,'Ana Souza','000.000.201-00','ana@exemplo.com','(62) 90000-0201','Vendedora','Comercial', current_date - 420, 2400,'ativo'),
      (ws,'Bruno Lima','000.000.202-00','bruno@exemplo.com','(62) 90000-0202','Vendedor','Comercial', current_date - 300, 2400,'ativo'),
      (ws,'Carla Mendes','000.000.203-00','carla@exemplo.com','(62) 90000-0203','Supervisora','Comercial', current_date - 700, 3800,'ativo'),
      (ws,'Daniel Rocha','000.000.204-00','daniel@exemplo.com','(62) 90000-0204','Vendedor','Comercial', current_date - 90, 2200,'ativo'),
      (ws,'Elaine Castro','000.000.205-00','elaine@exemplo.com','(62) 90000-0205','Analista de BKO','Backoffice', current_date - 510, 2900,'ativo'),
      (ws,'Fábio Torres','000.000.206-00','fabio@exemplo.com','(62) 90000-0206','Gerente','Diretoria', current_date - 1200, 7500,'ativo');
  EXCEPTION WHEN others THEN RAISE NOTICE 'funcionarios: %', SQLERRM; END;

  -- ── Financeiro: lançamentos dos últimos 3 meses ──
  BEGIN
    DELETE FROM fin_lancamentos WHERE workspace_id = ws;
    FOR i IN 0..2 LOOP
      INSERT INTO fin_lancamentos (workspace_id, tipo, descricao, valor, vencimento, status, pago_em, valor_pago, forma_pagamento) VALUES
        (ws,'receita','Comissão operadora — lote ' || (i + 1), 18500 - i * 1200, (date_trunc('month', current_date) - (i || ' month')::interval + interval '9 days')::date, CASE WHEN i = 0 THEN 'pendente' ELSE 'pago' END, CASE WHEN i > 0 THEN (date_trunc('month', current_date) - (i || ' month')::interval + interval '9 days')::date END, CASE WHEN i > 0 THEN 18500 - i * 1200 END, 'Transferência'),
        (ws,'receita','Bônus de metas', 4200 + i * 300, (date_trunc('month', current_date) - (i || ' month')::interval + interval '19 days')::date, CASE WHEN i = 0 THEN 'pendente' ELSE 'pago' END, CASE WHEN i > 0 THEN (date_trunc('month', current_date) - (i || ' month')::interval + interval '19 days')::date END, CASE WHEN i > 0 THEN 4200 + i * 300 END, 'Transferência'),
        (ws,'despesa','Folha de pagamento', 23400, (date_trunc('month', current_date) - (i || ' month')::interval + interval '4 days')::date, 'pago', (date_trunc('month', current_date) - (i || ' month')::interval + interval '4 days')::date, 23400, 'Transferência'),
        (ws,'despesa','Aluguel do escritório', 3200, (date_trunc('month', current_date) - (i || ' month')::interval + interval '9 days')::date, CASE WHEN i = 0 THEN 'pendente' ELSE 'pago' END, CASE WHEN i > 0 THEN (date_trunc('month', current_date) - (i || ' month')::interval + interval '9 days')::date END, CASE WHEN i > 0 THEN 3200 END, 'Boleto'),
        (ws,'despesa','Internet e telefonia', 489.90, (date_trunc('month', current_date) - (i || ' month')::interval + interval '14 days')::date, CASE WHEN i = 0 THEN 'pendente' ELSE 'pago' END, CASE WHEN i > 0 THEN (date_trunc('month', current_date) - (i || ' month')::interval + interval '14 days')::date END, CASE WHEN i > 0 THEN 489.90 END, 'Débito automático'),
        (ws,'despesa','Anúncios Meta Ads', 1800, (date_trunc('month', current_date) - (i || ' month')::interval + interval '24 days')::date, 'pago', (date_trunc('month', current_date) - (i || ' month')::interval + interval '24 days')::date, 1800, 'Cartão de crédito');
    END LOOP;
  EXCEPTION WHEN others THEN RAISE NOTICE 'fin_lancamentos: %', SQLERRM; END;

  RAISE NOTICE 'Workspace % populado com dados de demonstração.', ws;
END $$;
