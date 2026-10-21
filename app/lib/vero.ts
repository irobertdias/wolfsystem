export type RedeVero = 'neutra' | 'propria';
export type ClasseVero = 'neutra' | 'especial' | 'prata';
export const NOME_FLUXO_VERO = 'Grupo Prime · Vero · Vendas e BKO';
export const CIDADES_VERO = [
  { cidade: 'Belo Horizonte', uf: 'MG', rede: 'neutra', classe: 'neutra' },
  { cidade: 'Nova Lima', uf: 'MG', rede: 'neutra', classe: 'neutra' },
  { cidade: 'Itabira', uf: 'MG', rede: 'neutra', classe: 'neutra' },
  { cidade: 'Goiânia', uf: 'GO', rede: 'neutra', classe: 'neutra' },
  { cidade: 'Ipatinga', uf: 'MG', rede: 'propria', classe: 'especial' },
  { cidade: 'Sabará', uf: 'MG', rede: 'propria', classe: 'especial' },
  { cidade: 'Timóteo', uf: 'MG', rede: 'propria', classe: 'especial' },
  { cidade: 'João Monlevade', uf: 'MG', rede: 'propria', classe: 'prata' },
  { cidade: 'Vespasiano', uf: 'MG', rede: 'propria', classe: 'prata' },
] as const;
export const normalizarCidadeVero = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
export function planosVero(classe: ClasseVero) {
  const itens = classe === 'neutra' ? [[550,114.99,0],[700,124.99,0],[850,129.99,null]]
    : [...(classe === 'prata' ? [[420,69.99,0]] : []),[550,109.99,0],[700,118.99,0],[850,129.99,30]];
  return itens.map(([velocidade,preco,gb]) => ({ id: `vero-${classe}-${velocidade}`, nome: `Vero ${velocidade} Mega${gb !== 0 ? ' + Móvel' : ''}`, velocidade_mbps: velocidade!, mensalidade: preco!, mensalidade_cartao: null, movel_incluso: gb !== 0, gb_movel: gb, operadora: 'Vero' }));
}
export type EnderecoCepVero = { cep?: string; localidade?: string; uf?: string; ibge?: string; erro?: boolean | string };
export async function consultarVero(entrada: unknown, rede?: RedeVero, resolver: (cep: string) => Promise<EnderecoCepVero> = resolverCepVero) {
  if (typeof entrada !== 'string' || !/^\d{5}-?\d{3}$/.test(entrada.trim())) throw Object.assign(Error('Informe um CEP de oito dígitos.'), {statusCode:400});
  const cep=entrada.trim().replace('-','');
  if (/^(00000000|99999999)$/.test(cep)) throw Object.assign(Error('CEP inválido.'),{statusCode:400});
  let endereco: EnderecoCepVero;
  try { endereco=await resolver(cep); } catch { throw Object.assign(Error('A consulta de CEP está indisponível. Tente novamente; não confirme ausência de cobertura.'),{statusCode:503}); }
  if (endereco.erro === true || endereco.erro === 'true') return {success:true,operadora:'Vero',cep,status:'cep_nao_localizado',cidade:null,uf:null,rede:null,classificacao:null,planos:[],confirmacao_tecnica_necessaria:true};
  if (!endereco.localidade || !/^[A-Z]{2}$/.test(endereco.uf||'') || String(endereco.cep||'').replace(/\D/g,'')!==cep) throw Object.assign(Error('O serviço de CEP não confirmou o município deste CEP.'),{statusCode:503});
  const cidade=CIDADES_VERO.find(c=>c.uf===endereco.uf&&normalizarCidadeVero(c.cidade)===normalizarCidadeVero(endereco.localidade!));
  const elegivel=!!cidade&&(!rede||cidade.rede===rede);
  return {success:true,operadora:'Vero',cep,status:elegivel?'pre_viavel_por_cidade':'fora_das_cidades',cidade:endereco.localidade,uf:endereco.uf,rede:elegivel?cidade.rede:null,classificacao:elegivel?cidade.classe:null,
    planos:elegivel?planosVero(cidade.classe):[],confirmacao_tecnica_necessaria:true,origem:'Município do CEP via ViaCEP; cidades e ofertas fornecidas pelo cliente. Não é consulta de portas ou cobertura física da Vero.',
    mensagem:elegivel?'Cidade contemplada nesta campanha. Apresente as ofertas e confirme a viabilidade técnica do imóvel com o endereço completo.':'Não temos disponibilidade dessas ofertas para esse CEP nesta campanha. Não ofereça esses planos.'};
}
export async function resolverCepVero(cep:string):Promise<EnderecoCepVero> {
  const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:AbortSignal.timeout(7000),next:{revalidate:86400}});
  if(!r.ok)throw Error('Consulta postal indisponível');return r.json();
}
