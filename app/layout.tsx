import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
    title: 'Spirited Wines | Premium POS System',
    description: 'Enterprise Grade Point of Sale with high-end aesthetics',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
            <body className="font-sans antialiased text-[#09090B]" suppressHydrationWarning>
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent rounded-full blur-[120px]" />
                </div>
                <div className="relative z-10 flex flex-col min-h-screen">
                    {children}
                </div>
            </body>
        </html>
    )
}
