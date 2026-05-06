import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, History, Settings, Sparkles } from "lucide-react";
import InstagramCreate from "./InstagramCreate";
import InstagramHistory from "./InstagramHistory";
import InstagramSettings from "./InstagramSettings";

const InstagramModule = () => {
  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
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
  );
};

export default InstagramModule;
