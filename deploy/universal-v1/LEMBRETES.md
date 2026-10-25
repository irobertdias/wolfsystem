# Lembretes e retorno solicitado pelo cliente

No editor de fluxos, abra **Assistente universal → Lembretes inteligentes e retorno agendado**. O proprietário ativa a opção, escolhe o fuso e preenche cinco horários crescentes em minutos. São prazos cumulativos desde a última resposta normal do assistente. Não há ativação automática de workspaces nem imposição de horários para o quarto e quinto envio. Publique o fluxo para aplicar.

O disparador consulta as configurações publicadas a cada ciclo de aproximadamente 20 segundos. Uma resposta do cliente zera a contagem. O quinto lembrete encerra o atendimento como `resolvido`, finaliza a sessão e aplica o bloqueio pós-finalização configurado. Uma retomada tardia do serviço espaça as mensagens restantes, evitando disparar vários lembretes juntos.

Pedidos explícitos como “me chama amanhã às 15h” salvam o retorno no banco, no fuso escolhido. Enquanto espera esse horário, os lembretes por silêncio ficam suspensos. Se faltar dia/horário ou a data não for válida, solicita esclarecimento. Retorno solicitado não equivale a agendamento de instalação ou reserva de serviço. Após o retorno, a contagem de silêncio recomeça.

O motor ignora sessões encerradas, vendas concluídas, atendimento humano, bloqueios, entradas ainda não respondidas e canais desconectados. O envio atual usa os canais WebJS do motor universal. A configuração e o estado ficam isolados por workspace, fluxo, canal e contato. Um envio com resultado incerto é reconciliado pelo histórico/WhatsApp antes de continuar; não é reenviado cegamente.

Validação: `node --test deploy/universal-v1/agendamentos-300.test.cjs deploy/universal-v1/lembretes-universais.test.cjs`. Os 300 casos verificam interpretação de linguagem e datas com relógio controlado; a suíte adicional verifica o disparador com persistência e transporte simulados. Não substituem teste de entrega em um canal real conectado. O JSON e o HTML locais exibem cada um dos 300 casos: `node deploy/universal-v1/gerar-relatorio-agendamentos.cjs`.

Instalação do backend: pacote com os quatro módulos e `instalar-lembretes.cjs`; execute o instalador na pasta extraída, com `/root/wolf-whatsapp` como argumento, e reinicie o processo PM2 após salvar os arquivos. O instalador guarda backup antes de copiar. A interface exige publicar a versão frontend correspondente.
