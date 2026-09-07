import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'School Wallet',
  description: 'กระเป๋าเงินดิจิทัลสำหรับนักเรียน',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}