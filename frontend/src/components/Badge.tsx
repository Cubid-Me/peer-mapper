type BadgeProps = {
  issuer: string;
  trustLevel: string;
  circle: string | null;
  freshness: string;
};

export default function Badge({ issuer, trustLevel, circle, freshness }: BadgeProps) {
  return (
    <article className="flex items-center justify-between rounded border border-gray-300/70 px-4 py-3 text-sm">
      <div>
        <p className="font-mono text-xs text-gray-500">{issuer}</p>
        <p className="text-lg font-semibold">{trustLevel}</p>
        <p className="text-xs text-gray-400">{circle ?? "general circle"}</p>
      </div>
      <span className="text-xs text-gray-500">{freshness}</span>
    </article>
  );
}
