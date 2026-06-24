import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

function NavBar() {
  return (
    <nav className="bg-stone-900 text-white p-4 flex gap-6 items-center">
      <span className="font-semibold">EVAGRI</span>
      <Link href="/transactions" className="hover:underline">Liste</Link>
      <Link href="/transactions/map" className="hover:underline">Carte</Link>
      <Link href="/admin/import" className="hover:underline">Import</Link>
      <Link href="/admin/filters" className="hover:underline">Filtres</Link>
    </nav>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <body>
        <ThemeProvider>
          <NavBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
