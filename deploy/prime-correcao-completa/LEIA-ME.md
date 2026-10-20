# Envio automático — versão 4

Vendas prontas em SIM, JANELA ou REVISAR voltam a ser processadas automaticamente; não há aprovação ou botão obrigatório antes do envio. Partes já confirmadas são preservadas. Falhas antes do envio têm retentativa com intervalo. Uma entrega de resultado incerto continua retida para evitar duplicatas, sem ser confundida com aprovação do BKO.

# Atualização v2

Inclui dupla leitura do comprovante quando o CEP extraído difere do cadastro (sem substituir o valor por suposição) e permite que um BKO explicitamente cadastrado coincida com o telefone do cliente em testes. Continua bloqueando o próprio canal de envio como destinatário. A regra de canal de origem e a autorização dos números BKO permanecem obrigatórias.

Após instalar, uma venda em REVISAR só será reenviada mediante retentativa administrativa; partes confirmadas não são repetidas.

# Grupo Prime — correção consolidada de cadastro, documentos e lembretes

Inclui: separação PF/PJ de CPF; transição sem resumos técnicos em plano/endereço; reconhecimento de “Está sim”; classificação frente/verso pelo identificador e face lida; resposta baseada em arquivos salvos; texto não valida uploads; boleto/fatura/correspondência/contrato/print com endereço legível aceitos como comprovante; preservação do cadastro ao ler faturas em nome de terceiros; lembretes contínuos e cancelamento por pedido do cliente.

O roteiro no banco é atualizado separadamente pelo organizador. Este pacote altera seis arquivos do backend, valida sintaxe e idempotência antes de escrever, cria backup e restaura os originais se houver falha de gravação. Preserva integrações BKO e não ativa canais ou fluxos. A janela de 24 horas da API oficial é respeitada; mensagens depois dela dependem de template aprovado, ainda não configurado.

Testes (simulados, sem envios reais):

`node --test /tmp/wolf-prime-completo/prime-*/test.cjs`

Validação: `node instalar.cjs /root/wolf-whatsapp --check`

Instalação: `node instalar.cjs /root/wolf-whatsapp`

Reiniciar: `pm2 restart wolf-whatsapp`

Não marca documentos ausentes como recebidos. Documentos já enviados mas não salvos precisam ser recuperados do original ou reenviados. Capturas armazenadas e dados da sessão são preservados.
