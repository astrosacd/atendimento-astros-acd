import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Eye, CheckCircle2, AlertCircle, Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MediaItem {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  caption?: string;
}

interface InstagramMediaSelectorProps {
  onSelect: (mediaId: string, mediaUrl: string) => void;
  selectedId?: string;
}

const InstagramMediaSelector = ({ onSelect, selectedId }: InstagramMediaSelectorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchMedia = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get settings from DB
      const { data: settings, error: settingsError } = await supabase
        .from("instagram_settings")
        .select("ig_user_id, access_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;
      if (!settings?.access_token || !settings?.ig_user_id) {
        throw new Error("Configurações do Instagram não encontradas. Vá em Configurações.");
      }

      // 2. Fetch from Instagram API
      // Tokens "IGA..." (Instagram Login) usam graph.instagram.com com "me/media"
      // Tokens "EAA..." (Facebook Login) usam graph.facebook.com com IG user id
      const isInstagramLoginToken = settings.access_token.startsWith("IGA");
      const url = isInstagramLoginToken
        ? `https://graph.instagram.com/v23.0/me/media?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption&access_token=${settings.access_token}&limit=20`
        : `https://graph.facebook.com/v19.0/${settings.ig_user_id}/media?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption&access_token=${settings.access_token}&limit=20`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Erro ao buscar mídias do Instagram.");
      }

      setMedia(data.data || []);
    } catch (err: any) {
      console.error("Error fetching media:", err);
      setError(err.message);
      toast({
        title: "Erro ao buscar mídias",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Selecione o Post</h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchMedia} 
          disabled={loading}
          className="h-8 px-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : media.length === 0 && !loading ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
          <Instagram className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
          <p className="text-xs text-muted-foreground">Nenhum post encontrado.</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px] border rounded-lg p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {media.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all group",
                  selectedId === item.id ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                )}
                onClick={() => onSelect(item.id, item.media_url || item.thumbnail_url || "")}
              >
                <img 
                  src={item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url} 
                  alt={item.caption || "Instagram Media"} 
                  className="w-full h-full object-cover"
                />
                
                {selectedId === item.id && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-white drop-shadow-md" />
                  </div>
                )}
                
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      window.open(item.permalink, "_blank", "noopener,noreferrer");
                    }}
                    className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    title="Abrir no Instagram"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>


                {item.media_type !== "IMAGE" && (
                  <Badge variant="secondary" className="absolute bottom-1 left-1 text-[8px] px-1 h-3.5">
                    {item.media_type}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      
      {selectedId && (
        <p className="text-[10px] text-muted-foreground text-center">
          ID selecionado: <span className="font-mono">{selectedId}</span>
        </p>
      )}
    </div>
  );
};

export default InstagramMediaSelector;
