// Arquivo: app/crm/telefonia/page.tsx
// Rota: /crm/telefonia
// O componente ConexoesVoipSection fica em app/components/ConexoesVoipSection.tsx
// Daqui, precisa subir 2 níveis: ../../ (sai de telefonia, sai de crm, fica em app/)
"use client";
import ConexoesVoipSection from "../../components/ConexoesVoipSection";
import { useModulos, ModuloBloqueado } from "../../hooks/useModulos";
import { usePermissao } from "../../hooks/usePermissao";

export default function TelefoniaPage() {
  const { modulos, carregado } = useModulos();
  // 🆕 Permissão: gerenciar conexões VOIP (sub-rota de configurações)
  const { isDono, isSuperAdmin, permissoes } = usePermissao();

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

  // 🔒 PERMISSÃO voip_conexoes — gerenciar conexões VOIP é restrito
  // Atendente comum NÃO precisa configurar conexões/integrações Twilio. Quem usa o VOIP pra
  // ligar tem permissão voip_usar (separada). Essa aqui é pra ADMINISTRAR a conta Twilio.
  if (!isDono && !isSuperAdmin && !permissoes.voip_conexoes) {
    return (
      <div style={{ minHeight: "100vh", padding: 32, fontFamily: "Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#dc262611", border: "1px solid #dc262633", borderRadius: 12, padding: 40, textAlign: "center", maxWidth: 480 }}>
          <p style={{ fontSize: 56, margin: "0 0 16px" }}>🔒</p>
          <h1 style={{ color: "#dc2626", fontSize: 18, fontWeight: "bold", margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Você não tem permissão para gerenciar conexões VOIP. Entre em contato com o administrador do workspace.</p>
        </div>
      </div>
    );
  }

  // Liberado → renderiza página normal
  return <ConexoesVoipSection />;
}