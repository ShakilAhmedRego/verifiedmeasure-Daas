import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'VerifiedMeasure - Lead Distribution Platform',
  description: 'Secure capital raise lead distribution for verified companies',
  keywords: 'capital raise, leads, verified measure, Reg D, fundraising',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
