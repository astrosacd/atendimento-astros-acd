import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  });
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          });
        }
      } catch (error) {
        console.error('Error loading chat config:', error);
      }
    };

    loadConfig();
  }, []);

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
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Check for quick replies first
    const quickReply = checkQuickReplies(input);
    if (quickReply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: quickReply }]);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-lyra', {
        body: { messages: [...messages, userMessage] },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar sua mensagem.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
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
    <div className="fixed bottom-6 right-6 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradient} p-4 flex items-center justify-between`}>
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {config.name} - Assistente Virtual
          </h3>
          <p className="text-sm text-white/80">
            {isOffline ? 'Fora do horário' : 'Como posso ajudar?'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-secondary/50">
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
    </div>
  );
}
