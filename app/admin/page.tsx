'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    Users,
    Package,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    ShoppingBag,
    AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

interface DashboardStats {
    totalProducts: number
    totalCategories: number
    totalSales: number
    lowStockProducts: number
    todaySales: number
    totalRevenue: number
    recentSales: any[]
    chartData: { label: string; value: number }[]
    trends: {
        revenue: number
        sales: number
        today: number
        products: number
    }
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    const apiUrl = API_URL

    const fetchDashboardData = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const res = await fetch(`${apiUrl}/admin/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            const text = await res.text()

            let result = null;
            try {
                result = JSON.parse(text)
            } catch (jsonErr) {
                console.error('Failed to parse stats JSON. Response text:', text)
                console.error('JSON Error:', jsonErr)
            }

            if (!res.ok || !result) {
                if (res.status !== 401 && res.status !== 403) {
                    console.error('Stats request failed', {
                        status: res.status,
                        error: result?.error,
                        userRole: result?.role,
                        requiredRoles: result?.required,
                        fullResponse: result
                    })
                }

                setLoading(false)
                return
            }

            setData(result)
            setLoading(false)
        } catch (err) {
            console.error('Dashboard fetch error:', err)
            setLoading(false)
        }
    }, [apiUrl])

    useEffect(() => {
        fetchDashboardData()
    }, [fetchDashboardData])

    const chartData = useMemo(() => {
        if (!data?.chartData) return []
        return data.chartData.map(item => ({
            label: String(item.label ?? ''),
            value: Number(item.value ?? 0)
        }))
    }, [data])

    const chartMax = useMemo(() => {
        if (chartData.length === 0) return 1
        return Math.max(...chartData.map(item => item.value), 1)
    }, [chartData])

    const stats = [
        {
            label: 'Total Revenue',
            value: data ? `$${(data.totalRevenue ?? 0).toLocaleString()}` : '$0.00',
            trend: data?.trends ? `${data.trends.revenue > 0 ? '+' : ''}${data.trends.revenue}%` : '0%',
            trendUp: data?.trends ? data.trends.revenue >= 0 : true,
            icon: DollarSign,
            color: 'primary'
        },
        {
            label: 'Total Orders',
            value: data ? (data.totalSales ?? 0).toString() : '0',
            trend: data?.trends ? `${data.trends.sales > 0 ? '+' : ''}${data.trends.sales}%` : '0%',
            trendUp: data?.trends ? data.trends.sales >= 0 : true,
            icon: ShoppingBag,
            color: 'accent'
        },
        {
            label: 'Total Products',
            value: data ? (data.totalProducts ?? 0).toString() : '0',
            trend: '0%',
            trendUp: true,
            icon: Package,
            color: 'purple'
        },
        {
            label: 'Sales Today',
            value: data ? (data.todaySales ?? 0).toString() : '0',
            trend: data?.trends ? `${data.trends.today > 0 ? '+' : ''}${data.trends.today}%` : '0%',
            trendUp: data?.trends ? data.trends.today >= 0 : true,
            icon: Activity,
            color: 'indigo'
        },
    ]

    return (
        <div className="space-y-4">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="animate-entry">
                    <h2 className="text-3xl font-black text-dark font-outfit uppercase tracking-tight">System Intelligence 👋</h2>
                    <p className="text-purple-900 mt-1 italic text-sm font-semibold">Real-time performance metrics and business analytics.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 rounded-xl bg-white border border-purple-100 text-purple-700 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-purple-50 transition-all">
                        Export Report
                    </button>
                    <Link href="/" className="premium-button flex items-center gap-2 uppercase text-[10px] tracking-widest font-black shadow-lg shadow-primary/20">
                        <ShoppingBag size={14} />
                        Launch POS
                    </Link>
                </div>
            </div>
            {/* Low Stock Alert */}
            {data && data.lowStockProducts > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-[32px] p-6 flex items-center justify-between animate-entry shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-red-600 uppercase tracking-tight">Inventory Alert</h4>
                            <p className="text-xs text-red-600 font-bold uppercase tracking-widest">{data.lowStockProducts} products are currently below safety stock levels.</p>
                        </div>
                    </div>
                    <Link href="/admin/products?filter=low_stock" className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200">
                        View Low Stock Assets
                    </Link>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="stat-card glass-card rounded-[32px] p-8 group hover:border-primary/20 transition-all duration-500 relative overflow-hidden bg-white/80 border-purple-50 shadow-xl">
                        <div className="flex items-start justify-between mb-6">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6",
                                stat.color === 'primary' ? "bg-primary/10 text-primary" :
                                    stat.color === 'accent' ? "bg-accent/10 text-accent" :
                                        stat.color === 'purple' ? "bg-purple-500/10 text-purple-600" :
                                            "bg-indigo-500/10 text-indigo-600"
                            )}>
                                <stat.icon size={24} />
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                                stat.trendUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}>
                                {stat.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {stat.trend}
                            </div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-purple-900 text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-2">{stat.label}</p>
                            <h3 className="text-2xl font-black text-primary font-outfit tracking-tighter">{stat.value}</h3>
                        </div>
                        <div className={cn(
                            "absolute bottom-[-20px] right-[-20px] w-24 h-24 blur-[60px] opacity-0 group-hover:opacity-10 transition-opacity duration-700",
                            stat.color === 'primary' ? "bg-primary" :
                                stat.color === 'accent' ? "bg-accent" :
                                    stat.color === 'purple' ? "bg-purple-500" :
                                        "bg-indigo-500"
                        )} />
                    </div>
                ))}
            </div>

            {/* Main Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-8">
                <div className="lg:col-span-2 glass-card rounded-[32px] p-8 overflow-hidden relative border-purple-50 shadow-xl bg-white/80">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-primary font-outfit uppercase tracking-tight">Revenue Trajectory</h3>
                            <p className="text-purple-900 text-xs italic font-semibold">Operational walkthrough of financial metrics</p>
                        </div>
                        <select className="bg-purple-50/50 border border-purple-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-700 outline-none cursor-pointer hover:bg-purple-100 transition-colors">
                            <option>Last 7 Days</option>
                            <option>Monthly Trend</option>
                        </select>
                    </div>

                    <div className="h-[300px] flex items-end gap-3 px-2">
                        {chartData.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-purple-600 font-black uppercase tracking-[0.3em] text-[10px] opacity-60">
                                No Chart Data
                            </div>
                        ) : (
                            chartData.map((day, i) => {
                                const height = (day.value / chartMax) * 250
                                return (
                                    <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer">
                                        <div className="w-full bg-primary/10 rounded-t-xl group-hover:bg-primary/30 transition-all duration-300 relative border-t border-primary/10 shadow-sm" style={{ height: `${height}px` }}>
                                            <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none tracking-tight">
                                                ${day.value.toLocaleString()}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-purple-800 font-bold text-center mt-3 uppercase tracking-tighter">{day.label}</span>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="glass-card rounded-[32px] p-8 border-purple-50 shadow-xl bg-white/80">
                    <h3 className="text-xl font-black text-primary font-outfit mb-6 uppercase tracking-tight">Live Ledger</h3>
                    <div className="space-y-6">
                        {loading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-12 w-full bg-purple-50/50 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : data?.recentSales && data.recentSales.length > 0 ? (
                            data.recentSales.map((sale, i) => (
                                <div key={i} className="flex items-center justify-between group cursor-pointer border-l-2 border-l-transparent hover:border-l-primary pl-2 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-[10px] font-black text-primary shadow-sm">
                                            #{sale.id}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-primary uppercase tracking-tight">
                                                Order #{sale.id}
                                            </p>
                                            <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest">
                                                {sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-primary font-outfit tracking-tighter">${parseFloat(sale.total).toFixed(2)}</p>
                                        <p className="text-[9px] text-green-600 font-black uppercase tracking-widest opacity-80">Settled</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center text-purple-600 font-black uppercase tracking-[0.3em] text-[10px] opacity-60">
                                No Recent Sales
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
