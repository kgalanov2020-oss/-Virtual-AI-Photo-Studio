import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtual AI Photo Studio",
  description: "Виртуальная фотостудия с готовыми интерьерами",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
