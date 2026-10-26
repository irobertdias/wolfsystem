# Retornos automáticos do BKO

O retorno autenticado do BKO, associado ao pedido por resposta à mensagem ou referência BKO, atualiza o CRM e executa o pós-venda imediatamente. Não depende de intervenção no Codex nem de acionar manualmente outro bloco. A reconciliação periódica preserva tentativas e recibos pendentes.

| Retorno | Ação padrão |
| --- | --- |
| SEM DISPONIBILIDADE / SEM VIABILIDADE / SEM COBERTURA | No fluxo VERO com alternativa habilitada, consulta Nio e oferece ao cliente se houver disponibilidade. Encaminha ao BKO Nio somente após escolha. |
| CPF REPROVADO | Solicita outro titular autorizado e reaproveita o pedido. |
| CPF APROVADO / APROVADO | Salva APROVADA no CRM e segue o pós-venda de aprovação. |
| AGUARDANDO INSTALAÇÃO / PENDENTE DE INSTALAÇÃO | Avisa o cliente e solicita data/período ao BKO. Se já vierem no retorno, informa diretamente a agenda completa. |

Os nomes armazenados no CRM são preservados. Aceita variações de caixa, acento, sublinhado, prefixo `STATUS:`, CPF escrito `c pf`/`c.p.f` e as grafias comuns testadas. Dúvidas como `CPF aprovado?`, negações e status contraditórios não viram aprovação automática.

Cada ação conserva sua chave única e o recibo. Retornos repetidos não duplicam mensagens. A entrega ao cliente usa o resolvedor WebJS existente e reconhece seu `messageId`; a conferência de envios antigos usa o JID resolvido, sem reenviar cegamente. Canal, workspace, remetente autorizado, vínculo com o pedido e bloqueios existentes continuam verificados. Regras personalizadas e o modo de retorno por fluxos permanecem disponíveis para quem os configurar.

Testes: `node --test deploy/universal-v1/pos-venda.test.cjs deploy/universal-v1/alternativa-nio-bko.test.cjs`. A suíte completa do diretório passou em 3.295 testes sintéticos, incluindo reconhecimento das grafias, efeitos no CRM, despacho imediato, agenda, alternativa Nio e confirmação sem mensagens duplicadas.
