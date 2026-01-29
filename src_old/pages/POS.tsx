import { useEffect, useState, useRef } from 'react'
import { getAuthHeaders } from '../utils/auth'

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string | null
  brand?: string | null
  isAlcohol?: boolean
  mrp?: string | null
  bottleSize?: string | null
  price: string
  stock: number
  category: {
    id: number
    name: string
  }
}

interface CartItem {
  productId: number
  product: Product
  quantity: number
}

interface CashRegister {
  id: number
  openingCash: string
  currentCash?: number
  status: string
}

export default function POS() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')
  const [splitPayments, setSplitPayments] = useState<{ cash: number; card: number }>({ cash: 0, card: 0 })
  const [cashReceived, setCashReceived] = useState<string>('')
  const [showAgeVerification, setShowAgeVerification] = useState(false)
  const [ageVerified, setAgeVerified] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [holdNotes, setHoldNotes] = useState('')
  const cashInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    checkRegisterStatus()
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/health`)
        const data = await response.json()
        setHealthStatus(data.status === 'ok' ? '✅ Connected' : '❌ Error')
      } catch (error) {
        setHealthStatus('❌ Disconnected')
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [apiUrl])

  useEffect(() => {
    fetchProducts()
  }, [apiUrl])

  useEffect(() => {
    // Auto-focus barcode input for scanning
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  const checkRegisterStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/register/current`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setCashRegister(data)
      } else {
        setCashRegister(null)
        setShowRegisterModal(true)
      }
    } catch (error) {
      console.error('Error checking register:', error)
    }
  }

  const openRegister = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/register/open`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ openingCash: parseFloat(openingCash) || 0 }),
      })
      if (response.ok) {
        const data = await response.json()
        setCashRegister(data)
        setShowRegisterModal(false)
        setOpeningCash('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to open register')
      }
    } catch (error) {
      console.error('Error opening register:', error)
      alert('Failed to open cash register')
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/products`)
      const data = await response.json()
      setProducts(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching products:', error)
      setLoading(false)
    }
  }

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode || barcode.length < 3) return

    try {
      const response = await fetch(`${apiUrl}/api/products/barcode/${barcode}`, {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const product = await response.json()
        addToCart(product)
        setBarcodeInput('')
      } else {
        // Try finding by SKU if barcode doesn't match
        const product = products.find(p => p.sku === barcode || p.barcode === barcode)
        if (product) {
          addToCart(product)
          setBarcodeInput('')
        } else {
          alert('Product not found')
        }
      }
    } catch (error) {
      console.error('Error scanning barcode:', error)
    }
  }

  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBarcodeInput(value)
    
    // Auto-process when Enter is pressed or barcode is complete (usually 13 digits)
    if (value.length >= 12 || value.includes('\n')) {
      handleBarcodeScan(value.trim())
    }
  }

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Product is out of stock')
      return
    }

    const existingItem = cart.find(item => item.productId === product.id)
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Cannot add more items. Insufficient stock.')
        return
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { productId: product.id, product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId: number) => {
    const item = cart.find(item => item.productId === productId)
    if (item && item.quantity > 1) {
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ))
    } else {
      setCart(cart.filter(item => item.productId !== productId))
    }
  }

  const clearCart = () => {
    setCart([])
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      return sum + (parseFloat(item.product.price) * item.quantity)
    }, 0)
  }

  const calculateTax = (subtotal: number) => {
    return subtotal * 0.0825
  }

  const checkForAlcohol = () => {
    return cart.some(item => item.product.isAlcohol)
  }

  const handleHoldBill = async () => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/pos/bills/hold`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          notes: holdNotes,
        }),
      })

      if (response.ok) {
        alert('Bill held successfully')
        clearCart()
        setShowHoldModal(false)
        setHoldNotes('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to hold bill')
      }
    } catch (error) {
      console.error('Error holding bill:', error)
      alert('Failed to hold bill')
    }
  }

  const handleCheckout = async () => {
    if (!cashRegister) {
      alert('Please open cash register first')
      return
    }

    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    // Check for alcohol and age verification
    const hasAlcohol = checkForAlcohol()
    if (hasAlcohol && !ageVerified) {
      setShowAgeVerification(true)
      return
    }

    // Validate cash payment
    if (paymentMethod === 'cash') {
      const total = subtotal + tax
      const cashAmt = parseFloat(cashReceived) || 0
      if (cashAmt < total) {
        alert(`Cash received ($${cashAmt.toFixed(2)}) is less than total ($${total.toFixed(2)}). Please enter correct amount.`)
        if (cashInputRef.current) {
          cashInputRef.current.focus()
        }
        return
      }
    }

    // Validate split payments
    if (paymentMethod === 'split') {
      const total = subtotal + tax
      const splitTotal = splitPayments.cash + splitPayments.card
      if (Math.abs(splitTotal - total) > 0.01) {
        alert(`Split payment total ($${splitTotal.toFixed(2)}) must equal sale total ($${total.toFixed(2)})`)
        return
      }
    }

    setCheckoutLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/sales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: paymentMethod,
          registerId: cashRegister.id,
          ageVerified: hasAlcohol ? ageVerified : false,
          splitPayments: paymentMethod === 'split' ? splitPayments : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Checkout failed: ${error.error || 'Unknown error'}`)
        return
      }

      const sale = await response.json()
      alert(`✅ Sale completed!\nReceipt: ${sale.receiptNumber}\nTotal: $${parseFloat(sale.total).toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}`)
      
      clearCart()
      setPaymentMethod('cash')
      setAgeVerified(false)
      setSplitPayments({ cash: 0, card: 0 })
      
      // Refresh products and register status
      fetchProducts()
      checkRegisterStatus()
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Checkout failed. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const subtotal = calculateSubtotal()
  const tax = calculateTax(subtotal)
  const total = subtotal + tax

  // Don't show POS if register is not open
  if (!cashRegister && !showRegisterModal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-xl font-semibold mb-4">Cash Register Not Open</div>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Open Cash Register
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Cash Register Status */}
      {cashRegister && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-600">Cash Register Status</div>
              <div className="font-semibold text-green-700">OPEN</div>
              <div className="text-sm text-gray-600">
                Opening Cash: ${parseFloat(cashRegister.openingCash).toFixed(2)} | 
                Current Cash: ${cashRegister.currentCash?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Register ID: #{cashRegister.id}
            </div>
          </div>
        </div>
      )}

      {/* Search and Barcode Scanner */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🔍 Product Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={async (e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                try {
                  const response = await fetch(`${apiUrl}/api/pos/products/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: getAuthHeaders(),
                  })
                  if (response.ok) {
                    const results = await response.json()
                    if (results.length > 0) {
                      addToCart(results[0])
                      setSearchQuery('')
                    }
                  }
                } catch (error) {
                  console.error('Search error:', error)
                }
              }
            }}
            placeholder="Search by name, brand, SKU..."
            className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📷 Barcode Scanner
          </label>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={handleBarcodeInputChange}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && barcodeInput.trim()) {
                e.preventDefault()
                handleBarcodeScan(barcodeInput.trim())
              }
            }}
            placeholder="Scan barcode..."
            className="w-full px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 text-lg"
          />
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Point of Sale</h2>
        <div className="text-sm text-gray-600">
          Backend: <span className="font-mono">{healthStatus}</span>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Available Products</h3>
            {loading ? (
              <div className="text-center py-8">Loading products...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                      product.stock === 0 ? 'opacity-50 border-gray-300' : 'border-gray-200'
                    }`}
                    onClick={() => addToCart(product)}
                  >
                    <div className="font-semibold text-lg">{product.name}</div>
                    <div className="text-sm text-gray-600 mb-1">{product.category.name}</div>
                    <div className="text-xs text-gray-500 mb-2">
                      SKU: {product.sku} {product.barcode && `| Barcode: ${product.barcode}`}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">Stock: {product.stock} units</div>
                    <div className="text-xl font-bold text-blue-600 mb-3">
                      ${parseFloat(product.price).toFixed(2)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addToCart(product)
                      }}
                      disabled={product.stock === 0}
                      className={`w-full px-4 py-2 rounded transition ${
                        product.stock === 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="w-96 bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Shopping Cart</h3>
          
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Your cart is empty</div>
          ) : (
            <>
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{item.product.name}</div>
                        <div className="text-xs text-gray-600">
                          ${parseFloat(item.product.price).toFixed(2)} each
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-red-600 hover:text-red-800 text-lg font-bold ml-2"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Qty:</span>
                        <span className="font-semibold">{item.quantity}</span>
                      </div>
                      <div className="font-semibold">
                        ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (8.25%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    onClick={() => {
                      setPaymentMethod('cash')
                      setSplitPayments({ cash: 0, card: 0 })
                      setCashReceived(total.toFixed(2))
                      // Focus cash input after a brief delay to allow state update
                      setTimeout(() => {
                        if (cashInputRef.current) {
                          cashInputRef.current.focus()
                          cashInputRef.current.select()
                        }
                      }, 100)
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      paymentMethod === 'cash'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('card')
                      setSplitPayments({ cash: 0, card: 0 })
                      setCashReceived('')
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      paymentMethod === 'card'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    💳 Card
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('split')
                      setCashReceived('')
                      setSplitPayments({ cash: total / 2, card: total / 2 })
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      paymentMethod === 'split'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🔀 Split
                  </button>
                </div>
                {paymentMethod === 'split' && (
                  <div className="space-y-2 bg-purple-50 p-3 rounded">
                    <div>
                      <label className="text-xs text-gray-600">Cash Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitPayments.cash}
                        onChange={(e) => {
                          const cash = parseFloat(e.target.value) || 0
                          setSplitPayments({ cash, card: total - cash })
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Card Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitPayments.card}
                        onChange={(e) => {
                          const card = parseFloat(e.target.value) || 0
                          setSplitPayments({ cash: total - card, card })
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Total: ${(splitPayments.cash + splitPayments.card).toFixed(2)}
                      {(Math.abs(splitPayments.cash + splitPayments.card - total) > 0.01) && (
                        <span className="text-red-600 ml-2">⚠️ Amount mismatch</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cash Received Input - Show only when cash payment selected */}
              {paymentMethod === 'cash' && (
                <div className="mb-4 bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💵 Cash Received
                  </label>
                  <input
                    ref={cashInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const cashAmt = parseFloat(cashReceived) || 0
                        if (cashAmt >= total) {
                          handleCheckout()
                        } else {
                          alert(`Cash received ($${cashAmt.toFixed(2)}) is less than total ($${total.toFixed(2)})`)
                          cashInputRef.current?.focus()
                        }
                      }
                    }}
                    placeholder={`Enter cash amount (Total: $${total.toFixed(2)})`}
                    className="w-full px-4 py-3 text-2xl font-bold border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center"
                    autoFocus
                  />
                  {cashReceived && parseFloat(cashReceived) > 0 && (
                    <div className="mt-3 text-center">
                      <div className="text-sm text-gray-600 mb-1">Total: ${total.toFixed(2)}</div>
                      {parseFloat(cashReceived) >= total ? (
                        <div className="text-2xl font-bold text-green-600">
                          Change: ${(parseFloat(cashReceived) - total).toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-lg font-semibold text-red-600">
                          ⚠️ Need ${(total - parseFloat(cashReceived)).toFixed(2)} more
                        </div>
                      )}
                    </div>
                  )}
                  {/* Quick amount buttons */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[10, 20, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => {
                          const currentCash = parseFloat(cashReceived) || 0
                          setCashReceived((currentCash + amt).toFixed(2))
                        }}
                        className="px-2 py-1 bg-green-200 hover:bg-green-300 rounded text-sm font-semibold transition"
                      >
                        +${amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hold Bill Button */}
              <button
                onClick={() => setShowHoldModal(true)}
                className="w-full bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition mb-2"
              >
                📌 Hold Bill
              </button>

              <div className="space-y-2">
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < total))}
                  className={`w-full ${
                    paymentMethod === 'cash' ? 'bg-green-600 hover:bg-green-700' : paymentMethod === 'card' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                  } text-white px-4 py-3 rounded-lg font-semibold transition ${
                    checkoutLoading || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < total)) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {checkoutLoading
                    ? 'Processing...'
                    : paymentMethod === 'cash'
                    ? (cashReceived && parseFloat(cashReceived) >= total 
                        ? `💰 Complete Sale - Give $${(parseFloat(cashReceived) - total).toFixed(2)} Change`
                        : '💰 Enter Cash Amount')
                    : paymentMethod === 'card'
                    ? '💳 Complete Sale (Card)'
                    : '🔀 Complete Sale (Split)'}
                </button>
                <button
                  onClick={clearCart}
                  className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Clear Cart
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Open Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Open Cash Register</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Opening Cash Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border rounded-lg text-lg"
                  autoFocus
                />
              </div>
              <div className="flex space-x-2 pt-4">
                <button
                  onClick={openRegister}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Open Register
                </button>
                <button
                  onClick={() => {
                    setShowRegisterModal(false)
                    setOpeningCash('')
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Age Verification Modal */}
      {showAgeVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔞</div>
              <h3 className="text-2xl font-bold text-red-600 mb-2">Age Verification Required</h3>
              <p className="text-gray-600">
                This sale contains alcohol products. Please verify the customer is 21 years or older.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm text-gray-700">
                  By proceeding, you confirm that you have verified the customer's age and they are legally allowed to purchase alcohol.
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setAgeVerified(true)
                    setShowAgeVerification(false)
                    handleCheckout()
                  }}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
                >
                  ✓ Verified - Continue
                </button>
                <button
                  onClick={() => {
                    setShowAgeVerification(false)
                  }}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700"
                >
                  ✗ Cancel Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hold Bill Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Hold Bill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <textarea
                  value={holdNotes}
                  onChange={(e) => setHoldNotes(e.target.value)}
                  placeholder="Customer name, reason for hold, etc."
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">Items to hold: {cart.length}</div>
                <div className="text-sm font-semibold">Total: ${total.toFixed(2)}</div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleHoldBill}
                  className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                >
                  Hold Bill
                </button>
                <button
                  onClick={() => {
                    setShowHoldModal(false)
                    setHoldNotes('')
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
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
