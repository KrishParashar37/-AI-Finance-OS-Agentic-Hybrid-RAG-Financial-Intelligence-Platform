import { ScanResult } from "@/features/scanner";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScanResult id={id} />;
}
