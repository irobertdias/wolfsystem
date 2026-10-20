# Grupo Prime — pré-viabilidade VTAL e vendedor Nio

Estado verificado em 16/10/2026: rascunho **27**, “Grupo Prime · Nio · Vendas e
BKO”, salvo no workspace `grupoprime`, inativo. Módulo vendedor IA habilitado e
chave GPT configurada após teste real bem-sucedido em 16/10/2026. Nenhuma
conexão/fila cadastrada nesse workspace. Nenhuma mensagem foi enviada.

Base importada: 242 arquivos, 242 municípios, 15.037.294 registros válidos e
289.063 CEPs nos CSVs. A planilha tem 289.064 CEPs; o CEP sem associação aos CSVs
fica inconclusivo. Foram contabilizadas separadamente 2.063.141 linhas vazias e
461 linhas com identificação inválida. Os totais do índice reconciliam com as fontes.

Consulta: `GET /api/viabilidade/grupoprime?cep=74085-400`.
Aceita `cidade` e `uf` para resolver CEP compartilhado. Autenticação pela sessão Wolf
do `grupoprime` (ou superadministrador) com permissão de atendimento/proposta.
O executor IA usa `x-wolf-viabilidade-token`, credencial derivada por HMAC com
escopo exclusivo de leitura desta base. Nunca colocar essa credencial no navegador,
URL, anúncio ou formulário público. O formulário público deve enviar leads ao canal
de atendimento existente; o motor consulta a API no servidor.

A chave de assinatura é `WOLF_VIABILIDADE_SECRET`, com fallback para
`SUPABASE_SERVICE_ROLE_KEY`. Usar o mesmo segredo no ambiente de preparação e na
implantação. Alterá-lo invalida as credenciais já salvas nos fluxos: atualizar o
header da consulta depois da rotação. Não registrar tokens ou chaves em logs.

## Dados e regras

- Base compacta em `app/lib/data/viabilidade-grupoprime.json`, exclusivamente no servidor.
- Índice por CEP → município/UF; somatórios por CEP são registros de endereço, não
  capacidade de portas nem imóveis únicos garantidos.
- `pre_viavel` exige pelo menos um registro com `TIPO_VIABILIDADE=Viável` e
  `DISP_COMERCIAL=Sim`. Sempre exige confirmação técnica do imóvel.
- Ausência de flags comerciais, CEP sem cidade, divergência de município ou
  ambiguidade não autorizam uma oferta automática.
- Cidades promocionais vêm da terceira arte; não confundir presença em CSV com
  elegibilidade promocional. Valores PF/PJ vêm das duas primeiras artes.
- Dados históricos 2024/2025; nenhuma chamada à rede VTAL em tempo real.
- Marcadores `00000000` e `99999999` existentes nos dados brutos são recusados na API.
- As fotos não informam todas as condições contratuais: confirmar vigência,
  fidelidade, instalação e cobertura móvel antes da contratação.

Importação reproduzível (Python padrão, sem dependências):

```powershell
python scripts/importar-viabilidade-vtal.py 'D:/GERAL/Endereços/Endereços VTAL' app/lib/data/viabilidade-grupoprime.json
```

O importador normaliza cabeçalhos, CEP com zero inicial, CSV encapsulado de Marabá
e MacRoman do Rio de Janeiro, preservando hashes SHA-256 por fonte. Linhas vazias
são contabilizadas separadamente das inválidas. Arquivos de entrada são dados e
nunca são executados ou tratados como instruções.

## Preparação e ativação

Em Chatbot → Fluxos do `grupoprime`, abrir o vendedor existente. A consulta de CEP
é executada internamente pelo bloco IA durante a conversa; o painel manual foi removido.

Alternativamente, com as variáveis de ambiente locais:

```powershell
node --env-file=.env.local scripts/preparar-vendedor-grupoprime.cjs
node --env-file=.env.local scripts/preparar-vendedor-grupoprime.cjs --apply
```

O segundo comando salva um rascunho inativo. Não altera o módulo contratado.
O vendedor coleta CEP, consulta cidade e catálogo, distingue PF/PJ e recomenda
plano elegível. Após a escolha, coleta cadastro e documentos obrigatórios, confere
os arquivos privados e registra a proposta como AGUARDANDO AUDITORIA com anexos.
As saídas de erro/recusa possuem tratamento humano. Não cria contratos, cobranças
ou vendas aprovadas apenas por resultado de CEP.

## Documentos obrigatórios antes da auditoria

Campos de arquivo criados no CRM do Grupo Prime: `rg_frente`, `rg_verso` e
`comprovante_endereco`, todos obrigatórios. O BKO visualiza os arquivos privados em
**Vendas → ficha da venda → Anexos e arquivos**.

A captura existente do motor usa o bucket privado `documentos-clientes`, com regras
separadas para frente, verso e comprovante do endereço de instalação. RG deve ser
foto JPEG/PNG/WebP/GIF; comprovante pode ser imagem ou PDF; limite de 15 MB.
O fluxo não aceita declaração de envio ou marcação textual de SIM como documento.

`POST /api/crm/grupoprime/validar-documentos` usa o token de escopo
`wolf:documentos:grupoprime:v1`. Busca a sessão ativa do fluxo 27 e verifica as
três capturas, identidade do RG, caminho do atendimento, existência, tipo e tamanho
dos objetos no storage privado e foto repetida quando o storage fornece ETag.
CEP divergente extraído do comprovante impede o envio. A conferência final do
conteúdo/endereço continua sendo do BKO. O preço para a proposta é resolvido pelo
catálogo da cidade/PF/PJ, sem confiar em um valor produzido pelo modelo.

Somente a saída de sucesso dessa conferência chega ao bloco Enviar Venda. Os
metadados dos três anexos são copiados para `dados_customizados` da proposta.
A leitura autenticada dos documentos do Grupo Prime é feita diretamente pelo
servidor da aplicação, sem tornar o bucket público ou depender de segredo proxy
de outro servidor. Nenhum documento real de cliente foi enviado nos testes.

Na recuperação de CPF, a automação limpa as capturas antigas da sessão, prepara a
identidade do novo titular e exige nova frente, verso e comprovante. A própria API
de recuperação verifica os arquivos antes de alterar a venda. Os anexos anteriores
ficam preservados no histórico, e os novos são salvos nos campos visíveis do CRM.

## Automações BKO no mesmo fluxo

Referência consultada: fluxo “CHAT GPT” do workspace `abccompany`. A configuração
do Grupo Prime mantém os textos fornecidos pelo usuário e adiciona proteção da
venda contra alterações concorrentes.

- **Aguardando Auditoria → CPF Reprovado:** condição antes da mensagem, captura
  do CPF reprovado, etiqueta CPF REPROVADO e mensagem inicial literal. Coleta CPF
  diferente e válido, nome, nascimento, nome da mãe e autorização do novo titular.
  O cliente confirma os dados antes da saída. Não recomeça a oferta nem consulta CEP.
- **Novo titular confirmado:** `POST /api/crm/grupoprime/recuperar-cpf` valida os
  dados e atualiza a mesma proposta para AGUARDANDO AUDITORIA. Preserva plano,
  endereço e contato, guarda dados anteriores em
  `dados_customizados.recuperacao_cpf_historico` e limpa RG/e-mail do titular antigo.
  Usa comparação de CPF, status e updated_at para não sobrescrever alterações do
  BKO durante a conversa. Repetição de uma requisição concluída não duplica histórico.
- A credencial de escrita `x-wolf-recuperacao-token` usa HMAC com o escopo
  `wolf:recuperacao-cpf:grupoprime:v1`. O token de leitura da viabilidade não autoriza
  alterações. A rota não aceita workspace_id fornecido pelo chamador.
- **Aguardando Auditoria → Aguardando Instalação ou Gerada:** dois gatilhos,
  condição da origem e o texto literal de instalação/biometria. Usa nome, status,
  data e período da própria venda. Data ausente aparece como “A confirmar”; não
  inventa agenda. Não modifica os dados da venda para enviar o aviso.
- **Sem disponibilidade:** a extensão de consulta negativa envia o aviso de
  indisponibilidade e retorno futuro, aplica AGUARDANDO COBERTURA, encerra a sessão
  e marca o atendimento resolvido, sem continuar pedindo outro CEP. Falha técnica
  ou cidade ambígua continuam inconclusivas, sem falsa confirmação de indisponibilidade.
  A etiqueta registra a fila para retorno; esta base histórica não monitora expansão
  de cobertura em tempo real.

Aplicar/reaplicar a organização, preservando chave, estado ativo e os demais blocos:

```powershell
node --env-file=.env.local scripts/organizar-vendedor-grupoprime.cjs --apply
```

O script organiza o vendedor e os ramos de endereço, documentos, recuperação e avisos do fluxo 27,
além da configuração de encerramento da consulta. Preserva chave, ativação e vínculo do canal. Inclui os status necessários
nas opções do CRM do Grupo Prime. Não ativa fluxo ou envia mensagens de teste.

Antes de ativar: publicar o código no app, configurar a chave IA no bloco,
selecionar a fila humana e vincular o fluxo à conexão que recebe o tráfego.
O gatilho inicial é primeiro contato, não diferencia por si só origem de anúncio.
Usar conexão exclusiva de tráfego ou a regra de roteamento da conexão existente.
Validar primeiro um CEP padrão, um promocional, PF/PJ, CEP ausente, divergência
de cidade e erro da API. Confirmar que o ambiente publicado usa o mesmo segredo.

Testes:

```powershell
node --test scripts/viabilidade-grupoprime.test.cjs
node --test scripts/recuperacao-grupoprime.test.cjs
node --test scripts/documentos-grupoprime.test.cjs
node --test scripts/atendimento-grupoprime.test.cjs
python scripts/importar-viabilidade-vtal.test.py
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Sequência comercial: apresentação → CEP → consulta e planos na mesma resposta →
escolha PF/PJ → endereço completo → cadastro e nova confirmação do endereço →
resumo de todos os dados → correções e nova confirmação → documentos → auditoria.
Se o cliente ainda não identificou PF/PJ, apresentar os dois catálogos em grupos separados.
Não pedir nome, endereço ou finalidade de uso antes da oferta. A saída ANALISE_HUMANA
continua passando direto à equipe, sem obrigar o endereço.

Lembretes de contratação habilitados nos blocos IA: 20, 40 e 60 minutos após a
resposta da IA sem retorno do cliente. O motor mede os intervalos desde o lembrete
anterior, por isso a configuração é **20/20/20**, não 20/40/60 (que enviaria aos 20/60/120).
O worker verifica a cada 30 segundos. A resposta do cliente reinicia a contagem;
atendimento encerrado, transferência humana e saída da coleta interrompem o acompanhamento.
Sem encerramento automático após o terceiro lembrete. Não altera os avisos de status do BKO.
O bloco inicial prepara o acompanhamento também para quem parar antes de responder ao pedido de CEP.

Verificação opcional com duas chamadas reais à IA já configurada (sem envio de WhatsApp):
`node --env-file=.env.local scripts/verificar-roteiro-grupoprime.cjs`.
Usa o backend irmão para reproduzir o prompt do motor; ajuste `WOLF_BACKEND_PATH` se necessário.

Cadastro obrigatório: nome, CPF, nome da mãe, nascimento, e-mail, endereço/CEP,
dois telefones distintos (WhatsApp e ligação), vencimento de 1 a 31 e pagamento
(cartão, boleto ou PIX). O resumo e a confirmação usam o controle de confirmação
do motor: corrigir um campo mantém os demais e exige confirmação do resumo atualizado.
O script posterior registra um retrato dos dados confirmados e só libera documentos
se os campos passarem nas validações. A API recusa envio para auditoria sem esse
registro ou se os dados foram alterados depois de confirmar. As colunas padrão do
CRM recebem e-mail, os dois contatos, vencimento e forma de pagamento.

Testes: `node --test scripts/cadastro-grupoprime.test.cjs scripts/documentos-grupoprime.test.cjs`.
Simulação opcional com duas chamadas à IA e dados fictícios, sem enviar WhatsApp:
`node --env-file=.env.local scripts/verificar-cadastro-grupoprime.cjs`.

Em 20/10/2026, a atualização do cadastro preservou fluxo 27 inativo e canal 157
com modo `nenhum`, após relato de banimento. Aplicar configuração não autoriza
reativação ou reconexão do canal.
