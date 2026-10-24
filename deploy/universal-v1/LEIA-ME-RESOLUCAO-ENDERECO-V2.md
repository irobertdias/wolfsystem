# Resolução compartilhada de endereço — Nio e Vero

Esta correção mantém as etapas de apresentação, consulta, modalidade, ofertas, escolha, cadastro, confirmação, documentos e conclusão. A consulta de endereço é compartilhada pelos dois vendedores.

- Rua com cidade/UF é pesquisada sem exigir CEP. A descoberta utiliza primeiro o índice fornecido. Se necessário, pesquisa o CEP pelo endereço postal e cruza o resultado com a VTAL. Encontrar um CEP no serviço postal **não** confirma disponibilidade comercial.
- Rua sem número pede somente o número/complemento necessário. O CEP recuperado e o endereço da linha encontrada ficam salvos. Após a escolha do plano, o cadastro começa diretamente quando o endereço completo já está conhecido.
- CEP inválido anteriormente salvo deixa de bloquear a busca por uma rua completa. Número avulso consulta fachada; quando não há fachada correspondente, uma casa só é aceita se houver uma unidade exata na base. Lote não é confundido com fachada.
- Palavra “Casa” sem identificador não é filtro. Número e casa iguais podem representar uma única fachada. Casa, apartamento e bloco informados são preservados no endereço, inclusive na rede própria Vero.
- Erros de escrita oferecem nomes parecidos para confirmação. Número e complementos permanecem salvos. Bairro/distrito identificado nas linhas do CEP não é tratado como município diferente.
- Endereço ausente da base recebe uma confirmação específica, em vez de perguntas genéricas repetidas. Confirmação positiva do endereço ausente permite concluir o atendimento sem disponibilidade cadastrada.

O módulo `descoberta-vtal.cjs` é somente de descoberta. Preços, políticas municipais Vero, tabela Nio e encaminhamento por operadora continuam nos módulos e configurações existentes. A confirmação do endereço após os dados pessoais continua sendo uma etapa do cadastro.

## Verificações

68 testes passaram, incluindo as regras de consulta, telefone contextual, aceites, documentos em lote, consentimento por workspace, CRM e entrega separada por operadora. O ensaio Nio completo com IA e consulta reais passou sem CEP inicialmente e sem pedir novamente o endereço após o plano. O ensaio nativo Vero percorreu coleta, confirmação, documentos e conclusão em memória. Os testes não cadastraram vendas reais nem enviaram mensagens de teste a clientes.

## Aplicação e recuperação

O pacote `wolf-resolucao-endereco-v2-20261024.tar.gz` usa `instalar-endereco.cjs`. A instalação valida sintaxe e âncoras e salva um backup privado antes de copiar os módulos. Reinicie `wolf-whatsapp` e confirme a reconexão dos canais.

`recuperar-sessoes-endereco.cjs` revisa somente sessões ativas dos canais 164 e 165, fluxos 29 e 31, no piloto Grupo Prime. Sem argumentos, apenas prepara um relatório. `--aplicar` persiste a recuperação com backup e comparação de versão. `--enviar` permite comunicar uma única retomada por sessão recuperada. Atendimentos finalizados ou assumidos/bloqueados para humano são preservados. Recibos incertos não devem ser reenviados cegamente.

As regras de leitura de fotos/PDFs e armazenamento privado continuam vigentes. A recuperação não altera configurações de BKO nem reabre atendimentos finalizados.
