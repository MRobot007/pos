'use client'

import { useState, useEffect } from 'react'
import { ShoppingBag } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'
import { API_URL } from '@/lib/api-config'

export default function PurchaseOrdersPage() {
    const [suppliers, setSuppliers] = useState<{ label: string, value: string }[]>([])
    const apiUrl = API_URL

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await fetch(`${apiUrl}/admin/suppliers`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
                if (!res.ok) {
                    console.error('Failed to fetch suppliers:', res.status, res.statusText);
                    return;
                }
                const data = await res.json()
                if (Array.isArray(data)) {
                    const mapped = data.map((s: any) => ({ label: s.name, value: s.id.toString() }));
                    setSuppliers(mapped)
                } else {
                    console.error('Suppliers data is not an array:', data);
                }
            } catch (err) {
                console.error(err)
            }
        }
        fetchSuppliers()
    }, [apiUrl])

    return (
        <AdminResourceTemplate
            title="Procurement Orders"
            description="Track and manage stock replenishment requests."
            icon={ShoppingBag}
            resourceName="Purchase Orders"
            apiPath="/admin/purchase-orders"
            columns={[
                { label: 'Order ID', key: 'id' },
                { label: 'Supplier', key: 'supplier_name' },
                { label: 'Status', key: 'status' },
                { label: 'Created By', key: 'created_by_name' }
            ]}
            fields={[
                {
                    label: 'Supplier Entity',
                    key: 'supplier_id',
                    type: 'select',
                    options: suppliers,
                    required: true
                },
                {
                    label: 'Workflow Status',
                    key: 'status',
                    type: 'select',
                    options: [
                        { label: 'Draft / Planning', value: 'DRAFT' },
                        { label: 'Ordered / Sent', value: 'ORDERED' },
                        { label: 'Received / Fulfilled', value: 'RECEIVED' },
                        { label: 'Cancelled / Void', value: 'CANCELLED' }
                    ],
                    required: true
                },
                { label: 'Order Notes', key: 'notes', type: 'textarea' }
            ]}
        />
    )
}
