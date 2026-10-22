Correção isolada da recuperação de mensagens para resposta nativa no WhatsApp Web.

Resolve telefone e LID separadamente, busca os identificadores em paralelo, carrega até 500 mensagens apenas da conversa solicitada e pede sincronização dessa conversa quando necessário. Mantém as validações de workspace, canal, contato, autoria e ID. Não substitui uma resposta citada por envio comum nem repete envio com resultado incerto. Uma mensagem efetivamente indisponível no WhatsApp continua produzindo erro explícito.

O instalador executa 18 testes, verifica sintaxe, cria backup de dois arquivos e reinicia wolf-whatsapp. A instalação não inclui arquivos de fluxos, configurações de canais ou banco de dados.

Windows:
```powershell
scp "D:\GERAL\wolfsystem\deploy\wolf-resposta-citacao-v6-20261022.tar.gz" root@2.24.210.200:/tmp/
```

VPS:
```bash
mkdir -p /tmp/wolf-citacao-v6
tar -xzf /tmp/wolf-resposta-citacao-v6-20261022.tar.gz -C /tmp/wolf-citacao-v6
node /tmp/wolf-citacao-v6/instalar.cjs /root/wolf-whatsapp
```
