import { cpfValido, dataNascimentoISO } from './recuperacao-cpf-grupoprime';

export function prepararPedidoFluido(vars: Record<string, any>, consulta: any, operadora: 'Nio'|'Vero', pendenciasDocumentos: string[]=[]) {
  vars={...vars};
  const informados={...vars};
  const labels:Record<string,string>={nome:'Nome do titular',cpf:'CPF',data_nascimento:'Data de nascimento',nome_mae:'Nome da mãe',endereco_completo:'Endereço de instalação',vencimento:'Vencimento',forma_pagamento:'Forma de pagamento',email:'E-mail',telefone1:'WhatsApp de contato',telefone2:'Telefone para ligação',documento_rg_frente:'Identidade — frente',documento_rg_verso:'Identidade — verso',documento_comprovante_endereco:'Comprovante de endereço'};
  const pendencias=[...pendenciasDocumentos];
  try{const p=typeof vars.pendencias_coleta_bko==='string'?JSON.parse(vars.pendencias_coleta_bko):vars.pendencias_coleta_bko;for(const[k,v]of Object.entries(p||{})){const raw=(v as any)?.informado;pendencias.push(`${labels[k]||k}: ${String((v as any)?.motivo||'Conferir informação')}${raw?' · informado: '+String(raw):''}`);if(raw&&!k.startsWith('documento_')){informados[k]=raw;if(!vars[k]&&!/n[aã]o (?:sei|tenho|consigo)|sem (?:email|telefone|documento|comprovante)/i.test(String(raw)))vars[k]=raw;}}}catch{}
  const roteiro=vars.roteiro_vendas_v3==='SIM';
  if(vars.periodo_instalacao)pendencias.push('Preferência de instalação: '+String(vars.periodo_instalacao)+' (sujeita à confirmação da agenda).');
  const campos=roteiro?['nome','cpf','data_nascimento','endereco_completo','vencimento','forma_pagamento','email','telefone1','periodo_instalacao']:['nome','cpf','data_nascimento','nome_mae','endereco_completo','vencimento','forma_pagamento','email','telefone1','telefone2'];
  for(const k of campos)if(!String(vars[k]??'').trim())pendencias.push(`Não informado: ${labels[k]||k}.`);
  if(vars.cpf&&!cpfValido(String(vars.cpf)))pendencias.push('CPF informado requer conferência.');
  const nascimento=dataNascimentoISO(String(vars.data_nascimento||''));
  if(vars.data_nascimento&&!nascimento)pendencias.push('Data de nascimento informada requer conferência.');
  if(vars.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(vars.email)))pendencias.push('E-mail informado requer conferência.');
  const publico=String(vars.tipo_pessoa||'').toUpperCase();
  const planos=operadora==='Vero'?(consulta?.planos||[]):[...(consulta?.planos?.pessoa_fisica||[]),...(consulta?.planos?.pessoa_juridica||[])];
  const plano=planos.find((p:any)=>p.id===vars.plano_interesse);
  if(!plano)pendencias.push('Plano/preço requer conferência; nenhum preço foi inventado.');
  if(!['PF','PJ'].includes(publico))pendencias.push('Confirmar contratação em CPF ou CNPJ.');
  const forma=String(vars.forma_pagamento||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const formaTexto:Record<string,string>={CARTAO:'Cartão de Crédito',BOLETO:'Boleto Bancário',PIX:'PIX',DEBITO_CONTA:'Débito em Conta','DEBITO EM CONTA':'Débito em Conta'};
  if(forma&&!formaTexto[forma])pendencias.push('Forma de pagamento requer conferência.');
  const vencimento=String(vars.vencimento||'');if(vencimento&&!/^(?:[1-9]|[12]\d|3[01])$/.test(vencimento))pendencias.push('Dia de vencimento requer conferência.');
  const telefone=(v:any)=>{const t=String(v||'').replace(/\D/g,'');const local=t.startsWith('55')&&[12,13].includes(t.length)?t.slice(2):t;return /^[1-9]\d[2-9]\d{7,8}$/.test(local)?'55'+local:'';};
  for(const k of ['telefone1','telefone2'])if(vars[k]&&!telefone(vars[k]))pendencias.push(`Requer conferência: ${labels[k]}.`);
  const preco=plano?(forma==='CARTAO'&&Number.isFinite(plano.mensalidade_cartao)?plano.mensalidade_cartao:plano.mensalidade):'';
  const cadastro={nome:String(vars.nome||''),cpf:String(vars.cpf||'').replace(/\D/g,''),data_nascimento:nascimento||'',nome_mae:String(vars.nome_mae||''),rg:String(vars.rg||''),email:String(vars.email||''),telefone1:telefone(vars.telefone1)||String(vars.telefone1||''),telefone2:telefone(vars.telefone2)||String(vars.telefone2||''),vencimento,forma_pagamento:formaTexto[forma]||String(vars.forma_pagamento||''),cep:String(vars.cep||''),cidade:consulta?.cidade||String(vars.cidade||''),estado:consulta?.uf||String(vars.estado||vars.uf||''),endereco:String(vars.endereco_completo||vars.endereco_proposto||''),plano:plano?.nome||String(vars.plano_interesse||''),valor_plano:preco,operadora,venda_fluida_v1:'SIM',bko_pendente:'SIM',pendencias_bko:JSON.stringify([...new Set(pendencias)]),cadastro_informado_json:JSON.stringify(Object.fromEntries(campos.map(k=>[k,vars[k]??'']))) };
  Object.assign(cadastro,{roteiro_vendas_v3:roteiro?'SIM':'',preferencia_instalacao:String(vars.periodo_instalacao||''),periodo_instalacao:['Manhã','Tarde'].includes(vars.periodo_instalacao)?vars.periodo_instalacao:''});
  cadastro.cadastro_informado_json=JSON.stringify(Object.fromEntries(campos.map(k=>[k,informados[k]??''])));
  return{cadastro,pendencias:[...new Set(pendencias)]};
}
