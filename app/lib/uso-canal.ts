export const MODULO_SOMENTE_CONFIRMACOES='somente_confirmacoes_bko';
export function somenteConfirmacoes(modulos?: string[]){return Array.isArray(modulos)&&modulos.includes(MODULO_SOMENTE_CONFIRMACOES);}
export function definirSomenteConfirmacoes(modulos:string[]|undefined,ativo:boolean){const atuais=(modulos||[]).filter(m=>m!==MODULO_SOMENTE_CONFIRMACOES);return ativo?[...atuais,MODULO_SOMENTE_CONFIRMACOES]:atuais;}
