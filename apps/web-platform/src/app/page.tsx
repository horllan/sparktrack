import Link from 'next/link';
import { Button } from '@sparktrack/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-spark-50 p-8 text-center">
      <h1 className="mb-3 text-4xl font-bold text-spark-900">⚡ SparkTrack</h1>
      <p className="mb-8 max-w-md text-slate-600">Discover, develop and demonstrate your potential.</p>
      <div className="flex gap-3">
        <Link href="/student/onboarding"><Button size="lg">Get started</Button></Link>
        <Link href="/mentor/dashboard"><Button size="lg" variant="outline">Mentor portal</Button></Link>
      </div>
    </main>
  );
}

