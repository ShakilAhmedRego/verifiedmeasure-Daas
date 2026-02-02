'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Shield, Upload, Users, Database, LogOut, Coins, Home } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
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
        .single()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setUser(session.user)
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

    setLeads(leadsData.data || [])
    setUsers(usersData.data || [])
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
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
        
        const newLeads = []
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const lead = {
            lead_id: values[headers.indexOf('lead_id')] || `LEAD-${Date.now()}-${i}`,
            company_name: values[headers.indexOf('company_name')] || values[headers.indexOf('company')] || '',
            contact_name: values[headers.indexOf('contact_name')] || values[headers.indexOf('contact')] || '',
            email: values[headers.indexOf('email')] || '',
            phone: values[headers.indexOf('phone')] || '',
            industry: values[headers.indexOf('industry')] || '',
            location: values[headers.indexOf('location')] || '',
            company_size: values[headers.indexOf('company_size')] || values[headers.indexOf('size')] || '',
            revenue_range: values[headers.indexOf('revenue_range')] || values[headers.indexOf('revenue')] || '',
            capital_need: values[headers.indexOf('capital_need')] || values[headers.indexOf('capital')] || '',
            status: 'available'
          }
          
          if (lead.company_name) {
            newLeads.push(lead)
          }
        }
        
        if (newLeads.length === 0) {
          showNotification('No valid leads found in CSV', 'error')
          return
        }

        const { error } = await supabase.from('leads').insert(newLeads)
        if (error) throw error
        
        await fetchData()
        showNotification(`Successfully imported ${newLeads.length} leads!`, 'success')
      } catch (error: any) {
        console.error('CSV upload error:', error)
        showNotification(`Error: ${error.message || 'Check CSV format'}`, 'error')
      }
    }
    reader.readAsText(file)
    if (e.target) e.target.value = ''
  }

  const grantCredits = async (userId: string, amount: number) => {
    const user = users.find(u => u.id === userId)
    if (!user) return
    
    const newCredits = (user.credits || 0) + amount

    const { error } = await supabase
      .from('user_profiles')
      .update({ credits: newCredits })
      .eq('id', userId)

    if (!error) {
      await fetchData()
      showNotification(`Granted ${amount} credits successfully!`, 'success')
    } else {
      showNotification('Error granting credits', 'error')
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

  const activeUsers = users.filter(u => u.role === 'client').length
  const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0)

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

      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
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
            <div className="flex gap-3">
              <button 
                onClick={() => router.push('/dashboard')} 
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center gap-2"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </button>
              <button 
                onClick={handleLogout} 
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
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
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{activeUsers}</p>
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
                <p className="text-4xl font-bold text-gray-900 mt-1">{totalCredits}</p>
              </div>
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center">
                <Coins className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 border">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Lead Management</h2>
              <p className="text-sm text-gray-600 mt-1">CSV should have: lead_id, company_name, contact_name, email, phone, industry, location, company_size, revenue_range, capital_need</p>
            </div>
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
                  {['Lead ID', 'Company', 'Contact', 'Industry', 'Location', 'Capital Need', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No leads yet. Upload a CSV to get started!
                    </td>
                  </tr>
                ) : (
                  leads.slice(0, 20).map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{lead.lead_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lead.company_name}</div>
                        <div className="text-xs text-gray-500">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{lead.contact_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-xl bg-blue-100 text-blue-800">{lead.industry}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{lead.location}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">{lead.capital_need}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-xl ${
                          lead.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {leads.length > 20 && (
              <div className="px-4 py-3 text-sm text-gray-500 bg-gray-50">
                Showing 20 of {leads.length} leads
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 border">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Email', 'Role', 'Credits', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No users yet
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs rounded-xl font-semibold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-blue-600">{u.credits || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'client' && (
                          <button
                            onClick={() => {
                              const credits = prompt('Enter credits to grant:')
                              if (credits && !isNaN(Number(credits))) {
                                grantCredits(u.id, parseInt(credits))
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-semibold"
                          >
                            Grant Credits
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
          <p>© 2026 VerifiedMeasure | Contact: <a href="mailto:quality@verifiedmeasure.com" className="text-blue-600">quality@verifiedmeasure.com</a></p>
        </div>
      </div>
    </div>
  )
}
