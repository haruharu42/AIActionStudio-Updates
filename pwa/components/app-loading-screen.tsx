export function AppLoadingScreen({ message = "AASを読み込んでいます…" }: { message?: string }) {
  return (
    <main className="standalone-page" aria-busy="true">
      <section className="standalone-card">
        <p className="eyebrow">AI ACTION STUDIO</p>
        <h1>準備しています</h1>
        <p className="route-notice" role="status" aria-live="polite">{message}</p>
      </section>
    </main>
  );
}
