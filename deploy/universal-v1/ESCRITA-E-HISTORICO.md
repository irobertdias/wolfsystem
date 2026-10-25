# Escrita informal e histórico dos lembretes

Correções adicionais de 25/10/2026:

- CPF numérico enviado ao perguntar a modalidade define PF, preserva o documento e mostra o catálogo PF. CNPJ define PJ. Espaços, pontos, hífens, barras, sublinhados e quebras de linha são separadores; nenhum dígito é inventado. Um CPF do responsável em cadastro PJ não muda a contratação para PF.
- O motor genérico usa os nomes de variáveis configurados para modalidade e documento.
- Pedidos de preços e velocidades com grafias como `quantos mg`, `qntos mg`, `pasa os plamos` e `qual o valro` apresentam o catálogo; não autorizam escolha automática de oferta.
- As retentativas de respostas usam o resolvedor WebJS de destinatário já existente, inclusive para contatos persistidos como LID. O recibo fica salvo na conversa original. Uma falha de resolução anterior ao envio pode ser retomada mesmo se os dados já foram interpretados; timeouts de envio incerto não são liberados por essa condição.
- O histórico interno mantém metadados dos lembretes. As requisições à API recebem somente `role` e `content`, removendo campos internos `tipo` e `em` que causavam rejeição do formato e impediam a retomada após lembretes.

Validação: 3.192 testes passaram, incluindo os 1.000 contratos anteriores do motor, os 300 de agendamento, 1.372 mensagens distintas de CPF e 236 pedidos informais de catálogo, além dos casos de regressão e controles negativos. Cada novo caso de CPF executa tanto o motor integrado quanto o genérico com extração de IA vazia. Os pedidos informais simulam uma escolha incorreta do interpretador para verificar que o motor a impede. Os testes de histórico validam o corpo efetivamente montado para as duas APIs e a próxima etapa da coleta do nome.

São simulações com dados sintéticos, API e transporte simulados. Não representam 3.192 conversas reais nem demonstram entendimento de qualquer erro possível de escrita, áudio ou documento. Os testes multimodais anteriores permanecem na suíte.

Executar os arquivos `*.test.cjs` deste diretório com `node --test`. Resultado detalhado local: `deploy/escrita-regressao-completa.log`.

Referência oficial: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
