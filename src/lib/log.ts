import { db } from "@/db";
import { activityLog, notifications } from "@/db/schema";

export async function logActivity(action: string, detail = "") {
  await db.insert(activityLog).values({ action, detail });
}

export async function notify(title: string, body = "", type: "info" | "warning" | "success" | "alert" = "info") {
  await db.insert(notifications).values({ title, body, type });
}
