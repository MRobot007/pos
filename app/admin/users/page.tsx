'use client'

import { Users } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'
import { API_URL } from '@/lib/api-config'

export default function UsersPage() {
    const apiUrl = API_URL
    
    return (
        <AdminResourceTemplate
            title="Operational Team"
            description="Manage staff accounts and access privileges."
            icon={Users}
            resourceName="Team Members"
            apiPath="/admin/users"
            showBulkDelete={true}
            columns={[
                { label: 'Staff Identity', key: 'name' },
                { label: 'Access Level', key: 'role' },
                { label: 'Email Address', key: 'email' },
                { label: 'Status', key: 'active', align: 'center' }
            ]}
            renderActions={(item) => (
                <button
                    onClick={async (e) => {
                        e.stopPropagation()
                        const newPassword = prompt(`Enter new secure identifier for ${item.name}:`)
                        if (!newPassword || newPassword.length < 6) {
                            alert("Operational Security Breach: Password too short.")
                            return
                        }
                        if (!apiUrl) throw new Error('API URL not defined')
                        const token = localStorage.getItem('token')
                        if (!token) return

                        try {
                            const res = await fetch(`${apiUrl}/auth/users/${item.id}/reset-password`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ newPassword }),
                                credentials: 'include',
                                cache: 'no-store'
                            })
                            if (res.ok) alert("Security Credentials Successfully Rotated.")
                            else alert("Protocol Failure: Unable to reset identifier.")
                        } catch (err) {
                            console.error(err)
                        }
                    }}
                    className="w-9 h-9 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center justify-center text-amber-600 hover:text-amber-800 transition-all font-black"
                    title="Rotate Security Identifier"
                >
                    <span className="text-[9px] font-black">SEC</span>
                </button>
            )}
            fields={[
                { label: 'Full Name', key: 'name', type: 'text', required: true },
                { label: 'Email Address', key: 'email', type: 'email', required: true },
                { label: 'Initial Access Protocol (Password)', key: 'password', type: 'password', required: true },
                {
                    label: 'Access Authority Level',
                    key: 'role',
                    type: 'select',
                    options: [
                        { label: 'Super Admin / Owner', value: 'OWNER' },
                        { label: 'Executive Manager', value: 'MANAGER' },
                        { label: 'Station Operator', value: 'CASHIER' }
                    ],
                    required: true
                },
                { label: 'Account Activation Status', key: 'active', type: 'checkbox' }
            ]}
        />
    )
}
