"use client";
import EditorSolar from "./EditorSolar";
import { SxTitulo } from "./_sx";

// Simulação rápida: calcula o sistema e, se o cliente gostar, vira proposta.
export default function Simulador({ dados, ir, alvo }: any) {
  return (
    <div>
      <SxTitulo titulo="Simulador de sistema" sub="Conta de luz → painéis, inversor, geração, economia, retorno e parcelas, na hora" />
      <EditorSolar key={String(alvo?.t || 0)} dados={dados} modo="simulador" onSalvo={(id) => ir("propostas", { propostaId: id })} />
    </div>
  );
}
