'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

interface UpdateUserParams {
    userId: string
    business_name: string
    address: string
    city: string
    state: string
    pincode: string
    gst_number: string
}

export async function updateManufacturerDetails(params: UpdateUserParams) {
    try {
        console.log('Admin updating user:', params.userId)

        const { error } = await supabaseAdmin
            .from('users')
            .update({
                business_name: params.business_name,
                address: params.address,
                city: params.city,
                state: params.state,
                pincode: params.pincode,
                gst_number: params.gst_number
            })
            .eq('id', params.userId)

        if (error) {
            console.error('Error updating user (admin):', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error: any) {
        console.error('Server Action Error (updateManufacturerDetails):', error)
        return { success: false, error: error.message }
    }
}
