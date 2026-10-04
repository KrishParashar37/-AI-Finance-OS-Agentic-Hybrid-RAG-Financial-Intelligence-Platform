type Row = { merchant: string; category: string; amount: number; date: Date; type: string };

export function assessRisk(
  cand: { merchant: string; category: string; amount: number; date: Date; type: string },
  history: Row[],
): { risk: "low" | "medium" | "high"; reason: string } {
  if (cand.type !== "expense") return { risk: "low", reason: "" };
  const same = history.filter((h) => h.type === "expense" && h.category === cand.category);
  let risk: "low" | "medium" | "high" = "low";
  let reason = "";
  if (same.length >= 5) {
    const avg = same.reduce((a, b) => a + b.amount, 0) / same.length;
    if (cand.amount > avg * 4) {
      risk = "high";
      reason = `Amount is ${(cand.amount / avg).toFixed(1)}× your typical ${cand.category} purchase`;
    } else if (cand.amount > avg * 2.5) {
      risk = "medium";
      reason = `Amount is ${(cand.amount / avg).toFixed(1)}× your typical ${cand.category} purchase`;
    }
  }
  const seen = history.some((h) => h.merchant.toLowerCase() === cand.merchant.toLowerCase());
  if (!seen && cand.amount >= 5000 && risk === "low") {
    risk = "medium";
    reason = "First-time merchant with a large amount";
  }
  if (cand.amount >= 20000 && risk === "low") {
    risk = "medium";
    reason = "Unusually large transaction";
  }
  const dup = history.some(
    (h) =>
      h.merchant.toLowerCase() === cand.merchant.toLowerCase() &&
      h.amount === cand.amount &&
      Math.abs(h.date.getTime() - cand.date.getTime()) < 86400000,
  );
  if (dup) {
    reason = reason ? `${reason}; Duplicate of a recent transaction` : "Duplicate: same merchant & amount within 24h";
  }
  return { risk, reason };
}
