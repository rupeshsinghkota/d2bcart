import { createClient } from '@/lib/supabase-server'
import GuestHome from '@/components/home/GuestHome'
import RetailerHome from '@/components/home/RetailerHome'
import ManufacturerHome from '@/components/home/ManufacturerHome'
import { redirect } from 'next/navigation'
import { getMarketplaceData } from './actions/getMarketplaceData'

export const revalidate = 3600 // Cache homepage for 1 hour

export default async function Home() {
  const supabase = await createClient()

  // Get Auth User
  const { data: { user: authUser } } = await supabase.auth.getUser()

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
    return <GuestHome initialCategories={categories} initialProducts={products} />
  }

  if (profile.email === 'rupeshsingh1103@gmail.com') {
    redirect('/admin')
  }

  if (profile.user_type === 'manufacturer') {
    return <ManufacturerHome user={profile} />
  }

  if (profile.user_type === 'retailer') {
    return <RetailerHome initialCategories={categories} initialProducts={products} />
  }

  return <GuestHome initialCategories={categories} initialProducts={products} />
}
