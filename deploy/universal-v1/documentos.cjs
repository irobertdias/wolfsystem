'use strict';
const TIPOS = ['rg_frente', 'rg_verso', 'comprovante_endereco'];
function pendente(s) { return TIPOS.find(k => !s.documentos[k]?.length) || 'comprovante_endereco'; }
function incorporar(s, arquivo) {
    if (s.anexos.some(a => a.path === arquivo.path)) return;
    s.anexos.push(arquivo);
    let categorias = (arquivo.categorias || []).filter(k => TIPOS.includes(k));
    // Duas faces separadas podem ser classificadas como a mesma face. Preservar
    // ambas e encaminhar a conferência ao BKO, em vez de pedir o mesmo arquivo.
    if (!categorias.length && (s.etapa==='documentos'||s.confirmado===true)) categorias = [pendente(s)];
    else if (categorias.length === 1 && categorias[0].startsWith('rg_') && s.documentos[categorias[0]].length) {
        const outra = categorias[0] === 'rg_frente' ? 'rg_verso' : 'rg_frente';
        if (!s.documentos[outra].length) {
            categorias = [outra];
            s.pendencias.push('Conferir as duas faces do RG nos originais recebidos.');
        }
    }
    arquivo.categorias = categorias;
    for (const k of categorias) if (!s.documentos[k].some(a => a.path === arquivo.path)) s.documentos[k].push(arquivo);
    if (arquivo.leitura === 'inconclusiva') s.pendencias.push('Leitura inconclusiva: ' + arquivo.nome + '; conferir original.');
}
module.exports = { incorporar, pendente };
