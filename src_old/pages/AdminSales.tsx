import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

interface Sale {
  id: number
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
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
  payments: PaymentRecord[]
  customer?: Customer | null
  receipt?: Receipt | null
}

interface PaymentRecord {
  method: string
  amount: number
  reference?: string | null
}

interface Customer {
  id: number
  name: string
  phone?: string | null
  loyalty_points?: number
}

interface Receipt {
  email?: string | null
  phone?: string | null
  giftReceipt?: boolean
  receiptUrl?: string | null
}

export default function AdminSales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchSales()
  }, [page])

  const fetchSales = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/sales?page=${page}&limit=20`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      const normalizedSales: Sale[] = Array.isArray(data.sales)
        ? data.sales.map((sale: any) => ({
            id: sale.id,
            subtotal: Number(sale.subtotal ?? 0),
            tax: Number(sale.tax ?? 0),
            total: Number(sale.total ?? 0),
            paymentMethod: (sale.payment_method ?? sale.paymentMethod ?? 'unknown').toString(),
            createdAt: sale.created_at ?? sale.createdAt ?? new Date().toISOString(),
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
            payments: Array.isArray(sale.payments)
              ? sale.payments.map((p: any) => ({
                  method: (p.method ?? '').toString(),
                  amount: Number(p.amount ?? 0),
                  reference: p.reference ?? null,
                }))
              : [],
            customer: sale.customer
              ? {
                  id: sale.customer.id,
                  name: sale.customer.name,
                  phone: sale.customer.phone,
                  loyalty_points: sale.customer.loyalty_points,
                }
              : null,
            receipt: sale.receipt
              ? {
                  email: sale.receipt.email,
                  phone: sale.receipt.phone,
                  giftReceipt: !!sale.receipt.giftReceipt,
                  receiptUrl: sale.receipt.receiptUrl,
                }
              : null,
          }))
        : []
      setSales(normalizedSales)
      setTotalPages(data.pagination?.totalPages ?? 1)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching sales:', error)
      setLoading(false)
    }
  }

  const loadSaleDetail = async (saleId: number) => {
    setLoadingDetail(true)
    try {
      const response = await fetch(`${apiUrl}/api/sales/${saleId}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) return
      const sale = await response.json()
      const detail: Sale = {
        id: sale.id,
        subtotal: Number(sale.subtotal ?? 0),
        tax: Number(sale.tax ?? 0),
        total: Number(sale.total ?? 0),
        paymentMethod: (sale.payment_method ?? 'unknown').toString(),
        createdAt: sale.created_at ?? new Date().toISOString(),
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
        payments: Array.isArray(sale.payments)
          ? sale.payments.map((p: any) => ({
              method: (p.method ?? '').toString(),
              amount: Number(p.amount ?? 0),
              reference: p.reference ?? null,
            }))
          : [],
        customer: sale.customer
          ? {
              id: sale.customer.id,
              name: sale.customer.name,
              phone: sale.customer.phone,
              loyalty_points: sale.customer.loyalty_points,
            }
          : null,
        receipt: sale.receipt
          ? {
              email: sale.receipt.email,
              phone: sale.receipt.phone,
              giftReceipt: !!sale.receipt.gift_receipt,
              receiptUrl: sale.receipt.receipt_url,
            }
          : null,
      }
      setSelectedSale(detail)
    } catch (error) {
      console.error('Error loading sale detail:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const summarizePayments = (payments: PaymentRecord[], fallback: string) => {
    if (!payments.length) return fallback.toUpperCase()
    return payments
      .map((p) => `${p.method}:${p.amount.toFixed(2)}`)
      .join(', ')
  }

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Sales History</h2>

      {loading ? (
        <div className="text-center py-12">Loading sales...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{sale.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.items.length} item(s)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(sale.subtotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(sale.tax)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {summarizePayments(sale.payments, sale.paymentMethod)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedSale(sale)
                          loadSaleDetail(sale.id)
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {/* Sale Details Modal */}
          {selectedSale && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Sale #{selectedSale.id} Details</h3>
                  <button
                    onClick={() => setSelectedSale(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  {loadingDetail && <div className="text-sm text-gray-500">Refreshing sale details…</div>}
                  <div>
                    <strong>Date:</strong> {new Date(selectedSale.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Payment:</strong> {summarizePayments(selectedSale.payments, selectedSale.paymentMethod)}
                  </div>
                  {selectedSale.customer && (
                    <div className="flex gap-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-3">
                      <div>
                        <strong className="block text-gray-600 text-xs uppercase">Customer</strong>
                        <span>{selectedSale.customer.name}</span>
                      </div>
                      {selectedSale.customer.phone && (
                        <div>
                          <strong className="block text-gray-600 text-xs uppercase">Phone</strong>
                          <span>{selectedSale.customer.phone}</span>
                        </div>
                      )}
                      {typeof selectedSale.customer.loyalty_points === 'number' && (
                        <div>
                          <strong className="block text-gray-600 text-xs uppercase">Loyalty Points</strong>
                          <span>{selectedSale.customer.loyalty_points}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedSale.receipt && (selectedSale.receipt.email || selectedSale.receipt.phone || selectedSale.receipt.receiptUrl) && (
                    <div className="text-sm text-gray-700 bg-indigo-50 border border-indigo-200 rounded p-3">
                      <strong className="block text-gray-600 text-xs uppercase">Receipt Delivery</strong>
                      {selectedSale.receipt.email && <div>Email: {selectedSale.receipt.email}</div>}
                      {selectedSale.receipt.phone && <div>SMS: {selectedSale.receipt.phone}</div>}
                      {selectedSale.receipt.giftReceipt && <div>Gift receipt requested</div>}
                      {selectedSale.receipt.receiptUrl && (
                        <div>
                          Link: <a className="text-indigo-600 underline" href={selectedSale.receipt.receiptUrl} target="_blank" rel="noreferrer">Download</a>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold mb-2">Items:</h4>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedSale.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm">{item.product.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{item.product.sku}</td>
                            <td className="px-4 py-2 text-sm">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-2 text-sm">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <strong>Subtotal:</strong> {formatCurrency(selectedSale.subtotal)}
                    </div>
                    <div className="flex justify-between">
                      <strong>Tax:</strong> {formatCurrency(selectedSale.tax)}
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <strong>Total:</strong> {formatCurrency(selectedSale.total)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

