import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["ai-foto-dlya-rezyume"];

export const metadata = createSeoMetadata(page);

export default function AiFotoDlyaRezyumePage() {
  return <SeoLandingPage page={page} />;
}
