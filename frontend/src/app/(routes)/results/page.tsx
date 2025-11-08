import Badge from "@/components/Badge";

const stubData = [
  { issuer: "0x1111...2222", trustLevel: "High", circle: "core", freshness: "2m ago" },
];

export default function ResultsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Trusted overlaps</h1>
      <div className="space-y-2">
        {stubData.map((item) => (
          <Badge key={item.issuer} {...item} />
        ))}
      </div>
    </section>
  );
}
