import { redirect } from "next/navigation";

export default function ScanIndexPage() {
  redirect("/scan/my-qr");
  return null;
}
