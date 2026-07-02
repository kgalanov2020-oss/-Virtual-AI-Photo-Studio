import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["ai-fotosessiya"];

export const metadata = createSeoMetadata(page);

export default function AiFotosessiyaPage() {
  return <SeoLandingPage page={page} />;
}
