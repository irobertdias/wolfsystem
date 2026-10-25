# Validação do motor universal — 24/10/2026

## Resultado

- Matriz universal: **1.000 cenários**, 1.000 aprovados após correção.
- Regressão anterior e novos casos de CEP: **125 testes**, 125 aprovados.
- Total automatizado: **1.125 testes**, nenhuma falha na rodada final.
- API real de IA: **20 interpretações sintéticas aprovadas**, em cinco nichos (escolha de oferta, nome com variável configurada, interrupção de mensagens e consulta de preços). Nenhuma venda ou mensagem foi enviada por esses ensaios.

A matriz executa o motor configurável real (`generico.cjs`) e seus componentes compartilhados. São 20 contratos, em cinco nichos (telecom, vestuário, barbearia, serviços e correspondente bancário), com dez configurações por nicho: campos, nomes de variáveis, preços, documentos e origem do catálogo variam. Não são mil defeitos encontrados: são mil cenários de validação.

## Contratos verificados

1. Aproveitamento dos dados anteriores à oferta.
2. Oferta antes da coleta pessoal.
3. Mapeamento editável do CRM e proteção do workspace e ID.
4. Escolha de oferta somente depois da apresentação.
5. Rejeição de oferta inexistente sugerida pelo interpretador.
6. Correção cadastral exige nova confirmação.
7. Respostas positivas avançam após o resumo.
8. Uso contextual do número atual do WhatsApp.
9. Datas em dez formatos.
10. Perguntas documentais editáveis sem vazar descrição técnica.
11. Orientação para cópia, xerox e arquivo digitalizado.
12. Documento perdido, roubado ou extraviado como pendência.
13. Recusa persistente segue para conferência do BKO.
14. Pedido explícito para parar mensagens encerra o contato.
15. Uma tentativa de retenção; recusa mantida é respeitada.
16. Dados sem evidência e campos alheios à configuração são descartados.
17. Fotos e PDFs não saem para a API sem consentimento explícito.
18. Recuperação de entrada interrompida sem repetir a já interpretada.
19. Encerramento isolado por workspace, canal e contato.
20. Configuração de preço inválida falha antes de gerar venda.

## Defeitos encontrados e corrigidos

Na primeira rodada, dez cenários falharam, distribuídos em duas causas comuns aos cinco nichos: o feminino em “identidade roubada” e o reconhecimento de “não quero receber mensagens”. Ambas foram corrigidas no componente compartilhado, sem criar motores específicos por nicho.

O caso do CEP 81935-476 acrescentou oito regressões: município único identificado pela consulta prevalece sobre cidade/UF informadas incorretamente; confirmações e repetição do CEP permitem retomar sessões antigas; a classificação de operadora usa o município corrigido. CEP identificado exclusivamente no endereço do emitente de uma conta continua dependendo de confirmação do cliente. Resultado com vários municípios não é escolhido arbitrariamente.

## Como reproduzir a matriz

```powershell
node --test deploy/universal-v1/motor-universal-1000.test.cjs
node --test deploy/universal-v1/localidade-cep.test.cjs
```

Os testes automatizados usam respostas simuladas de serviços externos e do interpretador para verificar as decisões e a persistência do motor. Não enviam mensagens nem criam vendas reais. A integração real com IA é verificada separadamente, com textos sintéticos; disponibilidade da API e entrega pelo WhatsApp exigem verificação operacional própria.
