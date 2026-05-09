import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyCoach',
  description: 'CV + AI 기반 실시간 공부 코칭',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
