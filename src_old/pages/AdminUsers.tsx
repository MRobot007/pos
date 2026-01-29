import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

interface User {
  id: number
  email: string
  name: string
  role: string
  active: boolean
  createdAt: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    active: true,
  })

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/users`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching users:', error)
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: 'CASHIER', active: true })
    setShowModal(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      active: user.active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        // Update
        const response = await fetch(`${apiUrl}/api/auth/users/${editingUser.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            active: formData.active,
          }),
        })
        if (response.ok) {
          setShowModal(false)
          fetchUsers()
        } else {
          const error = await response.json()
          alert(error.error || 'Failed to update user')
        }
      } else {
        // Create
        const response = await fetch(`${apiUrl}/api/auth/register`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData),
        })
        if (response.ok) {
          setShowModal(false)
          fetchUsers()
        } else {
          const error = await response.json()
          alert(error.error || 'Failed to create user')
        }
      }
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Error saving user')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">User Management</h2>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading users...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        user.role === 'OWNER'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'MANAGER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setResetPasswordUserId(user.id)
                          setNewPassword('')
                          setShowResetPasswordModal(true)
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => {
                          setUserToDelete(user)
                          setShowDeleteModal(true)
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingUser ? 'Edit User' : 'Create User'}
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
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 border rounded disabled:bg-gray-100"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              {editingUser && (
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="mr-2"
                    />
                    Active
                  </label>
                </div>
              )}
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

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Reset User Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="w-full px-3 py-2 border rounded"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <button
                  onClick={async () => {
                    if (!newPassword || newPassword.length < 6) {
                      alert('Password must be at least 6 characters')
                      return
                    }
                    try {
                      const response = await fetch(`${apiUrl}/api/auth/users/${resetPasswordUserId}/reset-password`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ newPassword }),
                      })
                      if (response.ok) {
                        alert('Password reset successfully!')
                        setShowResetPasswordModal(false)
                        setResetPasswordUserId(null)
                        setNewPassword('')
                      } else {
                        const error = await response.json()
                        alert(error.error || 'Failed to reset password')
                      }
                    } catch (error) {
                      console.error('Error resetting password:', error)
                      alert('Error resetting password')
                    }
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Reset Password
                </button>
                <button
                  onClick={() => {
                    setShowResetPasswordModal(false)
                    setResetPasswordUserId(null)
                    setNewPassword('')
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-red-600">Delete User</h3>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete user <strong>{userToDelete.name}</strong> ({userToDelete.email})?
              </p>
              <p className="text-sm text-red-600 font-semibold">
                ⚠️ This action cannot be undone!
              </p>
              <div className="flex space-x-2 pt-4">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${apiUrl}/api/auth/users/${userToDelete.id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                      })
                      if (response.ok) {
                        alert('User deleted successfully!')
                        setShowDeleteModal(false)
                        setUserToDelete(null)
                        fetchUsers()
                      } else {
                        const error = await response.json()
                        alert(error.error || 'Failed to delete user')
                      }
                    } catch (error) {
                      console.error('Error deleting user:', error)
                      alert('Error deleting user')
                    }
                  }}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Delete User
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setUserToDelete(null)
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

