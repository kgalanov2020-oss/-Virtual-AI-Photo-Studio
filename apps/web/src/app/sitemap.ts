import type { MetadataRoute } from "next";
import catalog from "@/lib/studio-catalog.json";

const siteUrl = "https://virtual-ai-photo-studio.onrender.com";

const staticRoutes = [
  "",
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

  return [...staticPages, ...studioPages];
}
