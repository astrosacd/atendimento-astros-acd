import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, History, Settings, Sparkles, Link as LinkIcon, Plus, Copy, Trash2, Clock, Check, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { format, addHours, addDays } from "date-fns";
import InstagramCreate from "./InstagramCreate";
import InstagramHistory from "./InstagramHistory";
import InstagramSettings from "./InstagramSettings";

const InstagramModule = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-pink-100 p-3 rounded-xl dark:bg-pink-900/30">
            <Instagram className="h-8 w-8 text-pink-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Módulo Instagram</h1>
            <p className="text-muted-foreground">Gerencie suas publicações, histórico e configurações.</p>
          </div>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="create" className="gap-2">
              <Sparkles className="h-4 w-4" /> Criar Post
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <InstagramCreate />
          </TabsContent>
          <TabsContent value="history">
            <InstagramHistory />
          </TabsContent>
          <TabsContent value="settings">
            <InstagramSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default InstagramModule;
