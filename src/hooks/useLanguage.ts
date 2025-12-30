import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageCode } from '@/i18n/config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('pt-BR');

  // Load language preference on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `user_language_${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      setCurrentLanguage(cached as LanguageCode);
      i18n.changeLanguage(cached);
      setIsLoading(false);
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

  const changeLanguage = async (language: LanguageCode) => {
    if (!user?.id) return;

    setCurrentLanguage(language);
    i18n.changeLanguage(language);
    localStorage.setItem(`user_language_${user.id}`, language);

    // Update in database
    await supabase
      .from('profiles')
      .update({ language })
      .eq('user_id', user.id);
  };

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
  };
}
