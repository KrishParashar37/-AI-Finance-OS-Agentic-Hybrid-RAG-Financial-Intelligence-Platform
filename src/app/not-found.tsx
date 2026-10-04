import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-grad text-7xl font-extrabold">404</p>
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-500">The page you're looking for doesn't exist or has moved.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to dashboard</Link>
      </div>
    </div>
  );
}
