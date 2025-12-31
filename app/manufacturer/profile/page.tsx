'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
    User,
    ArrowLeft,
    Save,
    Building2,
    MapPin,
    Phone,
    Mail,
    FileText,
    CreditCard,
    Upload,
    CheckCircle,
    AlertCircle
} from 'lucide-react'

interface UserProfile {
    id: string
    business_name: string
    email: string
    phone: string
    address: string
    city: string
    state: string
    pincode: string
    gst_number: string
    shiprocket_pickup_code: string | null
    bank_account: string
    ifsc_code: string
    beneficiary_name: string
    account_type: string
    id_proof_url: string
    is_verified: boolean
}

export default function ManufacturerProfile() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [profile, setProfile] = useState<UserProfile>({
        id: '',
        business_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        gst_number: '',
        shiprocket_pickup_code: null,
        bank_account: '',
        ifsc_code: '',
        beneficiary_name: '',
        account_type: 'Savings',
        id_proof_url: '',
        is_verified: false
    })
    const [idProofFile, setIdProofFile] = useState<File | null>(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if (error) {
            console.error('Error fetching profile:', error)
            setMessage({ type: 'error', text: 'Failed to load profile' })
        } else if (data) {
            setProfile({
                id: data.id,
                business_name: data.business_name || '',
                email: data.email || '',
                phone: data.phone || '',
                address: data.address || '',
                city: data.city || '',
                state: data.state || '',
                pincode: data.pincode || '',
                gst_number: data.gst_number || '',
                shiprocket_pickup_code: data.shiprocket_pickup_code,
                bank_account: data.bank_account || '',
                ifsc_code: data.ifsc_code || '',
                beneficiary_name: data.beneficiary_name || '',
                account_type: data.account_type || 'Savings',
                id_proof_url: data.id_proof_url || '',
                is_verified: data.is_verified || false
            })
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    business_name: profile.business_name,
                    phone: profile.phone,
                    address: profile.address,
                    city: profile.city,
                    state: profile.state,
                    pincode: profile.pincode,
                    gst_number: profile.gst_number,
                    bank_account: profile.bank_account,
                    ifsc_code: profile.ifsc_code,
                    beneficiary_name: profile.beneficiary_name,
                    account_type: profile.account_type,
                    // id_proof_url handled below if changed
                })
                .eq('id', profile.id)

            if (error) throw error

            // Handle ID Proof Upload
            if (idProofFile) {
                const fileExt = idProofFile.name.split('.').pop()
                const fileName = `${profile.id}/id_proof.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('documents') // Needs 'documents' bucket
                    .upload(fileName, idProofFile, { upsert: true })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName)

                // Update user with URL
                await supabase.from('users').update({ id_proof_url: publicUrl }).eq('id', profile.id)
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' })

            // If they changed address, we might want to reset pickup code so it regenerates? 
            // For now, let's just keep it simple.

        } catch (error: any) {
            console.error('Error updating profile:', error)
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Business Profile</h1>
                    <p className="text-gray-600">Manage your business details and shipping address</p>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 md:p-8 space-y-8">

                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                <Building2 className="w-5 h-5 text-emerald-600" />
                                Basic Information
                            </h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.business_name}
                                        onChange={e => setProfile({ ...profile, business_name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                                    <input
                                        type="text"
                                        value={profile.gst_number}
                                        onChange={e => setProfile({ ...profile, gst_number: e.target.value })}
                                        placeholder="Optional"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                <Phone className="w-5 h-5 text-emerald-600" />
                                Contact Details
                            </h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            disabled
                                            value={profile.email}
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="tel"
                                            required
                                            value={profile.phone}
                                            onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                <MapPin className="w-5 h-5 text-emerald-600" />
                                Pickup Address
                            </h2>
                            <p className="text-sm text-gray-500">This address will be used as the pickup location for your shipments.</p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={profile.address}
                                    onChange={e => setProfile({ ...profile, address: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.city}
                                        onChange={e => setProfile({ ...profile, city: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.state}
                                        onChange={e => setProfile({ ...profile, state: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        value={profile.pincode}
                                        onChange={e => setProfile({ ...profile, pincode: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                                Bank Details (For Payouts)
                            </h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.beneficiary_name}
                                        onChange={e => setProfile({ ...profile, beneficiary_name: e.target.value })}
                                        placeholder="Name as per bank records"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.bank_account}
                                        onChange={e => setProfile({ ...profile, bank_account: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.ifsc_code}
                                        onChange={e => setProfile({ ...profile, ifsc_code: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                                    <select
                                        value={profile.account_type}
                                        onChange={e => setProfile({ ...profile, account_type: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="Savings">Savings</option>
                                        <option value="Current">Current</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Verification */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                <FileText className="w-5 h-5 text-emerald-600" />
                                Business Verification
                            </h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Upload ID/Business Proof</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={e => setIdProofFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="id-proof-upload"
                                    />
                                    <label htmlFor="id-proof-upload" className="cursor-pointer">
                                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600">
                                            {idProofFile ? idProofFile.name : "Click to upload ID Proof (Image or PDF)"}
                                        </p>
                                    </label>
                                </div>
                                {profile.id_proof_url && !idProofFile && (
                                    <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" />
                                        Document Uploaded
                                        <a href={profile.id_proof_url} target="_blank" className="text-blue-600 underline ml-2">View</a>
                                    </div>
                                )}
                            </div>

                            {profile.is_verified ? (
                                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    <span>Your account is verified. You can receive payouts.</span>
                                </div>
                            ) : (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Verification Pending. please complete your profile and upload ID proof.</span>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="px-6 md:px-8 py-4 bg-gray-50 border-t flex items-center justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
