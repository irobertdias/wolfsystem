-- Permite anexos privados configuráveis nos campos customizados do CRM.
-- Mantém todos os tipos já aceitos e acrescenta somente `arquivo`.

alter table public.proposta_campos_customizados
  drop constraint if exists proposta_campos_customizados_tipo_check;

alter table public.proposta_campos_customizados
  add constraint proposta_campos_customizados_tipo_check
  check (
    tipo in (
      'texto',
      'textarea',
      'numero',
      'moeda',
      'data',
      'dropdown',
      'checkbox',
      'arquivo'
    )
  );

comment on constraint proposta_campos_customizados_tipo_check
  on public.proposta_campos_customizados is
  'Tipos de campos customizados do CRM, incluindo arquivos privados.';
