import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

type Customer = {
  id: number
  name: string
  phone?: string | null
  loyalty_points?: number
  created_at?: string
}

type Purchase = {
  id: number
  subtotal: number
  tax: number
  total: number
  payment_method: string
  created_at: string
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchCustomers(1)
  }, [])

  const fetchCustomers = async (page: number) => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/customers?page=${page}&limit=20`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch customers')
      const result = await response.json()
      setCustomers(result.customers || [])
      setPagination({ page: result.pagination?.page ?? 1, totalPages: result.pagination?.totalPages ?? 1 })
    } catch (err) {
      console.error('Customer load error', err)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async (term: string) => {
    setSearchTerm(term)
    if (!term) {
      fetchCustomers(1)
      return
    }
    setSearching(true)
    try {
      const response = await fetch(`${apiUrl}/api/customers/search?q=${encodeURIComponent(term)}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      setCustomers(data || [])
      setPagination({ page: 1, totalPages: 1 })
    } catch (err) {
      console.error('Customer search error', err)
    } finally {
      setSearching(false)
    }
  }

  const showCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setPurchases([])
    setLoadingPurchases(true)
    try {
      const response = await fetch(`${apiUrl}/api/customers/${customer.id}/purchases`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load purchases')
      const data = await response.json()
      const mapped: Purchase[] = (data || []).map((purchase: any) => ({
        id: purchase.id,
        subtotal: Number(purchase.subtotal ?? 0),
        tax: Number(purchase.tax ?? 0),
        total: Number(purchase.total ?? 0),
        payment_method: purchase.payment_method ?? 'unknown',
        created_at: purchase.created_at,
      }))
      setPurchases(mapped)
    } catch (err) {
      console.error('Purchase history error', err)
    } finally {
      setLoadingPurchases(false)
    }
  }

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="text-sm text-gray-500">Manage loyalty members and view purchase history.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name or phone"
            value={searchTerm}
            onChange={(e) => performSearch(e.target.value)}
            className="px-3 py-2 border rounded w-64"
          />
          {searching && <span className="text-sm text-gray-500">Searching…</span>}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading customers…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No customers found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{customer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.loyalty_points ?? 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => showCustomerDetail(customer)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
                <button
                  onClick={() => fetchCustomers(Math.max(1, pagination.page - 1))}
                  className="px-3 py-2 border rounded disabled:opacity-50"
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchCustomers(Math.min(pagination.totalPages, pagination.page + 1))}
                  className="px-3 py-2 border rounded disabled:opacity-50"
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            {selectedCustomer ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedCustomer.name}</h3>
                  <p className="text-sm text-gray-500">
                    Member since {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-gray-500">Phone</span>
                    <span>{selectedCustomer.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Loyalty Points</span>
                    <span>{selectedCustomer.loyalty_points ?? 0}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Recent Purchases</h4>
                  {loadingPurchases ? (
                    <div className="text-sm text-gray-500">Loading purchases…</div>
                  ) : purchases.length === 0 ? (
                    <div className="text-sm text-gray-500">No purchases found for this customer.</div>
                  ) : (
                    <ul className="space-y-3 text-sm">
                      {purchases.map((purchase) => (
                        <li
                          key={purchase.id}
                          className="border rounded p-3 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium">Sale #{purchase.id}</div>
                            <div className="text-gray-500 text-xs">
                              {new Date(purchase.created_at).toLocaleString()}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {purchase.payment_method.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div>{formatCurrency(purchase.total)}</div>
                            <div className="text-xs text-gray-500">
                              Subtotal {formatCurrency(purchase.subtotal)} | Tax {formatCurrency(purchase.tax)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Select a customer to view profile and purchase history.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
