import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shine Wallet',
  description: 'กระเป๋าเงินดิจิทัลสำหรับนักเรียน',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/pig-icon.png',
    shortcut: '/pig-icon.png',
    apple: '/pig-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Mali:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/pig-icon.png" />
        <link rel="icon" href="/pig-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shine Wallet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}