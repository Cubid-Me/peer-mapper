const INDEXER_URL = "https://moonbeam.moonscan.io/";

export default function IndexerPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">Moonbeam tooling</span>
        <h1 className="text-3xl font-semibold text-slate-50">Moonbeam indexer</h1>
        <p className="max-w-3xl text-sm text-slate-300/90">
          Browse transaction details, contract events, and on-chain history without leaving Trust Me Bro. The
          Moonbeam explorer loads below inside the app shell so you can jump straight back into handshakes when you are
          done.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-950/70 shadow-inner shadow-black/50">
        <iframe
          className="h-[70vh] w-full"
          src={INDEXER_URL}
          title="Moonbeam indexer"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </section>
  );
}
