import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const InstagramCreate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Form State
  const [postType, setPostType] = useState<'feed' | 'reels' | 'carousel' | 'stories'>('feed');
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // AI State
  const [prompt, setPrompt] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash-exp");
  const [variations, setVariations] = useState<{ url: string; name: string }[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const uploadedUrls = [];

    for (const file of Array.from(files)) {
      const fileName = `${user?.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("instagram-media")
        .upload(fileName, file);

      if (error) {
        toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("instagram-media")
        .getPublicUrl(fileName);
      
      uploadedUrls.push(publicUrl);
    }

    setMediaUrls([...mediaUrls, ...uploadedUrls]);
    setLoading(false);
  };

  const generateAIImages = async () => {
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
          count: 3 
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
    if (postType === 'carousel') {
      setMediaUrls([...mediaUrls, url]);
    } else {
      setMediaUrls([url]);
    }
  };

  const removeMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (publishNow: boolean) => {
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
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-pink-100 p-3 rounded-xl dark:bg-pink-900/30">
          <Sparkles className="h-8 w-8 text-pink-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Criar Publicação</h2>
          <p className="text-muted-foreground">Crie e agende conteúdo incrível para o seu Instagram.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Configurações do Post */}
        <div className="lg:col-span-2 space-y-6">
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
              {/* Upload area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Label>Fazer Upload</Label>
                  <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      multiple={postType === 'carousel'}
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                    />
                    <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clique ou arraste arquivos</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-pink-500" />
                    Gerar com IA (Lovable AI)
                  </Label>
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Descreva a imagem que você deseja criar..." 
                      className="h-24 resize-none"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                          <SelectItem value="dalle-3">DALL-E 3</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={generateAIImages} 
                        disabled={generating} 
                        variant="secondary"
                        className="shrink-0"
                      >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Escreva algo interessante..." 
                className="h-32"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-2">
                Dica: Use hashtags para aumentar o alcance.
              </p>
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
                <div className="mx-auto w-[240px] border-8 border-black rounded-[30px] aspect-[9/18.5] overflow-hidden bg-white shadow-2xl flex flex-col">
                  {/* Phone UI header */}
                  <div className="h-6 w-full flex items-center justify-between px-4 pt-1">
                    <span className="text-[8px] font-bold">9:41</span>
                    <div className="flex gap-0.5">
                      <div className="w-2 h-1 bg-black rounded-full" />
                      <div className="w-2 h-1 bg-black rounded-full opacity-20" />
                    </div>
                  </div>
                  
                  {/* IG Header */}
                  <div className="p-2 border-b flex items-center gap-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[1px]">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-muted" />
                      </div>
                    </div>
                    <span className="text-[8px] font-bold">seu_perfil</span>
                  </div>

                  {/* IG Content */}
                  <div className="flex-1 bg-muted/20 relative">
                    {mediaUrls.length > 0 ? (
                      <img src={mediaUrls[0]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                        <Instagram className="h-8 w-8 mb-2" />
                        <span className="text-[10px]">Preview</span>
                      </div>
                    )}
                  </div>

                  {/* IG Interactions */}
                  <div className="p-2 flex gap-2">
                    <div className="w-3 h-3 border border-black rounded-full" />
                    <div className="w-3 h-3 border border-black rounded-full" />
                    <div className="w-3 h-3 border border-black rounded-full" />
                  </div>
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
