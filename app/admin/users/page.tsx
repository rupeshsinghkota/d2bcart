'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'
import { CheckCircle, XCircle, Search, Building2, Phone, Mail, FileText, ExternalLink, ShieldCheck, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('pending') // 'pending', 'verified', 'all'
    const [searchQuery, setSearchQuery] = useState('')
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        console.log('Fetching manufacturers...')
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_type', 'manufacturer')
            .order('created_at', { ascending: false })

        console.log('Fetch result:', { data, error })

        if (error) {
            toast.error('Error loading users: ' + error.message)
            return
        }

        if (data) setUsers(data as User[])
        setLoading(false)
    }

    const toggleVerification = async (userId: string, currentStatus: boolean) => {
        setProcessingId(userId)
        const newStatus = !currentStatus

        const { error } = await supabase
            .rpc('toggle_verification', {
                target_user_id: userId,
                new_status: newStatus
            } as any)

        if (error) {
            console.error('Update failed:', error)
            toast.error('Error: ' + error.message)
        } else {
            toast.success(newStatus ? 'User verified successfully' : 'User verification revoked')
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: newStatus } : u))
        }
        setProcessingId(null)
    }

    const filteredUsers = users.filter(user => {
        if (filter === 'pending' && user.is_verified) return false
        if (filter === 'verified' && !user.is_verified) return false

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                user.business_name?.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.phone?.toLowerCase().includes(query)
            )
        }

        return true
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Manufacturer Verification</h1>
                <p className="text-gray-600">Review and approve manufacturer accounts</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    {['pending', 'verified', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users List */}
            <div className="grid gap-6">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl">
                        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-gray-900 font-medium">No users found</h3>
                        <p className="text-gray-500 text-sm">No manufacturers match the current filters</p>
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Building2 className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-gray-900">
                                                    {user.business_name || 'Unnamed Business'}
                                                </h3>
                                                {user.is_verified ? (
                                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Verified
                                                    </span>
                                                ) : (
                                                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                                        Pending Verification
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                    {user.email}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                    {user.phone || 'No phone'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                                    {user.bank_account ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-gray-800">{user.beneficiary_name}</span>
                                                            <span>{user.bank_account} ({user.account_type})</span>
                                                            <span className="font-mono text-xs">{user.ifsc_code}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-red-500">Bank details missing</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 min-w-[200px]">
                                        {user.id_proof_url ? (
                                            <a
                                                href={user.id_proof_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary flex items-center justify-center gap-2 text-sm"
                                            >
                                                <FileText className="w-4 h-4" />
                                                View ID Proof
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <div className="px-4 py-2 border rounded-lg text-center text-sm text-gray-400 bg-gray-50">
                                                No ID Proof Uploaded
                                            </div>
                                        )}

                                        <button
                                            onClick={() => toggleVerification(user.id, user.is_verified)}
                                            disabled={processingId === user.id}
                                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${user.is_verified
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                }`}
                                        >
                                            {processingId === user.id ? (
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : user.is_verified ? (
                                                <>
                                                    <XCircle className="w-4 h-4" />
                                                    Revoke Verification
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    Approve & Verify
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
