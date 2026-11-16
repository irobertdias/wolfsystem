"use client";
import { createContext, useContext } from "react";

// Os sistemas de nicho (Informática, Moda, Comercial, Consignado) ocupam a tela
// inteira, com a própria navegação. O layout do CRM entrega aqui só os dados de
// que eles precisam para montar o topo do jeito deles: atalhos permitidos para
// o usuário (Atendimento, Contratos, Ajustes…), workspace e usuário.
export type Atalho = { path: string; label: string; icon: string };
export type AppNicho = {
  atalhos: Atalho[];
  workspaceNome: string;
  userNome: string;
  userEmail: string;
  fotoUrl: string;
  perfilLabel: string;
  ir: (path: string) => void;
  sair: () => void;
};

const Ctx = createContext<AppNicho>({ atalhos: [], workspaceNome: "", userNome: "", userEmail: "", fotoUrl: "", perfilLabel: "", ir: () => {}, sair: () => {} });
export const ProvedorAppNicho = Ctx.Provider;
export const useAppNicho = () => useContext(Ctx);
