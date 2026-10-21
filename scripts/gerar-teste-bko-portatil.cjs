const ts=require('typescript');
function gerarTestePortatil(source){
 const ast=ts.createSourceFile('bko-vero.test.cjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const nomes=new Set(['API exige permissão; salvar não reativa fluxo nem revela chave da IA','retentativa administrativa libera somente partes pendentes e mantém as já enviadas']);
 const remover=[];
 for(const no of ast.statements){
  const api=ts.isFunctionDeclaration(no)&&no.name?.text==='apiConfig';
  const teste=ts.isExpressionStatement(no)&&ts.isCallExpression(no.expression)&&no.expression.expression.getText(ast)==='test'&&nomes.has(no.expression.arguments[0]?.text);
  if(api||teste)remover.push([no.getFullStart(),no.end]);
 }
 if(remover.length!==3)throw Error('Estrutura dos testes mudou; pacote portátil não gerado.');
 let resultado=source;for(const [a,b]of remover.reverse())resultado=resultado.slice(0,a)+resultado.slice(b);
 if(/require\(['"]typescript|app\/api\//.test(resultado))throw Error('Dependência de frontend restante no teste portátil');
 return '// Testes de backend portáteis. Os testes Next/API permanecem na suíte do repositório.\n'+resultado;
}
module.exports={gerarTestePortatil};
