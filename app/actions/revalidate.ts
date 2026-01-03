'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateData(path: string = '/') {
    revalidatePath(path, 'layout')
    console.log(`[Cache] Revalidated path: ${path}`)
    return { success: true }
}
