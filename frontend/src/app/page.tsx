import Link from "next/link";

const LINKS = [
  { href: "/signin", label: "1. Sign in" },
  { href: "/new-user", label: "2. Onboard" },
  { href: "/circle", label: "3. My circle" },
  { href: "/profile", label: "4. Profile" },
  { href: "/vouch", label: "5. Vouch" },
  { href: "/scan", label: "6. Scan" },
  { href: "/results", label: "7. Results" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Peer Mapper</p>
        <h1 className="text-4xl font-semibold">QR-powered trust overlaps on Moonbeam</h1>
        <p className="text-xl text-muted-foreground">
          Follow the five step demo path to issue attestations, scan a peer&apos;s QR, and reveal mutual trust.
        </p>
      </header>
      <ol className="space-y-3 text-lg">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link className="text-blue-600 hover:underline" href={link.href}>
              {link.label}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
