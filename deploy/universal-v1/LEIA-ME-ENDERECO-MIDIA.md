# Correção de leitura e retomada de endereço — 24/10/2026

Fotos e PDFs passam a fornecer dados de endereço à consulta, respeitando a autorização de leitura do workspace. Cada campo exige evidência transcrita. Endereços de emitentes não preenchem dados de instalação; endereços conflitantes continuam exigindo esclarecimento. Os originais ficam privados.

Localizações do WhatsApp são preservadas com coordenadas e descrição, sem interpretar a miniatura como texto base64. Corpos contendo arquivos base64 válidos são armazenados como mídia somente após validação de tamanho e assinatura. Coordenadas, isoladamente, não confirmam viabilidade nem fornecem um CEP presumido.

Ausência do índice local não produz uma indisponibilidade temporária com tentativas infinitas. A correção complementar V2 pesquisa o CEP por cidade/UF/rua e cruza o resultado com a VTAL, sem exigir que o cliente descubra o CEP. Divergências de cidade mantêm a explicação correta. A retomada de uma consulta não reinterpreta nem acrescenta novamente uma mensagem já processada, e não reenvia a mesma pergunta sem entrada ou avanço de etapa. Pedidos para aguardar mantêm a etapa.

Arquivos antecipados sem categoria identificada permanecem salvos, sem ocupar indevidamente o lugar da frente do RG. A aceitação flexível durante a coleta de documentos e o cadastro/encaminhamento da venda continuam funcionando.

## Instalação

O pacote `wolf-endereco-midia-20261024.tar.gz` contém o instalador `instalar-endereco.cjs`. Execute-o dentro da pasta extraída, com Node, passando `/root/wolf-whatsapp`. Ele valida as âncoras do gerenciador de mídia e a sintaxe antes de aplicar. O backup privado fica em `backups/endereco-midia-<timestamp>`. Reinicie o serviço após a instalação e confirme a reconexão dos canais.

O instalador preserva as configurações de fluxo, catálogo e encaminhamento dos workspaces. Para reverter, restaure os arquivos do backup e reinicie o serviço.

## Verificação

56 testes passaram em `retomada`, `endereco-midia`, `universal`, `entrega`, `nativo`, `vero`, `generico`, `configuracao` e `pos-venda`. Incluem leitura de imagem/PDF, CEP do emitente, busca sem índice, localização, retomada sem duplicação, consentimento e encaminhamento separado por operadora.

No servidor também foi validada a leitura de uma foto do piloto autorizado e de uma imagem sintética contendo endereços distintos de emitente e instalação. Leitura inconclusiva não deve produzir um CEP inventado ou confirmar disponibilidade.
