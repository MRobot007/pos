'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
    ShoppingCart,
    History,
    BarChart3,
    LogOut,
    Power
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api-config'

interface CashierSidebarProps {
    className?: string
}

export default function CashierSidebar({ className }: CashierSidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) { }
        }
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.replace('/admin/login')
    }

    const handleShiftOff = async () => {
        if (!confirm('Are you sure you want to end your shift? You will need to set a new opening float to resume sales.')) return

        const token = localStorage.getItem('token')
        if (!token) {
            handleLogout()
            return
        }

        try {
            const res = await fetch(`${API_URL}/pos/session/close`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            if (res.ok) {
                alert('Shift ended successfully.')
                if (pathname === '/') {
                    window.location.reload()
                } else {
                    router.push('/')
                }
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to end shift')
            }
        } catch (err) {
            console.error('Shift off failed', err)
            alert('A network error occurred.')
        }
    }

    const role = user?.role?.toUpperCase() || 'CASHIER'
    const historyHref = role === 'OWNER' || role === 'MANAGER' ? '/admin/sales' : '/cashier/history'

    return (
        <nav className={cn("w-24 border-r border-white/5 flex flex-col items-center py-8 gap-8 bg-[#09090B] shadow-2xl relative z-30 shrink-0 h-full", className)}>
            <Link href="/admin">
                <div className="h-10 px-3 rounded-xl bg-primary border border-white/10 flex items-center justify-center shadow-md hover:opacity-90 transition-all group overflow-hidden">
                    <Image
                        src="/logo.avif"
                        alt="Logo"
                        width={100}
                        height={36}
                        className="h-full w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500"
                    />
                </div>
            </Link>

            <div className="flex flex-col gap-4">
                {/* Terminal Button */}
                {pathname === '/' ? (
                    <button className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <ShoppingCart size={22} />
                    </button>
                ) : (
                    <Link
                        href="/"
                        className="w-12 h-12 rounded-2xl text-purple-300/40 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all group relative"
                        title="Terminal"
                    >
                        <ShoppingCart size={22} />
                        <span className="absolute left-full ml-4 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            TERMINAL
                        </span>
                    </Link>
                )}

                {/* History Button */}
                {(pathname === '/cashier/history' || pathname === '/admin/sales') ? (
                    <button className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <History size={22} />
                    </button>
                ) : (
                    <Link
                        href={historyHref}
                        className="w-12 h-12 rounded-2xl text-purple-300/40 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all group relative"
                        title="History"
                    >
                        <History size={22} />
                        <span className="absolute left-full ml-4 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            HISTORY
                        </span>
                    </Link>
                )}

                {/* X-Report Button */}
                {pathname === '/reports/x-report' ? (
                    <button className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <BarChart3 size={22} />
                    </button>
                ) : (
                    <Link
                        href="/reports/x-report"
                        className="w-12 h-12 rounded-2xl text-purple-300/40 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all group relative"
                        title="X-Report"
                    >
                        <BarChart3 size={22} />
                        <span className="absolute left-full ml-4 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            X-REPORT
                        </span>
                    </Link>
                )}
            </div>

            <div className="mt-auto flex flex-col items-center gap-6 mb-4">
                {/* User Role Badge */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-900/30 flex items-center justify-center text-[10px] font-black text-purple-400 border border-purple-800/50 shadow-inner" title={`Logged in as ${role}`}>
                        {role.substring(0, 1)}
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="System Online" />
                </div>

                {/* Shift Off Button */}
                <button
                    onClick={handleShiftOff}
                    className="w-12 h-12 rounded-2xl text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 flex items-center justify-center transition-all group relative"
                    title="End Shift"
                >
                    <Power size={22} />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                        END SHIFT
                    </span>
                </button>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="w-12 h-12 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all group relative"
                    title="Logout"
                >
                    <LogOut size={22} />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                        LOGOUT SESSION
                    </span>
                </button>
            </div>
        </nav>
    )
}
