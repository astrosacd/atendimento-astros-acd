import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('Notifications not available or not permitted');
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: true,
      });

      if (options.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  // Subscribe to real-time events for notifications
  useEffect(() => {
    if (!isAdmin || permission !== 'granted') return;

    // Listen for new pending users
    const profilesChannel = supabase
      .channel('profiles-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          if (payload.new && payload.new.approval_status === 'pending') {
            showNotification({
              title: '👤 Novo usuário pendente',
              body: `${payload.new.name || payload.new.email} aguarda aprovação`,
              tag: 'pending-user',
            });
          }
        }
      )
      .subscribe();

    // Listen for billing errors
    const billingChannel = supabase
      .channel('billing-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'billing_logs',
        },
        (payload) => {
          if (payload.new && payload.new.status === 'error') {
            showNotification({
              title: '⚠️ Erro na cobrança',
              body: `Falha ao enviar cobrança para ${payload.new.cliente_nome}`,
              tag: 'billing-error',
            });
          }
        }
      )
      .subscribe();

    // Listen for new tickets
    const chamadosChannel = supabase
      .channel('chamados-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chamados',
        },
        (payload) => {
          showNotification({
            title: '🎫 Novo ticket aberto',
            body: `Assunto: ${payload.new.assunto}`,
            tag: 'new-ticket',
          });
        }
      )
      .subscribe();

    // Listen for payments awaiting approval
    const paymentsChannel = supabase
      .channel('payments-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gateway_order_approvals',
        },
        (payload) => {
          showNotification({
            title: '💰 Pagamento pende aprovação',
            body: `Um novo pagamento aguarda sua análise`,
            tag: 'payment-approval',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(billingChannel);
      supabase.removeChannel(chamadosChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [isAdmin, permission, showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
  };
};
