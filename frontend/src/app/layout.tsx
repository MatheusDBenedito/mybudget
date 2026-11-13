import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { PrivacyProvider } from "@/lib/privacy";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyFinance",
  description: "Controle financeiro e carteira de investimentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}>
        {/* Applies the saved eye state before the first paint, so values never flash visible on reload */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{document.documentElement.dataset.privacy=localStorage.getItem('myfinance:privacy')==='1'?'on':'off'}catch(e){}",
          }}
        />
        <PrivacyProvider>
          <AuthProvider>
            <AppHeader />
            <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </main>
            <footer className="bg-header text-header-foreground/70">
              <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs sm:px-6 lg:px-8">
                <span className="text-base font-semibold text-header-foreground">MyFinance</span>
                <span>Cotações: brapi (B3), Yahoo Finance (EUA), CoinGecko (cripto), Banco Central (CDI/Selic), AwesomeAPI (dólar)</span>
              </div>
            </footer>
            <Toaster />
          </AuthProvider>
        </PrivacyProvider>
      </body>
    </html>
  );
}
