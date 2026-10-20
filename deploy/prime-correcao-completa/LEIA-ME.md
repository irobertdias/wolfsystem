# Grupo Prime — correção consolidada de cadastro, documentos e lembretes

Inclui: separação PF/PJ de CPF; transição sem resumos técnicos em plano/endereço; reconhecimento de “Está sim”; classificação frente/verso pelo identificador e face lida; resposta baseada em arquivos salvos; texto não valida uploads; boleto/fatura/correspondência/contrato/print com endereço legível aceitos como comprovante; preservação do cadastro ao ler faturas em nome de terceiros; lembretes contínuos e cancelamento por pedido do cliente.

O roteiro no banco é atualizado separadamente pelo organizador. Este pacote altera cinco arquivos do backend, valida sintaxe e idempotência antes de escrever, cria backup e restaura os originais se houver falha de gravação. Preserva integrações BKO e não ativa canais ou fluxos. A janela de 24 horas da API oficial é respeitada; mensagens depois dela dependem de template aprovado, ainda não configurado.

Testes (simulados, sem envios reais):

`node --test /tmp/wolf-prime-completo/prime-*/test.cjs`

Validação: `node instalar.cjs /root/wolf-whatsapp --check`

Instalação: `node instalar.cjs /root/wolf-whatsapp`

Reiniciar: `pm2 restart wolf-whatsapp`

Não marca documentos ausentes como recebidos. Documentos já enviados mas não salvos precisam ser recuperados do original ou reenviados. Capturas armazenadas e dados da sessão são preservados.
