import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PromptForge",
  description: "Forja prompts a la medida de Claude, GPT y Gemini según modelo y nivel de esfuerzo, con búsqueda web en vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      lang="es"
    >
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
