# Piloto universal V1 — Grupo Prime / Nio

O piloto usa um assistente universal conectado a um nicho telecom. Os demais nichos continuam em rascunho. O processamento fica no serviço WhatsApp; o editor e a API Next não executam conversas em segundo plano.

O fluxo visível é **Vendedor IA → Nicho de atendimento → Concluir venda · CRM + WhatsApp**. O campo `prompt` do nicho é editável e usado pelo interpretador. O último bloco controla as opções reais `crm` e `whatsapp`; ambas ficam ligadas no piloto. Ele mostra a configuração BKO Nio já existente. Desmarcar WhatsApp conserva o pedido no CRM sem colocá-lo na fila de envio; desmarcar CRM impede o cadastro automático e também desmarca WhatsApp.

`configuracao-universal.cjs` é compilado de `app/lib/atendimento-universal.ts`, mantendo o prompt padrão e as opções de conclusão iguais no editor e no servidor. `migrar-configuracao.cjs` acrescenta o prompt e o bloco final ao fluxo 29 com backup e comparação do conteúdo anterior, preservando o estado de ativação e os atendimentos.

## Consulta

- `/api/viabilidade/grupoprime/vtal` usa a autenticação do workspace ou o token de leitura já existente.
- O serviço interno `/universal/vtal` consulta a mesma API do site Vtal. Número avulso filtra `numero` (fachada); quadra procura o logradouro e, quando necessário, complementos; lote procura os três complementos com igualdade numérica, sem confundir 1 com 10.
- O índice `indice-vtal` contém somente rua/CEP por cidade/UF e permite descobrir o CEP a partir da rua. Não determina disponibilidade: a linha completa é consultada na API.
- Base fornecida: snapshots de 2024/2025. Encontrar uma linha comercializável não garante instalação atual. Falha de API é inconclusiva e não significa falta de cobertura.
- Mais de uma unidade exige identificar casa, apartamento ou bloco. O motor preserva o restante do cadastro.

## Conversa e dados

As mensagens próximas são agrupadas por atendimento. A entrada é persistida antes da chamada à IA, com retomada automática após falha. A IA interpreta os dados e a intenção; o código controla catálogo, preço, confirmação e registro. Preços vêm de `app/lib/planos-grupoprime.ts`, compilado neste pacote, incluindo a tabela promocional por cidade/UF.

Sequência: apresentação → cidade/UF → consulta de CEP/endereço → CPF ou CNPJ com explicação → ofertas → escolha do plano → endereço → nome, CPF, nascimento, mãe, e-mail → confirmação de endereço → contato → vencimento/pagamento → resumo confirmado → documentos → CRM/WhatsApp. Dados enviados antecipadamente são aproveitados. Correção depois do resumo exige nova confirmação.

Os originais são salvos no bucket privado antes da leitura. A chave fica somente em `credencial.json` no servidor, com permissão 0600. `documentosOpenai: true` habilita a leitura de fotos/PDFs pela OpenAI, autorizada pelo responsável pelo piloto. RG aberto pode atender frente e verso. Leitura inconclusiva mantém o arquivo e uma pendência para o BKO, sem afirmar documento inválido ou identidade aprovada.

## CRM e WhatsApp

O registro usa uma chave estável por sessão e consulta cadastro anterior antes de repetir uma inserção. O CRM recebe os arquivos e a fila de entrega. O destino e o remetente vêm da configuração BKO Nio existente, sem substituir os números na instalação.

Cada parte da entrega guarda seu recibo. Recibo pendente não vira envio confirmado. Mensagens com resultado incerto são reconciliadas pela referência, sem reenvio cego. O BKO pode responder à referência da venda com os estados já suportados no sistema. Falha de conexão conserva a venda na fila.

## Instalação e validação

`node instalar.cjs /root/wolf-whatsapp` faz backup, instala os módulos e cria um fluxo inativo. A chave da configuração Nio anterior é reutilizada apenas no servidor. `node ativar.cjs /root/wolf-whatsapp` exige serviço pronto, canal conectado e BKO configurado; ativa somente o canal 164 e o novo fluxo. Não altera Vero nem outros workspaces.

Testes: `node --test *.test.cjs`. `avaliar-ia.cjs` e `ensaio.cjs` usam a API real com dados fictícios, em memória, sem criar vendas nem enviar mensagens. O índice pode ser regenerado com `importar-logradouros.py ORIGEM DESTINO`.

O backup indicado na instalação contém o inicializador, configurações e versão anterior. Para desativar imediatamente, mude o canal do piloto para modo `nenhum` e desative o fluxo novo; dados históricos e vendas permanecem preservados.

## Documentos em lote, painel e pós-venda

`documentos.cjs` incorpora cada original antes de ler o próximo arquivo. A etapa de leitura avança dentro do lote e originais repetidos não duplicam o cadastro. Faces classificadas de forma repetida seguem com observação para conferência no BKO.

O painel `/chatbot/vendas` reúne os envios antigos e do motor universal, seus destinatários, textos, arquivos, recibos e respostas. O acesso exige autenticação, workspace Grupo Prime e permissão de configurações. O chat de atendimento permanece separado.

`pos-venda.cjs` associa respostas pelo recibo citado ou referência BKO; sem citação exige um único pedido ativo do destinatário autorizado. Atualiza o CRM e persiste ações de acompanhamento antes de enviar. CPF exige outro titular autorizado, aprovação informa a etapa de biometria e pedidos gerados/aguardando instalação solicitam dia e período ao BKO antes de informar a agenda ao cliente. A troca de CPF reaproveita o pedido, exige conferência dos dados do titular no BKO e renova a referência para impedir aprovação por retorno antigo. Falhas de envio retomam ações pendentes; envios sem resultado confirmado são reconciliados antes de qualquer nova tentativa.

ACK 1 significa aceitação pelo servidor WhatsApp, ACK 2 entrega ao destinatário e ACK 3 leitura. O painel distingue essas situações. Não se deve simular retorno real do BKO em produção para testar: use `node --test pos-venda.test.cjs entrega.test.cjs universal.test.cjs`.
