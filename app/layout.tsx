import type { Metadata } from "next";
import Script from "next/script";
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

// Google Tag Manager (tráfego pago no Google). Snippet oficial do GTM + gtag().
const GTM_ID = "GTM-56S4R962";
// Tag do Google Ads (conversão de lead disparada em app/lib/conversoes.ts).
const GOOGLE_ADS_ID = "AW-18571255002";

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
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <Script id="google-ads-gtag" src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} strategy="afterInteractive" />
        <Script id="google-ads-config" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){dataLayer.push(arguments);};
gtag('config', '${GOOGLE_ADS_ID}');`}
        </Script>
        <noscript>
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
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
