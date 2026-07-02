import { Montserrat, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Optimistic VF is Meta-proprietary; Montserrat is the design system's
// documented first fallback and carries the same humanist-geometric voice.
const sans = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'SuiteSense — AI SuiteQL Console',
  description:
    'Ask questions about your NetSuite data in plain English. SuiteSense generates the SuiteQL and runs it.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
