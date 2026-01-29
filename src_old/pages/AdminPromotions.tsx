import { useEffect, useMemo, useState } from 'react'
import { getAuthHeaders, getUser } from '../utils/auth'

type Promotion = {
  id: number
  name: string
  discount_type: 'PERCENT' | 'AMOUNT'
  discount_value: number
  start_at?: string | null
  end_at?: string | null
  category_id?: number | null
  category_name?: string | null
  active: boolean
}

const emptyPromotion: Partial<Promotion> = {
  name: '',
  discount_type: 'PERCENT',
  discount_value: 0,
  start_at: '',
  end_at: '',
  category_id: undefined,
  active: true,
}

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyPromotion)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const currentUser = useMemo(() => getUser(), [])
  const canDelete = currentUser?.role === 'OWNER'

  useEffect(() => {
    fetchPromotions()
    fetchCategories()
  }, [])

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/promotions`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load promotions')
      const data = await response.json()
      const mapped: Promotion[] = data.map((promo: any) => ({
        id: promo.id,
        name: promo.name,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value ?? 0),
        start_at: promo.start_at,
        end_at: promo.end_at,
        category_id: promo.category_id,
        category_name: promo.category_name,
        active: promo.active === 1 || promo.active === true,
      }))
      setPromotions(mapped)
    } catch (err) {
      console.error(err)
      setError('Could not load promotions')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/categories`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) return
      const data = await response.json()
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories', err)
    }
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyPromotion)
    setShowModal(true)
    setError(null)
  }

  const startEdit = (promotion: Promotion) => {
    setEditingId(promotion.id)
    setForm({
      name: promotion.name,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_at: promotion.start_at ?? '',
      end_at: promotion.end_at ?? '',
      category_id: promotion.category_id ?? undefined,
      active: promotion.active,
    })
    setError(null)
    setShowModal(true)
  }

  const savePromotion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name || !form.discount_type || !form.discount_value) {
      setError('Please complete all required fields.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        discountType: form.discount_type,
        discountValue: Number(form.discount_value),
        startAt: form.start_at || null,
        endAt: form.end_at || null,
        categoryId: form.category_id || null,
        active: form.active !== false,
      }
      const url = editingId
        ? `${apiUrl}/api/admin/promotions/${editingId}`
        : `${apiUrl}/api/admin/promotions`
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to save promotion')
      }
      setShowModal(false)
      fetchPromotions()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unable to save promotion')
    } finally {
      setSaving(false)
    }
  }

  const togglePromotion = async (promotion: Promotion) => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/promotions/${promotion.id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Toggle failed')
      }
      fetchPromotions()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to toggle promotion')
    }
  }

  const deletePromotion = async (promotion: Promotion) => {
    if (!canDelete) return
    if (!confirm(`Delete promotion "${promotion.name}"?`)) return

    try {
      const response = await fetch(`${apiUrl}/api/admin/promotions/${promotion.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Delete failed')
      }
      fetchPromotions()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to delete promotion')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Promotions</h2>
          <p className="text-sm text-gray-500">Configure discounts by amount, percentage, and category.</p>
        </div>
        <button
          onClick={startCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Promotion
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading promotions…</div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No active promotions yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promotions.map((promotion) => (
                <tr key={promotion.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{promotion.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {promotion.discount_type === 'PERCENT'
                      ? `${promotion.discount_value}%`
                      : `$${promotion.discount_value.toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {promotion.start_at ? new Date(promotion.start_at).toLocaleString() : '—'}
                    {' '}–{' '}
                    {promotion.end_at ? new Date(promotion.end_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {promotion.category_name || 'All categories'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        promotion.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {promotion.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <button
                      onClick={() => startEdit(promotion)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePromotion(promotion)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {promotion.active ? 'Deactivate' : 'Activate'}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deletePromotion(promotion)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingId ? 'Edit Promotion' : 'New Promotion'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <form className="space-y-4" onSubmit={savePromotion}>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value as Promotion['discount_type'] }))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="PERCENT">Percent %</option>
                    <option value="AMOUNT">Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value ?? 0}
                    onChange={(e) => setForm((prev) => ({ ...prev, discount_value: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={form.start_at ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={form.end_at ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={form.category_id ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, category_id: value ? Number(value) : undefined }))
                  }}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="promotion-active"
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                />
                <label htmlFor="promotion-active" className="text-sm text-gray-700">Promotion is active</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded border"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
