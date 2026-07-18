import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIdeas — Transformă o idee într-un plan executabil",
  description:
    "Spațiu local pentru clarificarea, cercetarea și validarea ideilor de aplicații și website-uri.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
