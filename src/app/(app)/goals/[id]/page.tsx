import { GoalDetails } from "@/features/goals";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoalDetails id={id} />;
}
