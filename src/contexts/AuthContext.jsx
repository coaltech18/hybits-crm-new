import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/authService';
import { LocationService } from '../services/locationService';

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
  const [userLocations, setUserLocations] = useState([])
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        // Fetch user locations after profile is loaded
        fetchUserLocations()
      })?.catch(error => {
        console.error('Error fetching user profile:', error)
      })
  }

  const fetchUserLocations = async () => {
    try {
      const locations = await LocationService.getUserLocations()
      setUserLocations(locations)
      
      // Set default location if none is selected
      if (locations.length > 0 && !currentLocation) {
        setCurrentLocation(locations[0])
      }
    } catch (error) {
      console.error('Error fetching user locations:', error)
    }
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
      setUserLocations([])
      setCurrentLocation(null)
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

  const switchLocation = (locationId) => {
    const location = userLocations.find(loc => loc.id === locationId)
    if (location) {
      setCurrentLocation(location)
    }
  }

  const hasPermission = (permission) => {
    if (!userProfile) return false
    
    const role = userProfile.role?.toLowerCase()
    
    switch (permission) {
      case 'admin':
        return role === 'admin'
      case 'manager':
        return role === 'manager'
      case 'billing_operations':
        return ['admin', 'manager'].includes(role)
      case 'user_management':
        return role === 'admin'
      case 'system_settings':
        return role === 'admin'
      case 'audit_logs':
        return role === 'admin'
      case 'location_manager':
        return role === 'admin' || (currentLocation && currentLocation.access_level === 'manager')
      case 'location_viewer':
        return role === 'admin' || 
               (currentLocation && ['manager', 'viewer'].includes(currentLocation.access_level))
      default:
        return false
    }
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const value = {
    user,
    userProfile,
    userLocations,
    currentLocation,
    loading,
    sidebarCollapsed,
    signIn,
    signUp,
    signOut,
    updateProfile,
    switchLocation,
    hasPermission,
    fetchUserLocations,
    toggleSidebar
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}