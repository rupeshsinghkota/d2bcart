'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function revalidateData(path: string = '/') {
    revalidatePath(path, 'layout')
    // @ts-ignore
    revalidateTag('marketplace')
    // @ts-ignore
    revalidateTag('shop')
    // @ts-ignore
    revalidateTag('products')
    console.log(`[Cache] Revalidated path: ${path} and all related tags`)
    return { success: true }
}
