import { AccountDetails } from "@/features/accounts";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetails id={id} />;
}
