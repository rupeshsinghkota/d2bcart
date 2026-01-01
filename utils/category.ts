export const CATEGORY_IMAGES: Record<string, string> = {
    'electronics': '/category-images/electronics.png',
    'appliances': '/category-images/appliances.png',
    'fashion': '/category-images/fashion.png',
    'footwear': '/category-images/footwear.png',
    'grocery': '/category-images/grocery.png',
    'beauty': '/category-images/beauty.png',
    'personal care': '/category-images/beauty.png',
    'home': '/category-images/home.png',
    'kitchen': '/category-images/kitchen.png',
    'industrial': '/category-images/industrial.png',
    'office': '/category-images/industrial.png',
    'toys': '/category-images/toys.png',
    'baby': '/category-images/toys.png',
    'sports': '/category-images/sports.png',
    'automotive': '/category-images/automotive.png',
    'car': '/category-images/automotive.png',
    'hardware': '/category-images/hardware.png',
}

export function getCategoryImage(name: string): string | null {
    const lowerName = name?.toLowerCase() || ''

    // Explicit priority checks
    if (lowerName.includes('industrial') || lowerName.includes('office') || lowerName.includes('stationery')) return CATEGORY_IMAGES['industrial']

    if (lowerName.includes('shoe') || lowerName.includes('footwear') || lowerName.includes('sandal')) return CATEGORY_IMAGES['footwear']
    if (lowerName.includes('fashion') || lowerName.includes('clothing') || lowerName.includes('wear')) return CATEGORY_IMAGES['fashion']

    if (lowerName.includes('beauty') || lowerName.includes('personal') || lowerName.includes('hair') || lowerName.includes('skin')) return CATEGORY_IMAGES['beauty']
    if (lowerName.includes('grocery') || lowerName.includes('fmcg') || lowerName.includes('food')) return CATEGORY_IMAGES['grocery']

    if (lowerName.includes('toy') || lowerName.includes('baby') || lowerName.includes('game')) return CATEGORY_IMAGES['toys']
    if (lowerName.includes('sport') || lowerName.includes('gym') || lowerName.includes('fitness')) return CATEGORY_IMAGES['sports']
    if (lowerName.includes('auto') || lowerName.includes('car') || lowerName.includes('bike')) return CATEGORY_IMAGES['automotive']

    // Hardware & Tools
    if (lowerName.includes('hardware') || lowerName.includes('tool') || lowerName.includes('drill') || lowerName.includes('construction')) return CATEGORY_IMAGES['hardware']

    // Electronics & Appliances split
    if (lowerName.includes('wash') || lowerName.includes('fridge') || lowerName.includes('conditioner') || lowerName.includes('appliance')) return CATEGORY_IMAGES['appliances']
    if (lowerName.includes('kitchen') || lowerName.includes('cook') || lowerName.includes('mixer')) return CATEGORY_IMAGES['kitchen']
    if (lowerName.includes('electronics') || lowerName.includes('mobile') || lowerName.includes('gadget')) return CATEGORY_IMAGES['electronics']

    if (lowerName.includes('home') || lowerName.includes('decor')) return CATEGORY_IMAGES['home']

    return null
}
