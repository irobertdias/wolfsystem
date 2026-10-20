# Auditoria do vendedor e integração BKO — 20/10/2026

## Resultado verificado

- 99 testes passaram: CEP e catálogo, cadastro, documentos, recuperação de CPF, lembretes, BKO, QR e integração do motor.
- Canais 154 e 157 consultados na VPS: conectados, sem erro informado.
- Fluxo 27: 46 blocos, 68 conexões, nenhuma conexão inválida ou saída duplicada.
- Atendimento que reiniciou foi restaurado para recuperação da mesma proposta, preservando histórico e sem enviar aviso duplicado.
- A proposta 532 teve dados e três anexos enviados ao BKO; os quatro envios foram confirmados por identificador do provedor.

## Correções da revisão completa

| Caminho | Ajuste |
|---|---|
| Abertura e recuperação | Persistir sessão antes da mensagem inicial; erros do banco não viram sessão inexistente. |
| Mesmo cliente em canais diferentes | Consultar, salvar e finalizar com escopo de workspace e canal. Sessões legadas são adotadas no canal correto. |
| Mensagens simultâneas | Gatilho CRM e resposta do cliente compartilham a fila do Grupo Prime. |
| Recuperação após reprovação | Titular canônico do CRM prevalece sobre snapshots antigos; estados de tentativas anteriores são limpos. |
| Sessão ausente | Pedido reprovado retoma recuperação; pedido em auditoria não abre nova contratação com “obrigado”. |
| Cadastro | Ordem de campos, confirmação completa e correções antes dos documentos. |
| Documentos | Frente verifica nome; verso verifica face visual. Comprovante de qualquer tipo com endereço legível; CEP diferente não bloqueia. |
| Retentativa com arquivos salvos | Não pedir novamente documentos presentes; confirmação legível sem flags técnicas de OCR. |
| CRM | Sessão validada identifica a proposta; retentativa reutiliza a mesma venda. Falha no aviso WhatsApp não desfaz um registro confirmado. |
| Troca de titular | Preservar contato de e-mail já cadastrado; sincronizar campos principais e snapshot de automação. |
| BKO | Regras por canal/fila; um responsável; resumo e anexos; partes confirmadas não são reenviadas; retorno identifica a venda específica. |
| Lembretes | Testados 20/40/60 minutos e repetições; resposta e encerramento cancelam os pendentes. |
| WhatsApp Web | Chrome nativo, ciclo do navegador protegido e recuperação específica do perfil 154 com backup. |

## Aplicação

As alterações do grafo já foram aplicadas no banco. O pacote `wolf-auditoria-completa-20261020.tar.gz` contém as correções estruturais do backend, ainda dependentes de instalação na VPS.

O instalador valida os 12 arquivos em conjunto, roda testes locais, testa o navegador em perfil temporário, faz backup do código e reinicia o serviço uma única vez. A validação falha antes da escrita se a versão não tiver os encaixes esperados. Não apaga logins, documentos nem configurações do BKO.

Depois da instalação, `/bko/health` deve informar `auditoria_sessoes: true`. A confirmação desse campo distingue a revisão instalada do pacote anterior.

## Limites da verificação

Os testes completos do motor usam banco e envio simulados; não equivalem a uma venda real nova em produção. Foram verificados também os estados e entregas reais descritos acima. Não foi feito disparo de teste a clientes.

O canal 153 apresentou rejeição de acesso pela Meta nos logs fornecidos; a correção depende de credenciais/permissões válidas desse canal. Não foi alterado ou desativado.

Reengajamento por mensagem livre na API oficial respeita a janela de atendimento; envio após essa janela depende de template aprovado. A revisão não altera regras da Meta.
