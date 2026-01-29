'use client'

import { useEffect, useMemo, useState, useDeferredValue } from 'react'
import { History, Search, ChevronLeft, ChevronRight, ShoppingCart, LogOut, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import CashierSidebar from '@/components/CashierSidebar'

interface SaleRecord {
    id: number
    receipt_number?: string
    total?: string | number
    payment_method?: string
    created_at?: string
    items?: Array<{
        id: number
        quantity?: number
        price?: number
        subtotal?: number
        product?: {
            id: number
            name?: string
            sku?: string
        }
    }>
}

export default function CashierHistoryPage() {
    const [data, setData] = useState<SaleRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 25
    const apiUrl = API_URL
    const router = useRouter()

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 250)

        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        const fetchSales = async () => {
            try {
                const cacheKey = 'cashierSalesCache'
                const cacheTimeKey = 'cashierSalesCacheTimestamp'
                const cached = localStorage.getItem(cacheKey)
                const cachedAt = localStorage.getItem(cacheTimeKey)
                const now = Date.now()
                const cacheTtl = 3 * 60 * 1000
                let usedCache = false

                if (cached && cachedAt && now - parseInt(cachedAt) < cacheTtl) {
                    const cachedData = JSON.parse(cached)
                    if (Array.isArray(cachedData)) {
                        setData(cachedData)
                        setLoading(false)
                        usedCache = true
                    }
                }

                if (!usedCache) {
                    setLoading(true)
                }

                if (!apiUrl) throw new Error('API URL not defined')
                const token = localStorage.getItem('token')
                if (!token) return

                const res = await fetch(`${apiUrl}/sales`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    cache: 'no-store'
                })
                const text = await res.text()
                let result: any = null
                try {
                    result = JSON.parse(text)
                } catch {
                    result = null
                }

                let nextData: SaleRecord[] = []
                if (Array.isArray(result)) {
                    nextData = result
                } else if (result && typeof result === 'object') {
                    const arrayKey = Object.keys(result).find(key => Array.isArray(result[key]))
                    if (arrayKey) {
                        nextData = result[arrayKey]
                    }
                }
                setData(nextData)
                setLoading(false)
                localStorage.setItem(cacheKey, JSON.stringify(nextData))
                localStorage.setItem(cacheTimeKey, now.toString())
            } catch (err) {
                setLoading(false)
            }
        }
        fetchSales()
    }, [apiUrl])

    const deferredSearch = useDeferredValue(debouncedSearch)
    const filteredData = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase()
        if (!query) return data
        return data.filter(item => {
            const matchesMain = Object.values(item).some(val =>
                String(val).toLowerCase().includes(query)
            )
            if (matchesMain) return true
            if (!Array.isArray(item.items)) return false
            return item.items.some(line => {
                const name = line.product?.name ?? ''
                const sku = line.product?.sku ?? ''
                return `${name} ${sku}`.toLowerCase().includes(query)
            })
        })
    }, [data, deferredSearch])

    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const pagedData = useMemo(() => {
        const start = (safePage - 1) * pageSize
        return filteredData.slice(start, start + pageSize)
    }, [filteredData, safePage])

    useEffect(() => {
        if (currentPage !== safePage) {
            setCurrentPage(safePage)
        }
    }, [currentPage, safePage])

    useEffect(() => {
        setCurrentPage(1)
    }, [deferredSearch])

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.replace('/admin/login')
    }

    return (
        <div className="flex h-screen bg-white text-purple-900 overflow-hidden font-sans">
            <CashierSidebar />

            <main className="flex-1 flex flex-col bg-transparent p-6 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <Link
                            href="/"
                            className="w-10 h-10 rounded-xl bg-white border border-purple-100 text-purple-700 flex items-center justify-center hover:bg-purple-50 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <h2 className="text-3xl font-black text-dark font-outfit uppercase tracking-tight">Cashier History</h2>
                            <p className="text-purple-800 mt-1 italic text-sm font-semibold">Purchased product history for cashier operations.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search history..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-white border border-purple-100 rounded-2xl pl-12 pr-6 py-3 w-64 focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none transition-all text-sm font-semibold text-purple-900 placeholder:text-purple-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-[40px] overflow-hidden border-purple-50 shadow-xl bg-white/80 mt-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-purple-100 bg-purple-50/50">
                                    <th className="px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]">Receipt No.</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em] text-right">Gross Total</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em] text-center">Method</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]">Date Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-50">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-8 py-6 h-20 bg-purple-50/30" />
                                        </tr>
                                    ))
                                ) : pagedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center text-purple-600 font-bold uppercase tracking-[0.4em] text-[10px] opacity-60">
                                            No Records Found
                                        </td>
                                    </tr>
                                ) : (
                                    pagedData.map((item) => (
                                        <tr key={item.id} className="group hover:bg-purple-50/80 transition-colors border-l-2 border-l-transparent hover:border-l-primary">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                        <History size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-primary font-black text-sm tracking-tight uppercase">{item.receipt_number ?? `#${item.id}`}</span>
                                                        {Array.isArray(item.items) && item.items.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {item.items.map(line => (
                                                                    <div key={line.id} className="text-[11px] font-semibold text-purple-700">
                                                                        {(line.product?.name ?? 'Item').toString()} × {line.quantity ?? 0}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className="text-sm font-bold text-purple-900">
                                                    ${Number(item.total ?? 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className="text-sm font-bold text-purple-900 uppercase">
                                                    {item.payment_method ?? 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-sm font-bold text-purple-900">
                                                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filteredData.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-8 py-4 border-t border-purple-100 bg-white/70">
                            <div className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredData.length)} of {filteredData.length}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className={cn(
                                        "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                                        safePage === 1 ? "border-purple-100 text-purple-300" : "border-purple-200 text-purple-700 hover:bg-purple-50"
                                    )}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                                    {safePage} / {totalPages}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className={cn(
                                        "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                                        safePage === totalPages ? "border-purple-100 text-purple-300" : "border-purple-200 text-purple-700 hover:bg-purple-50"
                                    )}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
