// Conversões do Google Ads disparadas pelo site.
// A tag base (AW-18571255002) é carregada em app/layout.tsx.

declare global {
  interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[] }
}

const LEAD = "AW-18571255002/hqbSCNDjgrcdENq5u5dF";

/**
 * "Enviar formulário de lead": dispara só depois da ação concluída
 * (orçamento gerado, cadastro aceito ou clique para falar com especialista).
 * `depois` roda quando o Google confirma o envio (ou em até 1,2 s), para não
 * perder a conversão quando a página muda logo em seguida.
 */
export function conversaoLead(origem: "orcamento" | "cadastro" | "whatsapp", depois?: () => void) {
  let feito = false;
  const seguir = () => { if (!feito) { feito = true; depois?.(); } };
  try {
    if (typeof window === "undefined") return seguir();
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "lead_wolf", origem }); // também disponível no GTM
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", { send_to: LEAD, value: 1.0, currency: "BRL", event_callback: seguir });
      setTimeout(seguir, 1200);
    } else seguir();
  } catch { seguir(); }
}
