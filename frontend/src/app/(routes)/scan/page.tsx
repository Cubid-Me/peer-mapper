import QRScanner from "@/components/QRScanner";

export default function ScanPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Scan & verify</h1>
      <QRScanner />
    </section>
  );
}
