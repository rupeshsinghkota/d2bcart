'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight,
  Factory,
  Store,
  TrendingUp,
  Shield,
  Truck,
  Percent,
  Users,
  Package
} from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Fetch profile needed for role
        const { data: profile } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', session.user.id)
          .single() as { data: { user_type: string } | null, error: any }

        if (profile) {
          if (session.user.email === 'rupeshsingh1103@gmail.com' || profile.user_type === 'admin') {
            router.push('/admin')
          } else if (profile.user_type === 'manufacturer') {
            router.push('/manufacturer')
          } else {
            router.push('/products')
          }
          return // Stop execution to prevent flashing content
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-white" /> // Prevent flash of content
  }
  const features = [
    {
      icon: Factory,
      title: 'Direct from Manufacturers',
      description: 'Connect with verified manufacturers and importers directly'
    },
    {
      icon: Percent,
      title: 'Wholesale Prices',
      description: 'Get the best prices without middlemen markup'
    },
    {
      icon: Shield,
      title: 'Secure Payments',
      description: 'Safe transactions with payment protection'
    },
    {
      icon: Truck,
      title: 'Direct Delivery',
      description: 'Products shipped directly from manufacturer to you'
    }
  ]

  const stats = [
    { value: '500+', label: 'Manufacturers' },
    { value: '10K+', label: 'Products' },
    { value: '50K+', label: 'Orders' },
    { value: '₹10Cr+', label: 'Trade Volume' }
  ]

  const categories = [
    { name: 'Electronics', slug: 'electronics', icon: '📱' },
    { name: 'Fashion', slug: 'fashion', icon: '👕' },
    { name: 'FMCG', slug: 'fmcg', icon: '🛒' },
    { name: 'Hardware', slug: 'hardware', icon: '🔧' },
    { name: 'Stationery', slug: 'stationery', icon: '📝' },
    { name: 'Home & Kitchen', slug: 'home-kitchen', icon: '🏠' }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Direct to Business
              <span className="block text-emerald-200">Skip the Middleman</span>
            </h1>
            <p className="text-lg md:text-xl text-emerald-100 mb-8 max-w-xl">
              Connect with verified manufacturers & importers. Get wholesale prices delivered directly to your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register?type=retailer"
                className="bg-white text-emerald-700 px-8 py-4 rounded-lg font-semibold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
              >
                <Store className="w-5 h-5" />
                I'm a Retailer
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/register?type=manufacturer"
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Factory className="w-5 h-5" />
                I'm a Manufacturer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-12 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                  {stat.value}
                </div>
                <div className="text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose D2BCart?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We make B2B trade simple, transparent, and profitable for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Popular Categories
            </h2>
            <p className="text-gray-600">
              Explore products across multiple industries
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                className="bg-gray-50 hover:bg-emerald-50 p-6 rounded-xl text-center transition-colors group"
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <div className="font-medium text-gray-900 group-hover:text-emerald-600">
                  {category.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-xl mb-2">Browse Products</h3>
              <p className="text-gray-600">
                Explore thousands of products from verified manufacturers
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-xl mb-2">Place Order</h3>
              <p className="text-gray-600">
                Order in bulk at wholesale prices with secure payments
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-xl mb-2">Direct Delivery</h3>
              <p className="text-gray-600">
                Get products delivered directly from the manufacturer
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-emerald-100 mb-8 text-lg">
            Join thousands of businesses saving money with direct trade
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-emerald-700 px-8 py-4 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/products"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">D2B</span>
                </div>
                <span className="font-bold text-xl text-white">D2BCart</span>
              </div>
              <p className="text-sm">
                Direct to Business marketplace connecting manufacturers with retailers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">For Retailers</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/products" className="hover:text-white">Browse Products</Link></li>
                <li><Link href="/register?type=retailer" className="hover:text-white">Register</Link></li>
                <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">For Manufacturers</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/register?type=manufacturer" className="hover:text-white">Sell on D2BCart</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/support" className="hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>support@d2bcart.com</li>
                <li>+91 XXXXX XXXXX</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            © 2024 D2BCart. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
