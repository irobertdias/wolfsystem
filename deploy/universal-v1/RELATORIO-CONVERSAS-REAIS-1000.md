# Conversas, arquivos e bloqueio — 24/10/2026

## O que foi executado

Esta bateria é diferente da matriz anterior de configurações. Foram enviadas **1.000 entradas distintas à API real**, com credencial já autorizada do piloto, usando dados e arquivos sintéticos. Não foram cadastradas vendas nem enviadas mensagens a clientes pelos testes.

| Entrada | Casos | Aprovados na revisão final |
| --- | ---: | ---: |
| Texto de cliente | 900 | 900 |
| Imagem com endereço | 40 | 40 |
| PDF com endereço | 30 | 30 |
| Áudio sintetizado, transcrito e interpretado | 30 | 30 |
| **Total** | **1.000** | **1.000** |

O histórico contém **1.280 execuções**, incluindo retentativas e revisão dos casos que falharam. A primeira passagem completa teve 839 aprovados. Foram preservados os resultados iniciais, o histórico das tentativas e a resposta final por caso.

O relatório HTML permite buscar mensagem, erro de escrita, CEP, resultado ou ID. Cada entrada mostra o esperado, o obtido, a resposta estruturada da IA, a transcrição quando há áudio e a próxima mensagem produzida pelo motor. Os JSONs são evidência detalhada, não apenas uma contagem de testes.

## Linguagem coberta

CEP sem separador, com espaço simples e repetido, tabulação, quebra de linha, hífen, travessão, ponto, barra e underline; dados fragmentados; abreviações e grafias incorretas; CPF, telefone e referência ao WhatsApp atual; confirmação informal; pessoa física; quadra/lote e fachada; datas por extenso e em formatos numéricos; email ditado; vencimento por extenso; boleto com erros; escolha de oferta; perguntas de preço; recusa de documentação e pedido para parar mensagens.

Imagens variam em número do imóvel, tamanho de fonte e inclinação. PDFs têm números de imóvel distintos. Os áudios usam dez mensagens em três velocidades. A transcrição usa o mesmo componente do backend de produção.

## Correções implementadas

- Normalização de CEP sem inventar, substituir ou completar dígitos.
- Aproveitamento de CEP separado por quebra de linha quando a IA extrai apenas a primeira parte.
- Leitura contextual de quadra, lote e fachada, incluindo “qudra”.
- Referência informal “o msm q tô falando” para o contato atual.
- CPF/CNPJ como modalidade, sem confundir modalidade com número do documento.
- Números por extenso, vencimento, boleto e email ditado.
- Pergunta de preço impede seleção de plano, mesmo que o interpretador sugira um ID.
- Correção contextual invalida a confirmação anterior.

Nem toda primeira falha era um defeito do produto: a revisão também corrigiu comparação de números com zero à esquerda e acrescentou a pergunta anterior ao contexto dos casos que dependiam dela. Os resultados brutos foram preservados para auditoria.

## Bloqueio de encerrados

O encerramento passou a persistir o prazo definido no workspace em `bloqueado_ate`, além do status e das travas de automação. Grupo Prime: **24 horas**. Foram regularizados **25 atendimentos** encerrados sem prazo; a conferência seguinte encontrou **zero** encerrados elegíveis sem prazo. Atendimentos com retomada ativa foram preservados.

**17 testes específicos** cobrem texto, CEP, `/menu`, `/reiniciar`, áudio, imagem e PDF; mensagens simultâneas, nova instância do serviço, expiração e reabertura manual explícita. A regressão automatizada completa terminou com **1.163 testes aprovados**.

## Limite da evidência

O resultado é 1.000/1.000 **nesta bateria**, após correções e retentativas. Não comprova entendimento de toda frase possível nem leitura de arquivo ilegível. Conteúdo ambíguo ou incompleto exige esclarecimento específico, sem inventar dados. Esta bateria não mede disponibilidade externa, autenticação de documentos, ruído real de microfone nem entrega do WhatsApp.

## Reprodução

```powershell
node deploy/universal-v1/gerar-fixtures-conversas.cjs
node deploy/universal-v1/avaliar-conversas-reais.cjs CAMINHO_DO_MOTOR_COM_CREDENCIAL DIRETORIO_DOS_RESULTADOS
node deploy/universal-v1/gerar-relatorio-conversas.cjs RESULTADO_FINAL_JSON RELATORIO_HTML
```

O avaliador faz chamadas cobradas à API. Usa checkpoint: casos aprovados não são repetidos ao retomar o mesmo diretório. O diretório do motor deve conter os módulos de produção e a credencial privada; o arquivo de credencial nunca integra os relatórios.
