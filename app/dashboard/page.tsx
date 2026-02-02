'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { exportToCSV, formatDateTimeStamp } from '@/lib/csv'
import { Shield, Download, Search, LogOut, Settings } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [filteredLeads, setFilteredLeads] = useState<any[]>([])
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [downloadedLeads, setDownloadedLeads] = useState<Set<string>>(new Set())
  
  const [searchTerm, setSearchTerm] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
    fetchLeads()
    fetchDownloadHistory()
  }, [])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, industryFilter, locationFilter])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      router.push('/login')
      return
    }

    setUser(session.user)
    
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    setProfile(profileData)
    setLoading(false)
  }

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'available')
      .order('created_date', { ascending: false })

    if (data) {
      setLeads(data)
      setFilteredLeads(data)
    }
  }

  const fetchDownloadHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('download_history')
      .select('lead_id')
      .eq('user_id', session.user.id)

    if (data) {
      setDownloadedLeads(new Set(data.map(d => d.lead_id)))
    }
  }

  const filterLeads = () => {
    let filtered = leads

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.contact_name && lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (industryFilter) {
      filtered = filtered.filter(lead => lead.industry === industryFilter)
    }

    if (locationFilter) {
      filtered = filtered.filter(lead => lead.location === locationFilter)
    }

    setFilteredLeads(filtered)
  }

  const toggleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.lead_id)))
    }
  }

  const calculateCost = () => {
    let cost = 0
    selectedLeads.forEach(leadId => {
      if (!downloadedLeads.has(leadId)) {
        cost += 1
      }
    })
    return cost
  }

  const handleDownloadCSV = async () => {
    if (selectedLeads.size === 0) {
      alert('Please select at least one lead')
      return
    }

    const cost = calculateCost()
    
    if (cost > (profile?.credits || 0)) {
      alert(`Not enough credits! You need ${cost} credits but have ${profile?.credits || 0}`)
      return
    }

    try {
      const leadsToDownload = filteredLeads.filter(l => selectedLeads.has(l.lead_id))
      const newDownloads: string[] = []
      
      for (const lead of leadsToDownload) {
        if (!downloadedLeads.has(lead.lead_id)) {
          await supabase.from('download_history').insert({
            user_id: user.id,
            lead_id: lead.lead_id
          })
          newDownloads.push(lead.lead_id)
        }
      }

      if (newDownloads.length > 0 && profile) {
        await supabase
          .from('user_profiles')
          .update({ credits: profile.credits - newDownloads.length })
          .eq('id', user.id)

        setProfile({ ...profile, credits: profile.credits - newDownloads.length })
      }

      const updatedDownloaded = new Set(downloadedLeads)
      newDownloads.forEach(id => updatedDownloaded.add(id))
      setDownloadedLeads(updatedDownloaded)

      const timestamp = formatDateTimeStamp()
      exportToCSV(leadsToDownload, `verifiedmeasure-leads-${timestamp}.csv`)

      alert(`Successfully downloaded ${leadsToDownload.length} leads! ${newDownloads.length} credits deducted.`)
      setSelectedLeads(new Set())
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download leads')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const uniqueIndustries = Array.from(new Set(leads.map(l => l.industry).filter(Boolean)))
  const uniqueLocations = Array.from(new Set(leads.map(l => l.location).filter(Boolean)))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">VerifiedMeasure</h1>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Available Credits</p>
                <p className="text-2xl font-bold text-blue-600">{profile?.credits || 0}</p>
              </div>
              {profile?.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <p className="text-gray-600 text-sm font-medium">Available Leads</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">{filteredLeads.length}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <p className="text-gray-600 text-sm font-medium">Selected</p>
            <p className="text-4xl font-bold text-blue-600 mt-1">{selectedLeads.size}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <p className="text-gray-600 text-sm font-medium">Downloaded</p>
            <p className="text-4xl font-bold text-green-600 mt-1">{downloadedLeads.size}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-6 border">
            <p className="text-gray-600 text-sm font-medium">Cost</p>
            <p className="text-4xl font-bold text-purple-600 mt-1">{calculateCost()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Company or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Industries</option>
              {uniqueIndustries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-3xl shadow-sm p-4 mb-6 border flex justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={selectAll}
              className="px-4 py-2 border border-gray-300 rounded-2xl hover:bg-gray-50 text-sm font-medium"
            >
              {selectedLeads.size === filteredLeads.length ? 'Deselect All' : 'Select All'}
            </button>
            <p className="text-gray-600 py-2">
              {selectedLeads.size} selected • {calculateCost()} credits needed
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={selectedLeads.size === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download CSV ({calculateCost()} credits)
          </button>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Select</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Industry</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Capital Need</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.lead_id)}
                        onChange={() => toggleSelectLead(lead.lead_id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{lead.company_name}</div>
                      <div className="text-sm text-gray-500">{lead.company_size || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lead.contact_name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded-xl bg-blue-100 text-blue-800">{lead.industry || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{lead.location || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">{lead.capital_need || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {downloadedLeads.has(lead.lead_id) ? (
                        <span className="px-2 py-1 text-xs rounded-xl bg-green-100 text-green-800 font-semibold">
                          Downloaded
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-xl bg-gray-100 text-gray-800 font-semibold">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found matching your filters.
          </div>
        )}
      </main>
    </div>
  )
}
