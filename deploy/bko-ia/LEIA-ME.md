# Vendas e retorno BKO por WhatsApp — Grupo Prime

## Comportamento

CRM → Configurações → Geral → Retorno de vendas pelo WhatsApp do BKO.
Até cinco contatos com nome e WhatsApp, sem duplicatas, e um canal do mesmo workspace.
Configuração desativada por padrão. Instalar ou salvar não reconecta nem reativa o canal/vendedor.

Uma venda nova, criada pela IA após confirmação e documentos, recebe a marca de fila
`bko_pendente=SIM` em `proposta.dados_customizados`. O worker envia somente vendas do
fluxo 27, workspace grupoprime e status AGUARDANDO AUDITORIA. Não há disparo retroativo
para vendas antigas sem essa marca. O envio só funciona com configuração BKO e vendedor ativos.

Cada destinatário recebe o resumo dos dados cadastrais/comerciais e os três arquivos
privados: RG frente, verso e comprovante. Downloads saem do bucket privado, após conferir
origem, workspace, atendimento, categoria e caminho; não são criados links públicos.
Não são enviados chave IA, estado interno do fluxo ou demais campos técnicos.

O BKO usa Responder na mensagem da venda (texto ou um dos anexos) ou informa a referência
`#BKO-ID-REFERENCIA`. Retornos permitidos: CPF REPROVADO, APROVADO/APROVADA, GERADA,
AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE e CANCELADA.
APROVADO corresponde a APROVADA. Para agendar, linhas opcionais:

```text
GERADA
DATA: 25/10/2026
PERIODO: MANHÃ
```

Uma resposta precisa identificar uma única venda enviada integralmente ao remetente
autorizado, pelo canal configurado. Negação, vários status, referência divergente da
citação e destinatário não autorizado nunca são interpretados como aprovação.
Concorrência usa `proposta.updated_at` (trigger do motor CRM existente) e o status anterior.
Repetições do mesmo ID não repetem a atualização. O histórico dos retornos fica na venda.

Atualizar o CRM aciona os gatilhos existentes do vendedor para CPF reprovado, biometria
e agendamento. Há aviso de APROVADA e encerramento para SEM DISPONIBILIDADE. Corrigir
uma agenda mantendo GERADA/AGUARDANDO INSTALAÇÃO sinaliza um novo aviso, uma vez por retorno.
Novo titular recuperado recebe nova referência; a referência anterior deixa de autorizar alterações.

Envios são registrados por parte e destinatário antes de chamar o provedor. Se o processo
cair ou o provedor não confirmar, não há reenvio automático: estado REVISAR e liberação
administrativa de partes pendentes pela tela. A tela informa que uma entrega incerta
pode ter ocorrido. Partes já confirmadas não são reenviadas.

Não cria tabelas: configuração/versionamento no bloco de envio do fluxo, fila e histórico
nos campos internos da própria proposta. O organizador e o editor preservam a configuração BKO.
Campos de dados extensos ou chaves não são usados em filtros de URL; comparação de versão
do BKO usa um token curto em `nos->indice->dados->>bko_versao`.

## Instalar na VPS

Nenhuma mensagem real foi enviada nos testes. O SSH disponível na estação retornou
`Permission denied (publickey,password)`; esta versão ainda precisa ser instalada na VPS.

Na estação:

```powershell
scp "D:\GERAL\wolfsystem\deploy\wolf-bko-ia-20261020.tar.gz" root@2.24.210.200:/tmp/
```

Na VPS, autenticado como root, executar separadamente:

```bash
mkdir -p /tmp/wolf-bko-ia-20261020
tar -xzf /tmp/wolf-bko-ia-20261020.tar.gz -C /tmp/wolf-bko-ia-20261020
node --test /tmp/wolf-bko-ia-20261020/scripts/bko-ia.test.cjs
node /tmp/wolf-bko-ia-20261020/instalar.cjs /root/wolf-whatsapp --check
node /tmp/wolf-bko-ia-20261020/instalar.cjs /root/wolf-whatsapp
pm2 restart wolf-whatsapp
```

O instalador verifica todos os encaixes e a sintaxe antes de gravar. Faz backup dos arquivos
existentes em `backups/bko-ia-*`. Altera apenas código: index, captura do corpo do webhook,
interceptação WebJS/WABA e os dois módulos novos. Preserva autenticação, env e dados.
O restart interrompe brevemente as conexões do processo. Não elimina a necessidade de
tratar o banimento informado; a integração respeita o vendedor pausado.

Após instalar, a tela deve mostrar Servidor BKO disponível. Cadastrar os números antes
de ativar o encaminhamento. A primeira prova com WhatsApp real depende de canal operacional
e destinatário explicitamente configurado pelo administrador.

### API oficial (WABA)

Configurar `META_APP_SECRET` (ou WHATSAPP_APP_SECRET) e `META_GRAPH_VERSION` com a versão
habilitada na aplicação Meta. Não compartilhar esses segredos em mensagens ou no frontend.
O corpo original do webhook é preservado e o retorno exige assinatura HMAC-SHA256 válida
e phone_number_id correspondente ao canal. Sem assinatura, nenhum retorno BKO é aplicado.

O BKO deve iniciar a conversa enviando uma mensagem ao canal. Sem conversa recente o worker
aguarda em JANELA; não tenta usar documentos como mensagem de abertura nem inventa templates.
O intervalo conservador é de 23 horas desde a mensagem autenticada do BKO. O canal WebJS
usa somente a sessão já conectada: o módulo nunca abre Chromium ou tenta reconectar.

Referências de implementação: [assinatura do webhook, exemplo Meta](https://github.com/fbsamples/whatsapp-api-examples/blob/main/signature-validation-with-webhooks-payloads/app.py)
e [upload de mídia, coleção oficial Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/13382743-ecb27be5-4d27-4763-bbee-6a8002c04bf3).

## Validação local

```powershell
node --test scripts/bko-grupoprime.test.cjs
node scripts/empacotar-bko.cjs
node --test deploy/bko-ia/scripts/bko-ia.test.cjs
node deploy/bko-ia/instalar.cjs D:/GERAL/wolf-whatsapp --check
```

Testes usam banco, navegador e envios simulados. Cobrem cinco destinos, três arquivos,
autorização, outro canal/workspace, assinatura, ambiguidade, replay, conflito, timeout,
retentativa administrativa, agenda e manutenção da pausa. Não equivalem à homologação
com um número real nem provam estabilidade da conexão WhatsApp.
