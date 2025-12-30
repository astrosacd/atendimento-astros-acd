import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageCode } from '@/i18n/config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => {
    // Initialize from localStorage immediately to prevent flicker
    if (user?.id) {
      const cached = localStorage.getItem(`user_language_${user.id}`);
      if (cached) {
        return cached as LanguageCode;
      }
    }
    return 'pt-BR';
  });

  // Load language preference on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `user_language_${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const lang = cached as LanguageCode;
      setCurrentLanguage(lang);
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
      }
      setIsLoading(false);
      return; // Use cached value, don't fetch from DB
    }

    const loadLanguage = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('language')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.language) {
        const lang = data.language as LanguageCode;
        setCurrentLanguage(lang);
        i18n.changeLanguage(lang);
        localStorage.setItem(cacheKey, lang);
      }
      setIsLoading(false);
    };

    loadLanguage();
  }, [user?.id, i18n]);

  const changeLanguage = useCallback(async (language: LanguageCode) => {
    if (!user?.id) return;

    // Update immediately for instant feedback
    setCurrentLanguage(language);
    i18n.changeLanguage(language);
    localStorage.setItem(`user_language_${user.id}`, language);

    // Update in database (fire and forget)
    supabase
      .from('profiles')
      .update({ language })
      .eq('user_id', user.id)
      .then(() => {});
  }, [user?.id, i18n]);

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
  };
}
