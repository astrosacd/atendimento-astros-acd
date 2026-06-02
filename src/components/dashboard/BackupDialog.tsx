import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Mail, MessageSquare, Plus, Trash2, Database } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  is_active: boolean;
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [method, setMethod] = useState<"download" | "email" | "whatsapp">("download");
  
  // Email states
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  
  // WhatsApp states
  const [whatsappRecipients, setWhatsappRecipients] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchInitialData();
    }
  }, [open]);

  const fetchInitialData = async () => {
    try {
      // Buscar o e-mail remetente (gmail_user) para EXCLUIR da lista de destinatários,
      // já que ele é quem envia, não precisa receber.
      const { data: configData } = await supabase
        .from("recovery_config")
        .select("config_key, config_value")
        .eq("config_key", "gmail_user")
        .maybeSingle();

      const senderEmail = (configData?.config_value || "").trim().toLowerCase();

      // Pré-preencher apenas com o e-mail do usuário logado (se diferente do remetente)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user.email.toLowerCase() !== senderEmail) {
        setEmailRecipients([user.email]);
      }

      // Fetch WhatsApp instances
      const { data: whatsappData } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, is_active")
        .eq("is_active", true);
      
      if (whatsappData) {
        setInstances(whatsappData);
        if (whatsappData.length > 0) {
          setSelectedInstance(whatsappData[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching backup settings:", error);
    }
  };


  const addEmail = () => {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      if (!emailRecipients.includes(newEmail)) {
        setEmailRecipients([...emailRecipients, newEmail]);
      }
      setNewEmail("");
    } else {
      toast({
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail válido.",
        variant: "destructive",
      });
    }
  };

  const removeEmail = (index: number) => {
    setEmailRecipients(emailRecipients.filter((_, i) => i !== index));
  };

  const addPhone = () => {
    if (newPhone && newPhone.length >= 8) {
      if (!whatsappRecipients.includes(newPhone)) {
        setWhatsappRecipients([...whatsappRecipients, newPhone]);
      }
      setNewPhone("");
    } else {
      toast({
        title: "Número inválido",
        description: "Por favor, insira um número de WhatsApp válido.",
        variant: "destructive",
      });
    }
  };

  const removePhone = (index: number) => {
    setWhatsappRecipients(whatsappRecipients.filter((_, i) => i !== index));
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-data", {
        body: {
          includeLogs,
          sendEmail: method === "email",
          emailRecipients: method === "email" ? emailRecipients : [],
          sendWhatsApp: method === "whatsapp",
          whatsappRecipients: method === "whatsapp" ? whatsappRecipients : [],
          whatsappInstanceId: method === "whatsapp" ? selectedInstance : undefined,
        },
      });

      if (error) throw error;

      if (method === "download" && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }

      toast({
        title: "Backup iniciado!",
        description: method === "download" 
          ? "O download deve começar em breve." 
          : `O link do backup está sendo enviado via ${method}.`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Backup error:", error);
      toast({
        title: "Erro no backup",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Backup do Sistema</DialogTitle>
          <DialogDescription>
            Escolha como deseja receber o backup completo dos dados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="includeLogs" 
              checked={includeLogs}
              onCheckedChange={(checked) => setIncludeLogs(!!checked)}
            />
            <Label htmlFor="includeLogs" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Incluir logs gigantes (deixa o backup mais pesado)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Método de Envio</Label>
            <Select value={method} onValueChange={(v: any) => setMethod(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="download">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>Baixar agora</span>
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Enviar por e-mail</span>
                  </div>
                </SelectItem>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Enviar por WhatsApp</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "email" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label>Destinatários de E-mail</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="exemplo@email.com" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEmail()}
                />
                <Button size="icon" variant="outline" onClick={addEmail}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="max-h-[100px] overflow-y-auto space-y-2">
                {emailRecipients.map((email, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded-md text-sm">
                    <span className="truncate">{email}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeEmail(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {method === "whatsapp" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label>Instância WhatsApp</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label>Números de Destino</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="5585999999999" 
                  value={newPhone} 
                  onChange={(e) => setNewPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPhone()}
                />
                <Button size="icon" variant="outline" onClick={addPhone}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="max-h-[100px] overflow-y-auto space-y-2">
                {whatsappRecipients.map((phone, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded-md text-sm">
                    <span>{phone}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePhone(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleBackup} disabled={loading || (method === "email" && emailRecipients.length === 0) || (method === "whatsapp" && whatsappRecipients.length === 0)}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            {method === "download" ? "Gerar e Baixar" : "Gerar e Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


