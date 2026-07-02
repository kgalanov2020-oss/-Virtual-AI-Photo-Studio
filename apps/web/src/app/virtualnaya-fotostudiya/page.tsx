import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["virtualnaya-fotostudiya"];

export const metadata = createSeoMetadata(page);

export default function VirtualnayaFotostudiyaPage() {
  return <SeoLandingPage page={page} />;
}
