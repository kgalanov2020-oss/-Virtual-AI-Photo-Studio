import type { MetadataRoute } from "next";
import catalog from "@/lib/studio-catalog.json";
import { seoPages } from "@/lib/seo-pages";

const siteUrl = "https://virtualphotostudio.ru";

const staticRoutes = [
  "",
  "/login",
  "/sessions",
  "/upload",
  "/oferta",
  "/privacy",
  "/personal-data-consent",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
  }));
  const studioPages = catalog.studios.map((studio) => ({
    url: `${siteUrl}/studios/${studio.slug}`,
    lastModified: now,
  }));
  const seoLandingPages = Object.values(seoPages).map((page) => ({
    url: `${siteUrl}/${page.slug}`,
    lastModified: now,
  }));

  return [...staticPages, ...seoLandingPages, ...studioPages];
}
