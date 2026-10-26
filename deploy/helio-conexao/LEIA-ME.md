# Proteção de conexão WebJS

Corrige a recuperação atrasada que poderia recriar um navegador depois de a conexão voltar, e impede recuperação automática enquanto o canal está autenticando ou aguardando QR. Inicialização efetivamente travada continua elegível após a tolerância. Heartbeat de página travada continua permitido.

O callback do manager passa a identidade da sessão para a proteção. O módulo também fecha os navegadores nos sinais SIGINT/SIGTERM, usando o encerramento existente e preservando os perfis LocalAuth. Não chama logout nem remove os arquivos de autenticação.

Instalação: copiar `patch.cjs` e `webjs-conexao-segura.js` para uma pasta do servidor e executar `node patch.cjs /root/wolf-whatsapp`. O instalador confere as âncoras, guarda backup e valida a sintaxe; não reinicia o serviço. A mudança de arquivos exige carregamento controlado pelo processo ou sua próxima inicialização.

Validação: `node --test deploy/helio-conexao/conexao-segura.test.cjs` (16 testes). Proteção ativada no processo corrente sem reiniciar o PM2; uma tentativa simulada de reconexão atrasada foi ignorada e o Divino permaneceu conectado. Isso não confirma estabilidade do Hélio: ele ainda precisa ser vinculado e observado após conectar.

Não atribuir todas as quedas a esse ponto sem evidência. A auditoria também encontrou reinicializações do serviço e solicitações de novo QR que removiam o perfil antigo. Os eventos desses procedimentos precisam ser separados de desconexões espontâneas do WhatsApp.

