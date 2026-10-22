Pacote V16 completo: inclui V15, roteiro Nio/Vero e uso compartilhado ou exclusivo do canal de confirmações.

Na edição do canal, a caixa **Somente confirmações e BKO** controla o uso:

- Marcada: mantém o envio das vendas e os retornos BKO; bloqueia a automação comercial e seus lembretes.
- Desmarcada: permite atender leads com o fluxo/IA selecionado e continuar enviando vendas.

Marcar/desmarcar preserva o fluxo escolhido e as sessões existentes. Os destinatários por operadora continuam na configuração do BKO. Contatos BKO sem referência de venda não iniciam o vendedor. A interface exige o suporte do servidor antes de salvar essa opção.

Windows:
```powershell
scp "D:\GERAL\wolfsystem\deploy\wolf-canal-compartilhado-20261022-v16.tar.gz" root@2.24.210.200:/tmp/
```

VPS:
```bash
mkdir -p /tmp/wolf-canal-v16
tar -xzf /tmp/wolf-canal-compartilhado-20261022-v16.tar.gz -C /tmp/wolf-canal-v16
node /tmp/wolf-canal-v16/roteiro-obrigatorio/instalar.cjs /root/wolf-whatsapp
```
