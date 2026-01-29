import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

type SupplierOption = { id: number; name: string }
type ProductOption = { id: number; name: string; sku: string }

type PurchaseOrder = {
  id: number
  supplier_id: number
  supplier_name: string
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  ordered_at?: string | null
  received_at?: string | null
  created_by_name?: string | null
  notes?: string | null
}

type PurchaseOrderDetail = PurchaseOrder & {
  items: PurchaseOrderItem[]
}

type PurchaseOrderItem = {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  ordered_qty: number
  received_qty: number
  cost_price: number
}

type NewOrderItem = {
  productId: number | null
  quantity: number
  costPrice: number
}

export default function AdminPurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrderSupplierId, setNewOrderSupplierId] = useState<number | null>(null)
  const [newOrderNotes, setNewOrderNotes] = useState('')
  const [newOrderItems, setNewOrderItems] = useState<NewOrderItem[]>([{ productId: null, quantity: 1, costPrice: 0 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [receiving, setReceiving] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchOrders()
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/admin/purchase-orders`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load purchase orders')
      const data = await response.json()
      const mapped: PurchaseOrder[] = Array.isArray(data)
        ? data.map((order: any) => ({
            id: Number(order.id),
            supplier_id: Number(order.supplier_id),
            supplier_name: order.supplier_name ?? 'Unknown supplier',
            status: order.status ?? 'DRAFT',
            ordered_at: order.ordered_at ?? null,
            received_at: order.received_at ?? null,
            created_by_name: order.created_by_name ?? null,
            notes: order.notes ?? null,
          }))
        : []
      setOrders(mapped)
    } catch (err) {
      console.error(err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/suppliers`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load suppliers')
      const data = await response.json()
      setSuppliers(
        Array.isArray(data)
          ? data.map((supplier: any) => ({ id: supplier.id, name: supplier.name }))
          : [],
      )
    } catch (err) {
      console.error(err)
      setSuppliers([])
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/products`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load products')
      const data = await response.json()
      setProducts(
        Array.isArray(data)
          ? data.map((product: any) => ({ id: product.id, name: product.name, sku: product.sku }))
          : [],
      )
    } catch (err) {
      console.error(err)
      setProducts([])
    }
  }

  const addOrderItemRow = () => {
    setNewOrderItems((items) => [...items, { productId: null, quantity: 1, costPrice: 0 }])
  }

  const removeOrderItemRow = (index: number) => {
    setNewOrderItems((items) => items.filter((_, idx) => idx !== index))
  }

  const updateOrderItemRow = (index: number, update: Partial<NewOrderItem>) => {
    setNewOrderItems((items) =>
      items.map((item, idx) => (idx === index ? { ...item, ...update } : item)),
    )
  }

  const resetNewOrderForm = () => {
    setNewOrderSupplierId(null)
    setNewOrderNotes('')
    setNewOrderItems([{ productId: null, quantity: 1, costPrice: 0 }])
    setError(null)
  }

  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newOrderSupplierId) {
      setError('Select a supplier before creating a purchase order.')
      return
    }
    const validItems = newOrderItems.filter((item) => item.productId && item.quantity > 0 && item.costPrice > 0)
    if (!validItems.length) {
      setError('Add at least one line item with quantity and cost price.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        supplierId: newOrderSupplierId,
        status: 'ORDERED',
        notes: newOrderNotes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice,
        })),
      }
      const response = await fetch(`${apiUrl}/api/admin/purchase-orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to create purchase order')
      }
      setShowCreateModal(false)
      resetNewOrderForm()
      fetchOrders()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Could not create purchase order')
    } finally {
      setSaving(false)
    }
  }

  const loadDetail = async (orderId: number) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const response = await fetch(`${apiUrl}/api/admin/purchase-orders/${orderId}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load purchase order')
      const order = await response.json()
      const detail: PurchaseOrderDetail = {
        id: order.id,
        supplier_id: order.supplier_id,
        supplier_name: order.supplier_name ?? 'Unknown supplier',
        status: order.status,
        ordered_at: order.ordered_at,
        received_at: order.received_at,
        created_by_name: order.created_by_name,
        notes: order.notes,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              product_name: item.product_name ?? item.name ?? 'Unknown product',
              product_sku: item.sku ?? item.product_sku ?? '',
              ordered_qty: Number(item.ordered_qty ?? 0),
              received_qty: Number(item.received_qty ?? 0),
              cost_price: Number(item.cost_price ?? 0),
            }))
          : [],
      }
      setDetail(detail)
    } catch (err) {
      console.error(err)
      alert('Unable to load purchase order detail.')
    } finally {
      setDetailLoading(false)
    }
  }

  const receiveRemaining = async () => {
    if (!detail) return
    const remainingItems = detail.items
      .map((item) => ({
        itemId: item.id,
        receivedQty: item.ordered_qty - item.received_qty,
        costPrice: item.cost_price,
      }))
      .filter((item) => item.receivedQty > 0)

    if (remainingItems.length === 0) {
      alert('All items for this purchase order are already received.')
      return
    }

    setReceiving(true)
    try {
      const response = await fetch(`${apiUrl}/api/admin/purchase-orders/${detail.id}/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: remainingItems }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to receive items')
      }
      loadDetail(detail.id)
      fetchOrders()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Could not receive goods.')
    } finally {
      setReceiving(false)
    }
  }

  const updateStatus = async (order: PurchaseOrder, status: PurchaseOrder['status']) => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/purchase-orders/${order.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, notes: order.notes }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to update status')
      }
      fetchOrders()
      if (detail?.id === order.id) {
        loadDetail(order.id)
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to update purchase order status')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Purchase Orders</h2>
          <p className="text-sm text-gray-500">Track goods on order, receipts, and supplier fulfillment.</p>
        </div>
        <button
          onClick={() => {
            resetNewOrderForm()
            setShowCreateModal(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Purchase Order
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading purchase orders…</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No purchase orders created yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{order.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.supplier_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${statusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.ordered_at ? new Date(order.ordered_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.received_at ? new Date(order.received_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <button
                      onClick={() => loadDetail(order.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                    {order.status !== 'CANCELLED' && (
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order, e.target.value as PurchaseOrder['status'])}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="ORDERED">Ordered</option>
                        <option value="RECEIVED">Received</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create Purchase Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{error}</div>
            )}
            <form className="space-y-4" onSubmit={saveOrder}>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier *</label>
                <select
                  value={newOrderSupplierId ?? ''}
                  onChange={(e) => setNewOrderSupplierId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="" disabled>
                    Select supplier
                  </option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={newOrderNotes}
                  onChange={(e) => setNewOrderNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Line Items</h4>
                <div className="space-y-3">
                  {newOrderItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border p-3 rounded">
                      <div className="md:col-span-5">
                        <label className="block text-xs font-medium mb-1">Product *</label>
                        <select
                          value={item.productId ?? ''}
                          onChange={(e) => updateOrderItemRow(index, { productId: e.target.value ? Number(e.target.value) : null })}
                          className="w-full px-2 py-2 border rounded"
                          required
                        >
                          <option value="" disabled>
                            Select product
                          </option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium mb-1">Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOrderItemRow(index, { quantity: Number(e.target.value) })}
                          className="w-full px-2 py-2 border rounded"
                          required
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium mb-1">Cost Price *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.costPrice}
                          onChange={(e) => updateOrderItemRow(index, { costPrice: Number(e.target.value) })}
                          className="w-full px-2 py-2 border rounded"
                          required
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        {newOrderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOrderItemRow(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOrderItemRow}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add another item
                </button>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white px-4 py-3 rounded shadow">Loading purchase order…</div>
        </div>
      )}

      {detail && !detailLoading && (() => {
        const hasRemaining = detail.items.some((item) => item.ordered_qty > item.received_qty)
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold">Purchase Order #{detail.id}</h3>
                  <p className="text-sm text-gray-500">{detail.supplier_name}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="block text-gray-500">Status</span>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColor(detail.status)}`}>
                    {detail.status}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500">Ordered</span>
                  <span>{detail.ordered_at ? new Date(detail.ordered_at).toLocaleString() : '—'}</span>
                </div>
                <div>
                  <span className="block text-gray-500">Received</span>
                  <span>{detail.received_at ? new Date(detail.received_at).toLocaleString() : '—'}</span>
                </div>
                <div>
                  <span className="block text-gray-500">Created By</span>
                  <span>{detail.created_by_name || '—'}</span>
                </div>
              </div>

              {detail.notes && (
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700">
                  <strong className="block text-gray-600 text-xs uppercase mb-1">Notes</strong>
                  {detail.notes}
                </div>
              )}

              <h4 className="font-semibold mb-2">Line Items</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {detail.items.map((item) => {
                      const remaining = item.ordered_qty - item.received_qty
                      const remainingClass = remaining > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500'
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm">{item.product_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{item.product_sku}</td>
                          <td className="px-4 py-2 text-sm">{item.ordered_qty}</td>
                          <td className="px-4 py-2 text-sm">{item.received_qty}</td>
                          <td className={`px-4 py-2 text-sm ${remainingClass}`}>{remaining}</td>
                          <td className="px-4 py-2 text-sm">${item.cost_price.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-6">
                <button onClick={() => setDetail(null)} className="px-4 py-2 border rounded">
                  Close
                </button>
                <div className="space-x-3">
                  <button
                    onClick={receiveRemaining}
                    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    disabled={receiving || !hasRemaining}
                  >
                    {receiving ? 'Receiving…' : 'Receive Remaining'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function statusColor(status: PurchaseOrder['status']) {
  switch (status) {
    case 'RECEIVED':
      return 'bg-green-100 text-green-700'
    case 'ORDERED':
      return 'bg-blue-100 text-blue-700'
    case 'CANCELLED':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-200 text-gray-600'
  }
}
