import type { ReactNode } from "react";
import { AuthBrand } from "@/features/auth";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrand />
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
