"use client";
import { usePathname } from "next/navigation";
import { Softphone } from "./Softphone";

// O softphone é da equipe: não aparece nas páginas públicas que o cliente final abre
// (proposta do Revisional em /revisional/p/... ou rev.wolfgyn.com.br/p/...).
export function SoftphoneVisivel() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/revisional/p/") || pathname.startsWith("/p/") || pathname.startsWith("/orcamento/") || pathname.startsWith("/assinar/")) return null;
  // Site institucional e telas de entrada: visitante não usa o discador da equipe.
  if (pathname === "/" || pathname.startsWith("/login") || ["/privacidade", "/termos", "/excluir-dados"].includes(pathname)) return null;
  return <Softphone />;
}
