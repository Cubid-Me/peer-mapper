import Link from "next/link";

const DEVELOPER_SHORTCUTS = [
  { href: "/signin", label: "1. Sign in" },
  { href: "/new-user", label: "2. Onboard" },
  { href: "/circle", label: "3. My circle" },
  { href: "/profile", label: "4. Profile" },
  { href: "/vouch", label: "5. Vouch" },
  { href: "/scan/my-qr", label: "6. My QR" },
  { href: "/scan/camera", label: "7. Camera" },
  { href: "/results", label: "8. Results" },
];

export function AppFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-slate-300">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/70">Developer shortcuts</p>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Quick links we keep handy while building. They stay tucked down here so guests can focus on the experience, while the
            team can still hop between flows at speed.
          </p>
        </div>
        <ol className="flex flex-wrap gap-3 text-sm font-medium text-slate-200">
          {DEVELOPER_SHORTCUTS.map((link) => (
            <li key={link.href}>
              <Link className="rounded-full border border-slate-600/70 px-4 py-2 transition hover:border-sky-400/70 hover:text-sky-200" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Trust Me Bro • Built for trusted introductions on Moonbeam.</p>
      </div>
    </footer>
  );
}

export { DEVELOPER_SHORTCUTS };
