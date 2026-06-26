import { createContext, useEffect, useMemo, useState } from 'react'
import { fetchAuthMe } from '../services/authApi'
import { isSupabaseClientReady, supabase } from '../lib/supabaseClient'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function syncProfile(nextSession) {
      if (!nextSession?.access_token) {
        if (isMounted) setProfile(null)
        return
      }

      try {
        const result = await fetchAuthMe(nextSession)
        if (!isMounted) return
        setProfile(result.profile || null)
      } catch {
        if (!isMounted) return
        setProfile(null)
      }
    }

    if (!isSupabaseClientReady || !supabase) {
      setLoading(false)
      return undefined
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return
      const currentSession = data.session || null
      setSession(currentSession)
      setUser(currentSession?.user || null)
      await syncProfile(currentSession)
      if (!isMounted) return
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession || null)
      setUser(nextSession?.user || null)
      await syncProfile(nextSession || null)
      if (!isMounted) return
      setLoading(false)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    loading,
    session,
    user,
    profile,
    isAuthenticated: Boolean(user),
    isSupabaseClientReady,
    signOut: async () => {
      if (!supabase) return
      await supabase.auth.signOut()
      setProfile(null)
    },
  }), [loading, session, user, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
