'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'
import { CheckCircle, XCircle, Search, Building2, Phone, Mail, FileText, ExternalLink, ShieldCheck, CreditCard, Edit, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateManufacturerDetails } from '@/app/actions/adminActions'

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

    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        business_name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        gst_number: ''
    })

    const handleEditClick = (user: User) => {
        setEditingUser(user)
        setFormData({
            business_name: user.business_name || '',
            address: user.address || '',
            city: user.city || '',
            state: user.state || '',
            pincode: user.pincode || '',
            gst_number: user.gst_number || ''
        })
        setIsEditModalOpen(true)
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        setProcessingId(editingUser.id)

        try {
            const result = await updateManufacturerDetails({
                userId: editingUser.id,
                business_name: formData.business_name,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                pincode: formData.pincode,
                gst_number: formData.gst_number
            })

            if (!result.success) throw new Error(result.error)

            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData } : u))
            toast.success('Manufacturer details updated')
            setIsEditModalOpen(false)
        } catch (error: any) {
            console.error('Update failed:', error)
            toast.error('Error updating user: ' + error.message)
        } finally {
            setProcessingId(null)
        }
    }

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
                                                <div className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                                    <span className="max-w-xs block">
                                                        {[user.address, user.city, user.state, user.pincode].filter(Boolean).join(', ') || 'No address provided'}
                                                    </span>
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
                                            onClick={() => handleEditClick(user)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                            Edit Details
                                        </button>

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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900">Edit Manufacturer Details</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Name</label>
                                <input
                                    type="text"
                                    value={formData.business_name}
                                    onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Address</label>
                                <textarea
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">City</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">State</label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pincode</label>
                                    <input
                                        type="text"
                                        value={formData.pincode}
                                        onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GST Number</label>
                                    <input
                                        type="text"
                                        value={formData.gst_number}
                                        onChange={e => setFormData({ ...formData, gst_number: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-100">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                disabled={!!processingId}
                                className="px-6 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {processingId ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
