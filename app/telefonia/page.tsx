// Arquivo: app/telefonia/page.tsx
// Rota principal do módulo de Telefonia VOIP.
// Fica no mesmo nível de /chatbot, /dashboard, /vendas etc — item independente no menu lateral.

"use client";
import ConexoesVoipSection from "@/components/ConexoesVoipSection";

export default function TelefoniaPage() {
  return <ConexoesVoipSection />;
}