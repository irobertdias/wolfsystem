// ═══════════════════════════════════════════════════════════════════════
// Módulos próprios de cada nicho (tipo de workspace). O admin liga/desliga no
// cadastro do cliente (cadastros.nicho_opcoes, JSONB). Chave ausente = padrão
// do módulo (a maioria vem ligada; os pagos à parte, como a IA, vêm desligados).
// ═══════════════════════════════════════════════════════════════════════
import type { Vertical } from "./vertical-workspace";

export type ModuloNicho = { key: string; label: string; desc: string; padrao: boolean };

export const MODULOS_NICHO: Partial<Record<Vertical, ModuloNicho[]>> = {
  informatica: [
    { key: "os", label: "Assistência técnica (OS)", desc: "Bancada de ordens de serviço, laudo, peças e garantia", padrao: true },
    { key: "orcamentos", label: "Orçamentos com PDF e aceite", desc: "Orçamento com logo e CNPJ, PDF e link para o cliente aceitar", padrao: true },
    { key: "vendas", label: "Vendas e pedidos", desc: "Pedidos, pagamento e entrega", padrao: true },
    { key: "estoque", label: "Estoque", desc: "Saldo por produto e peça, aviso de estoque baixo", padrao: true },
    { key: "ia_cadastro", label: "IA no cadastro de produtos", desc: "Busca dados e fotos do produto para cadastrar", padrao: false },
  ],
  vendas: [
    { key: "caixa", label: "Caixa (PDV)", desc: "Frente de caixa com leitor de código, troco e cupom", padrao: true },
    { key: "orcamentos", label: "Orçamentos com PDF e aceite", desc: "Orçamento com logo e CNPJ, PDF e link para o cliente aceitar", padrao: true },
    { key: "estoque", label: "Estoque", desc: "Saldo por produto, aviso de estoque baixo", padrao: true },
    { key: "ia_cadastro", label: "IA no cadastro de produtos", desc: "Busca dados e fotos do produto para cadastrar", padrao: false },
  ],
  roupas: [
    { key: "entregas", label: "Separação e entregas", desc: "Expedição dos pedidos, entrega e retirada", padrao: true },
    { key: "estoque", label: "Estoque por grade", desc: "Saldo por tamanho e cor", padrao: true },
    { key: "orcamentos", label: "Pedido com link de aceite", desc: "PDF do pedido e link para o cliente confirmar", padrao: true },
    { key: "ia_cadastro", label: "IA no cadastro de peças", desc: "Busca dados e fotos da peça para cadastrar", padrao: false },
  ],
  consignado: [
    { key: "esteira", label: "Esteira de contratos", desc: "Da simulação ao pagamento", padrao: true },
    { key: "simulador", label: "Simulador de margem", desc: "Margem consignável e valor liberado", padrao: true },
    { key: "comissoes", label: "Comissões", desc: "Comissão por banco e produto", padrao: true },
  ],
};

export const modulosDoNicho = (v?: string | null) => MODULOS_NICHO[(v || "telecom") as Vertical] || [];

/** O módulo do nicho está liberado? Sem configuração, vale o padrão do módulo. */
export function nichoLiberado(opcoes: Record<string, boolean> | null | undefined, vertical: string | null | undefined, key: string) {
  const def = modulosDoNicho(vertical).find((m) => m.key === key);
  if (!def) return true;
  const v = opcoes?.[key];
  return v === undefined || v === null ? def.padrao : !!v;
}
