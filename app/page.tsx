import { createClient } from '@/lib/supabase-server'
import GuestHome from '@/components/home/GuestHome'
import RetailerHome from '@/components/home/RetailerHome'
import ManufacturerHome from '@/components/home/ManufacturerHome'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { getMarketplaceData } from './actions/getMarketplaceData'

// export const dynamic = 'force-dynamic'
// export const revalidate = 3600 // Cache homepage for 1 hour

export default async function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}

async function HomeContent() {
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

  if (profile.user_type === 'manufacturer') {
    return <ManufacturerHome user={profile} />
  }

  return <RetailerHome initialCategories={categories} initialProducts={products} user={profile} />
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="animate-pulse">
        <div className="h-48 md:h-64 bg-emerald-800" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div className="h-8 bg-gray-200 w-48 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
