import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "../components/AuthProvider";
import { UserSessionSummary } from "../components/UserSessionSummary";

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
          <header className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mx-auto max-w-5xl px-6 py-4">
              <UserSessionSummary />
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
