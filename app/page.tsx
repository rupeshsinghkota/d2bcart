'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import GuestHome from '@/components/home/GuestHome'
import RetailerHome from '@/components/home/RetailerHome'
import ManufacturerHome from '@/components/home/ManufacturerHome'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!user) return <GuestHome />

  if (user.email === 'rupeshsingh1103@gmail.com') {
    router.push('/admin')
    return null
  }

  if (user.user_type === 'manufacturer') return <ManufacturerHome user={user} />
  if (user.user_type === 'retailer') return <RetailerHome />

  return <GuestHome />
}
