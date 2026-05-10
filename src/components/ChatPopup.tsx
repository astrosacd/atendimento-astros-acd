import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, History, Plus, Trash2, ChevronLeft, Search, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  preview?: string;
}

interface ChatConfig {
  name: string;
  welcomeMessage: string;
  placeholder: string;
  themeColor: string;
  operatingHoursEnabled: boolean;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  offlineMessage: string;
  quickReplies: { trigger: string; response: string }[];
  aiModel: string;
}

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const themeGradients: Record<string, string> = {
  purple: 'from-purple-600 to-purple-800',
  blue: 'from-blue-600 to-blue-800',
  green: 'from-emerald-600 to-emerald-800',
  red: 'from-red-600 to-red-800',
  orange: 'from-orange-600 to-orange-800',
  pink: 'from-pink-600 to-pink-800',
};

const themeBgColors: Record<string, string> = {
  purple: 'bg-purple-600',
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  red: 'bg-red-600',
  orange: 'bg-orange-600',
  pink: 'bg-pink-600',
};

export default function ChatPopup({ isOpen, onClose }: ChatPopupProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<ChatConfig>({
    name: 'Lyra',
    welcomeMessage: 'Olá! Sou a Lyra, sua assistente virtual. Como posso ajudá-lo hoje?',
    placeholder: 'Digite sua mensagem...',
    themeColor: 'purple',
    operatingHoursEnabled: false,
    operatingHoursStart: '08:00',
    operatingHoursEnd: '18:00',
    offlineMessage: 'Estamos fora do horário de atendimento.',
    quickReplies: [],
    aiModel: 'google/gemini-2.5-flash',
  });
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await supabase
          .from('billing_config')
          .select('config_key, config_value')
          .like('config_key', 'chat_%');

        if (data) {
          const configMap: Record<string, string> = {};
          data.forEach(item => {
            configMap[item.config_key] = item.config_value;
          });

          let quickReplies: { trigger: string; response: string }[] = [];
          try {
            quickReplies = JSON.parse(configMap.chat_quick_replies || '[]');
          } catch {
            quickReplies = [];
          }

          setConfig({
            name: configMap.chat_name || 'Lyra',
            welcomeMessage: configMap.chat_welcome_message || 'Olá! Sou a Lyra, sua assistente virtual. Como posso ajudá-lo hoje?',
            placeholder: configMap.chat_placeholder || 'Digite sua mensagem...',
            themeColor: configMap.chat_theme_color || 'purple',
            operatingHoursEnabled: configMap.chat_operating_hours_enabled === 'true',
            operatingHoursStart: configMap.chat_operating_hours_start || '08:00',
            operatingHoursEnd: configMap.chat_operating_hours_end || '18:00',
            offlineMessage: configMap.chat_offline_message || 'Estamos fora do horário de atendimento.',
            quickReplies,
            aiModel: configMap.chat_ai_model || 'google/gemini-2.5-flash',
          });
          setCurrentModel(configMap.chat_ai_model || 'google/gemini-2.5-flash');
        }
      } catch (error) {
        console.error('Error loading chat config:', error);
      }
    };

    loadConfig();
  }, []);

  // Load conversations
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    
    try {
      const { data: convData, error } = await supabase
        .from('chat_conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Load first message preview for each conversation
      const conversationsWithPreview: Conversation[] = [];
      for (const conv of convData || []) {
        const { data: msgData } = await supabase
          .from('chat_messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(1);
        
        conversationsWithPreview.push({
          ...conv,
          preview: msgData?.[0]?.content?.slice(0, 100) || ''
        });
      }
      
      setConversations(conversationsWithPreview);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(query) ||
      (conv.preview && conv.preview.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  const loadConversation = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data?.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) || []);
      setCurrentConversationId(conversationId);
      setShowHistory(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const createNewConversation = async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: 'Nova conversa' })
        .select('id')
        .single();

      if (error) throw error;
      
      setCurrentConversationId(data.id);
      loadConversations();
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setSearchQuery('');
  };

  // Check operating hours
  useEffect(() => {
    if (config.operatingHoursEnabled) {
      const checkHours = () => {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startH, startM] = config.operatingHoursStart.split(':').map(Number);
        const [endH, endM] = config.operatingHoursEnd.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        setIsOffline(currentTime < startMinutes || currentTime > endMinutes);
      };

      checkHours();
      const interval = setInterval(checkHours, 60000);
      return () => clearInterval(interval);
    } else {
      setIsOffline(false);
    }
  }, [config.operatingHoursEnabled, config.operatingHoursStart, config.operatingHoursEnd]);

  const checkQuickReplies = (userMessage: string): string | null => {
    const lowerMessage = userMessage.toLowerCase();
    for (const reply of config.quickReplies) {
      if (reply.trigger && lowerMessage.includes(reply.trigger.toLowerCase())) {
        return reply.response;
      }
    }
    return null;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (isOffline) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: config.offlineMessage }
      ]);
      setInput('');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    const userInput = input; // Capture input before clearing
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Check for quick replies first
    const quickReply = checkQuickReplies(userInput);
    if (quickReply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: quickReply }]);
      return;
    }

    setIsLoading(true);

    try {
      // Create conversation if needed
      let convId = currentConversationId;
      if (!convId && user) {
        convId = await createNewConversation();
      }

      // Get user role from user_roles table
      let userRole = 'user';
      let isAdmin = false;
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData) {
          userRole = roleData.role;
          isAdmin = roleData.role === 'admin';
        }
      }

      // Build messages array with the new user message included
      const allMessages = [...messages, userMessage];

      const { data, error } = await supabase.functions.invoke('chat-lyra', {
        body: { 
          messages: allMessages,
          conversationId: convId,
          userId: user?.id,
          userRole,
          isAdmin
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar sua mensagem.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      if (data.model) {
        setCurrentModel(data.model);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Tente novamente mais tarde.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  const gradient = themeGradients[config.themeColor] || themeGradients.purple;
  const bgColor = themeBgColors[config.themeColor] || themeBgColors.purple;

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradient} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="text-white hover:bg-white/20 h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {showHistory ? 'Histórico' : `${config.name}`}
            </h3>
            {!showHistory && (
              <p className="text-xs text-white/70">
                {currentModel ? currentModel.split('/')[1] : config.aiModel.split('/')[1]}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <Button variant="ghost" size="icon" onClick={startNewChat} className="text-white hover:bg-white/20 h-8 w-8" title="Nova conversa">
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} className="text-white hover:bg-white/20 h-8 w-8" title="Histórico">
                <History className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* History View */
        <div className="flex flex-col h-80 bg-secondary/50">
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por palavras-chave..."
                className="pl-9 bg-background/50 border-border/50 h-9 text-sm"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-3">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                {searchQuery ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa salva ainda.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between group ${
                      currentConversationId === conv.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border/40 hover:border-border hover:bg-background/50'
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      {conv.preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.preview}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {new Date(conv.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        /* Chat View */
        <>
          <div className="h-72 overflow-y-auto p-4 space-y-3 bg-secondary/50">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                {config.welcomeMessage}
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } animate-fade-in`}
              >
                {message.role === 'assistant' && (
                  <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-xl text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-muted p-3 rounded-xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={config.placeholder}
              className="flex-1 bg-input border-border text-foreground"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
