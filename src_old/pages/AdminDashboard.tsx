import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

interface Stats {
  totalProducts: number
  totalCategories: number
  totalSales: number
  lowStockProducts: number
  todaySales: number
  totalRevenue: number
  recentSales: RecentSale[]
}

interface RecentSale {
  id: number
  createdAt: string
  items: {
    id: number
    quantity: number
    price: number
    subtotal: number
    product: {
      id: number
      name: string
      sku: string
    }
  }[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/admin/stats`, {
        headers: getAuthHeaders(),
      })
        const raw = await response.json()
        const normalized: Stats = {
          totalProducts: raw.totalProducts ?? 0,
          totalCategories: raw.totalCategories ?? 0,
          totalSales: raw.totalSales ?? 0,
          lowStockProducts: raw.lowStockProducts ?? 0,
          todaySales: raw.todaySales ?? 0,
          totalRevenue: Number(raw.totalRevenue ?? 0),
          recentSales: Array.isArray(raw.recentSales)
            ? raw.recentSales.map((sale: any) => ({
                id: sale.id,
                createdAt: sale.created_at,
                items: Array.isArray(sale.items)
                  ? sale.items.map((item: any) => ({
                      id: item.id,
                      quantity: Number(item.quantity ?? 0),
                      price: Number(item.price ?? 0),
                      subtotal: Number(item.subtotal ?? 0),
                      product: {
                        id: item.product?.id ?? item.product_id ?? 0,
                        name: item.product?.name ?? item.name ?? 'Unknown',
                        sku: item.product?.sku ?? item.sku ?? '',
                      },
                    }))
                  : [],
                subtotal: Number(sale.subtotal ?? 0),
                tax: Number(sale.tax ?? 0),
                total: Number(sale.total ?? 0),
                paymentMethod: sale.payment_method ?? 'unknown',
              }))
            : [],
        }
        setStats(normalized)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching stats:', error)
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [apiUrl])

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading dashboard...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-600">Failed to load dashboard data</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Admin Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Total Products</div>
          <div className="text-3xl font-bold text-blue-600">{stats.totalProducts}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Total Categories</div>
          <div className="text-3xl font-bold text-green-600">{stats.totalCategories}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Total Sales</div>
          <div className="text-3xl font-bold text-purple-600">{stats.totalSales}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Low Stock Products</div>
          <div className="text-3xl font-bold text-orange-600">{stats.lowStockProducts}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Today's Sales</div>
          <div className="text-3xl font-bold text-indigo-600">{stats.todaySales}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">
            ${stats.totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Sales</h3>
        {stats.recentSales.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No recent sales</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{sale.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.items.length} item(s)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${sale.subtotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${sale.tax.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      ${sale.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.paymentMethod.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

