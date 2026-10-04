import type { Metadata } from "next";
import { Login } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign in — AI Finance OS",
  description: "Sign in to your AI Finance OS account",
};

export default function LoginPage() {
  return <Login />;
}
