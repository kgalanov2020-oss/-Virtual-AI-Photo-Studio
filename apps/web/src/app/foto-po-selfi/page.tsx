import { SeoLandingPage } from "@/app/seo-landing-page";
import { createSeoMetadata, seoPages } from "@/lib/seo-pages";

const page = seoPages["foto-po-selfi"];

export const metadata = createSeoMetadata(page);

export default function FotoPoSelfiPage() {
  return <SeoLandingPage page={page} />;
}
