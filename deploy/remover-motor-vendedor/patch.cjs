'use strict';
function fluxos(s){
 if(s.includes('// motorVendedorRemovidoV2:'))return s;
 const inicio=s.indexOf('    case "fluxo_ia": {'),fim=s.indexOf('    case "claude_ai": {',inicio);
 if(inicio>=0&&fim>=0)s=s.slice(0,inicio)+'    // motorVendedorRemovidoV2: implementação antiga removida.\n    case "fluxo_ia": return { parar: true };\n\n'+s.slice(fim);
 else if(s.includes('// motorVendedorRemovidoV1:'))s=s.replace('// motorVendedorRemovidoV1:','// motorVendedorRemovidoV2:');else throw Error('Motor instalado incompatível');
 for(const nome of ['executarFluxoPorIA','gerarContornoObjecaoFluxoIA','workspacePossuiVendedorIA']){const i=s.indexOf('async function '+nome+'(');if(i<0)continue;const resto=s.slice(i+1),proximo=/\n(?:async )?function /m.exec(resto);if(!proximo)throw Error('Limite da implementação não localizado');const j=i+1+proximo.index;s=s.slice(0,i)+s.slice(j);}
 s=s.replace(/^.*ctx\.interpretarIntencaoComercial\s*=\s*executarFluxoPorIA;.*\r?\n/gm,'').replace(/^\s*executarFluxoPorIA,\r?\n/gm,'').replace(/^const CACHE_MODULO_VENDEDOR_IA.*\r?\n/gm,'');
 return s;
}
const arquivos=['roteiro-vendas.js','roteiro-runtime.js','venda-fluida.js','objecoes-comerciais.js','documentos-autonomos.js','nio-oferta-direta.js','vero-oferta-direta.js','fluxo-ia-extensoes-config.js','fluxo-ia-multimidia.js','fluxo-ia-biblioteca.js','fluxo-ia-agente.js','fluxo-ia-normalizadores.js','fluxo-ia-validacao-documentos.js','fluxo-ia-retomada.js','fluxo-ia-followups.js','fluxo-ia-consulta-guard.js','fluxo-ia-fila.js','fluxo-ia-captura-deterministica.js'];
function index(s){for(const n of arquivos){const texto=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');s=s.replace(new RegExp('require\\(["\\\']\\./src/services/'+texto+'["\\\']\\)(?:\\(ctx\\))?;','g'),'');}return s.replace(/ctx\.roteiroComercialV3\s*=\s*3\s*;/g,'').replace(/^.*require\(["']\.\/src\/jobs\/fluxo-ia-followups-worker\.js["']\)\(ctx\);.*\r?\n/gm,'');}
function worker(){return '"use strict";\nmodule.exports = function(){ return null; };\n';}
function bridge(s){s=s.replace(/^.*require\(["']\.\/fluxo-ia-captura-deterministica\.js["']\)\(ctx\);.*\r?\n/gm,'');const inicio=s.indexOf('  async function executarFluxoComMultimidia('),fim=s.indexOf('  return ctx;',inicio);if(inicio<0)return s;if(fim<0)throw Error('Ponte incompatível');return s.slice(0,inicio)+s.slice(fim);}
module.exports={fluxos,index,worker,bridge,arquivos};
