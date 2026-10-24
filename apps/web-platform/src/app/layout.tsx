import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '../components/navbar';

export const metadata: Metadata = {
  title: 'SparkTrack — Discover Your Potential',
  description: 'Explore careers, build skills, and demonstrate your capabilities.',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f59e0b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
