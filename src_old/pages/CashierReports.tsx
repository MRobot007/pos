import { useEffect, useState } from 'react'
import { getAuthHeaders } from '../utils/auth'

export default function CashierReports() {
  const [xReport, setXReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [register, setRegister] = useState<any>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchRegister()
    fetchXReport()
  }, [])

  const fetchRegister = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/register/current`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setRegister(data)
      }
    } catch (error) {
      console.error('Error fetching register:', error)
    }
  }

  const fetchXReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/reports/x-report`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setXReport(data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching X-report:', error)
      setLoading(false)
    }
  }

  if (!register) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-xl font-semibold mb-4">No Open Cash Register</div>
          <p className="text-gray-600">Please open a cash register to view reports</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">X-Report (Live Shift Summary)</h2>
        <button
          onClick={fetchXReport}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Refresh Report
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading report...</div>
      ) : xReport ? (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Sales</div>
              <div className="text-2xl font-bold text-blue-600">{xReport.totalSales}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                ${xReport.totalRevenue.toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-gray-600">Cash Sales</div>
              <div className="text-2xl font-bold text-purple-600">
                ${xReport.totalCash.toFixed(2)}
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="text-sm text-gray-600">Card Sales</div>
              <div className="text-2xl font-bold text-indigo-600">
                ${xReport.totalCard.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Cash Drawer */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Cash Drawer</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Opening Cash</div>
                <div className="text-xl font-bold">${xReport.openingCash.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Cash Sales</div>
                <div className="text-xl font-bold">${xReport.totalCash.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Current Cash</div>
                <div className="text-xl font-bold text-green-600">
                  ${xReport.currentCash.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(xReport.categoryBreakdown || {}).map(([category, data]: any) => (
                    <tr key={category}>
                      <td className="px-4 py-3 text-sm font-medium">{category}</td>
                      <td className="px-4 py-3 text-sm">{data.quantity}</td>
                      <td className="px-4 py-3 text-sm">${data.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Report Info */}
          <div className="border-t pt-4 text-sm text-gray-500">
            <div>Register ID: #{xReport.registerId}</div>
            <div>Opened: {new Date(xReport.openedAt).toLocaleString()}</div>
            <div>Report Generated: {new Date(xReport.reportGeneratedAt).toLocaleString()}</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">No report data available</div>
      )}
    </div>
  )
}


