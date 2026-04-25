import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  if (/opera|opr\//i.test(ua)) return "Opera";
  return "Desconhecido";
}

function detectOS(ua: string): string {
  if (/windows nt/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}

function detectDevice(ua: string): string {
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android.*mobile/i.test(ua)) return "Android (mobile)";
  if (/android/i.test(ua)) return "Android (tablet)";
  if (/macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/linux/i.test(ua)) return "Linux PC";
  return "Outro";
}

/**
 * Registra automaticamente o login do usuário e cria alerta de segurança
 * quando um novo dispositivo é detectado. Roda uma única vez por sessão.
 */
export function useLoginTracker() {
  const { user } = useAuth();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      trackedRef.current = null;
      return;
    }

    // Garante que só roda uma vez por usuário/sessão
    const sessionKey = `login_tracked_${user.id}`;
    if (trackedRef.current === user.id || sessionStorage.getItem(sessionKey)) return;
    trackedRef.current = user.id;

    const track = async () => {
      try {
        const ua = navigator.userAgent;
        const browser = detectBrowser(ua);
        const os = detectOS(ua);
        const device = detectDevice(ua);
        const sessionId = crypto.randomUUID();

        // Tenta pegar IP via serviço público (silencioso se falhar)
        let ip: string | null = null;
        let city: string | null = null;
        let country: string | null = null;
        try {
          const ipRes = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            ip = ipData.ip || null;
            city = ipData.city || null;
            country = ipData.country_name || null;
          }
        } catch {
          // ignora erros de IP lookup
        }

        // Verifica se é dispositivo novo (combinação browser+os+device nunca vista)
        const { data: previous } = await supabase
          .from("user_login_history")
          .select("id")
          .eq("user_id", user.id)
          .eq("browser", browser)
          .eq("os", os)
          .eq("device_name", device)
          .limit(1);

        const isNewDevice = !previous || previous.length === 0;

        // Insere registro de login
        await supabase.from("user_login_history").insert({
          user_id: user.id,
          ip_address: ip,
          user_agent: ua,
          device_name: device,
          browser,
          os,
          city,
          country,
          is_new_device: isNewDevice,
          session_id: sessionId,
          is_active: true,
        });

        // Salva session_id local para encerrar depois
        sessionStorage.setItem(sessionKey, sessionId);

        // Se for dispositivo novo, cria alerta no dashboard
        if (isNewDevice) {
          const localTxt = [city, country].filter(Boolean).join(", ");
          await supabase.from("user_security_alerts").insert({
            user_id: user.id,
            alert_type: "new_device_login",
            title: "🔐 Novo login detectado",
            message: `Login de ${device} (${browser} no ${os})${localTxt ? ` em ${localTxt}` : ""}${ip ? ` · IP ${ip}` : ""}. Se não foi você, encerre a sessão imediatamente.`,
            metadata: { browser, os, device, ip, city, country },
          });
        }
      } catch (err) {
        console.error("Erro ao registrar login:", err);
      }
    };

    track();
  }, [user]);
}
