import { ReportDetails } from "@/features/reports";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetails id={id} />;
}
