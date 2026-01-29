'use client'

import { RotateCcw } from 'lucide-react'
import { AdminResourceTemplate } from '@/components/AdminResourceTemplate'

export default function RefundsPage() {
    return (
        <AdminResourceTemplate
            title="Reversal Logs"
            description="Audit trail of all processed refunds and stock restorations."
            icon={RotateCcw}
            resourceName="Refunds"
            apiPath="/admin/refunds"
            columns={[
                { label: 'Refund ID', key: 'id' },
                { label: 'Receipt No.', key: 'receipt_number' },
                { label: 'Agent', key: 'processed_by_name' },
                { label: 'Justification', key: 'reason' },
                { label: 'Timestamp', key: 'created_at' }
            ]}
            fields={[]} // Typically read-only or handled via a specialized flow
        />
    )
}
