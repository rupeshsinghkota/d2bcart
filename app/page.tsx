import { createClient } from '@/lib/supabase-server'
import GuestHome from '@/components/home/GuestHome'
import RetailerHome from '@/components/home/RetailerHome'
import ManufacturerHome from '@/components/home/ManufacturerHome'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getMarketplaceData } from './actions/getMarketplaceData'

// export const revalidate = 3600 // Cache homepage for 1 hour -> Removed to allow Auth checks

export default async function Home() {
  const supabase = await createClient()

  // Get Auth User
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    console.log('[Home] Auth User found:', authUser.email)
  }


  // Pre-fetch marketplace data (Cached in Server Action)
  const { categories, products } = await getMarketplaceData()

  if (!authUser) {
    return <GuestHome initialCategories={categories} initialProducts={products} />
  }

  // Get Profile data
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    console.error('[Home] User authenticated but profile not found in "users" table. ID:', authUser.id)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <h1 className="text-xl font-bold text-red-600">Profile Not Found</h1>
        <p className="text-gray-600">You are logged in, but your user profile is missing.</p>
        <p className="text-xs text-gray-400">ID: {authUser.id}</p>
      </div>
    )
  }

  if (profile.email === 'rupeshsingh1103@gmail.com') {
    redirect('/admin')
  }

  console.log('[Home] User Profile Type:', profile.user_type)

  if (profile.user_type === 'manufacturer') {
    return <ManufacturerHome user={profile} />
  }

  // Default to Retailer Home for 'retailer' or any other authenticated role (fallback)
  // This prevents logged-in users from seeing Guest Home
  return <RetailerHome initialCategories={categories} initialProducts={products} user={profile} />
}
