begin;

alter table public.assinatura_wolf_sessoes
  alter column canal_id drop not null,
  alter column numero drop not null;

alter table public.assinatura_wolf_signatarios
  alter column numero drop not null,
  add column if not exists papel_label text,
  add column if not exists otp_meio text not null default 'whatsapp';

alter table public.assinatura_wolf_signatarios
  drop constraint if exists assinatura_wolf_signatarios_papel_check,
  drop constraint if exists assinatura_wolf_signatarios_ordem_check,
  drop constraint if exists assinatura_wolf_signatarios_sessao_id_papel_key,
  drop constraint if exists assinatura_wolf_signatarios_sessao_id_ordem_key,
  drop constraint if exists assinatura_wolf_signatarios_otp_meio_check;

alter table public.assinatura_wolf_signatarios
  add constraint assinatura_wolf_signatarios_papel_check
    check (papel in ('empresa','cliente','testemunha','interveniente','outro')),
  add constraint assinatura_wolf_signatarios_ordem_check
    check (ordem between 1 and 20),
  add constraint assinatura_wolf_signatarios_sessao_id_ordem_key
    unique (sessao_id, ordem),
  add constraint assinatura_wolf_signatarios_otp_meio_check
    check (otp_meio in ('whatsapp','email'));

create index if not exists assinatura_wolf_signatarios_papel_idx
  on public.assinatura_wolf_signatarios(workspace_id, papel, status);

comment on table public.assinatura_wolf_signatarios is
  'Participantes sequenciais dos envelopes Wolf Sign: representantes, cliente, testemunhas e intervenientes.';
comment on column public.assinatura_wolf_signatarios.otp_meio is
  'Canal escolhido pelo signatário para receber o código OTP: whatsapp ou email.';

commit;
