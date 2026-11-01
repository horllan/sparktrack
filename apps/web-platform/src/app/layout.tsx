import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';
import { SparkChatbot } from '../components/spark-chatbot';
import { PwaRegistrar } from '../components/pwa-registrar';

export const metadata: Metadata = {
  title: 'SparkTrack | Build Real Skills and Verified Portfolios',
  description:
    'Track real projects, get mentor feedback, and build a verified portfolio from secondary school through university, NYSC, and career growth.',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#172554' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col pb-16 md:pb-0">
        <Providers>
          <PwaRegistrar />
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
          <SparkChatbot />
        </Providers>
      </body>
    </html>
  );
}
