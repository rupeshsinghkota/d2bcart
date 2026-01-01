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
    // Subcategory Specific Images
    'smartphones': '/category-images/smartphones.png',
    'headphones': '/category-images/audio-headphones.png',
    'laptops': '/category-images/laptops.png',
    'mens_shirts': '/category-images/mens-shirts.png',
    'sarees': '/category-images/sarees.png',
    'sports_shoes': '/category-images/sports-shoes.png',
    'smart_tvs': '/category-images/smart-tvs.png',
    'mens_jeans': '/category-images/mens-jeans.png',
}

export function getCategoryImage(name: string): string | null {
    const lowerName = name?.toLowerCase() || ''

    // Specific Subcategory Overrides (High Priority)
    if (lowerName.includes('smartphone')) return CATEGORY_IMAGES['smartphones']
    if (lowerName.includes('headphone') || lowerName.includes('earbud') || lowerName.includes('audio')) return CATEGORY_IMAGES['headphones']
    if (lowerName.includes('laptop')) return CATEGORY_IMAGES['laptops']
    if (lowerName.includes('saree')) return CATEGORY_IMAGES['sarees']
    if (lowerName.includes('television') || (lowerName.includes('tv') && !lowerName.includes('stand'))) return CATEGORY_IMAGES['smart_tvs']
    if (lowerName.includes('jean') || lowerName.includes('denim')) return CATEGORY_IMAGES['mens_jeans']
    // Match "Shirt" but avoid "T-Shirt" if possible, though strict checking helps
    if (lowerName.includes('shirt') && !lowerName.includes('t-shirt') && !lowerName.includes('tshirt') && !lowerName.includes('sweat')) return CATEGORY_IMAGES['mens_shirts']

    // Industrial & Office
    if (lowerName.includes('industrial') || lowerName.includes('office') || lowerName.includes('stationery') || lowerName.includes('packaging') || lowerName.includes('safety') || lowerName.includes('security')) return CATEGORY_IMAGES['industrial']

    // Footwear (Generic backup, but try specific first)
    if (lowerName.includes('shoe') || lowerName.includes('footwear') || lowerName.includes('sandal') || lowerName.includes('slipper') || lowerName.includes('boot') || lowerName.includes('sneaker')) return CATEGORY_IMAGES['sports_shoes']

    // Fashion & Lifestyle
    if (lowerName.includes('fashion') || lowerName.includes('clothing') || lowerName.includes('wear') || lowerName.includes('top') || lowerName.includes('kurti') || lowerName.includes('lehenga') || lowerName.includes('bag') || lowerName.includes('luggage') || lowerName.includes('lingerie') || lowerName.includes('night') || lowerName.includes('t-shirt') || lowerName.includes('tshirt')) return CATEGORY_IMAGES['fashion']

    // Beauty & Personal Care
    if (lowerName.includes('beauty') || lowerName.includes('personal') || lowerName.includes('hair') || lowerName.includes('skin') || lowerName.includes('face') || lowerName.includes('makeup') || lowerName.includes('oral') || lowerName.includes('soap') || lowerName.includes('shampoo')) return CATEGORY_IMAGES['beauty']

    // Grocery & FMCG
    if (lowerName.includes('grocery') || lowerName.includes('fmcg') || lowerName.includes('food') || lowerName.includes('rice') || lowerName.includes('dal') || lowerName.includes('pulse') || lowerName.includes('flour') || lowerName.includes('oil') || lowerName.includes('snack') || lowerName.includes('biscuit') || lowerName.includes('cookie') || lowerName.includes('beverage') || lowerName.includes('tea') || lowerName.includes('coffee') || lowerName.includes('chocolate') || lowerName.includes('clean') || lowerName.includes('detergent') || lowerName.includes('wash')) return CATEGORY_IMAGES['grocery']

    // Toys & Baby
    if (lowerName.includes('toy') || lowerName.includes('baby') || lowerName.includes('game') || lowerName.includes('kid') || lowerName.includes('infant')) return CATEGORY_IMAGES['toys']

    // Sports & Fitness
    if (lowerName.includes('sport') || lowerName.includes('gym') || lowerName.includes('fitness') || lowerName.includes('cycle') || lowerName.includes('cricket') || lowerName.includes('badminton')) return CATEGORY_IMAGES['sports']

    // Automotive
    if (lowerName.includes('auto') || lowerName.includes('car') || lowerName.includes('bike') || lowerName.includes('vehicle') || lowerName.includes('helmet') || lowerName.includes('tyre')) return CATEGORY_IMAGES['automotive']

    // Hardware & Tools
    if (lowerName.includes('hardware') || lowerName.includes('tool') || lowerName.includes('drill') || lowerName.includes('construction') || lowerName.includes('paint') || lowerName.includes('plumb') || lowerName.includes('electric')) return CATEGORY_IMAGES['hardware']

    // Appliances (Large)
    if (lowerName.includes('fridge') || lowerName.includes('refrigerator') || lowerName.includes('conditioner') || lowerName.includes('ac') || lowerName.includes('washing') || lowerName.includes('cooler')) return CATEGORY_IMAGES['appliances']

    // Kitchen (Small Appliances & Cookware)
    if (lowerName.includes('kitchen') || lowerName.includes('cook') || lowerName.includes('mixer') || lowerName.includes('grinder') || lowerName.includes('oven') || lowerName.includes('pan') || lowerName.includes('pot') || lowerName.includes('flask') || lowerName.includes('bottle')) return CATEGORY_IMAGES['kitchen']

    // Electronics (Mobiles & IT)
    if (lowerName.includes('electronics') || lowerName.includes('mobile') || lowerName.includes('phone') || lowerName.includes('gadget') || lowerName.includes('computer') || lowerName.includes('accessories') || lowerName.includes('charger') || lowerName.includes('cable') || lowerName.includes('power') || lowerName.includes('printer') || lowerName.includes('camera') || lowerName.includes('watch') || lowerName.includes('smart')) return CATEGORY_IMAGES['electronics']

    // Home Decor
    if (lowerName.includes('home') || lowerName.includes('decor') || lowerName.includes('furnish') || lowerName.includes('sheet') || lowerName.includes('curtain') || lowerName.includes('towel') || lowerName.includes('light') || lowerName.includes('lamp')) return CATEGORY_IMAGES['home']

    // Default Fallback
    return null
}
