import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://virtualphotostudio.ru";
const siteDescription =
  "Virtual AI Photo Studio — виртуальная фотостудия с готовыми интерьерами. Выберите локацию, загрузите селфи и получите профессиональную фотосессию в офисе, отеле, яхте, ресторане, городе, на пляже и других пространствах.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Virtual AI Photo Studio — виртуальная фотостудия",
    template: "%s | Virtual AI Photo Studio",
  },
  description: siteDescription,
  keywords: [
    "виртуальная фотостудия",
    "AI фотосессия",
    "AI Photo Studio",
    "фотосессия по селфи",
    "нейросеть фото",
    "профессиональные портреты",
    "фото для соцсетей",
    "деловая фотосессия",
    "фотосессия в интерьере",
    "генерация фото",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Virtual AI Photo Studio",
    description: siteDescription,
    url: siteUrl,
    siteName: "Virtual AI Photo Studio",
    images: [
      {
        url: "/studios/modern-office/master-wide.webp",
        width: 1366,
        height: 768,
        alt: "Virtual AI Photo Studio — фотосессия в выбранном интерьере",
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual AI Photo Studio",
    description: siteDescription,
    images: ["/studios/modern-office/master-wide.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
