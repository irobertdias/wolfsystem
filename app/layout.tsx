import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SoftphoneProvider } from "./hooks/useSoftphone";
import { SoftphoneVisivel } from "./components/SoftphoneVisivel";
import PopupCobranca from "./components/PopupCobranca";
import AcessoTeste from "./components/AcessoTeste";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonte do tema A2 (sistema e site).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-wolf",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Wolf System",
  description: "CRM e Chatbot com WhatsApp",
  icons: {
    icon: "/logo1.png",
    apple: "/logo1.png",
  },
  verification: {
    other: {
      "facebook-domain-verification": "xw17cao3411psrbude4yd8qm6sbzse",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 🆕 SoftphoneProvider envolve TUDO — permite que qualquer página/componente
            (CRM, Chatbot, etc) chame useSoftphone() sem precisar de Provider local.
            O <Softphone /> renderiza uma bolha flutuante no canto inferior direito,
            visível em todas as rotas (mas só é funcional pra usuário autenticado).

            🆕 PopupCobranca: sistema de cobrança automática — verifica status do
            workspace e renderiza popup de lembrete/agressivo/bloqueio dependendo
            da fase. Admin master (robert.dias@live.com) é imune. */}
        <AcessoTeste>
          <SoftphoneProvider>
            {children}
            <SoftphoneVisivel />
            <PopupCobranca />
          </SoftphoneProvider>
        </AcessoTeste>
      </body>
    </html>
  );
}
