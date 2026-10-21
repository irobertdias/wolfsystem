'use strict';
const base=require('./patch.cjs');
function bridge(s){
 if(s.includes('// primeDocumentosSemNomeV2:'))return s;
 s=base.bridge(s);
 const a=s.indexOf('  // primeIdentidadePorFace:'),b=s.indexOf('  const identidade = identidadeDaAnalise(analise);',a);
 if(a<0||b<0)throw Error('Validação documental incompatível');
 s=s.slice(0,a)+`  // primeDocumentosSemNomeV2: classifica a face e salva, sem validar dados pessoais.
  if (/^prime_rg_/.test(String(regra.id || ""))) {
    if (!["frente", "verso"].includes(ladoLido) || ladoLido !== ladoEsperado) throw erroDocumento("LADO_DOCUMENTO_INCORRETO", "Não consegui distinguir a face da identidade nesta imagem. Envie uma foto completa de uma face, por favor.");
    return { identidade: { lado: ladoLido } };
  }
`+s.slice(b);
 s=s.replace('Na frente transcreva o nome do TITULAR, não filiação nem assinatura de autoridade.','Na frente e no verso apenas reconheça a face; não leia nem compare dados pessoais. Na CIN, o lado com QR, filiação e assinatura sem retrato é verso.');
 s=s.replace('{nome:"nome",tipo:"texto",label:"Nome do titular impresso na face com retrato"},','');
 s=s.replace('Face COM retrato do titular; ler nome.','Face COM retrato; não ler nem comparar nome, CPF ou RG.');
 return s;
}
function visao(s){
 if(s.includes('primeVisaoSemNomeV2'))return s;
 s=base.visao(s);
 s=s.replace('Transcreva o NOME do titular em dados.nome. Não use nome da mãe, do pai ou de autoridade. Não invente nome ilegível.','primeVisaoSemNomeV2: não extraia nem compare nome, CPF ou RG. dados pode ser vazio.');
 s=s.replace('Identidade SEM retrato, com impressão digital, dados de registro ou assinatura do diretor:', 'Identidade SEM retrato, incluindo CIN com QR code, filiação, local de emissão, impressão digital, dados de registro ou assinatura do diretor:');
 if(!s.includes('primeVisaoSemNomeV2'))throw Error('Instrução visual incompatível');
 return s;
}
module.exports={bridge,visao};
