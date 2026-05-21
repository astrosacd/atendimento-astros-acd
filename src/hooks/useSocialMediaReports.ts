import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/utils/invokeFunction";
import { toast } from "sonner";

export interface SocialProfile {
  id: string;
  username: string;
  display_name: string | null;
  cliente_id: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  is_active: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
  whatsapp_number: string | null;
  email: string | null;
  report_day: number;
  auto_send_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export interface SocialReport {
  id: string;
  profile_id: string;
  month: string;
  data: any;
  share_token: string;
  pdf_url: string | null;
  sent_whatsapp_at: string | null;
  sent_email_at: string | null;
  generated_at: string;
}

export function useSocialProfiles() {
  return useQuery({
    queryKey: ["social-media-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_client_profiles" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SocialProfile[];
    },
  });
}

export function useSocialReports(profileId?: string) {
  return useQuery({
    queryKey: ["social-media-reports", profileId],
    queryFn: async () => {
      let q = supabase
        .from("social_media_monthly_reports" as any)
        .select("*")
        .order("month", { ascending: false });
      if (profileId) q = q.eq("profile_id", profileId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SocialReport[];
    },
  });
}

export function useSocialReportConfig() {
  return useQuery({
    queryKey: ["social-media-report-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_report_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Partial<SocialProfile> & { id?: string }) => {
      if (profile.id) {
        const { error } = await supabase
          .from("social_media_client_profiles" as any)
          .update(profile)
          .eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_media_client_profiles" as any)
          .insert(profile);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-profiles"] });
      toast.success("Perfil salvo!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_media_client_profiles" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-profiles"] });
      toast.success("Perfil excluído");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useSyncProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { profile_id?: string; sync_all?: boolean }) => {
      return await invokeFunction("social-media-sync-profiles", { body: vars });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["social-media-profiles"] });
      const ok = data?.results?.filter((r: any) => r.status === "ok").length || 0;
      const err = data?.results?.filter((r: any) => r.status === "error").length || 0;
      toast.success(`Sync: ${ok} OK, ${err} erro(s)`);
    },
    onError: (e: any) => toast.error("Erro no sync: " + e.message),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { profile_id: string; month: string }) => {
      return await invokeFunction("social-media-generate-report", { body: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-reports"] });
      toast.success("Relatório gerado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useSendReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { report_id: string; channels?: ("whatsapp" | "email")[] }) => {
      return await invokeFunction("social-media-send-report", { body: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-reports"] });
      toast.success("Relatório enviado!");
    },
    onError: (e: any) => toast.error("Erro ao enviar: " + e.message),
  });
}

export function useTestCredentials() {
  return useMutation({
    mutationFn: async (vars: { test_phone?: string; test_email?: string }) => {
      return await invokeFunction("social-media-test-credentials", { body: vars });
    },
  });
}

export function useSaveReportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: any) => {
      const { data: existing } = await supabase
        .from("social_media_report_config" as any)
        .select("id")
        .limit(1)
        .maybeSingle();
      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("social_media_report_config" as any)
          .update(cfg)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_media_report_config" as any)
          .insert(cfg);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-media-report-config"] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}
