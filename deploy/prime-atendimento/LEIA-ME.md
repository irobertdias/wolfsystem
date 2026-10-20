# Atendimento Grupo Prime — 20/10/2026

O roteiro CPF/CNPJ é salvo no fluxo 27 pelo organizador. Este pacote altera somente dois pontos do motor de lembretes, com backup: repete o último lembrete a cada 20 minutos depois dos 20/40/60 e intercepta pedidos explícitos de encerramento. Restrito a grupoprime/fluxo 27; outros workspaces mantêm seu comportamento.

Abrange plano, endereço, cadastro, documentos e recuperação de CPF quando a sessão está ativa e esperando o cliente. Respostas reiniciam a contagem; atendimento encerrado, transferência humana, fluxo pausado ou bloqueio manual suspendem os disparos. Na API oficial, após 24 horas sem resposta, o envio livre é suspenso até nova mensagem ou futura configuração de template aprovado. A janela gratuita de anúncios não estende a permissão para mensagens livres.

Testar: node --test test.cjs
Validar: node patch.cjs /root/wolf-whatsapp --check
Instalar: node patch.cjs /root/wolf-whatsapp
Reiniciar: pm2 restart wolf-whatsapp

O pacote não ativa canais e não substitui os pacotes BKO/roleta. Não contém dados de clientes ou credenciais. Os testes simulam envio; não enviam mensagens reais.
