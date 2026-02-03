'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, AlertCircle } from 'lucide-react'

const supabase = getSupabase()

interface UserProfile {
  role: string
  status: string
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single() as { data: UserProfile | null }
      
      if (profile) {
        router.push(profile.role === 'admin' ? '/admin' : '/dashboard')
      }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single() as { data: UserProfile | null }

      if (profile && profile.status === 'suspended') {
        await supabase.auth.signOut()
        setError('Account suspended. Please contact QA@verifiedmeasure.com')
        setLoading(false)
        return
      }

      if (profile) {
        router.push(profile.role === 'admin' ? '/admin' : '/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen vm-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
      
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">VerifiedMeasure</h1>
          <p className="text-blue-100">Verified Capital Raise Leads</p>
        </div>

        <div className="glass-card rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="your@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/signup"
              className="text-blue-600 hover:text-blue-700 font-medium transition"
            >
              Don't have an account? Sign up
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>Need help? Contact us:</p>
            <a 
              href="mailto:QA@verifiedmeasure.com" 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              QA@verifiedmeasure.com
            </a>
          </div>
        </div>

        <p className="text-center text-blue-100 text-sm mt-8">
          © 2026 VerifiedMeasure. All rights reserved.
        </p>
      </div>
    </div>
  )
}
