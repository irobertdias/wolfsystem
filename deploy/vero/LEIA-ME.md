# Vero — campanha por município do CEP

Fluxo criado: **28 — Grupo Prime · Vero · Vendas e BKO**. Destino autorizado: canal **162 — VERO**, fila **VENDAS VERO**. O canal Nio 158 e o fluxo Nio 27 não são reconfigurados.

| Rede / classe | Municípios | Ofertas mensais |
|---|---|---|
| Neutra | Belo Horizonte, Nova Lima, Itabira, Goiânia | 550 Mbps R$ 114,99; 700 Mbps R$ 124,99; 850 Mbps + Móvel R$ 129,99 |
| Própria / Especial | Ipatinga, Sabará, Timóteo | 550 Mbps R$ 109,99; 700 Mbps R$ 118,99; 850 Mbps + Móvel 30 GB R$ 129,99 |
| Própria / Prata | João Monlevade, Vespasiano | 420 Mbps R$ 69,99; 550 Mbps R$ 109,99; 700 Mbps R$ 118,99; 850 Mbps + Móvel 30 GB R$ 129,99 |

Não foram fornecidos franquia móvel da Rede Neutra, descontos por pagamento, fidelidade, instalação ou vigência. O vendedor não inventa essas condições.

## APIs

- `/api/viabilidade/vero?cep=74480150`: identifica a rede e a classe entre as nove cidades.
- `/api/viabilidade/vero/rede-neutra?cep=34000168`: somente as quatro cidades de Rede Neutra.
- `/api/viabilidade/vero/rede-propria?cep=35182327`: somente as cinco cidades de Rede Própria.

Exigem sessão autorizada do Grupo Prime ou o token de consulta próprio Vero, configurado no fluxo. O token da consulta Nio não autoriza essas rotas. Token de consulta não autoriza alteração cadastral.

O município é consultado pelo CEP completo no [ViaCEP](https://viacep.com.br/), sem usar a API anterior. Não há dedução por faixa de CEP, DDD ou cidade digitada. Somente cidade + UF exatas permitem ofertar. Falha do serviço postal retorna HTTP 503, nunca indisponibilidade definitiva. Cache postal de 24 horas por CEP evita repetir consultas.

**A consulta é de elegibilidade da campanha por município; não confirma porta, cobertura em todos os imóveis ou instalação.** A disponibilidade física continua sujeita à confirmação técnica. Os arquivos `ceps/*.csv` são recortes geográficos parciais da base histórica fornecida pelo cliente e exemplos postais verificados; não representam uma base de rede Vero nem todos os CEPs de cada cidade. CEP ausente desses CSVs continua consultável pela API nova.

## Conclusão e BKO

Cadastro e documentos seguem o fluxo anterior: coleta completa, resumo confirmado, duas fotos do RG sem comparação de nome/CPF, qualquer comprovante com endereço legível e arquivos privados no CRM. Validação final usa o catálogo Vero da cidade e o preço do servidor; não aceita preço fornecido pelo cliente. Recuperação de CPF altera a mesma venda Vero.

Em Configurações → BKO existe seletor Nio / Vero. Cada vendedor tem regras, origem e fila próprias. A configuração inicial Vero usa o canal de confirmações e responsável que já estavam cadastrados, com origem ajustada para 162 / VENDAS VERO. É editável separadamente.

## Instalação

O pacote `wolf-vero-completo-20261021.tar.gz` inclui a auditoria de sessões, QR sequencial, documentos sem validação de nome e extensão BKO Vero. Valida encaixes, testa, faz backups e reinicia uma vez. Não apaga logins durante a instalação. O fluxo permanece pausado até o instalador confirmar backend e API publicados; depois ele ativa o fluxo 28 e vincula somente o canal VERO.

Se aparecer “API Vero ainda não está publicada”, aguarde a implantação e execute `node /tmp/wolf-vero/ativar.cjs`. Esse comando não reinicia o serviço e só ativa após confirmar a nova API. O marcador `/bko/health` deve incluir `vero_fluxo: 28`.

Verificações: 79 testes passaram, TypeScript e build Next aprovados, composição/reaplicação do instalador testadas em cópia temporária do backend, consultas postais reais de Goiânia, Nova Lima e Timóteo conferidas. Testes de envio usam dados sintéticos e não constituem uma venda real de ponta a ponta.
