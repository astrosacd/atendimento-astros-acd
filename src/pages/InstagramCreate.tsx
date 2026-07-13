import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Instagram, 
  ImagePlus, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Send, 
  Clock, 
  Layers, 
  Video, 
  Layout, 
  Smartphone,
  Trash2,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Upload,
  Info,
  Heart,
  MessageCircle,
  Bookmark
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const AI_IMAGE_MODELS = [
  {
    value: "google/gemini-3.1-flash-image-preview",
    label: "Lovable AI — rápido e caprichado",
    hint: "Melhor padrão para posts, carrosséis e variações com referência.",
  },
  {
    value: "google/gemini-2.5-flash-image",
    label: "Lovable AI — econômico",
    hint: "Bom para testar ideias com menor custo.",
  },
  {
    value: "google/gemini-3-pro-image-preview",
    label: "Lovable AI — qualidade máxima",
    hint: "Mais lento, ideal para artes finais importantes.",
  },
];

const InstagramCreate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const isTempAccess = !!localStorage.getItem("temp_access_token");
  const blockEdit = () => {
    toast({ title: "Ação não permitida", description: "O acesso provisório só permite publicar novos posts, não alterar configurações.", variant: "destructive" });
  };
  
  // Form State
  const [postType, setPostType] = useState<'feed' | 'reels' | 'carousel' | 'stories'>('feed');
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // AI State
  const [prompt, setPrompt] = useState("");
  const [aiModel, setAiModel] = useState(AI_IMAGE_MODELS[0].value);
  const [variations, setVariations] = useState<{ url: string; name: string }[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [carouselPreviewIndex, setCarouselPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const [igUsername, setIgUsername] = useState<string>("seu_perfil");

  useEffect(() => {
    setCarouselPreviewIndex((current) => Math.min(current, Math.max(mediaUrls.length - 1, 0)));
  }, [mediaUrls.length]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("instagram_settings")
        .select("account_username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.account_username) setIgUsername(data.account_username.replace(/^@/, ""));
    })();
  }, [user?.id]);

  // Regras por tipo de conteúdo
  const typeRules = {
    feed:     { accept: "image/*",         multiple: false, max: 1,  label: "1 imagem (proporção 1:1)" },
    reels:    { accept: "video/mp4,video/quicktime", multiple: false, max: 1, label: "1 vídeo (9:16, MP4/MOV)" },
    carousel: { accept: "image/*",         multiple: true,  max: 10, label: "Até 10 imagens" },
    stories:  { accept: "image/*,video/*", multiple: false, max: 1,  label: "1 imagem ou vídeo" },
  } as const;
  const currentRule = typeRules[postType];

  // Reseta mídia ao trocar tipo (evita arquivos incompatíveis)
  useEffect(() => {
    setMediaUrls([]);
    setVariations([]);
    setSelectedVariation(null);
  }, [postType]);

  // ---------- Validação de mídia (dimensões / aspect / tamanho) ----------
  const readImageMeta = (file: File): Promise<{ w: number; h: number }> => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { const r = { w: img.naturalWidth, h: img.naturalHeight }; URL.revokeObjectURL(url); resolve(r); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao ler imagem")); };
    img.src = url;
  });
  const readVideoMeta = (file: File): Promise<{ w: number; h: number; duration: number }> => new Promise((resolve, reject) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => { const r = { w: v.videoWidth, h: v.videoHeight, duration: v.duration }; URL.revokeObjectURL(url); resolve(r); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao ler vídeo")); };
    v.src = url;
  });

  // Regras oficiais IG (aproximadas): feed/carousel 4:5 a 1.91:1, reels/stories 9:16 exato preferencial
  const validateMedia = async (file: File): Promise<string | null> => {
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    // Tamanhos máximos aproximados da Graph API
    const maxImgMB = 8;
    const maxVidMB = 100;
    if (isImg && file.size > maxImgMB * 1024 * 1024) return `Imagem excede ${maxImgMB}MB (Instagram limita a esse tamanho).`;
    if (isVid && file.size > maxVidMB * 1024 * 1024) return `Vídeo excede ${maxVidMB}MB (Instagram limita a esse tamanho).`;

    try {
      if (isImg) {
        const { w, h } = await readImageMeta(file);
        if (w < 320) return `Imagem com largura ${w}px — mínimo do Instagram é 320px.`;
        const ratio = w / h;
        if (postType === 'feed' || postType === 'carousel') {
          if (ratio < 0.8 || ratio > 1.91) return `Proporção ${(ratio).toFixed(2)}:1 fora do permitido para Feed (0.8 a 1.91).`;
        }
        if (postType === 'stories') {
          if (Math.abs(ratio - (9/16)) > 0.05) return `Stories preferem 9:16 (${(9/16).toFixed(2)}). Sua imagem está em ${ratio.toFixed(2)}.`;
        }
      }
      if (isVid) {
        const { w, h, duration } = await readVideoMeta(file);
        if (w < 500) return `Vídeo com largura ${w}px — mínimo recomendado é 500px.`;
        const ratio = w / h;
        if (postType === 'reels') {
          if (Math.abs(ratio - (9/16)) > 0.05) return `Reels exige 9:16. Seu vídeo está em ${ratio.toFixed(2)}.`;
          if (duration < 3 || duration > 90) return `Reels aceita 3s a 90s. Seu vídeo tem ${duration.toFixed(1)}s.`;
        }
        if (postType === 'stories') {
          if (duration > 60) return `Stories aceita até 60s. Seu vídeo tem ${duration.toFixed(1)}s.`;
        }
      }
    } catch (e: any) {
      return `Não foi possível ler a mídia: ${e?.message || 'erro desconhecido'}`;
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rule = typeRules[postType];
    let filesToUpload = Array.from(files);

    if (!rule.multiple && filesToUpload.length > 1) {
      toast({ title: "Apenas um arquivo", description: `Para ${postType === 'feed' ? 'Feed' : postType === 'reels' ? 'Reels' : 'Stories'} envie somente 1 arquivo.`, variant: "destructive" });
      filesToUpload = [filesToUpload[0]];
    }

    const remaining = rule.max - mediaUrls.length;
    if (remaining <= 0) {
      toast({ title: "Limite atingido", description: `Você já adicionou o máximo permitido (${rule.max}).`, variant: "destructive" });
      return;
    }
    if (filesToUpload.length > remaining) {
      toast({ title: "Limite excedido", description: `Apenas ${remaining} arquivo(s) restantes. Os demais foram ignorados.` });
      filesToUpload = filesToUpload.slice(0, remaining);
    }

    // Validação de tipo MIME + dimensões/tamanho
    for (const f of filesToUpload) {
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (postType === 'feed' && !isImg) { toast({ title: "Tipo inválido", description: "Feed aceita apenas imagens.", variant: "destructive" }); return; }
      if (postType === 'reels' && !isVid) { toast({ title: "Tipo inválido", description: "Reels aceita apenas vídeos.", variant: "destructive" }); return; }
      if (postType === 'carousel' && !isImg) { toast({ title: "Tipo inválido", description: "Carrossel aceita apenas imagens.", variant: "destructive" }); return; }

      const err = await validateMedia(f);
      if (err) { toast({ title: "Mídia inválida para Instagram", description: err, variant: "destructive" }); return; }
    }

    setLoading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of filesToUpload) {
        if (file.size > 50 * 1024 * 1024) {
           toast({ title: "Arquivo muito grande", description: `${file.name} excede 50MB.`, variant: "destructive" });
           continue;
        }

        const fileName = `${user?.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const { error } = await supabase.storage
          .from("instagram-media")
          .upload(fileName, file);

        if (error) {
          console.error("Upload error:", error);
          toast({ title: "Erro no upload", description: `${file.name}: ${error.message}`, variant: "destructive" });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("instagram-media")
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
      }

      setMediaUrls(rule.multiple ? [...mediaUrls, ...uploadedUrls] : uploadedUrls);
    } catch (err) {
      console.error("General upload error:", err);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow reference upload for AI generation
    // if (isTempAccess) { blockEdit(); return; }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast({ title: "Login necessário", description: "Entre na sua conta antes de enviar uma imagem de referência.", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "A referência precisa ser uma imagem.", variant: "destructive" });
      return;
    }

    setIsUploadingReference(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${user.id}/references/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("instagram-media")
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("instagram-media")
        .getPublicUrl(fileName);
      
      setReferenceImageUrl(publicUrl);
      toast({ title: "Imagem de referência enviada" });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingReference(false);
      if (referenceInputRef.current) referenceInputRef.current.value = "";
    }
  };

  const generateAIImages = async () => {
    // Allow AI image generation
    // if (isTempAccess) { blockEdit(); return; }
    if (!prompt) {
      toast({ title: "Aviso", description: "Digite um prompt para gerar imagens." });
      return;
    }

    setGenerating(true);
    setVariations([]);
    setSelectedVariation(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt, 
          format: postType, 
          model: aiModel,
          count: 3,
          referenceImage: referenceImageUrl
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setVariations(data.images);
    } catch (error: any) {
      toast({ title: "Erro na IA", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const useVariation = (url: string) => {
    setSelectedVariation(url);
    const rule = typeRules[postType];
    if (rule.multiple) {
      if (mediaUrls.length >= rule.max) {
        toast({ title: "Limite atingido", description: `Máximo de ${rule.max} imagens no carrossel.`, variant: "destructive" });
        return;
      }
      setMediaUrls([...mediaUrls, url]);
    } else {
      setMediaUrls([url]);
    }
  };

  const removeMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (publishNow: boolean) => {
    // Allow submitting new posts
    // if (isTempAccess) { blockEdit(); return; }
    if (mediaUrls.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos uma mídia.", variant: "destructive" });
      return;
    }

    if (!publishNow && !scheduledFor) {
      toast({ title: "Erro", description: "Selecione uma data para agendamento.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: post, error } = await supabase.from("posts").insert({
        user_id: user?.id,
        type: postType,
        caption,
        media_urls: mediaUrls,
        status: publishNow ? 'publishing' : 'scheduled',
        scheduled_for: publishNow ? null : scheduledFor?.toISOString(),
      }).select().single();

      if (error) throw error;

      if (publishNow) {
        // Trigger edge function for immediate publishing
        const { error: publishError } = await supabase.functions.invoke("publish-instagram", {
          body: { postId: post.id }
        });
        
        if (publishError) {
          toast({ title: "Aviso", description: "Post criado, mas a publicação imediata falhou. Verifique o histórico." });
        } else {
          toast({ title: "Sucesso!", description: "Post enviado para publicação!" });
        }
      } else {
        toast({ title: "Sucesso!", description: "Post agendado com sucesso!" });
      }

      navigate("/instagram/history");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isTempAccess && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Acesso Provisório Ativo:</strong> Você pode criar e publicar novos conteúdos (Feed, Reels, Carrossel ou Stories). Alterações em agendamentos existentes no histórico não são permitidas.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Lado Esquerdo: Configurações do Post */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tipo de Conteúdo</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={postType} 
                onValueChange={(val: any) => setPostType(val)}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {[
                  { id: 'feed', icon: Layout, label: 'Feed (1:1)' },
                  { id: 'reels', icon: Video, label: 'Reels (9:16)' },
                  { id: 'carousel', icon: Layers, label: 'Carrossel' },
                  { id: 'stories', icon: Smartphone, label: 'Stories' },
                ].map((item) => (
                  <Label
                    key={item.id}
                    htmlFor={item.id}
                    className={cn(
                      "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                      postType === item.id ? "border-primary bg-primary/5" : ""
                    )}
                  >
                    <RadioGroupItem value={item.id} id={item.id} className="sr-only" />
                    <item.icon className="mb-3 h-6 w-6" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mídia e Design</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner de regra do tipo selecionado */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong className="capitalize">{postType === 'feed' ? 'Feed' : postType === 'reels' ? 'Reels' : postType === 'carousel' ? 'Carrossel' : 'Stories'}:</strong>{' '}
                  {currentRule.label}. {mediaUrls.length > 0 && `(${mediaUrls.length}/${currentRule.max} adicionado${mediaUrls.length > 1 ? 's' : ''})`}
                </AlertDescription>
              </Alert>

              {/* Tabs: Upload x Gerar com IA */}
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="gap-2">
                    <Upload className="h-4 w-4" /> Fazer Upload
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="gap-2">
                    <Sparkles className="h-4 w-4" /> Gerar com IA
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                  {mediaUrls.length >= currentRule.max ? (
                    <Alert variant="destructive">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Limite atingido ({currentRule.max}). Remova uma mídia abaixo para enviar outra.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/30 transition-colors",
                        loading ? "cursor-wait opacity-60" : "cursor-pointer"
                      )}
                      onClick={() => !loading && fileInputRef.current?.click()}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !loading) fileInputRef.current?.click(); }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple={currentRule.multiple}
                        accept={currentRule.accept}
                        onChange={handleFileUpload}
                        disabled={loading}
                      />
                      {loading ? (
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      ) : (
                        <>
                          <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                          <p className="text-xs text-muted-foreground mt-1">{currentRule.label}</p>
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ai" className="mt-4">
                  <div className="space-y-4 rounded-xl border bg-muted/20 p-5">
                    {postType === 'reels' && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Reels exige vídeo. A IA gera apenas a <strong>capa estática</strong> 9:16 — você precisa enviar o vídeo final manualmente na aba "Fazer Upload".
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Gerar arte para {postType === 'feed' ? 'Feed' : postType === 'reels' ? 'capa do Reels' : postType === 'carousel' ? 'Carrossel' : 'Stories'}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Cada tipo gera variações com briefing e proporção próprios ({postType === 'feed' || postType === 'carousel' ? '1:1' : '9:16'}).
                        </p>
                      </div>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="w-[200px] h-9 text-xs">
                          <SelectValue placeholder="Qualidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_IMAGE_MODELS.map((model) => (
                            <SelectItem key={model.value} value={model.value} className="text-xs">{model.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                      {/* Imagem modelo */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Imagem modelo (opcional)</Label>
                        {referenceImageUrl ? (
                          <div className="relative h-28 w-28 overflow-hidden rounded-lg border group">
                            <img src={referenceImageUrl} className="h-full w-full object-cover" alt="Referência" />
                            <button
                              type="button"
                              onClick={() => setReferenceImageUrl(null)}
                              className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="h-28 w-28 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:bg-muted/40 transition disabled:opacity-50"
                            disabled={isUploadingReference}
                            onClick={() => referenceInputRef.current?.click()}
                          >
                            {isUploadingReference ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                            <span>Enviar</span>
                          </button>
                        )}
                        <input
                          ref={referenceInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleReferenceUpload}
                          disabled={isUploadingReference}
                        />
                      </div>

                      {/* Prompt */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder={referenceImageUrl ? "Ex: use esta imagem como estilo, mas crie uma arte nova..." : "Ex: arte para feed sobre promoção de atendimento via WhatsApp, visual moderno..."}
                          className="h-28 resize-none"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        <Button
                          onClick={generateAIImages}
                          disabled={generating || !prompt.trim()}
                          className="w-full"
                        >
                          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                          {generating ? "Gerando 3 variações..." : "Gerar artes com IA"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* AI Variations Result */}
              {variations.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Escolha uma variação gerada:</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {variations.map((v, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                          selectedVariation === v.url ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                        )}
                        onClick={() => useVariation(v.url)}
                      >
                        <img src={v.url} alt={v.name} className="w-full aspect-square object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white p-1 text-center font-medium">
                          {v.name}
                        </div>
                        {selectedVariation === v.url && (
                          <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Media List */}
              {mediaUrls.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Mídias Selecionadas ({mediaUrls.length})</Label>
                  <div className="flex flex-wrap gap-3">
                    {mediaUrls.map((url, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden group">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeMedia(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Legenda</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">
                    {postType === 'stories' ? "Legenda (não visível em Stories)" : "Legenda do Post"}
                  </Label>
                  <span className={cn(
                    "text-[10px] font-mono",
                    caption.length > 2200 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {caption.length}/2200
                  </span>
                </div>
                <Textarea 
                  placeholder={postType === 'stories' ? "Legenda não é enviada para Stories via API..." : "Escreva algo interessante..."} 
                  className="flex-1 min-h-32 resize-none"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.substring(0, 2200))}
                  disabled={postType === 'stories'}
                />
                <p className="text-[10px] text-muted-foreground">
                  {postType === 'stories' 
                    ? "A API do Instagram não permite enviar legendas para Stories." 
                    : "Dica: Use hashtags para aumentar o alcance (máx. 30)."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lado Direito: Preview e Agendamento */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Agendamento
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Data e Hora</Label>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledFor && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledFor ? format(scheduledFor, "PPP HH:mm") : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledFor}
                      onSelect={(date) => {
                        if (date) {
                          const now = new Date();
                          date.setHours(now.getHours(), now.getMinutes());
                          setScheduledFor(date);
                        }
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t bg-muted/50">
                      <Label className="text-[10px] uppercase mb-2 block">Horário</Label>
                      <input 
                        type="time" 
                        className="w-full bg-background border rounded px-2 py-1 text-sm"
                        value={scheduledFor ? format(scheduledFor, "HH:mm") : ""}
                        onChange={(e) => {
                          if (scheduledFor) {
                            const [h, m] = e.target.value.split(':');
                            const newDate = new Date(scheduledFor);
                            newDate.setHours(parseInt(h), parseInt(m));
                            setScheduledFor(newDate);
                          }
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  onClick={() => handleSubmit(true)} 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-none"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Publicar Agora
                </Button>
                
                <Button 
                  onClick={() => handleSubmit(false)} 
                  variant="outline" 
                  className="w-full"
                  disabled={loading || !scheduledFor}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Agendar Publicação
                </Button>
              </div>

              <div className="pt-6 border-t mt-4">
                <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold mb-4">Preview Mobile</p>
                <div className={cn(
                  "mx-auto border-[10px] border-black rounded-[36px] overflow-hidden bg-black shadow-2xl flex flex-col transition-all duration-300",
                  postType === 'feed' ? "w-[280px]" : "w-[280px] aspect-[9/18.5]"
                )}>
                  {postType === 'feed' || postType === 'carousel' ? (
                    <div className="bg-white flex flex-col">
                      {/* IG Header (Feed) */}
                      <div className="px-3 py-2 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[1.5px]">
                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                            <Instagram className="h-3.5 w-3.5 text-neutral-500" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-semibold text-black truncate">{igUsername}</div>
                          <div className="text-[8px] text-neutral-500 truncate">Publicação • Agora</div>
                        </div>
                        <div className="text-black text-lg leading-none tracking-tighter">···</div>
                      </div>
                      
                      {/* Content Area (feed = square) */}
                      <div className="aspect-square bg-neutral-100 relative overflow-hidden">
                        {mediaUrls.length > 0 ? (
                          <div className="w-full h-full">
                            {postType === 'carousel' ? (
                              <div
                                ref={carouselScrollRef}
                                className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                onScroll={(e) => {
                                  const nextIndex = Math.round(e.currentTarget.scrollLeft / Math.max(e.currentTarget.clientWidth, 1));
                                  setCarouselPreviewIndex(nextIndex);
                                }}
                              >
                                {mediaUrls.map((url, index) => (
                                  <img key={`${url}-${index}`} src={url} className="h-full w-full shrink-0 snap-center object-cover" alt={`Preview ${index + 1}`} />
                                ))}
                              </div>
                            ) : (
                              <img src={mediaUrls[0]} className="w-full h-full object-cover" alt="Preview" />
                            )}
                            {postType === 'carousel' && mediaUrls.length > 1 && (
                              <>
                                <div className="absolute top-2 right-2 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                                  {carouselPreviewIndex + 1}/{mediaUrls.length}
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-background/80"
                                  disabled={carouselPreviewIndex === 0}
                                  onClick={() => {
                                    const nextIndex = Math.max(carouselPreviewIndex - 1, 0);
                                    setCarouselPreviewIndex(nextIndex);
                                    carouselScrollRef.current?.scrollTo({ left: nextIndex * carouselScrollRef.current.clientWidth, behavior: 'smooth' });
                                  }}
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-background/80"
                                  disabled={carouselPreviewIndex >= mediaUrls.length - 1}
                                  onClick={() => {
                                    const nextIndex = Math.min(carouselPreviewIndex + 1, mediaUrls.length - 1);
                                    setCarouselPreviewIndex(nextIndex);
                                    carouselScrollRef.current?.scrollTo({ left: nextIndex * carouselScrollRef.current.clientWidth, behavior: 'smooth' });
                                  }}
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                                  {mediaUrls.map((_, index) => (
                                    <span key={index} className={cn("h-1.5 w-1.5 rounded-full", index === carouselPreviewIndex ? "bg-background" : "bg-background/40")} />
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
                            <Instagram className="h-10 w-10 mb-2" />
                            <span className="text-[10px]">Sua mídia aqui</span>
                          </div>
                        )}
                      </div>

                      {/* IG Interactions reais */}
                      <div className="px-3 pt-2 pb-1 flex items-center gap-3 text-black">
                        <Heart className="h-5 w-5" strokeWidth={1.8} />
                        <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
                        <Send className="h-5 w-5" strokeWidth={1.8} />
                        <Bookmark className="h-5 w-5 ml-auto" strokeWidth={1.8} />
                      </div>
                      <div className="px-3 pb-1 text-[10px] font-semibold text-black">1.284 curtidas</div>
                      <div className="px-3 pb-3 text-[10px] text-black leading-snug">
                        <span className="font-semibold">{igUsername}</span>{' '}
                        <span className="whitespace-pre-wrap break-words">{(caption || 'Sua legenda aparecerá aqui...').slice(0, 180)}{(caption?.length ?? 0) > 180 ? '…' : ''}</span>
                      </div>
                    </div>
                  ) : (
                    /* Reels / Stories (Full Screen) */
                    <div className="h-full relative bg-neutral-900">
                      {mediaUrls.length > 0 ? (
                        mediaUrls[0].toLowerCase().includes('.mp4') || mediaUrls[0].toLowerCase().includes('.mov') ? (
                          <video src={mediaUrls[0]} className="w-full h-full object-cover" autoPlay muted loop />
                        ) : (
                          <img src={mediaUrls[0]} className="w-full h-full object-cover" alt="Preview" />
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/30">
                          <Instagram className="h-8 w-8 mb-2" />
                          <span className="text-[10px]">Preview Full</span>
                        </div>
                      )}
                      
                      {/* Overlays for Reels/Stories */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
                      
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted border border-white/20" />
                        <span className="text-[10px] font-bold text-white">seu_perfil</span>
                      </div>

                      <div className="absolute bottom-12 left-4 right-12">
                        <p className="text-[10px] text-white line-clamp-2">{caption || 'Sua legenda aqui...'}</p>
                      </div>

                      <div className="absolute bottom-12 right-2 flex flex-col gap-4 items-center">
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm" />
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm" />
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstagramCreate;
