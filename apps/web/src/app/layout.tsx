import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Photo Studio",
  description: "Virtual AI photo studio MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
