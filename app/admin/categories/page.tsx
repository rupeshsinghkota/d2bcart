'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Category } from '@/types'
import {
    Plus,
    Edit,
    Trash2,
    Image as ImageIcon,
    ChevronRight,
    Search,
    FolderPlus,
    Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import slugify from 'slugify'
import Image from 'next/image'

export default function AdminCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)

    // Form State
    const [name, setName] = useState('')
    const [markup, setMarkup] = useState(20) // default 20%
    const [imageUrl, setImageUrl] = useState('')
    const [parentId, setParentId] = useState<string>('')

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        if (error) {
            toast.error('Failed to categories')
        } else if (data) {
            setCategories(data as Category[])
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const slug = slugify(name, { lower: true, strict: true })

        const payload = {
            name,
            slug,
            markup_percentage: markup,
            image_url: imageUrl || null,
            parent_id: parentId || null
        }

        let error
        if (editingCategory) {
            const { error: updateError } = await (supabase.from('categories') as any)
                .update(payload)
                .eq('id', editingCategory.id)
            error = updateError
        } else {
            const { error: insertError } = await (supabase.from('categories') as any)
                .insert(payload)
            error = insertError
        }

        if (error) {
            toast.error(error.message)
        } else {
            toast.success(editingCategory ? 'Category updated' : 'Category created')
            setIsModalOpen(false)
            resetForm()
            fetchCategories()
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure? This will fail if products are linked.')) return

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Category deleted')
            fetchCategories()
        }
    }

    const resetForm = () => {
        setEditingCategory(null)
        setName('')
        setMarkup(20)
        setImageUrl('')
        setParentId('')
    }

    const openEdit = (cat: Category) => {
        setEditingCategory(cat)
        setName(cat.name)
        setMarkup(cat.markup_percentage)
        setImageUrl(cat.image_url || '')
        setParentId(cat.parent_id || '')
        setIsModalOpen(true)
    }

    // Recursive function to render category tree
    const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
        const children = categories.filter(c => c.parent_id === parentId)

        if (children.length === 0) return null

        return children.map(cat => (
            <div key={cat.id} className="">
                <div className="flex items-center justify-between p-3 bg-white border-b hover:bg-gray-50 group">
                    <div className="flex items-center gap-3" style={{ paddingLeft: `${depth * 24}px` }}>
                        {depth > 0 && <span className="text-gray-300">└</span>}
                        {cat.image_url ? (
                            <Image src={cat.image_url} alt="" width={32} height={32} className="rounded object-cover bg-gray-100" />
                        ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">IMG</span>
                            </div>
                        )}
                        <div>
                            <div className="font-medium text-gray-900">{cat.name}</div>
                            <div className="text-xs text-gray-400">/{cat.slug} • Margin: +{cat.markup_percentage}%</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => openEdit(cat)}
                            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDelete(cat.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {renderCategoryTree(cat.id, depth + 1)}
            </div>
        ))
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
                    <p className="text-gray-600">Organize products into categories and subcategories</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Category
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 bg-gray-50 border-b font-medium text-gray-500 text-sm grid grid-cols-2">
                    <div>Category Name</div>
                    <div className="text-right pr-12">Actions</div>
                </div>
                {categories.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No categories found.</div>
                ) : renderCategoryTree(null)}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Category Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="input"
                                    placeholder="e.g. Smartphones"
                                />
                            </div>

                            <div>
                                <label className="label">Parent Category</label>
                                <select
                                    value={parentId}
                                    onChange={e => setParentId(e.target.value)}
                                    className="input"
                                >
                                    <option value="">None (Top Level)</option>
                                    {categories
                                        .filter(c => c.id !== editingCategory?.id) // Prevent self-parenting
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Platform Margin %</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={markup}
                                    onChange={e => setMarkup(Number(e.target.value))}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="label">Image URL</label>
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    className="input"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 btn-outline justify-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 btn-primary justify-center"
                                >
                                    {editingCategory ? 'Save Changes' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
