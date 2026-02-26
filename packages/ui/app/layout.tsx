import type { Metadata } from "next";
import "./globals.css";
import { AppWithTenant } from "./components/AppWithTenant";

export const metadata: Metadata = {
  title: "Oryens",
  description: "Accounting and consolidation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AppWithTenant>{children}</AppWithTenant>
      </body>
    </html>
  );
}
