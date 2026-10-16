// Transcrição das três artes comerciais fornecidas pelo cliente em 16/10/2026.
// A lista promocional é independente da cobertura técnica VTAL.
export function normalizarCidade(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[_\s]+/g, ' ').trim();
}

const promocionais: Record<string, string> = {
  RO: 'Cacoal;Jaru;Ouro Preto do Oeste;Pimenta Bueno;Rolim de Moura',
  PA: 'Marabá;Castanhal', TO: 'Gurupi;Paraíso do Tocantins',
  GO: 'Morrinhos;Catalão;Formosa;Senador Canedo;Inhumas;Trindade',
  MT: 'Sinop;Tangará da Serra;Barra do Garças;Juína;Pontes e Lacerda', MS: 'Maracaju',
  CE: 'Juazeiro do Norte;Maracanaú;Iguatu;Sobral',
  MA: 'Imperatriz;São José de Ribamar;Timon;Paço do Lumiar',
  BA: 'Feira de Santana;Vitória da Conquista;Eunápolis;Jequié;Itabuna;Lauro de Freitas;Simões Filho;Ilhéus;Paulo Afonso;Juazeiro;Porto Seguro;Luís Eduardo Magalhães',
  AL: 'Maceió;Marechal Deodoro;Arapiraca', PB: 'Cabedelo;João Pessoa;Campina Grande',
  PE: 'Caruaru;Cabo de Santo Agostinho;Goiana;Petrolina;Paulista;Jaboatão dos Guararapes',
  PI: 'Parnaíba;Floriano;Piripiri', RN: 'Natal;Mossoró', SE: 'Itabaiana',
  SP: 'Campinas;Guarulhos;Mogi das Cruzes;São José dos Campos;Sorocaba;Jundiaí;Votorantim;Hortolândia',
  MG: 'Poços de Caldas;Ipatinga;Itabira;João Monlevade;Caxambu;Lavras;Muriaé;Esmeraldas;Sabará;Santa Rita do Sapucaí;Araguari;Coronel Fabriciano;Governador Valadares;Paracatu;Patrocínio;Timóteo;Montes Claros',
  RJ: 'Resende;Paracambi;Nova Friburgo;Saquarema;Piraí;Campos dos Goytacazes', ES: 'Cachoeiro de Itapemirim',
  PR: 'Apucarana;Arapongas;Francisco Beltrão;Marechal Cândido Rondon;Toledo;Cambé;Guarapuava;Quatro Barras;Campo Largo;Campo Mourão;Campina Grande do Sul;Campo Magro;Guaratuba;Castro;Umuarama;Irati;Jandaia do Sul;Matinhos;Ibiporã;Santo Antônio da Platina;Londrina;Astorga;Sarandi;Colorado;São Pedro do Ivaí;São Sebastião da Amoreira;Cianorte;Cornélio Procópio;Medianeira;Palmas;Pato Branco;União da Vitória;Foz do Iguaçu',
  SC: 'Criciúma;Chapecó;Içara;Ituporanga;Guabiruba;Balneário Camboriú;Rio do Sul;São José;Indaial;Garopaba;Palhoça',
  RS: 'Erechim;Lajeado;Bento Gonçalves;Rio Grande;Ijuí;Uruguaiana;Carazinho;Bagé;Alegrete;Eldorado do Sul;Estância Velha;Campo Bom;Farroupilha;Marau;Flores da Cunha;Montenegro;Garibaldi;Taquara;Camaquã;Rio Pardo;Rosário do Sul;Santiago;Venâncio Aires',
};
const cidadesPromocionais = new Set(Object.entries(promocionais).flatMap(([uf, lista]) => lista.split(';').map(cidade => `${uf}:${normalizarCidade(cidade)}`)));

export function planosDaCidade(uf: string, cidade: string) {
  const promocional = cidadesPromocionais.has(`${uf.toUpperCase()}:${normalizarCidade(cidade)}`);
  const montar = (publico: 'PF' | 'PJ', nome: string, velocidadeMbps: number, mensalidade: number, cartao: number | null, chips: number, gbPorChip: number, mesh = false, globoplay = false) => ({
    id: `${publico.toLowerCase()}-${nome.toLowerCase()}-${promocional ? 'promo' : 'padrao'}`, publico, nome: `Nio ${nome}`, velocidade_mbps: velocidadeMbps,
    mensalidade, mensalidade_cartao: cartao, chips_5g: chips, gb_por_chip: gbPorChip, wifi_mesh: mesh, globoplay_meses: globoplay ? 12 : 0,
  });
  return {
    tabela: promocional ? 'promocional' : 'padrao',
    preco_fixo_ate: promocional ? 'janeiro de 2030, conforme arte fornecida' : null,
    pessoa_fisica: promocional ? [
      montar('PF', 'Essencial', 800, 70, null, 1, 10), montar('PF', 'Super', 1000, 85, null, 1, 20, false, true), montar('PF', 'Ultra', 1000, 100, null, 2, 20, true, true),
    ] : [
      montar('PF', 'Fibra', 600, 110, 95, 0, 0), montar('PF', 'Essencial', 800, 140, 125, 1, 10), montar('PF', 'Super', 1000, 170, 155, 1, 20, false, true), montar('PF', 'Ultra', 1000, 200, 185, 2, 20, true, true),
    ],
    pessoa_juridica: promocional ? [
      montar('PJ', 'Essencial', 700, 70, null, 1, 10), montar('PJ', 'Super', 800, 85, null, 1, 20), montar('PJ', 'Ultra', 1000, 100, null, 2, 20),
    ] : [
      montar('PJ', 'Essencial', 700, 110, 95, 1, 10), montar('PJ', 'Super', 800, 130, 115, 1, 20), montar('PJ', 'Ultra', 1000, 180, 165, 2, 20),
    ],
    observacao: 'Valores transcritos das artes do cliente. Validar vigência, fidelidade, instalação e condições antes de contratar. Benefícios 5G sujeitos à cobertura móvel; não aplicar desconto de cartão à tabela promocional sem confirmação.',
  };
}
