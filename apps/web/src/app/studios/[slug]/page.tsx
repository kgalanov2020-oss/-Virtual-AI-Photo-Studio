import Link from "next/link";
import { PRODUCT_IMAGES_PER_STUDIO } from "@/lib/generation";
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
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Интерьер: {studio.name}</div>
      </header>

      <section className="studio-detail-hero">
        <div>
          <p className="eyebrow">Выбранный интерьер</p>
          <h1>{studio.name}</h1>
          <p className="lead">{studio.description}</p>
          <div className="actions">
            <Link className="button button-primary" href={`/upload?studio=${studio.slug}`}>
              Выбрать этот интерьер
            </Link>
            <Link className="button button-secondary" href="/">
              Все интерьеры
            </Link>
          </div>
        </div>

        {studio.preview_url ? (
          <img
            alt={studio.name}
            className="studio-detail-cover"
            src={studio.preview_url}
          />
        ) : null}
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Ракурсы интерьера</h2>
            <p>
              9 изображений самого пространства, чтобы перед загрузкой селфи
              посмотреть атмосферу, свет, мебель и будущие зоны съёмки.
            </p>
          </div>
          <div className="count-pill">{galleryUrls.length} фото интерьера</div>
        </div>

        <div className="interior-gallery">
          {galleryUrls.map((url, index) => (
            <img
              alt={`${studio.name} ракурс ${index + 1}`}
              key={`${url}-${index}`}
              src={url}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Фотосессия в этом пространстве</h2>
            <p>
              После загрузки селфи будет создано {PRODUCT_IMAGES_PER_STUDIO} фото:
              10 разных позиций и 4 дистанции камеры для каждой позиции. Одежда
              подбирается под интерьер.
            </p>
          </div>
          <Link className="button button-primary" href={`/upload?studio=${studio.slug}`}>
            Перейти к загрузке селфи
          </Link>
        </div>

        <div className="shot-grid">
          {shots.slice(0, 10).map((shot) => (
            <article className="shot-card" key={shot.id}>
              <h3>{shot.name}</h3>
              <div className="meta-list">
                <div className="meta-item">
                  <span>Поза</span>
                  {shot.pose}
                </div>
                <div className="meta-item">
                  <span>Камера</span>
                  {shot.camera_angle}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
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
