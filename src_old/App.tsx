import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import POS from './pages/POS'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminProducts from './pages/AdminProducts'
import AdminSales from './pages/AdminSales'
import AdminCategories from './pages/AdminCategories'
import AdminUsers from './pages/AdminUsers'
import CashierReports from './pages/CashierReports'
import ProtectedRoute from './components/ProtectedRoute'
import AdminSuppliers from './pages/AdminSuppliers'
import AdminPromotions from './pages/AdminPromotions'
import AdminCustomers from './pages/AdminCustomers'
import AdminPurchaseOrders from './pages/AdminPurchaseOrders'

function Navigation() {
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isManagerOrOwner = user.role === 'MANAGER' || user.role === 'OWNER'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/admin/login'
  }

  if (location.pathname === '/admin/login') {
    return null
  }

  return (
    <aside className="w-64 bg-gray-800 text-white shadow-lg flex flex-col">
      <nav className="p-4 flex-1">
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="text-sm text-gray-400">Logged in as</div>
          <div className="font-semibold">{user.name || 'User'}</div>
          <div className="text-xs text-gray-500">{user.role}</div>
        </div>
        <ul className="space-y-2">
          {user.role === 'CASHIER' && (
            <>
              <li>
                <a
                  href="/"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  🛒 Point of Sale
                </a>
              </li>
              <li>
                <a
                  href="/reports/x-report"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/reports/x-report' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  📊 X-Report
                </a>
              </li>
            </>
          )}
          {isManagerOrOwner && (
            <>
              <li>
                <a
                  href="/admin"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  📊 Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/admin/purchase-orders"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/purchase-orders' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  📥 Purchase Orders
                </a>
              </li>
              <li>
                <a
                  href="/admin/products"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/products' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  📦 Products
                </a>
              </li>
              <li>
                <a
                  href="/admin/categories"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/categories' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  🏷️ Categories
                </a>
              </li>
              <li>
                <a
                  href="/admin/suppliers"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/suppliers' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  🤝 Suppliers
                </a>
              </li>
              <li>
                <a
                  href="/admin/promotions"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/promotions' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  🎯 Promotions
                </a>
              </li>
              <li>
                <a
                  href="/admin/customers"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/customers' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  🧑‍🤝‍🧑 Customers
                </a>
              </li>
              <li>
                <a
                  href="/admin/sales"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/sales' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  💰 Sales History
                </a>
              </li>
              <li>
                <a
                  href="/admin/users"
                  className={`block px-4 py-2 rounded transition ${
                    location.pathname === '/admin/users' ? 'bg-blue-700' : 'hover:bg-gray-700'
                  }`}
                >
                  👥 Users
                </a>
              </li>
            </>
          )}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition text-sm"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/*"
          element={
            <div className="min-h-screen bg-gray-100">
              <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white shadow-lg">
                <div className="container mx-auto px-4 py-4">
                  <div className="flex items-center justify-between">
                    <h1 className="app-hero-title text-2xl font-bold tracking-tight">Spirited Wines POS</h1>
                  </div>
                </div>
              </header>
              <div className="flex h-[calc(100vh-73px)]">
                <Navigation />
                <main className="flex-1 overflow-auto">
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute requiredRoles={['CASHIER', 'MANAGER', 'OWNER']} redirectTo="/admin/login">
                          <POS />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/products"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminProducts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/categories"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminCategories />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/purchase-orders"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminPurchaseOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/suppliers"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminSuppliers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/promotions"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminPromotions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/customers"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminCustomers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/sales"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminSales />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <ProtectedRoute requiredRoles={['OWNER', 'MANAGER']}>
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports/x-report"
                      element={
                        <ProtectedRoute requiredRoles={['CASHIER', 'MANAGER', 'OWNER']}>
                          <CashierReports />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </main>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
