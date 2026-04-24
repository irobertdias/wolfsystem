// Arquivo: app/crm/telefonia/page.tsx
// Rota: /crm/telefonia
// O componente ConexoesVoipSection fica em app/components/ConexoesVoipSection.tsx
// Daqui, precisa subir 2 níveis: ../../ (sai de telefonia, sai de crm, fica em app/)
"use client";
import ConexoesVoipSection from "../../components/ConexoesVoipSection";

export default function TelefoniaPage() {
  return <ConexoesVoipSection />;
}