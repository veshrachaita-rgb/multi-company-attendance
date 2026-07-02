import './globals.css';

export const metadata = {
  title: 'QR Attendance System',
  description: 'Multi-company QR-based staff attendance tracking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
