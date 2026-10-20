module.exports=function destinoBko(s){
 const a='if([v.telefone1,v.telefone2,v.dados_customizados.numero_origem_whatsapp,c.numero].some(x=>numeroBko(x)===n))throw Error("Destinatário BKO coincide com cliente ou canal de envio.");';
 const b='if([c.numero].some(x=>numeroBko(x)===n))throw Error("O próprio canal de envio não pode ser destinatário BKO.");';
 if(s.includes(b))return s;
 if(s.split(a).length!==2)throw Error('Encaixe BKO incompatível');
 return s.replace(a,b);
};
