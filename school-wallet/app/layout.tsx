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
        <link rel="apple-touch-icon" href="/pig-icon.png" />
        <link rel="icon" href="/pig-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shine Wallet" />
        <link rel="stylesheet" href="/admin-header.css" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}