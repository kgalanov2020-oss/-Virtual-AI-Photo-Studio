import { getStudioSession } from "@/lib/studios";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getStudioSession("modern-business-studio");

  if (result.status === "missing-env") {
    return <SetupPanel />;
  }

  if (result.status === "error") {
    return <ErrorPanel message={result.message} />;
  }

  const { studio, shots } = result;
  const outputCount = shots.reduce((total, shot) => total + shot.variations, 0);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">Virtual AI Photo Studio</div>
        <div className="status">MVP studio catalog connected to Supabase</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">First studio session</p>
          <h1>{studio.name}</h1>
          <p className="lead">{studio.description}</p>
          <div className="actions">
            <a className="button button-primary" href="#shots">
              View shot plan
            </a>
            <a className="button button-secondary" href="#upload-guide">
              Selfie guide
            </a>
          </div>
        </div>

        <div className="studio-preview" aria-label="Modern office studio preview">
          <div className="preview-card">
            <strong>{outputCount} final photos</strong>
            <span>
              {shots.length} directed scenes, 4 variations per scene, one consistent
              business studio.
            </span>
          </div>
        </div>
      </section>

      <section className="section" id="shots">
        <div className="section-header">
          <div>
            <h2>Shot Plan</h2>
            <p>Scenes loaded from Supabase table `studio_shots`.</p>
          </div>
          <div className="count-pill">
            {shots.length} scenes / {outputCount} photos
          </div>
        </div>

        <div className="shot-grid">
          {shots.map((shot) => (
            <article className="shot-card" key={shot.id}>
              <h3>{shot.name}</h3>
              <div className="meta-list">
                <div className="meta-item">
                  <span>Pose</span>
                  {shot.pose}
                </div>
                <div className="meta-item">
                  <span>Camera</span>
                  {shot.camera_angle}
                </div>
                <div className="meta-item">
                  <span>Crop</span>
                  {shot.crop}
                </div>
                <div className="meta-item">
                  <span>Output</span>
                  {shot.variations} variations
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="upload-guide">
        <div className="section-header">
          <div>
            <h2>Selfie Guide</h2>
            <p>Next step: turn this into the upload flow.</p>
          </div>
        </div>
        <div className="shot-grid">
          {[
            "Front-facing neutral expression",
            "Front-facing slight smile",
            "Left three-quarter angle",
            "Right three-quarter angle",
            "Left profile",
            "Right profile",
            "Slightly from above",
            "Slightly from below",
            "Daylight photo",
            "No sunglasses or heavy shadows",
          ].map((item, index) => (
            <article className="shot-card" key={item}>
              <h3>{String(index + 1).padStart(2, "0")}</h3>
              <div className="meta-item">{item}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SetupPanel() {
  return (
    <main className="page">
      <section className="setup-panel">
        <p className="eyebrow">Supabase setup needed</p>
        <h1>Add frontend environment variables</h1>
        <p className="lead">
          The web app is ready, but it needs the project URL and publishable key
          before it can read `studios` and `studio_shots`.
        </p>
        <code className="code">
          NEXT_PUBLIC_SUPABASE_URL=https://vplhgizzyonpwqjdzvwg.supabase.co{"\n"}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
        </code>
      </section>
    </main>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="page">
      <section className="error-panel">
        <p className="eyebrow">Supabase query failed</p>
        <h1>Could not load the studio</h1>
        <p className="lead">{message}</p>
      </section>
    </main>
  );
}
