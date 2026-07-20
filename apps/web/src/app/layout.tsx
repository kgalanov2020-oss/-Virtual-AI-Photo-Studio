import type { Metadata } from "next";
import { MarketingAttributionTracker } from "@/app/marketing-attribution-tracker";
import {
  buildYandexMetrikaInitScript,
  normalizeYandexMetrikaId,
} from "@/lib/yandex-metrika-core.mjs";
import "./globals.css";

const siteUrl = "https://virtualphotostudio.ru";
const vkPixelId = "3777361";
const yandexMetrikaId = normalizeYandexMetrikaId(
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID,
);
const yandexMetrikaScript = buildYandexMetrikaInitScript(yandexMetrikaId);
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
var _tmr = window._tmr || (window._tmr = []);
_tmr.push({id: "${vkPixelId}", type: "pageView", start: (new Date()).getTime()});
(function (d, w, id) {
  if (d.getElementById(id)) return;
  var ts = d.createElement("script"); ts.type = "text/javascript"; ts.async = true; ts.id = id;
  ts.src = "https://top-fwz1.mail.ru/js/code.js";
  var f = function () {var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ts, s);};
  if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); }
})(document, window, "tmr-code");
`,
          }}
          type="text/javascript"
        />
        {yandexMetrikaId && yandexMetrikaScript ? (
          <script
            dangerouslySetInnerHTML={{ __html: yandexMetrikaScript }}
            id="yandex-metrika"
            type="text/javascript"
          />
        ) : null}
      </head>
      <body>
        <MarketingAttributionTracker />
        {children}
        <noscript>
          <div>
            <img
              alt="Top.Mail.Ru"
              src={`https://top-fwz1.mail.ru/counter?id=${vkPixelId};js=na`}
              style={{ left: "-9999px", position: "absolute" }}
            />
          </div>
        </noscript>
        {yandexMetrikaId ? (
          <noscript>
            <div>
              <img
                alt="Яндекс Метрика"
                src={`https://mc.yandex.ru/watch/${yandexMetrikaId}`}
                style={{ left: "-9999px", position: "absolute" }}
              />
            </div>
          </noscript>
        ) : null}
      </body>
    </html>
  );
}
