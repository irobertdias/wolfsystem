"use client";
import { Page, PageHeader } from "../../financeiro/_sections/_ui";
import EditorSolar from "./EditorSolar";

// Simulação rápida: calcula o sistema e, se o cliente gostar, vira proposta.
export default function Simulador({ dados, ir, alvo }: any) {
  return (
    <Page>
      <PageHeader titulo="Simulador de sistema solar" subtitulo="Conta de luz → painéis, inversor, geração, economia e retorno" />
      <EditorSolar key={String(alvo?.t || 0)} dados={dados} modo="simulador" onSalvo={(id) => ir("propostas", { propostaId: id })} />
    </Page>
  );
}
