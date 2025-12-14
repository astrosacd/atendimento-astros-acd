import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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

      // Fetch approval status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      // User is approved ONLY if approval_status is explicitly 'approved'
      const isUserApproved = profileData?.approval_status === 'approved';

      return {
        role: roleData?.role as UserRole | null,
        approved: isUserApproved,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { role: null, approved: false };
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

        if (session?.user) {
          const { role, approved } = await fetchUserData(session.user.id);
          if (!isMounted) return;
          setUserRole(role);
          setIsApproved(approved);
        }
        
        setIsDataLoaded(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          setIsLoading(false);
          setIsDataLoaded(true);
        }
      }
    };

    initializeAuth();

    // Set up the listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Set loading while fetching user data
          setIsLoading(true);
          
          // Use setTimeout to avoid deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            const { role, approved } = await fetchUserData(session.user.id);
            if (!isMounted) return;
            setUserRole(role);
            setIsApproved(approved);
            setIsLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setIsApproved(false);
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
    // Garante que qualquer sessão anterior seja encerrada antes de um novo login
    await supabase.auth.signOut();

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
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setIsApproved(false);
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
