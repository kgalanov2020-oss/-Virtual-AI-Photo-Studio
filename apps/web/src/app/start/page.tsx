import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "5 AI-фото бесплатно по обычным селфи",
  description:
    "Загрузите обычные селфи, выберите готовую локацию и получите первые 5 AI-фото бесплатно без фотографа и студийной съёмки.",
  alternates: {
    canonical: "https://virtualphotostudio.ru/start",
  },
};

const signupHref = "/login?next=%2F%23studios";

export default function AdStartPage() {
  return (
    <main className="ad-start-page">
      <header className="ad-start-header">
        <Link className="ad-start-brand" href="/" aria-label="Virtual AI Photo Studio">
          <span aria-hidden="true">V</span>
          <strong>Virtual AI Photo Studio</strong>
        </Link>
        <Link className="ad-start-login" href={signupHref}>
          Войти
        </Link>
      </header>

      <section className="ad-start-hero">
        <div className="ad-start-hero-copy">
          <p className="eyebrow">AI-фотосессия онлайн</p>
          <h1>5 AI-фото бесплатно</h1>
          <p className="ad-start-lead">
            Загрузите обычные селфи, выберите локацию и получите готовые портреты без
            фотографа и студийной съёмки.
          </p>
          <Link className="button primary ad-start-cta" href={signupHref}>
            Получить 5 фото
          </Link>
          <p className="ad-start-note">Регистрация по email. Банковская карта не нужна.</p>
        </div>

        <div className="ad-start-result" aria-label="Пример результата до и после">
          <figure>
            <Image
              alt="Обычное селфи до AI-фотосессии"
              src="/selfie-guide/03-left-three-quarter.webp"
              width={640}
              height={854}
              priority
            />
            <figcaption>До</figcaption>
          </figure>
          <figure>
            <Image
              alt="Готовый портрет после AI-фотосессии"
              src="/before-after/after-luxury-garage-01.webp"
              width={1024}
              height={1365}
              priority
            />
            <figcaption>После</figcaption>
          </figure>
        </div>
      </section>

      <section className="ad-start-steps" aria-labelledby="ad-start-steps-title">
        <div className="ad-start-section-heading">
          <p className="eyebrow">Как это работает</p>
          <h2 id="ad-start-steps-title">Три простых шага</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Загрузите селфи</h3>
              <p>Подойдут обычные снимки с телефона при хорошем освещении.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Выберите локацию</h3>
              <p>Офис, отель, пляж, студия и другие готовые пространства.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Получите портреты</h3>
              <p>Сервис подберёт одежду, свет и позы под выбранную сцену.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="ad-start-examples" aria-labelledby="ad-start-examples-title">
        <div className="ad-start-section-heading">
          <p className="eyebrow">Результат</p>
          <h2 id="ad-start-examples-title">Один человек, разные кадры</h2>
        </div>
        <div className="ad-start-example-grid">
          {[1, 2, 3, 4].map((number) => (
            <Image
              key={number}
              alt={`Пример AI-портрета ${number}`}
              src={`/before-after/after-luxury-garage-0${number}.webp`}
              width={720}
              height={960}
            />
          ))}
        </div>
      </section>

      <section className="ad-start-final">
        <h2>Попробуйте на своих селфи</h2>
        <p>После регистрации на баланс сразу начисляются 5 бесплатных фото.</p>
        <Link className="button primary ad-start-cta" href={signupHref}>
          Начать бесплатно
        </Link>
      </section>
    </main>
  );
}
