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
O vendedor coleta CEP, consulta cidade e catálogo, distingue PF/PJ, recomenda
plano elegível, confirma endereço/interesse e transfere à equipe. As quatro
saídas IA possuem tratamento humano. Não cria contratos, cobranças ou vendas
confirmadas apenas por resultado de CEP.

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

O script atualiza somente os ramos `prime_reversao_*` e `prime_aviso_*` do fluxo 27,
além da configuração de encerramento da consulta. Inclui os status necessários
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
python scripts/importar-viabilidade-vtal.test.py
node node_modules/typescript/bin/tsc --noEmit --incremental false
```
