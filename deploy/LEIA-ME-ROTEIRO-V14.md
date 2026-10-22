Atualização V14 — Nio e Vero

Sequência: CEP, consulta oficial, CPF/CNPJ, ofertas do público, escolha, endereço, cadastro, resumo e confirmação, documentos, CRM e WhatsApp do BKO. Cidade e UF são aproveitadas da consulta. O cadastro aceita contatos repetidos e datas numéricas ou com mês por extenso. CPF não resolvido vira pendência; não são inventados dígitos. RG não exige comparação de nome: frente é o lado com retrato. Classificação inconclusiva é sinalizada ao BKO. Qualquer comprovante é recebido; a declaração de ausência é registrada e o pedido continua.

O instalador testa os arquivos, verifica a sintaxe, cria backup, reinicia o processo e só ativa a configuração V3 após confirmar o suporte no backend. Preserva canais e destinatários de cada operadora. Não altera nem apaga perfis do Chromium.

Na máquina Windows, enviar o arquivo para a VPS:

```powershell
scp D:\GERAL\wolfsystem\deploy\wolf-vendas-roteiro-20261022-v14.tar.gz root@2.24.210.200:/tmp/
```

Na VPS:

```bash
mkdir -p /tmp/wolf-vendas-v14
tar -xzf /tmp/wolf-vendas-roteiro-20261022-v14.tar.gz -C /tmp/wolf-vendas-v14
node /tmp/wolf-vendas-v14/roteiro-obrigatorio/instalar.cjs /root/wolf-whatsapp
```

O resultado esperado é `VENDA_FLUIDA_ATIVA: Nio 27 e Vero 28`. Sem essa confirmação, a configuração V3 não foi ativada. Um ID de mensagem sem confirmação do provedor não comprova envio da venda; erros permanecem registrados com retentativa automática.
