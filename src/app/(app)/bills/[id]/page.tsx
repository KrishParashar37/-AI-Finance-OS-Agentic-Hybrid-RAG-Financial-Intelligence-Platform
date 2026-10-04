import { BillDetails } from "@/features/bills";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillDetails id={id} />;
}
