import { Category } from '@/types'

// Get full path from Root -> Current
export const getAncestors = (categoryId: string, allCategories: Category[]): Category[] => {
    const ancestors: Category[] = []
    let current = allCategories.find(c => c.id === categoryId)

    while (current) {
        ancestors.unshift(current)
        if (current.parent_id) {
            current = allCategories.find(c => c.id === current?.parent_id)
        } else {
            current = undefined
        }
    }

    return ancestors
}

// Get immediate children of a category
export const getChildren = (parentId: string | null, allCategories: Category[]): Category[] => {
    return allCategories.filter(c => c.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name))
}

// Get siblings of a category (children of its parent)
export const getSiblings = (categoryId: string, allCategories: Category[]): Category[] => {
    const current = allCategories.find(c => c.id === categoryId)
    if (!current) return []
    return getChildren(current.parent_id, allCategories)
}

// Get the root category for a given category ID
export const getRootCategory = (categoryId: string, allCategories: Category[]): Category | undefined => {
    const ancestors = getAncestors(categoryId, allCategories)
    return ancestors[0]
}
