import './globals.css';

export const metadata = {
  title: 'SuiteSense — AI SuiteQL Console',
  description:
    'Ask questions about your NetSuite data in plain English. SuiteSense generates the SuiteQL and runs it.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
