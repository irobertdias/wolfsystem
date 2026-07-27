"use client";

type Props = {
  dados: Record<string, any>;
  onChange: (patch: Record<string, unknown>) => void;
};

type Extensao = {
  chave: string;
  titulo: string;
  descricao: string;
  legado?: string;
};

const EXTENSOES: Extensao[] = [
  { chave: "ext_normalizadores_ativa", titulo: "Proteções de interpretação", descricao: "Normaliza dados sem alterar a ordem definida no prompt." },
  { chave: "ext_crm_ativa", titulo: "CRM e vendas", descricao: "Envia e atualiza vendas mantendo o workspace isolado." },
  { chave: "ext_retomada_ativa", titulo: "Retomar atendimento", descricao: "Oferece continuar o atendimento anterior ou iniciar um novo." },
  { chave: "ext_followups_ativa", titulo: "Agendamentos e lembretes", descricao: "Agenda retornos em segundos, minutos e horas e executa os lembretes configurados.", legado: "followups_extensao_ativa" },
  { chave: "ext_consulta_negativa_ativa", titulo: "Consulta negativa", descricao: "Aplica as ações configuradas quando uma consulta GET retorna negativa." },
  { chave: "ext_fila_ativa", titulo: "Fila por cliente", descricao: "Serializa mensagens do mesmo cliente para impedir respostas duplicadas." },
  { chave: "ext_multimidia_ativa", titulo: "Fotos, áudios e arquivos", descricao: "Interpreta anexos habilitados e devolve o conteúdo ao fluxo da IA.", legado: "midia_ia_extensao_ativa" },
];

function ativo(valor: unknown): boolean {
  if (valor === true || valor === 1) return true;
  return ["true", "1", "on", "sim", "yes"].includes(String(valor ?? "").trim().toLowerCase());
}

function Toggle({ ligado, desabilitado, onClick }: { ligado: boolean; desabilitado?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ligado}
      disabled={desabilitado}
      onClick={onClick}
      style={{
        width: 46,
        height: 25,
        border: 0,
        borderRadius: 999,
        padding: 3,
        background: ligado ? "#16a34a" : "#cbd5e1",
        cursor: desabilitado ? "not-allowed" : "pointer",
        opacity: desabilitado ? 0.55 : 1,
        transition: "background .15s ease",
        flexShrink: 0,
      }}
    >
      <span style={{ display: "block", width: 19, height: 19, borderRadius: "50%", background: "#fff", transform: ligado ? "translateX(21px)" : "translateX(0)", transition: "transform .15s ease", boxShadow: "0 1px 3px #0003" }} />
    </button>
  );
}

export default function ExtensoesFluxoIA({ dados, onChange }: Props) {
  const mestre = ativo(dados.extensoes_ia_ativas);

  const alterarExtensao = (item: Extensao) => {
    const valor = !ativo(dados[item.chave]);
    const patch: Record<string, unknown> = { [item.chave]: valor };
    if (item.legado) patch[item.legado] = valor;
    onChange(patch);
  };

  return (
    <section style={{ margin: "12px 0", border: "1px solid #c4b5fd", borderRadius: 12, overflow: "hidden", background: "#faf9ff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, background: mestre ? "#ede9fe" : "#f8fafc" }}>
        <div>
          <div style={{ color: "#5b21b6", fontSize: 12, fontWeight: 900 }}>Extensões isoladas do Vendedor IA</div>
          <div style={{ color: "#64748b", fontSize: 10, lineHeight: 1.4, marginTop: 3 }}>O motor principal permanece intacto. Ative somente os recursos que este fluxo precisa.</div>
        </div>
        <Toggle ligado={mestre} onClick={() => onChange({ extensoes_ia_ativas: !mestre })} />
      </div>

      <div style={{ display: "grid", gap: 8, padding: 10 }}>
        {EXTENSOES.map((item) => {
          const ligado = ativo(dados[item.chave]);
          return (
            <div key={item.chave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 10px", border: "1px solid #e2e8f0", borderRadius: 9, background: "#fff" }}>
              <div>
                <div style={{ color: "#1e293b", fontSize: 10, fontWeight: 800 }}>{item.titulo}</div>
                <div style={{ color: "#64748b", fontSize: 9, lineHeight: 1.35, marginTop: 2 }}>{item.descricao}</div>
              </div>
              <Toggle ligado={ligado} desabilitado={!mestre} onClick={() => alterarExtensao(item)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}