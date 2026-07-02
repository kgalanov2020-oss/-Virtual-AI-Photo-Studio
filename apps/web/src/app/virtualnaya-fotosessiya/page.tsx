import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["virtualnaya-fotosessiya"];

export const metadata = createSeoMetadata(page);

export default function VirtualnayaFotosessiyaPage() {
  return <SeoLandingPage page={page} />;
}
