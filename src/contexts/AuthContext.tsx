import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  isApproved: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  // Track if initial auth check has completed - once true, we won't show global loader again
  // unless the user actually changes (different account)
  const initialLoadCompleteRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      }

      // Fetch approval status and blocked status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('approval_status, is_blocked, blocked_reason')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      // User is approved ONLY if approval_status is explicitly 'approved'
      const isUserApproved = profileData?.approval_status === 'approved';
      const isUserBlocked = profileData?.is_blocked === true;
      const userBlockedReason = profileData?.blocked_reason || null;

      return {
        role: roleData?.role as UserRole | null,
        approved: isUserApproved,
        blocked: isUserBlocked,
        blockedReason: userBlockedReason,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { role: null, approved: false, blocked: false, blockedReason: null };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;

        if (session?.user) {
          const { role, approved, blocked, blockedReason } = await fetchUserData(session.user.id);
          if (!isMounted) return;
          setUserRole(role);
          setIsApproved(approved);
          setIsBlocked(blocked);
          setBlockedReason(blockedReason);
        }
        
        initialLoadCompleteRef.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          initialLoadCompleteRef.current = true;
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up the listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Always keep the session in sync
        setSession(session);
        setUser(session?.user ?? null);

        const incomingUserId = session?.user?.id ?? null;
        const previousUserId = currentUserIdRef.current;
        currentUserIdRef.current = incomingUserId;

        // After initial load is complete, ONLY show loading if user actually changed
        // This prevents "Carregando..." when switching browser tabs
        if (initialLoadCompleteRef.current) {
          const isSameUser = incomingUserId && incomingUserId === previousUserId;
          
          if (isSameUser) {
            // Same user - no need to refetch or show loading
            return;
          }
          
          // User changed (logged out or different user logged in)
          if (!session?.user) {
            // User signed out
            setUserRole(null);
            setIsApproved(false);
            setIsBlocked(false);
            setBlockedReason(null);
            return;
          }
          
          // Different user signed in - fetch their data (rare case)
          const { role, approved, blocked, blockedReason } = await fetchUserData(session.user.id);
          if (!isMounted) return;
          setUserRole(role);
          setIsApproved(approved);
          setIsBlocked(blocked);
          setBlockedReason(blockedReason);
          return;
        }

        // Initial load not complete yet - this shouldn't normally happen
        // but handle it just in case
        if (session?.user) {
          setIsLoading(true);
          setTimeout(async () => {
            if (!isMounted) return;
            const { role, approved, blocked, blockedReason } = await fetchUserData(session.user.id);
            if (!isMounted) return;
            setUserRole(role);
            setIsApproved(approved);
            setIsBlocked(blocked);
            setBlockedReason(blockedReason);
            setIsLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setIsApproved(false);
          setIsBlocked(false);
          setBlockedReason(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          phone,
        },
      },
    });
    
    // Update profile with phone if signup succeeded
    if (!error && data.user && phone) {
      await supabase
        .from('profiles')
        .update({ phone })
        .eq('user_id', data.user.id);
    }

    // Garante que o usuário não permaneça logado enquanto aguarda aprovação
    if (!error) {
      await supabase.auth.signOut();
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("temp_access_token");
    localStorage.removeItem("temp_access_target");
    setUser(null);
    setSession(null);
    setUserRole(null);
    setIsApproved(false);
    setIsBlocked(false);
    setBlockedReason(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isApproved,
        isLoading,
        isAdmin: userRole === 'admin',
        isBlocked,
        blockedReason,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
