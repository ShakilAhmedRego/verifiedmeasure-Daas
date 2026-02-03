'use client'
import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Shield, Upload, Users, Database, LogOut, Coins } from 'lucide-react'

const supabase = getSupabase()

interface Lead {
  id: string
  lead_id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  industry: string
  location: string
  company_size: string
  revenue_range: string
  capital_need: string
  status: string
}

interface UserProfile {
  id: string
  email: string
  name: string
  company: string
  credits: number
  role: string
  status: string
}

export default function AdminPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{message: string, type: string} | null>(null)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single() as { data: { role: string } | null }

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      await fetchData()
    } catch (error) {
      console.error('Error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    const [leadsData, usersData] = await Promise.all([
      supabase.from('leads').select('*').order('created_date', { ascending: false }),
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
    ])

    setLeads((leadsData.data as Lead[]) || [])
    setUsers((usersData.data as UserProfile[]) || [])
  }

  const showNotification = (message: string, type: string) => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/"/g, ''))

        const newLeads: Record<string, string>[] = []
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue

          const values = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''))
          const lead: Record<string, string> = {
            lead_id: `LEAD-${Date.now()}-${i}`,
            company_name: values[headers.indexOf('company_name')] || values[headers.indexOf('company')] || '',
            contact_name: values[headers.indexOf('contact_name')] || values[headers.indexOf('contact')] || '',
            email: values[headers.indexOf('email')] || '',
            phone: values[headers.indexOf('phone')] || '',
            industry: values[headers.indexOf('industry')] || '',
            location: values[headers.indexOf('location')] || '',
            company_size: values[headers.indexOf('company_size')] || values[headers.indexOf('company size')] || '',
            revenue_range: values[headers.indexOf('revenue_range')] || values[headers.indexOf('revenue')] || '',
            capital_need: values[headers.indexOf('capital_need')] || values[headers.indexOf('capital need')] || ''
          }
          newLeads.push(lead)
        }

        const { error } = await (supabase.from('leads') as any).insert(newLeads)
        if (error) throw error

        await fetchData()
        showNotification(`Successfully imported ${newLeads.length} leads!`, 'success')
      } catch (error) {
        console.error('CSV upload error:', error)
        showNotification('Error importing CSV. Please check format.', 'error')
      }
    }
    reader.readAsText(file)
    if (e.target) e.target.value = ''
  }

  const grantCredits = async (userId: string, currentCredits: number) => {
    const creditsInput = prompt('Enter credits to grant:')
    if (!creditsInput || isNaN(Number(creditsInput))) return

    const amount = parseInt(creditsInput)
    const newCredits = currentCredits + amount

    const { error } = await (supabase.from('user_profiles') as any)
      .update({ credits: newCredits })
      .eq('id', userId)

    if (!error) {
      await (supabase.from('credit_transactions') as any).insert({
        user_id: userId,
        amount: amount,
        type: 'grant',
        description: `Admin granted ${amount} credits`
      })

      await fetchData()
      showNotification(`Granted ${amount} credits successfully!`, 'success')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl text-white font-medium ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

      <div className="vm-gradient text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-blue-100">VerifiedMeasure Platform Management</p>
              </div>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Leads</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{leads.length}</p>
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Database className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Users</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">
                  {users.filter(u => u.role === 'client' && u.status === 'active').length}
                </p>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Credits Issued</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">
                  {users.reduce((sum, u) => sum + (u.credits || 0), 0)}
                </p>
              </div>
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center">
                <Coins className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 border">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Lead Management</h2>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 flex items-center gap-2 font-semibold shadow-lg"
            >
              <Upload className="w-5 h-5" />
              Upload CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Company', 'Contact', 'Industry', 'Location', 'Capital Need', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.slice(0, 10).map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{lead.company_name}</div>
                      <div className="text-xs text-gray-500">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{lead.contact_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-xl bg-blue-100 text-blue-800">{lea
