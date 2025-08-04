import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/authService';

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session - Use Promise chain
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session?.user)
          fetchUserProfile(session?.user?.id)
        }
        setLoading(false)
      })

    // Listen for auth changes - NEVER ASYNC callback
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session?.user)
          fetchUserProfile(session?.user?.id)  // Fire-and-forget, NO AWAIT
        } else {
          setUser(null)
          setUserProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const fetchUserProfile = (userId) => {
    AuthService?.getUserProfile(userId)?.then(profile => {
        setUserProfile(profile)
      })?.catch(error => {
        console.error('Error fetching user profile:', error)
      })
  }

  const signIn = async (email, password) => {
    try {
      const result = await AuthService?.signIn(email, password)
      return result
    } catch (error) {
      throw error
    }
  }

  const signUp = async (email, password, userData) => {
    try {
      const result = await AuthService?.signUp(email, password, userData)
      return result
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    try {
      await AuthService?.signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      throw error
    }
  }

  const updateProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('No user logged in')
      
      const updatedProfile = await AuthService?.updateUserProfile(user?.id, updates)
      setUserProfile(updatedProfile)
      return updatedProfile
    } catch (error) {
      throw error
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}