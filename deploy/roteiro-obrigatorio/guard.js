'use strict';
// Revalida o estado persistido: uma flag de confirmação não comprova completude.
function pendencias(campos,valores,validar,comparar){
 return campos.filter(c=>{
  if(c.obrigatoria&&!validar(c.tipo,valores[c.nome]))return true;
  if(c.diferenteDe&&validar(c.tipo,valores[c.nome])&&String(valores[c.diferenteDe]??'').trim())return comparar(c.tipo,valores[c.nome])===comparar(c.tipo,valores[c.diferenteDe]);
  return false;
 });
}
module.exports={pendencias};
