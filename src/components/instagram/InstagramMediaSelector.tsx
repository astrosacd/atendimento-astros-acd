import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Eye, CheckCircle2, AlertCircle, Instagram, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

const PAGE_LIMIT = 50;

const InstagramMediaSelector = ({ onSelect, selectedId }: InstagramMediaSelectorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);

  const buildInitialUrl = (token: string, igUserId: string) => {
    const fields = "id,media_type,media_url,permalink,thumbnail_url,timestamp,caption";
    const isInstagramLoginToken = token.startsWith("IGA");
    return isInstagramLoginToken
      ? `https://graph.instagram.com/v23.0/me/media?fields=${fields}&access_token=${token}&limit=${PAGE_LIMIT}`
      : `https://graph.facebook.com/v19.0/${igUserId}/media?fields=${fields}&access_token=${token}&limit=${PAGE_LIMIT}`;
  };

  const fetchMedia = async (append = false, overrideUrl?: string) => {
    if (!user) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      let url = overrideUrl;
      if (!url) {
        const { data: settings, error: settingsError } = await supabase
          .from("instagram_settings")
          .select("ig_user_id, access_token")
          .eq("user_id", user.id)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (!settings?.access_token || !settings?.ig_user_id) {
          throw new Error("Configurações do Instagram não encontradas. Vá em Configurações.");
        }
        url = buildInitialUrl(settings.access_token, settings.ig_user_id);
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Erro ao buscar mídias do Instagram.");

      setMedia((prev) => (append ? [...prev, ...(data.data || [])] : data.data || []));
      setNextUrl(data.paging?.next || null);
    } catch (err: any) {
      console.error("Error fetching media:", err);
      setError(err.message);
      toast({ title: "Erro ao buscar mídias", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchMedia(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Selecione o Post{media.length > 0 && <span className="text-muted-foreground font-normal"> ({media.length})</span>}
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchMedia(false)}
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
                      setPreview(item);
                    }}
                    className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    title="Visualizar"
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

          {nextUrl && (
            <div className="flex justify-center mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMedia(true, nextUrl)}
                disabled={loadingMore}
                className="h-8 text-xs"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Carregando...
                  </>
                ) : (
                  "Carregar mais posts"
                )}
              </Button>
            </div>
          )}
        </ScrollArea>
      )}

      {selectedId && (
        <p className="text-[10px] text-muted-foreground text-center">
          ID selecionado: <span className="font-mono">{selectedId}</span>
        </p>
      )}

      {/* Preview Lightbox */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
          {preview && (
            <div className="flex flex-col">
              <div className="relative bg-black flex items-center justify-center max-h-[80vh]">
                {preview.media_type === "VIDEO" ? (
                  <video
                    src={preview.media_url}
                    poster={preview.thumbnail_url}
                    controls
                    autoPlay
                    className="max-h-[80vh] max-w-full"
                  />
                ) : (
                  <img
                    src={preview.media_url || preview.thumbnail_url}
                    alt={preview.caption || "Instagram Media"}
                    className="max-h-[80vh] max-w-full object-contain"
                  />
                )}
              </div>
              <div className="p-4 bg-background space-y-2">
                {preview.caption && (
                  <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">{preview.caption}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{preview.id}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => window.open(preview.permalink, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir no Instagram
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onSelect(preview.id, preview.media_url || preview.thumbnail_url || "");
                        setPreview(null);
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Selecionar este post
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstagramMediaSelector;
