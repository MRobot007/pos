import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string | null
  price: string
  stock: number
  category: {
    id: number
    name: string
  }
}

interface Category {
  id: number
  name: string
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    stock: '',
    categoryId: '',
  })
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<any>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const isOwner = userRole === 'OWNER'

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user')
      if (!userStr) return
      const parsed = JSON.parse(userStr)
      setUserRole(parsed?.role ?? null)
    } catch {
      setUserRole(null)
    }
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/products`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
    setLoading(false)
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/categories`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setFormData({ name: '', sku: '', barcode: '', price: '', stock: '', categoryId: '' })
    setShowModal(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      price: product.price,
      stock: product.stock.toString(),
      categoryId: product.category.id.toString(),
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`${apiUrl}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        fetchProducts()
      } else {
        alert('Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error deleting product')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingProduct
        ? `${apiUrl}/api/admin/products/${editingProduct.id}`
        : `${apiUrl}/api/admin/products`
      const method = editingProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        fetchProducts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save product')
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Error saving product')
    }
  }

  const updateStock = async (id: number, newStock: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/products/${id}/stock`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ stock: newStock }),
      })
      if (response.ok) {
        fetchProducts()
      }
    } catch (error) {
      console.error('Error updating stock:', error)
    }
  }

  const handleDeleteAll = async () => {
    if (!isOwner) return
    if (!confirm('This will permanently remove every product. Continue?')) return
    setBulkDeleting(true)
    try {
      const response = await fetch(`${apiUrl}/api/admin/products`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        alert(result.error || 'Failed to delete all products')
        return
      }
      fetchProducts()
    } catch (error) {
      console.error('Error deleting all products:', error)
      alert('Error deleting all products')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvUploading(true)
    setCsvResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('token')
      const response = await fetch(`${apiUrl}/api/csv/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const result = await response.json()
      setCsvResult(result)
      
      if (response.ok) {
        fetchProducts()
        setTimeout(() => setCsvResult(null), 10000)
      }
    } catch (error) {
      console.error('Error uploading CSV:', error)
      setCsvResult({ errors: ['Failed to upload CSV file'] })
    } finally {
      setCsvUploading(false)
      e.target.value = '' // Reset input
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold">Product Management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 cursor-pointer inline-block">
            {csvUploading ? 'Uploading...' : '📤 Upload CSV'}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
              disabled={csvUploading}
            />
          </label>
          <a
            href={`${apiUrl}/api/csv/products`}
            download
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-block"
            onClick={(e) => {
              const token = localStorage.getItem('token')
              if (token) {
                fetch(`${apiUrl}/api/csv/products`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(res => res.blob())
                  .then(blob => {
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'products.csv'
                    a.click()
                    window.URL.revokeObjectURL(url)
                  })
                e.preventDefault()
              }
            }}
          >
            📥 Export CSV
          </a>
          {isOwner && (
            <button
              onClick={handleDeleteAll}
              disabled={bulkDeleting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDeleting ? 'Deleting…' : '🗑️ Delete All'}
            </button>
          )}
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Add Product
          </button>
        </div>
      </div>

      {csvResult && (
        <div className={`mb-4 p-4 rounded-lg ${
          csvResult.errors && csvResult.errors.length > 0
            ? 'bg-yellow-100 border border-yellow-400 text-yellow-800'
            : 'bg-green-100 border border-green-400 text-green-800'
        }`}>
          <div className="font-semibold mb-2">
            CSV Import: {csvResult.imported || 0} imported, {csvResult.updated || 0} updated
          </div>
          {csvResult.errors && csvResult.errors.length > 0 && (
            <div className="text-sm mt-2">
              <strong>Errors:</strong>
              <ul className="list-disc list-inside">
                {csvResult.errors.slice(0, 5).map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No products found. Add one or upload via CSV.</div>
      ) : (
        <>
          <div className="md:hidden space-y-4">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-gray-400">#{product.id}</div>
                    <div className="font-semibold text-lg leading-tight">{product.name}</div>
                    <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                    {product.barcode && (
                      <div className="text-xs font-mono text-gray-400">Barcode: {product.barcode}</div>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    {product.category?.name ?? 'Unassigned'}
                  </span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 uppercase text-xs">Price</div>
                    <div className="font-semibold">${Number(product.price || 0).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-gray-500 uppercase text-xs">Stock</div>
                      <span className={product.stock <= 10 ? 'text-orange-600 font-semibold' : ''}>{product.stock}</span>
                    </div>
                    <input
                      type="number"
                      defaultValue={product.stock}
                      className="w-20 px-2 py-1 border rounded text-sm"
                      onBlur={(e) => {
                        const newStock = parseInt(e.target.value)
                        if (!isNaN(newStock) && newStock !== product.stock) {
                          updateStock(product.id, newStock)
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-4 text-sm">
                  <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="bg-white rounded-lg shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{product.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{product.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.barcode || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">${Number(product.price ?? 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={product.stock <= 10 ? 'text-orange-600 font-semibold' : ''}>
                              {product.stock}
                            </span>
                            <input
                              type="number"
                              defaultValue={product.stock}
                              className="w-20 px-2 py-1 border rounded text-sm"
                              onBlur={(e) => {
                                const newStock = parseInt(e.target.value)
                                if (!isNaN(newStock) && newStock !== product.stock) {
                                  updateStock(product.id, newStock)
                                }
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Create Product'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  required
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

