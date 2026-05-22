import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Anton, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "./brand.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
});

const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
});

const jetbrains = JetBrains_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Babel Markets",
  description:
    "Polymarket in every tongue. Paste a non-English news article. The agent posts a tradable binary question with your builder code attached.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${anton.variable} ${cormorant.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen antialiased">
        <div className="brand-shell">{children}</div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
