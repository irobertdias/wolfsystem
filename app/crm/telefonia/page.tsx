// Arquivo: app/crm/telefonia/page.tsx
// Rota: /crm/telefonia
// O componente ConexoesVoipSection fica em app/components/ConexoesVoipSection.tsx
// Daqui, precisa subir 2 níveis: ../../ (sai de telefonia, sai de crm, fica em app/)
"use client";
import ConexoesVoipSection from "../../components/ConexoesVoipSection";
import { useModulos, ModuloBloqueado } from "../../hooks/useModulos";

export default function TelefoniaPage() {
  const { modulos, carregado } = useModulos();

  // Enquanto carrega os módulos do banco, mostra loading minimalista
  if (!carregado) {
    return (
      <div style={{ padding: 32, color: "#9ca3af", fontFamily: "Arial, sans-serif" }}>
        Carregando...
      </div>
    );
  }

  // 🔒 Se módulo VOIP não liberado → tela de upsell (admin Wolf passa direto pelo hook)
  if (!modulos.voip) return <ModuloBloqueado modulo="voip" />;

  // Liberado → renderiza página normal
  return <ConexoesVoipSection />;
}