'use client'

import { Handshake } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'

export default function SuppliersPage() {
    return (
        <AdminResourceTemplate
            title="Strategic Partners"
            description="Manage your product suppliers and procurement contacts."
            icon={Handshake}
            resourceName="Suppliers"
            apiPath="/admin/suppliers"
            showBulkDelete={true}
            columns={[
                { label: 'Entity Name', key: 'name' },
                { label: 'Contact Person', key: 'contactName' },
                { label: 'Email', key: 'email' },
                { label: 'Phone', key: 'phone' }
            ]}
            fields={[
                { label: 'Entity Name', key: 'name', type: 'text', required: true },
                { label: 'Contact Person', key: 'contactName', type: 'text' },
                { label: 'Email Address', key: 'email', type: 'email' },
                { label: 'Mobile Number', key: 'phone', type: 'text' },
                { label: 'Business Address', key: 'address', type: 'textarea' },
                { label: 'Contractual Terms', key: 'terms', type: 'textarea' }
            ]}
        />
    )
}
