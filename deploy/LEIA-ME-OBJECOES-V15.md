V15 — pacote completo Nio e Vero, incluindo o roteiro V14 e contorno comercial por intenção antes da coleta em todas as etapas, inclusive documentos e recuperação de titular. Não depende de uma lista fechada de frases. Preserva cadastro, plano e etapa. Aceitar continuar retoma o ponto pendente. Pedidos explícitos para parar e recusas finais após a tentativa de recuperação são respeitados. Benefícios, preços e alternativas devem vir do catálogo oficial.

Windows:
```powershell
scp "D:\GERAL\wolfsystem\deploy\wolf-vendas-objecoes-20261022-v15.tar.gz" root@2.24.210.200:/tmp/
```

VPS:
```bash
mkdir -p /tmp/wolf-vendas-v15
tar -xzf /tmp/wolf-vendas-objecoes-20261022-v15.tar.gz -C /tmp/wolf-vendas-v15
node /tmp/wolf-vendas-v15/roteiro-obrigatorio/instalar.cjs /root/wolf-whatsapp
```

O instalador testa, cria backup, reinicia e ativa após confirmar os módulos e a API. Resultado esperado: VENDA_FLUIDA_ATIVA. Não altera perfis do navegador nem muda destinatários BKO.
