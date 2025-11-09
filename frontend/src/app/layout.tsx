import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppFooter } from "../components/AppFooter";
import { AppHeader } from "../components/AppHeader";
import { AuthProvider } from "../components/AuthProvider";

export const metadata: Metadata = {
  title: "Peer Mapper",
  description: "QR-powered trust overlaps on Moonbeam",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950/95 via-slate-900/80 to-blue-950/80">
            <AppHeader />
            <main className="flex-1 px-4 py-10 sm:px-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
            <AppFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
