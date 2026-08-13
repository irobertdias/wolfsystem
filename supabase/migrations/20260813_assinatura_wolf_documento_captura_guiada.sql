-- Wolf Sign: documento opcional e evidencias da captura guiada.
-- Arquivos permanecem no storage privado do backend; o banco guarda somente nomes e hashes.

alter table public.assinatura_wolf_sessoes
  add column if not exists exigir_documento_identidade boolean not null default false;

alter table public.assinatura_wolf_signatarios
  add column if not exists selfie_desafios jsonb not null default '[]'::jsonb,
  add column if not exists documento_frente_arquivo text,
  add column if not exists documento_frente_hash text,
  add column if not exists documento_verso_arquivo text,
  add column if not exists documento_verso_hash text,
  add column if not exists documento_identidade_recebido_em timestamptz;

comment on column public.assinatura_wolf_sessoes.exigir_documento_identidade is
  'Quando true, cada signatario deve enviar frente e verso de documento antes de concluir.';
comment on column public.assinatura_wolf_signatarios.selfie_desafios is
  'Registro temporal das orientacoes da captura guiada; nao representa prova de vida certificada.';
comment on column public.assinatura_wolf_signatarios.documento_frente_hash is
  'SHA-256 da frente armazenada de forma privada no backend.';
comment on column public.assinatura_wolf_signatarios.documento_verso_hash is
  'SHA-256 do verso armazenado de forma privada no backend.';
