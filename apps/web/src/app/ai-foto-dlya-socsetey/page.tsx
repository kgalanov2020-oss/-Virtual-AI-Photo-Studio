import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["ai-foto-dlya-socsetey"];

export const metadata = createSeoMetadata(page);

export default function AiFotoDlyaSocseteyPage() {
  return <SeoLandingPage page={page} />;
}
