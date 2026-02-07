'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { History, ArrowUpRight, X, Loader2, Users, RotateCcw, TrendingUp, ChevronLeft, DollarSign, ShoppingBag, Activity } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

export default function UserSalesPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const userId = params.id
    const userName = searchParams.get('name') || 'Team Member'

    const [selectedSale, setSelectedSale] = useState<any>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [isRefunding, setIsRefunding] = useState(false)
    const [stats, setStats] = useState<any>(null)

    const apiUrl = API_URL

    const fetchStats = async () => {
        if (!apiUrl) return
        const token = localStorage.getItem('token')
        if (!token) return
        try {
            const res = await fetch(`${apiUrl}/admin/stats?cashier_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [userId])

    const handleViewDetail = async (saleId: number) => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        setLoadingDetail(true)
        setShowDetailModal(true)
        try {
            const res = await fetch(`${apiUrl}/sales/${saleId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setSelectedSale(data)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingDetail(false)
        }
    }

    const handleRefund = async () => {
        const reason = prompt("Enter justification for financial reversal:")
        if (!reason) return

        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        setIsRefunding(true)
        try {
            const res = await fetch(`${apiUrl}/admin/refunds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    saleId: selectedSale.id,
                    reason,
                    items: selectedSale.items.map((i: any) => ({
                        saleItemId: i.id,
                        quantity: i.quantity,
                        amount: i.subtotal,
                        restock: true
                    }))
                }),
                credentials: 'include',
                cache: 'no-store'
            })

            if (res.ok) {
                alert("Financial Reversal Successfully Authorized.")
                setShowDetailModal(false)
                window.location.reload()
            } else {
                const data = await res.json()
                alert(`Protocol Error: ${data.error}`)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsRefunding(false)
        }
    }

    const formatCurrency = (val: any) => `$${Number(val || 0).toFixed(2)}`

    return (
        <div className="relative space-y-6">
            {/* Operational Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 glass-card rounded-[32px] bg-white border-purple-50 shadow-lg relative overflow-hidden group">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary w-fit mb-4 group-hover:scale-110 transition-transform">
                        <DollarSign size={20} />
                    </div>
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Gross Revenue Generated</p>
                    <h4 className="text-2xl font-black text-dark font-outfit">{formatCurrency(stats?.totalRevenue)}</h4>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                </div>
                <div className="p-6 glass-card rounded-[32px] bg-white border-purple-50 shadow-lg relative overflow-hidden group">
                    <div className="p-3 rounded-2xl bg-accent/10 text-accent w-fit mb-4 group-hover:scale-110 transition-transform">
                        <ShoppingBag size={20} />
                    </div>
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Total Operations Executed</p>
                    <h4 className="text-2xl font-black text-dark font-outfit">{stats?.totalSales || 0} Orders</h4>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl" />
                </div>
                <div className="p-6 glass-card rounded-[32px] bg-white border-purple-50 shadow-lg relative overflow-hidden group">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 w-fit mb-4 group-hover:scale-110 transition-transform">
                        <Activity size={20} />
                    </div>
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Activity Today</p>
                    <h4 className="text-2xl font-black text-dark font-outfit">{stats?.todaySales || 0} Transactions</h4>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                </div>
            </div>

            <AdminResourceTemplate
                title={`${userName}'s Performance`}
                description={`Operational sales history and ledger entries for ${userName}.`}
                icon={TrendingUp}
                resourceName="Sales"
                apiPath={`/admin/sales?cashier_id=${userId}&limit=all`}
                columns={[
                    { label: 'Receipt No.', key: 'receipt_number' },
                    { label: 'Gross Total', key: 'total', align: 'right' },
                    { label: 'Method', key: 'payment_method', align: 'center' },
                    { label: 'Date Time', key: 'created_at' }
                ]}
                headerActions={
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-3 rounded-2xl bg-white border border-purple-100 text-purple-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-purple-50 transition-all flex items-center gap-2 mr-2"
                    >
                        <ChevronLeft size={16} />
                        Back to Team
                    </button>
                }
                renderActions={(item) => (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetail(item.id)
                        }}
                        title="View Details"
                        className="w-9 h-9 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary hover:bg-primary/10 transition-all font-black"
                    >
                        <ArrowUpRight size={14} />
                    </button>
                )}
            />

            {/* Transaction Detail Modal */}
            {showDetailModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                    <div className="glass-card rounded-[40px] p-8 w-full max-w-2xl relative overflow-hidden border-purple-100 bg-white shadow-2xl animate-entry">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-dark mb-1 font-outfit tracking-tight uppercase">
                                    Transaction Ledger
                                </h3>
                                <p className="text-purple-800 italic text-sm font-semibold">
                                    Session Entry: <span className="text-primary">#{selectedSale?.id || '...'}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {loadingDetail ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="animate-spin text-primary" size={40} />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Consulting Archives...</p>
                            </div>
                        ) : selectedSale && (
                            <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                                {/* Summary Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-3xl bg-purple-50/50 border border-purple-100">
                                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Time Stamp</p>
                                        <p className="text-sm font-bold text-dark">{new Date(selectedSale.created_at).toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 rounded-3xl bg-purple-50/50 border border-purple-100 text-right">
                                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Payment Channel</p>
                                        <p className="text-sm font-bold text-primary uppercase tracking-tight">{selectedSale.payment_method}</p>
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest ml-1">Inventory Breakdown</h4>
                                    <div className="border border-purple-50 rounded-3xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-purple-50/50 text-[10px] font-black text-purple-700 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-5 py-4">Item Identity</th>
                                                    <th className="px-5 py-4 text-center">Unit</th>
                                                    <th className="px-5 py-4 text-right">Extension</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-purple-50">
                                                {selectedSale.items.map((item: any) => (
                                                    <tr key={item.id}>
                                                        <td className="px-5 py-4">
                                                            <p className="font-black text-dark tracking-tight leading-none mb-1">{item.name || item.product?.name}</p>
                                                            <p className="text-[10px] text-purple-400 font-bold uppercase">{item.sku || item.product?.sku}</p>
                                                        </td>
                                                        <td className="px-5 py-4 text-center font-bold text-purple-900">
                                                            {item.quantity} × {formatCurrency(item.price)}
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-black text-primary font-outfit">
                                                            {formatCurrency(item.subtotal)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Financial Total */}
                                <div className="p-6 rounded-[32px] bg-dark text-white space-y-2 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                                        <span>Operational Subtotal</span>
                                        <span>{formatCurrency(selectedSale.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                                        <span>Statutory Tax (8.25%)</span>
                                        <span>{formatCurrency(selectedSale.tax)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2">
                                        <span className="text-sm font-black uppercase tracking-widest">Gross Settlement</span>
                                        <span className="text-2xl font-black font-outfit text-primary">{formatCurrency(selectedSale.total)}</span>
                                    </div>
                                </div>

                                {/* Refund Action */}
                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={handleRefund}
                                        disabled={isRefunding}
                                        className="flex-1 py-5 rounded-[24px] bg-red-50 text-red-600 font-black border border-red-100 hover:bg-red-100 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                                    >
                                        {isRefunding ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                                        Authorize Full Reversal
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
