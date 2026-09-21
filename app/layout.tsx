import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { enabledProviders } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "MyStore",
  description: "Buy cool products",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col bg-white">
        <Navbar authEnabled={enabledProviders().length > 0} />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
