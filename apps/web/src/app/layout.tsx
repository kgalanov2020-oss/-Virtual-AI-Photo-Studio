import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = "https://virtualphotostudio.ru";
const vkPixelId = "3777361";
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
      <body>
        {children}
        <Script id="vk-ads-pixel" strategy="afterInteractive">
          {`
            var _tmr = window._tmr || (window._tmr = []);
            _tmr.push({ id: "${vkPixelId}", type: "pageView", start: (new Date()).getTime() });
            (function (d, w, id) {
              if (d.getElementById(id)) return;
              var ts = d.createElement("script");
              ts.type = "text/javascript";
              ts.async = true;
              ts.id = id;
              ts.src = "https://top-fwz1.mail.ru/js/code.js";
              var f = function () {
                var s = d.getElementsByTagName("script")[0];
                s.parentNode.insertBefore(ts, s);
              };
              if (w.opera == "[object Opera]") {
                d.addEventListener("DOMContentLoaded", f, false);
              } else {
                f();
              }
            })(document, window, "tmr-code");
          `}
        </Script>
        <noscript>
          <div>
            <img
              alt="Top.Mail.Ru"
              src={`https://top-fwz1.mail.ru/counter?id=${vkPixelId};js=na`}
              style={{ left: "-9999px", position: "absolute" }}
            />
          </div>
        </noscript>
      </body>
    </html>
  );
}
