import { createClient } from '@/lib/supabase-server'
import GuestHome from '@/components/home/GuestHome'
import RetailerHome from '@/components/home/RetailerHome'
import WholesalerHome from '@/components/home/WholesalerHome'
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

  // Admin Override: Check email before profile lookup
  if (authUser.email === 'rupeshsingh1103@gmail.com') {
    redirect('/admin')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4 p-4 text-center">
        <h1 className="text-xl font-bold text-red-600">Profile Not Found</h1>
        <p className="text-gray-600 max-w-md">
          You are logged in with Email ({authUser.email}), but we couldn't find your profile details.
        </p>
        <div className="flex gap-4 mt-2">
          <form action="/auth/signout" method="post">
            <button className="text-sm text-gray-500 hover:text-gray-900 border px-4 py-2 rounded">Sign Out</button>
          </form>
          <a href="/register?step=2" className="bg-emerald-600 text-white px-6 py-2 rounded shadow hover:bg-emerald-700">
            Complete Profile
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4">Auth ID: {authUser.id}</p>
      </div>
    )
  }

  if (profile.user_type === 'manufacturer') {
    return <WholesalerHome user={profile} />
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
