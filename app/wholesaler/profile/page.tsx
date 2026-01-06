'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
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
    AlertCircle,
    LogOut,
    ChevronDown,
    ChevronRight,
    Layers,
    User as UserIcon,
    Settings
} from 'lucide-react'
import toast from 'react-hot-toast'

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

interface Category {
    id: string
    name: string
    parent_id?: string | null
    children?: Category[]
}

export default function WholesalerProfile() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'profile' | 'categories'>('profile')

    // Profile State
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

    // Category State
    const [categoryTree, setCategoryTree] = useState<Category[]>([])
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [isLoadingCategories, setIsLoadingCategories] = useState(false)
    const [isSavingCategories, setIsSavingCategories] = useState(false)

    useEffect(() => {
        fetchProfile()
    }, [])

    useEffect(() => {
        if (activeTab === 'categories') {
            fetchCategories()
            fetchSelectedCategories()
        }
    }, [activeTab])

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
            .single() as { data: any, error: any }

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

    const fetchCategories = async () => {
        if (categoryTree.length > 0) return // Already fetched
        setIsLoadingCategories(true)

        // Fetch all categories
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .order('name')

        if (categories) {
            // Build Tree
            const tree = buildCategoryTree(categories)
            setCategoryTree(tree)
        }
        setIsLoadingCategories(false)
    }

    const fetchSelectedCategories = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/wholesaler/categories', {
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        })
        const data = await res.json()
        if (data.categories) {
            setSelectedCategories(data.categories)
        }
    }

    const buildCategoryTree = (flatList: any[]) => {
        const map = new Map()
        const roots: any[] = []

        flatList.forEach(item => {
            map.set(item.id, { ...item, children: [] })
        })

        flatList.forEach(item => {
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id).children.push(map.get(item.id))
            } else {
                roots.push(map.get(item.id))
            }
        })
        return roots
    }

    const handleCategoryToggle = (id: string) => {
        setSelectedCategories(prev => {
            if (prev.includes(id)) {
                return prev.filter(c => c !== id)
            } else {
                return [...prev, id]
            }
        })
    }

    const saveCategories = async () => {
        setIsSavingCategories(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error('Please login first')
                return
            }

            const res = await fetch('/api/wholesaler/categories', {
                method: 'POST',
                body: JSON.stringify({ categories: selectedCategories }),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                }
            })
            if (res.ok) {
                toast.success('Category preferences saved!')
            } else {
                const errorData = await res.json()
                toast.error(errorData.error || 'Failed to save categories')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setIsSavingCategories(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const { error } = await (supabase
                .from('users') as any)
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
                })
                .eq('id', profile.id)

            if (error) throw error

            if (idProofFile) {
                const fileExt = idProofFile.name.split('.').pop()
                const fileName = `${profile.id}/id_proof.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(fileName, idProofFile, { upsert: true })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName)

                await (supabase.from('users') as any).update({ id_proof_url: publicUrl }).eq('id', profile.id)
            }

            toast.success('Profile updated successfully!')
            setMessage({ type: 'success', text: 'Profile updated successfully!' })

        } catch (error: any) {
            console.error('Error updating profile:', error)
            toast.error(error.message || 'Failed to update profile')
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
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
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                            <p className="text-gray-600">Manage your profile and business preferences</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm font-medium">Log Out</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar Tabs */}
                    <div className="w-full md:w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'profile'
                                    ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                                    }`}
                            >
                                <UserIcon className="w-4 h-4" />
                                <span>Profile & Business</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'categories'
                                    ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                                    }`}
                            >
                                <Layers className="w-4 h-4" />
                                <span>Category Settings</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {activeTab === 'profile' && (
                            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 md:p-8 space-y-8">
                                    {/* Existing Profile Form Content */}
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
                                                    className="input w-full px-4 py-2 border rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                                                <input
                                                    type="text"
                                                    value={profile.gst_number}
                                                    onChange={e => setProfile({ ...profile, gst_number: e.target.value })}
                                                    className="input w-full px-4 py-2 border rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                            <Phone className="w-5 h-5 text-emerald-600" />
                                            Contact Details
                                        </h2>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    disabled
                                                    value={profile.email}
                                                    className="input w-full px-4 py-2 border rounded-lg bg-gray-50 cursor-not-allowed"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                                <input
                                                    type="tel"
                                                    required
                                                    value={profile.phone}
                                                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                                    className="input w-full px-4 py-2 border rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                            <MapPin className="w-5 h-5 text-emerald-600" />
                                            Address
                                        </h2>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={profile.address}
                                                onChange={e => setProfile({ ...profile, address: e.target.value })}
                                                className="input w-full px-4 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                                <input required type="text" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                                <input required type="text" value={profile.state} onChange={e => setProfile({ ...profile, state: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                                <input required type="text" value={profile.pincode} onChange={e => setProfile({ ...profile, pincode: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                            <CreditCard className="w-5 h-5 text-emerald-600" />
                                            Bank Details
                                        </h2>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name</label>
                                                <input required type="text" value={profile.beneficiary_name} onChange={e => setProfile({ ...profile, beneficiary_name: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                                <input required type="text" value={profile.bank_account} onChange={e => setProfile({ ...profile, bank_account: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                                <input required type="text" value={profile.ifsc_code} onChange={e => setProfile({ ...profile, ifsc_code: e.target.value })} className="input w-full px-4 py-2 border rounded-lg" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                                            <FileText className="w-5 h-5 text-emerald-600" />
                                            Verification
                                        </h2>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50">
                                            <input type="file" onChange={e => setIdProofFile(e.target.files?.[0] || null)} className="hidden" id="id-upload" />
                                            <label htmlFor="id-upload" className="cursor-pointer block">
                                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                                <p className="text-sm text-gray-600">{idProofFile ? idProofFile.name : "Upload ID Proof"}</p>
                                            </label>
                                        </div>
                                        {profile.id_proof_url && (
                                            <div className="text-sm text-green-600 flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" /> Document Uploaded
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                                    <button type="submit" disabled={saving} className="btn-primary px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                                        {saving ? 'Saving...' : 'Save Details'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'categories' && (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900 mb-6">Category Subscriptions</h3>
                                <p className="text-gray-500 mb-4 text-sm">Select the categories you want to sell in. You will only see these options when adding products.</p>

                                <div className="space-y-2 max-h-[600px] overflow-y-auto border border-gray-100 rounded-md p-4 mb-6">
                                    {isLoadingCategories ? (
                                        <div className="flex justify-center p-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                        </div>
                                    ) : (
                                        <CategoryTree
                                            categories={categoryTree}
                                            selectedIds={selectedCategories}
                                            onToggle={handleCategoryToggle}
                                        />
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={saveCategories}
                                        disabled={isSavingCategories}
                                        className="btn-primary px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {isSavingCategories ? 'Saving...' : 'Save Category Preferences'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function CategoryTree({ categories, selectedIds, onToggle }: { categories: any[], selectedIds: string[], onToggle: (id: string) => void }) {
    return (
        <ul className="pl-2 space-y-1">
            {categories.map(cat => (
                <CategoryNode key={cat.id} category={cat} selectedIds={selectedIds} onToggle={onToggle} />
            ))}
        </ul>
    )
}

function CategoryNode({ category, selectedIds, onToggle }: { category: any, selectedIds: string[], onToggle: (id: string) => void }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasChildren = category.children && category.children.length > 0
    const isSelected = selectedIds.includes(category.id)

    return (
        <li>
            <div className={`flex items-center hover:bg-gray-50 py-1.5 px-2 rounded transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}>
                {hasChildren ? (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 mr-1 text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                ) : <div className="w-6 mr-1" />}

                <label className="flex items-center space-x-3 cursor-pointer flex-1 select-none">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(category.id)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className={`text-sm ${hasChildren ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {category.name}
                    </span>
                </label>
            </div>

            {hasChildren && isExpanded && (
                <div className="ml-2 border-l-2 border-gray-100 pl-2 mt-1">
                    <CategoryTree categories={category.children} selectedIds={selectedIds} onToggle={onToggle} />
                </div>
            )}
        </li>
    )
}
