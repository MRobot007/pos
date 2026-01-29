'use client'

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Plus,
    Search,
    Edit,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    ArrowRight,
    Loader2,
    X,
    CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

interface Resource {
    id: number
    [key: string]: any
}

interface Field {
    label: string
    key: string
    type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'password' | 'checkbox' | 'datetime-local'
    options?: { label: string; value: any }[]
    required?: boolean
}

interface PageProps {
    title: string
    description: string
    icon: any
    resourceName: string
    columns: { label: string; key: string; align?: 'left' | 'center' | 'right' }[]
    apiPath: string
    fields?: Field[]
    renderActions?: (item: Resource) => React.ReactNode
    initialSearch?: string
    customFilter?: (data: Resource[]) => Resource[]
    headerActions?: React.ReactNode
}

export function AdminResourceTemplate({
    title,
    description,
    icon: Icon,
    resourceName,
    columns,
    apiPath,
    fields = [],
    renderActions,
    csvPath,
    showBulkDelete = false,
    initialSearch = '',
    customFilter,
    headerActions
}: PageProps & { csvPath?: string, showBulkDelete?: boolean, initialSearch?: string, customFilter?: (data: Resource[]) => Resource[], headerActions?: React.ReactNode }) {
    const [data, setData] = useState<Resource[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState(initialSearch)
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 25
    const [showModal, setShowModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [isCsvUploading, setIsCsvUploading] = useState(false)

    const apiUrl = API_URL

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 250)

        return () => clearTimeout(timer)
    }, [search])

    const fetchData = useCallback(async () => {
        try {
            const cacheKey = `resourceCache:${apiPath}`
            const cacheTimeKey = `resourceCacheTimestamp:${apiPath}`
            const cached = localStorage.getItem(cacheKey)
            const cachedAt = localStorage.getItem(cacheTimeKey)
            const now = Date.now()
            const cacheTtl = 5 * 60 * 1000
            let usedCache = false

            if (cached && cachedAt && now - parseInt(cachedAt) < cacheTtl) {
                try {
                    const cachedData = JSON.parse(cached)
                    if (Array.isArray(cachedData)) {
                        setData(cachedData)
                        setLoading(false)
                        usedCache = true
                    }
                } catch (e) {
                    usedCache = false
                }
            }

            if (!usedCache) {
                setLoading(true)
            }
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            const res = await fetch(`${apiUrl}${apiPath}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            const text = await res.text();
            let result = null;
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error(`Failed to parse ${resourceName} JSON:`, text);
            }

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    console.warn(`${resourceName} access denied (403/401).`)
                } else {
                    console.error(`${resourceName} fetch failed:`, result?.error || 'Unknown error', result?.debug || '');
                }
                setData([])
                setLoading(false)
                return
            }

            let nextData: Resource[] = []
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
            try {
                localStorage.setItem(cacheKey, JSON.stringify(nextData))
                localStorage.setItem(cacheTimeKey, now.toString())
            } catch (e) {
                console.warn(`LocalStorage quota exceeded for ${resourceName}, skipping cache.`)
            }
        } catch (err) {
            console.error(err)
            setData([])
            setLoading(false)
        }
    }, [apiUrl, apiPath, resourceName])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleAdd = () => {
        setEditingId(null)
        setFormData({})
        setShowModal(true)
    }

    const handleEdit = (item: Resource) => {
        setEditingId(item.id)
        const initialForm: any = {}
        fields.forEach(f => {
            initialForm[f.key] = item[f.key] !== undefined && item[f.key] !== null ? item[f.key] : ''
        })
        setFormData(initialForm)
        setShowModal(true)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this record?')) return
        try {
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            const res = await fetch(`${apiUrl}${apiPath}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Deletion failed')
            }
        } catch (err) {
            console.error(err)
            alert('An error occurred during deletion')
        }
    }

    const handleDeleteAll = async () => {
        if (!confirm('CRITICAL: This will permanently delete EVERY record in this resource. Are you absolutely certain?')) return
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${apiPath}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Bulk deletion failed')
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !csvPath) return

        setIsCsvUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${csvPath}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            const result = await res.json()
            if (res.ok) {
                alert(`Import Successful!\nImported: ${result.imported || 0} items\nUpdated: ${result.updated || 0} items`)
                fetchData()
            } else {
                alert(result.error || 'CSV Import failed')
            }
        } catch (err) {
            console.error(err)
            alert('CSV transmission error')
        } finally {
            setIsCsvUploading(false)
            e.target.value = ''
        }
    }

    const handleCsvExport = async () => {
        if (!csvPath) return
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}${csvPath}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${resourceName.toLowerCase()}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            console.error(err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            const res = await fetch(`${apiUrl}${apiPath}${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
                credentials: 'include',
                cache: 'no-store'
            })

            if (res.ok) {
                setShowModal(false)
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Operation failed')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const deferredSearch = useDeferredValue(debouncedSearch)
    const filteredData = useMemo(() => {
        let result = data

        if (customFilter) {
            result = customFilter(result)
        }

        const query = deferredSearch.trim().toLowerCase()
        if (!query) return result
        return result.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(query)
            )
        )
    }, [data, deferredSearch, customFilter])
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
    }, [apiPath, deferredSearch])

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-dark font-outfit uppercase tracking-tight">{title}</h2>
                    <p className="text-purple-800 mt-1 italic text-sm font-semibold">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group mr-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${resourceName}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-white border border-purple-100 rounded-2xl pl-12 pr-6 py-3 w-64 focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none transition-all text-sm font-semibold text-purple-900 placeholder:text-purple-600"
                        />
                    </div>

                    {headerActions}

                    {csvPath && (
                        <>
                            <label className="px-5 py-3 rounded-2xl bg-white border border-green-100 text-green-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-green-50 transition-all flex items-center gap-2 cursor-pointer">
                                {isCsvUploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                Import CSV
                                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={isCsvUploading} />
                            </label>
                            <button
                                onClick={handleCsvExport}
                                className="px-5 py-3 rounded-2xl bg-white border border-blue-100 text-blue-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-blue-50 transition-all flex items-center gap-2"
                            >
                                Export CSV
                            </button>
                        </>
                    )}

                    {showBulkDelete && (
                        <button
                            onClick={handleDeleteAll}
                            className="px-5 py-3 rounded-2xl bg-white border border-red-100 text-red-600 font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-red-50 transition-all flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Purge All
                        </button>
                    )}

                    {fields.length > 0 && (
                        <button
                            onClick={handleAdd}
                            className="premium-button flex items-center gap-2 uppercase text-[10px] tracking-widest font-black shadow-lg shadow-primary/20"
                        >
                            <Plus size={18} />
                            New {resourceName.slice(0, -1)}
                        </button>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-[40px] overflow-hidden border-purple-50 shadow-xl bg-white/80">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-purple-100 bg-purple-50/50">
                                {columns.map((col, i) => (
                                    <th key={i} className={cn(
                                        "px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]",
                                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                                    )}>
                                        {col.label}
                                    </th>
                                ))}
                                <th className="px-8 py-6 text-[10px] font-black text-purple-700 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={columns.length + 1} className="px-8 py-6 h-20 bg-purple-50/30" />
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-8 py-20 text-center text-purple-600 font-bold uppercase tracking-[0.4em] text-[10px] opacity-60">
                                        No Records Found
                                    </td>
                                </tr>
                            ) : (
                                pagedData.map((item) => (
                                    <tr key={item.id} className="table-row group hover:bg-purple-50/80 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-primary">
                                        {columns.map((col, i) => {
                                            const val = col.key.split('.').reduce((obj, key) => obj?.[key], item)
                                            const displayVal = typeof val === 'object' ? JSON.stringify(val) : val
                                            return (
                                                <td key={i} className={cn(
                                                    "px-8 py-6",
                                                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                                                )}>
                                                    {i === 0 ? (
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                                <Icon size={18} />
                                                            </div>
                                                            <span className="text-primary font-black text-sm tracking-tight uppercase">{displayVal ?? 'N/A'}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm font-bold text-purple-900">{displayVal ?? '-'}</span>
                                                    )}
                                                </td>
                                            )
                                        })}
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {renderActions && renderActions(item)}
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="w-9 h-9 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-primary transition-all"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-9 h-9 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-center text-purple-800 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
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

            {/* Dynamic Form Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                    <div className="glass-card rounded-[40px] p-10 w-full max-w-lg relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">
                                    {editingId ? 'Edit Record' : `New ${resourceName.slice(0, -1)}`}
                                </h3>
                                <p className="text-purple-800 italic text-sm">Fill in the details for the operational ledger.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 relative z-10 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            {fields.map((field) => (
                                <div key={field.key} className="space-y-1.5">
                                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest ml-1">{field.label}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold min-h-[100px] py-3"
                                            required={field.required}
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold cursor-pointer"
                                            required={field.required}
                                        >
                                            <option value="">Select Option</option>
                                            {field.options?.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'checkbox' ? (
                                        <div className="flex items-center gap-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={!!formData[field.key]}
                                                onChange={e => setFormData({ ...formData, [field.key]: e.target.checked })}
                                                className="w-5 h-5 rounded border-purple-100 text-primary focus:ring-primary/20 accent-primary"
                                            />
                                            <span className="text-xs font-semibold text-purple-700">Enable / Confirm selection</span>
                                        </div>
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={formData[field.key] ?? ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="input-field w-full font-semibold"
                                            required={field.required}
                                        />
                                    )}
                                </div>
                            ))}

                            <div className="flex gap-4 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-800 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} className="group-hover:rotate-12 transition-transform" />}
                                    {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Create Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
