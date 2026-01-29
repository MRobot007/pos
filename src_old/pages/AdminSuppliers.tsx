import { useEffect, useMemo, useState } from 'react'
import { getAuthHeaders, getUser } from '../utils/auth'

type Supplier = {
  id: number
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  terms?: string | null
  created_at?: string
}

const emptyForm: Omit<Supplier, 'id'> = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  terms: '',
  created_at: undefined,
}

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const currentUser = useMemo(() => getUser(), [])
  const canDelete = currentUser?.role === 'OWNER'

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/admin/suppliers`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch suppliers')
      const data = await response.json()
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers', err)
      setError('Unable to load suppliers right now.')
    } finally {
      setLoading(false)
    }
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  const startEdit = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      terms: supplier.terms ?? '',
      created_at: supplier.created_at,
    })
    setError(null)
    setShowModal(true)
  }

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Supplier name is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contact_name?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        address: form.address?.trim() || undefined,
        terms: form.terms?.trim() || undefined,
      }

      const url = editingId
        ? `${apiUrl}/api/admin/suppliers/${editingId}`
        : `${apiUrl}/api/admin/suppliers`
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Failed to save supplier')
      }

      setShowModal(false)
      setEditingId(null)
      setForm(emptyForm)
      fetchSuppliers()
    } catch (err: any) {
      console.error('Save supplier error', err)
      setError(err.message || 'Failed to save supplier.')
    } finally {
      setSaving(false)
    }
  }

  const deleteSupplier = async (supplier: Supplier) => {
    if (!canDelete) return
    if (!confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return

    try {
      const response = await fetch(`${apiUrl}/api/admin/suppliers/${supplier.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Delete failed')
      }
      fetchSuppliers()
    } catch (err: any) {
      console.error('Delete supplier error', err)
      alert(err.message || 'Failed to delete supplier')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Suppliers</h2>
          <p className="text-sm text-gray-500">Manage vendors, contracts, and contact information.</p>
        </div>
        <button
          onClick={startCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Supplier
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No suppliers yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terms</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{supplier.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.contact_name || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.phone || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{supplier.email || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {supplier.terms ? supplier.terms.slice(0, 60) + (supplier.terms.length > 60 ? '…' : '') : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <button
                      onClick={() => startEdit(supplier)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteSupplier(supplier)}
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
              <h3 className="text-xl font-bold">{editingId ? 'Edit Supplier' : 'Create Supplier'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <form className="space-y-4" onSubmit={saveSupplier}>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={form.contact_name ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea
                  value={form.address ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <textarea
                  value={form.terms ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
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
                  {saving ? 'Saving…' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
