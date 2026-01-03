'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'

interface Variation {
    id: string
    name: string      // e.g., "Samsung A06"
    sku: string
    price: string
    stock: string
    moq: string
}

interface Attribute {
    id: string
    name: string      // e.g., "Model", "Color", "Size"
    values: string[]  // e.g., ["Samsung A06", "Vivo Y200"]
}

interface VariationManagerProps {
    variations: Variation[]
    onVariationsChange: (variations: Variation[]) => void
    parentName: string
    parentPrice: string
    parentStock: string
    parentMoq: string
}

export default function VariationManager({
    variations,
    onVariationsChange,
    parentName,
    parentPrice,
    parentStock,
    parentMoq
}: VariationManagerProps) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [bulkNames, setBulkNames] = useState('')
    const [attributes, setAttributes] = useState<Attribute[]>([])
    const [newAttrName, setNewAttrName] = useState('')
    const [newAttrValues, setNewAttrValues] = useState('')
    const [activeTab, setActiveTab] = useState<'attributes' | 'manual'>('attributes')
    const [defaultPrice, setDefaultPrice] = useState(parentPrice || '')

    // Get the effective price for new variations
    const effectivePrice = parentPrice || defaultPrice || ''

    // Add a new attribute
    const addAttribute = () => {
        if (!newAttrName.trim()) return
        const values = newAttrValues.split(',').map(v => v.trim()).filter(Boolean)
        if (values.length === 0) return

        const newAttr: Attribute = {
            id: Date.now().toString(),
            name: newAttrName.trim(),
            values
        }
        setAttributes([...attributes, newAttr])
        setNewAttrName('')
        setNewAttrValues('')
    }

    // Remove an attribute
    const removeAttribute = (id: string) => {
        setAttributes(attributes.filter(a => a.id !== id))
    }

    // Add value to attribute
    const addValueToAttribute = (attrId: string, value: string) => {
        if (!value.trim()) return
        setAttributes(attributes.map(a => {
            if (a.id === attrId && !a.values.includes(value.trim())) {
                return { ...a, values: [...a.values, value.trim()] }
            }
            return a
        }))
    }

    // Remove value from attribute
    const removeValueFromAttribute = (attrId: string, value: string) => {
        setAttributes(attributes.map(a => {
            if (a.id === attrId) {
                return { ...a, values: a.values.filter(v => v !== value) }
            }
            return a
        }))
    }

    // Generate all combinations from attributes
    const generateVariationsFromAttributes = () => {
        if (attributes.length === 0) return

        // Get all combinations
        const combinations: string[][] = attributes.reduce((acc: string[][], attr) => {
            if (acc.length === 0) {
                return attr.values.map(v => [v])
            }
            const newAcc: string[][] = []
            acc.forEach(combo => {
                attr.values.forEach(v => {
                    newAcc.push([...combo, v])
                })
            })
            return newAcc
        }, [])

        // Create variations from combinations
        const newVariations: Variation[] = combinations.map(combo => {
            const name = combo.join(' / ')
            return {
                id: Date.now().toString() + Math.random(),
                name,
                sku: `${parentName.substring(0, 15).replace(/\s+/g, '-').toUpperCase()}-${combo.map(c => c.substring(0, 10).replace(/\s+/g, '-').toUpperCase()).join('-')}`,
                price: effectivePrice,
                stock: parentStock || '1000',
                moq: parentMoq || '1'
            }
        })

        onVariationsChange([...variations, ...newVariations])
    }

    const addVariation = () => {
        const newVariation: Variation = {
            id: Date.now().toString(),
            name: '',
            sku: '',
            price: effectivePrice,
            stock: parentStock || '1000',
            moq: parentMoq || '1'
        }
        onVariationsChange([...variations, newVariation])
    }

    const updateVariation = (id: string, field: keyof Variation, value: string) => {
        onVariationsChange(
            variations.map(v => {
                if (v.id === id) {
                    const updated = { ...v, [field]: value }
                    if (field === 'name' && parentName) {
                        updated.sku = `${parentName.substring(0, 20).replace(/\s+/g, '-').toUpperCase()}-${value.replace(/\s+/g, '-').toUpperCase()}`
                    }
                    return updated
                }
                return v
            })
        )
    }

    const removeVariation = (id: string) => {
        onVariationsChange(variations.filter(v => v.id !== id))
    }

    const bulkAddVariations = () => {
        if (!bulkNames.trim()) return
        const names = bulkNames.split('\n').map(n => n.trim()).filter(Boolean)
        const newVariations: Variation[] = names.map(name => ({
            id: Date.now().toString() + Math.random(),
            name,
            sku: `${parentName.substring(0, 20).replace(/\s+/g, '-').toUpperCase()}-${name.replace(/\s+/g, '-').toUpperCase()}`,
            price: effectivePrice,
            stock: parentStock || '1000',
            moq: parentMoq || '1'
        }))
        onVariationsChange([...variations, ...newVariations])
        setBulkNames('')
    }

    const setAllPrices = (price: string) => {
        onVariationsChange(variations.map(v => ({ ...v, price })))
    }

    const setAllStock = (stock: string) => {
        onVariationsChange(variations.map(v => ({ ...v, stock })))
    }

    const setAllMoq = (moq: string) => {
        onVariationsChange(variations.map(v => ({ ...v, moq })))
    }

    const clearAllVariations = () => {
        onVariationsChange([])
    }

    // Calculate total combinations
    const totalCombinations = attributes.length > 0
        ? attributes.reduce((acc, attr) => acc * attr.values.length, 1)
        : 0

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-purple-100">
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 font-bold">{variations.length}</span>
                    </div>
                    <div>
                        <h2 className="font-semibold text-lg">Product Variations</h2>
                        <p className="text-sm text-gray-500">Add different models, sizes, or colors</p>
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>

            {isExpanded && (
                <div className="mt-6 space-y-4">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            type="button"
                            onClick={() => setActiveTab('attributes')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'attributes'
                                ? 'border-purple-600 text-purple-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Sparkles className="w-4 h-4 inline mr-1" />
                            Attributes (Auto-Generate)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'manual'
                                ? 'border-purple-600 text-purple-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Manual Entry
                        </button>
                    </div>

                    {/* Default Price Input - Show when parent price is not set */}
                    {!parentPrice && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <label className="block text-sm font-medium text-amber-800 mb-2">
                                ⚠️ Set Default Price for Variations
                            </label>
                            <div className="flex gap-3 items-center">
                                <span className="text-amber-700">₹</span>
                                <input
                                    type="number"
                                    value={defaultPrice}
                                    onChange={(e) => setDefaultPrice(e.target.value)}
                                    placeholder="Enter base price for all variations"
                                    className="input text-sm flex-1"
                                    min="1"
                                />
                                {variations.length > 0 && defaultPrice && (
                                    <button
                                        type="button"
                                        onClick={() => setAllPrices(defaultPrice)}
                                        className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                                    >
                                        Apply to all
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-amber-600 mt-2">
                                This price will be used for new variations. You can also set the price in the main product form above.
                            </p>
                        </div>
                    )}

                    {activeTab === 'attributes' && (
                        <div className="space-y-4">
                            {/* Add Attribute Section */}
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-purple-800 mb-3">
                                    Add Attribute (like WooCommerce)
                                </label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newAttrName}
                                        onChange={(e) => setNewAttrName(e.target.value)}
                                        placeholder="Attribute name (e.g., Model, Color, Size)"
                                        className="input text-sm flex-1"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newAttrValues}
                                        onChange={(e) => setNewAttrValues(e.target.value)}
                                        placeholder="Values separated by comma (e.g., Samsung A06, Vivo Y200, Redmi 13C)"
                                        className="input text-sm flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={addAttribute}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 whitespace-nowrap"
                                    >
                                        Add Attribute
                                    </button>
                                </div>
                            </div>

                            {/* Existing Attributes */}
                            {attributes.length > 0 && (
                                <div className="space-y-3">
                                    {attributes.map(attr => (
                                        <div key={attr.id} className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-700">{attr.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttribute(attr.id)}
                                                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {attr.values.map(value => (
                                                    <span
                                                        key={value}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm"
                                                    >
                                                        {value}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeValueFromAttribute(attr.id, value)}
                                                            className="text-gray-400 hover:text-red-500"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="+ Add value"
                                                    className="px-3 py-1 border border-dashed border-gray-300 rounded-full text-sm w-24 focus:border-purple-400 focus:outline-none"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            addValueToAttribute(attr.id, (e.target as HTMLInputElement).value)
                                                                ; (e.target as HTMLInputElement).value = ''
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Generate Button */}
                                    <div className="flex items-center justify-between p-4 bg-purple-100 rounded-lg">
                                        <div>
                                            <span className="text-sm text-purple-800">
                                                This will generate <strong>{totalCombinations}</strong> variations
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={generateVariationsFromAttributes}
                                            className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Generate Variations
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <>
                            {/* Bulk Add Section */}
                            <div className="bg-purple-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-purple-800 mb-2">
                                    Quick Add (one per line)
                                </label>
                                <textarea
                                    value={bulkNames}
                                    onChange={(e) => setBulkNames(e.target.value)}
                                    placeholder="Samsung A06&#10;Samsung A05&#10;Vivo Y200&#10;Redmi 13C"
                                    className="input min-h-[80px] text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={bulkAddVariations}
                                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                                >
                                    Add All Variations
                                </button>
                            </div>

                            {/* Add Single Variation */}
                            <button
                                type="button"
                                onClick={addVariation}
                                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-400 hover:text-purple-600 w-full justify-center"
                            >
                                <Plus className="w-4 h-4" />
                                Add Single Variation
                            </button>
                        </>
                    )}

                    {/* Variations List (Always Visible) */}
                    {variations.length > 0 && (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-gray-700">Generated Variations ({variations.length})</h3>
                                <div className="flex gap-3 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setAllPrices(parentPrice)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Set all prices to ₹{parentPrice || '0'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAllStock('1000')}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Set all stock to 1000
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAllMoq(parentMoq || '1')}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Set all MOQ to {parentMoq || '1'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearAllVariations}
                                        className="text-red-500 hover:underline"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {variations.map((variation, index) => (
                                    <div key={variation.id} className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg text-sm">
                                        <span className="text-gray-400 w-6">{index + 1}</span>
                                        <input
                                            type="text"
                                            value={variation.name}
                                            onChange={(e) => updateVariation(variation.id, 'name', e.target.value)}
                                            placeholder="Name"
                                            className="input text-sm flex-1"
                                        />
                                        <input
                                            type="text"
                                            value={variation.sku}
                                            onChange={(e) => updateVariation(variation.id, 'sku', e.target.value)}
                                            placeholder="SKU"
                                            className="input text-sm w-40 font-mono text-xs"
                                        />
                                        <input
                                            type="number"
                                            value={variation.price}
                                            onChange={(e) => updateVariation(variation.id, 'price', e.target.value)}
                                            placeholder="Price"
                                            className="input text-sm w-24"
                                        />
                                        <input
                                            type="number"
                                            value={variation.stock}
                                            onChange={(e) => updateVariation(variation.id, 'stock', e.target.value)}
                                            placeholder="Stock"
                                            className="input text-sm w-20"
                                        />
                                        <input
                                            type="number"
                                            value={variation.moq}
                                            onChange={(e) => updateVariation(variation.id, 'moq', e.target.value)}
                                            placeholder="MOQ"
                                            className="input text-sm w-16"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeVariation(variation.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
