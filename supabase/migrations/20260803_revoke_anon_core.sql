-- Etapa segura 1: nenhuma tabela operacional Wolf pode ser consultada
-- com a chave anonima sem uma sessao autenticada.
begin;

revoke all privileges on table public.workspaces from anon;
revoke all privileges on table public.usuarios_workspace from anon;
revoke all privileges on table public.atendimentos from anon;
revoke all privileges on table public.mensagens from anon;
revoke all privileges on table public.conexoes from anon;
revoke all privileges on table public.proposta from anon;
revoke all privileges on table public.equipes from anon;
revoke all privileges on table public.filas from anon;
revoke all privileges on table public.fluxos from anon;
revoke all privileges on table public.fluxo_sessoes from anon;
revoke all privileges on table public.respostas_rapidas from anon;
revoke all privileges on table public.grupos_permissao from anon;
revoke all privileges on table public.cadastros from anon;
revoke all privileges on table public.contato_logs from anon;
revoke all privileges on table public.disparos from anon;
revoke all privileges on table public.disparo_contatos from anon;
revoke all privileges on table public.templates_waba from anon;
revoke all privileges on table public.etiquetas from anon;
revoke all privileges on table public.atendimento_etiquetas from anon;
revoke all privileges on table public.proposta_campos_customizados from anon;
revoke all privileges on table public.proposta_campos_padrao_config from anon;
revoke all privileges on table public.proposta_logs from anon;
revoke all privileges on table public.pagamentos from anon;

commit;

