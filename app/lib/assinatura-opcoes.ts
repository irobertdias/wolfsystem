export type OpcoesAssinatura = {
  exigir_otp: boolean;
  facial: "nenhuma" | "foto" | "guiada";
  exigir_documento_identidade: boolean;
};

export function opcoesAssinatura(valor?: Partial<OpcoesAssinatura>, documentoPadrao = false): OpcoesAssinatura {
  return {
    exigir_otp: valor?.exigir_otp ?? true,
    facial: valor?.facial ?? "foto",
    exigir_documento_identidade: valor?.exigir_documento_identidade ?? documentoPadrao,
  };
}
