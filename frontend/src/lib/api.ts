const apiUrl = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

export async function getProfile(cubidId: string) {
  const res = await fetch(`${apiUrl}/profile/${cubidId}`);
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}
