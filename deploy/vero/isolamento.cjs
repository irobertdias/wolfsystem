function isolarCrm(s){
 if(s.includes('// veroGatilhoDoProprioFluxo:'))return s;
 const a='        for (const fluxo of (porWorkspace.get(proposta.workspace_id) || [])) {';
 if(s.split(a).length!==2)throw Error('Worker CRM incompatível');
 return s.replace(a,a+'\n          // veroGatilhoDoProprioFluxo: Nio e Vero não disparam sobre a mesma venda.\n          if (proposta.workspace_id === "grupoprime" && [27,28].includes(Number(fluxo.id)) && Number(proposta.fluxo_id) !== Number(fluxo.id)) continue;');
}
module.exports={isolarCrm};
