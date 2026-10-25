# Alternativa Nio após inviabilidade VERO

No bloco de nicho da integração **VERO + VTAL**, a opção **Oferecer Nio após retorno sem viabilidade do BKO** habilita `alternativa_nio_bko.ativo`. Ela é independente das cidades e preços VERO e inicia apenas após retorno autenticado do BKO responsável pelo pedido. `SEM VIABILIDADE`, `SEM COBERTURA` e `SEM DISPONIBILIDADE` atualizam o CRM para `SEM DISPONIBILIDADE`.

O motor usa o endereço já salvo (incluindo quadra, lote, número em complemento e casa) para consultar a VTAL. Somente uma unidade confirmada permite oferecer o catálogo Nio da cidade, modalidade e forma de pagamento existentes. Falha técnica permanece pendente para retentativa. Unidade ambígua gera solicitação de conferência ao BKO, usando os dados e documentos salvos, sem reiniciar a coleta do cliente.

O cliente escolhe o novo plano antes da alteração. O mesmo registro de proposta recebe operadora Nio, plano, valor e status de auditoria. Dados pessoais, endereço, forma de pagamento, anexos e pendências documentais são preservados. A entrega VERO anterior e suas referências ficam no histórico; a entrega Nio começa com nova referência BKO, resumo atualizado e os mesmos originais. A rota de destino é a regra Nio do canal de origem. Não cria uma segunda venda nem reutiliza recibos VERO como recibos Nio.

Respostas repetidas não duplicam oferta, venda ou encaminhamento. Retornos atrasados do BKO VERO não alteram a fase Nio. Encerramento, bloqueio e atendimento humano continuam respeitados. O pós-venda Nio segue o tratamento existente.

Validação: `node --test deploy/universal-v1/alternativa-nio-bko.test.cjs`. A suíte executa os handlers de retorno, persistência, escolha e encaminhamento reais com banco, VTAL e transporte simulados; não envia mensagens a clientes nem altera pedidos de produção.
