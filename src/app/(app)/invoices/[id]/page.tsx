import { InvoiceDetails } from "@/features/invoices";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetails id={id} />;
}
