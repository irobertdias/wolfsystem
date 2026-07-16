-- Configuracao do cadastro de vendas pelo ChatGPT, isolada por conexao/workspace.
alter table public.conexoes
  add column if not exists ia_crm_ativo boolean not null default false,
  add column if not exists ia_crm_mapeamento jsonb not null default '{}'::jsonb,
  add column if not exists ia_crm_campos_obrigatorios jsonb not null default '[]'::jsonb,
  add column if not exists ia_agrupamento_ms integer not null default 3500;

comment on column public.conexoes.ia_crm_ativo is
  'Ativa ferramentas do ChatGPT para salvar variaveis e criar proposta no CRM.';
comment on column public.conexoes.ia_crm_mapeamento is
  'Mapa campo_da_proposta -> variavel_coletada_pela_IA.';
comment on column public.conexoes.ia_crm_campos_obrigatorios is
  'Campos do CRM que precisam estar validos antes da confirmacao da venda.';
comment on column public.conexoes.ia_agrupamento_ms is
  'Janela para juntar mensagens consecutivas do cliente antes de chamar a IA.';

alter table public.conexoes
  drop constraint if exists conexoes_ia_agrupamento_ms_check;
alter table public.conexoes
  add constraint conexoes_ia_agrupamento_ms_check
  check (ia_agrupamento_ms between 0 and 10000);
