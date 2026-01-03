import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Posers Viewer',
  description: 'Procedural motion viewer for VRM humanoids',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
