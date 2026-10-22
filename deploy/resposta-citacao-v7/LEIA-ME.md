V7 — recuperação da chave da mensagem usando a coleção nativa do WhatsApp, sem exigir a serialização completa do chat.

Antes de alterar arquivos ou reiniciar o processo, o instalador verifica a foto real #503829, do workspace abcfinan, canal 154. Ele tenta recuperar a mensagem e montar o contexto de citação sem enviar mensagem à cliente. Se não conseguir, para com o erro detalhado e preserva a instalação atual.

São executados 21 testes. A instalação altera apenas três arquivos de respostas, com backup. Não inclui arquivos de fluxos, configurações de canais ou banco de dados.

Windows:
```powershell
scp "D:\GERAL\wolfsystem\deploy\wolf-resposta-citacao-v7-20261022.tar.gz" root@2.24.210.200:/tmp/
```

VPS:
```bash
mkdir -p /tmp/wolf-citacao-v7
tar -xzf /tmp/wolf-resposta-citacao-v7-20261022.tar.gz -C /tmp/wolf-citacao-v7
node /tmp/wolf-citacao-v7/instalar.cjs /root/wolf-whatsapp
```

Resultados de sucesso: FOTO_RECUPERADA_SEM_ENVIO e CITACAO_V7_REINICIADA. Se aparecer FOTO_NAO_RECUPERADA ou FOTO_NAO_CITAVEL, copie a saída; a instalação não terá sido aplicada.
