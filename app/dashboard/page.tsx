'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { exportToCSV } from '@/lib/csv'
import { useRouter } from 'next/navigation'
import { Shield, Download, Search, Filter, LogOut, Coins, Database, CheckCircle, History, X } from 'lucide-react'

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

interface DownloadRecord {
  id: string
  user_id: string
  lead_id: string
  downloaded_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{message: string, type: string} | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: UserProfile | null }

      if (profileData && profileData.role === 'admin') {
        router.push('/admin')
        return
      }

      setUser(session.user)
      setProfile(profileData)
      await fetchLeads()
      await fetchDownloadHistory(session.user.id)
    } catch (error) {
      console.error('Error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'available')
      .order('created_date', { ascending: false })
    
    setLeads((data as Lead[]) || [])
  }

  const fetchDownloadHistory = async (userId: string) => {
    const { data } = await supabase
      .from('download_history')
      .select('*')
      .eq('user_id', userId)
      .order('downloaded_at', { ascending: false })
    
    setDownloadHistory((data as DownloadRecord[]) || [])
  }

  const showNotification = (message: string, type: string) => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const industries = ['all', ...new Set(leads.map(l => l.industry).filter(Boolean))]
  const locations = ['all', ...new Set(leads.map(l => l.location).filter(Boolean))]

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesIndustry = filterIndustry === 'all' || lead.industry === filterIndustry
    const matchesLocation = filterLocation === 'all' || lead.location === filterLocation
    
    return matchesSearch && matchesIndustry && matchesLocation
  })

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    )
  }

  const handleSelectAll = () => {
    setSelectedLeads(
      selectedLeads.length === filteredLeads.length ? [] : filteredLeads.map(l => l.id)
    )
  }

  const handleDownload = async () => {
    if (selectedLeads.length === 0) {
      showNotification('Please select at least one lead', 'warning')
      return
    }

    const alreadyDownloaded = selectedLeads.filter(leadId =>
      downloadHistory.some((h: DownloadRecord) => h.lead_id === leadId)
    )
    const newDownloads = selectedLeads.filter(leadId => !alreadyDownloaded.includes(leadId))
    const creditsNeeded = newDownloads.length

    if (creditsNeeded > 0 && (profile?.credits || 0) < creditsNeeded) {
      showNotification(`Insufficient credits. You need ${creditsNeeded} but have ${profile?.credits || 0}`, 'error')
      return
    }

    try {
      const leadsToDownload = leads.filter(l => selectedLeads.includes(l.id))
      
      exportToCSV(
        leadsToDownload.map(lead => ({
          'Company Name': lead.company_name,
          'Contact Name': lead.contact_name,
          'Email': lead.email,
          'Phone': lead.phone,
          'Industry': lead.industry,
          'Location': lead.location,
          'Company Size': lead.company_size,
          'Revenue Range': lead.revenue_range,
          'Capital Need': lead.capital_need
        })),
        `verifiedmeasure_leads_${new Date().toISOString().split('T')[0]}.csv`
      )

      if (newDownloads.length > 0) {
        await supabase
          .from('user_profiles')
          .update({ credits: (profile?.credits || 0) - creditsNeeded })
          .eq('id', user.id)

        for (const leadId of newDownloads) {
          await supabase.from('download_history').insert({ user_id: user.id, lead_id: leadId })
        }

        await supabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: -creditsNeeded,
          type: 'deduct',
          description: `Downloaded ${creditsNeeded} leads`
        })
      }

      await checkUser()
      setSelectedLeads([])
      
      showNotification(
        alreadyDownloaded.length > 0
          ? `Downloaded ${selectedLeads.length} leads! (${alreadyDownloaded.length} were free re-downloads)`
          : `Downloaded ${selectedLeads.length} leads successfully!`,
        'success'
      )
    } catch (error) {
      console.error('Download error:', error)
      showNotification('Download failed. Please try again.', 'error')
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-green-500' :
            notification.type === 'error' ? 'bg-red-500' : 'bg-yellow-500'
          } text-white font-medium`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.message}
            <button onClick={() => setNotification(null)}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">VerifiedMeasure</h1>
                <p className="text-sm text-gray-600">Welcome, {profile?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Available Credits</p>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <p className="text-3xl font-bold text-blue-600">{profile?.credits || 0}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Available Leads</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">{filteredLeads.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Selected</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{selectedLeads.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Downloaded</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">{downloadHistory.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <History className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Cost</p>
                <p className="text-3xl font-bold mt-1 text-orange-600">{selectedLeads.filter(id => !downloadHistory.some((h: DownloadRecord) => h.lead_id === id)).length}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <Coins className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
