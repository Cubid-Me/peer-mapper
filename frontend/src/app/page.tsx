import Link from "next/link";

const LINKS = [
  { href: "/(routes)/signin", label: "1. Sign in" },
  { href: "/(routes)/circle", label: "2. My circle" },
  { href: "/(routes)/vouch", label: "3. Vouch" },
  { href: "/(routes)/scan", label: "4. Scan" },
  { href: "/(routes)/results", label: "5. Results" },
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
