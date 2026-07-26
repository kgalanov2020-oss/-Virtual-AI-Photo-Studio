import Link from "next/link";
import Image from "next/image";
import { AuthNavAction } from "@/app/auth-nav-action";
import { getStudioSession } from "@/lib/studios";

type StudioPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: StudioPageProps) {
  const { slug } = await params;
  const result = await getStudioSession(slug);

  if (result.status === "missing-env") {
    return <StudioError message="Нужны переменные окружения Supabase." />;
  }

  if (result.status === "error") {
    return <StudioError message={result.message} />;
  }

  const { studio, shots } = result;
  const galleryUrls = studio.gallery_urls?.length
    ? studio.gallery_urls
    : Array(9).fill(studio.preview_url).filter(Boolean) as string[];

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
          <Link href={`/upload?studio=${studio.slug}`}>Загрузить селфи</Link>
          <AuthNavAction />
        </nav>
      </header>

      <section className="studio-detail-hero">
        <div>
          <p className="eyebrow">Интерьер</p>
          <h1>{studio.name}</h1>
          <div className="actions studio-actions">
            <Link className="button button-primary" href={`/upload?studio=${studio.slug}`}>
              Выбрать этот интерьер
            </Link>
            <Link className="button button-secondary" href="/">
              Все интерьеры
            </Link>
          </div>
        </div>

        {studio.preview_url ? (
          <StudioImage
            alt={studio.name}
            className="studio-detail-cover"
            priority
            sizes="(max-width: 1100px) 100vw, 55vw"
            src={studio.preview_url}
          />
        ) : null}
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Ракурсы интерьера</h2>
          </div>
        </div>

        <div className="interior-gallery">
          {galleryUrls.map((url, index) => (
            <StudioImage
              alt={`${studio.name} ракурс ${index + 1}`}
              key={`${url}-${index}`}
              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              src={url}
            />
          ))}
          <div className="interior-gallery-cta">
            <div className="actions studio-actions actions-bottom">
              <Link className="button button-primary" href={`/upload?studio=${studio.slug}`}>
                Выбрать этот интерьер
              </Link>
              <Link className="button button-secondary" href="/">
                Все интерьеры
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StudioImage({
  alt,
  className,
  priority = false,
  sizes,
  src,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  sizes: string;
  src: string;
}) {
  if (!src.startsWith("/")) {
    return (
      <img
        alt={alt}
        className={className}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        src={src}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      height={900}
      priority={priority}
      sizes={sizes}
      src={src}
      width={1200}
    />
  );
}

function StudioError({ message }: { message: string }) {
  return (
    <main className="page">
      <section className="error-panel">
        <p className="eyebrow">Интерьер не найден</p>
        <h1>Не удалось открыть студию</h1>
        <p className="lead">{message}</p>
        <Link className="button button-secondary" href="/">
          Вернуться к каталогу
        </Link>
      </section>
    </main>
  );
}
