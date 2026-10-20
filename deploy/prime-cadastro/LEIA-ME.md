# Correção cadastro Grupo Prime — 20/10/2026

Causa: o motor inferia tipo CPF a partir do rótulo do campo tipo_pessoa, exigindo 11 dígitos no lugar de PF/PJ. O tipo público agora tem validação própria e prioridade sobre rótulos. Números de documentos não passam como categoria.

O motor deixa de mostrar resumos técnicos nos blocos de plano e endereço do fluxo 27. Após coletar esses dados, segue para o cadastro. O cadastro mantém resumo completo, correção e confirmação obrigatória antes dos documentos. Confirmação 'Está sim' é reconhecida; negações e ressalvas continuam bloqueadas. Estados antigos inválidos não liberam confirmação direta.

O roteiro e a ordem cadastral são aplicados pelo organizador no banco. Este pacote atualiza apenas src/routes/fluxos.js, cria backup e não ativa canais nem envia mensagens. Preserva os demais patches BKO e lembretes.

node --test test.cjs
node patch.cjs /root/wolf-whatsapp --check
node patch.cjs /root/wolf-whatsapp
pm2 restart wolf-whatsapp
