import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-10 text-6xl font-bold tabular-nums text-yellow-500">404</p>
      <h1 className="mt-3 text-2xl font-bold text-gray-100">Page not found</h1>
      <p className="mt-2 max-w-md text-gray-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="btn-primary mt-8">Back to dashboard</Link>
    </main>
  );
}
