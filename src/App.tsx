import { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsDrawer from './components/SettingsDrawer';
import useChatMessages from './hooks/useChatMessages';
import { fetchModels } from './utils/fetchModels';

// Define a Settings type for clarity
type Settings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  chatMemoryTurns: number;
  systemPrompt: string;
};

function App() {
  // Settings state
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem('settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return {
      baseUrl: '',
      apiKey: '',
      model: '',
      chatMemoryTurns: 0,
      systemPrompt: '',
    };
  });
  const [models, setModels] = useState<string[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      return 'light';
    }
    return 'light';
  });

  // Chat messages and sending functionality
  const streamAbortRef = useRef<AbortController | null>(null);
  const { messages, sendMessage, isStreaming, setMessages, tokenUsage } = useChatMessages(settings);

  // Stop streaming handler
  const handleStopStream = () => {
    if (streamAbortRef.current) {
      console.log('Aborting stream...');
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
  };

  // Modified sendMessage to support abort controller
  const handleSendMessage = (content: string, image?: File) => {
    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    sendMessage(content, image, abortController.signal);
    // Force autoscroll after sending a message
    setTimeout(() => {
      setAutoScroll(true);
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100); // Delay to allow new message to render
  };

  // Theme toggle logic
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch models when baseUrl or apiKey changes
  useEffect(() => {
    async function loadModels() {
      const result = await fetchModels(settings.baseUrl, settings.apiKey);
      setModels(result.length > 0 ? result : [settings.model]);
    }
    loadModels();
  }, [settings.baseUrl, settings.apiKey]);

  // Auto-scroll to bottom when messages change, unless user has scrolled up
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect user scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 5;
      setAutoScroll(atBottom);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    // In a real implementation, you would save these settings to local storage
    // or send them to the backend
  };

  // New chat handler: clears chat but keeps system prompt
  const handleNewChat = () => {
    setMessages(prev => {
      const sysPromptMsg = prev.length > 0 && prev[0].role === 'system' ? [prev[0]] : [];
      return sysPromptMsg;
    });
  };

  const handleChangeModel = (model: string) => {
    setSettings(prev => ({ ...prev, model }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewChat={handleNewChat}
        models={models}
        selectedModel={settings.model}
        onChangeModel={handleChangeModel}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto p-4" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="max-w-md">
                <h2 className="text-xl font-semibold mb-2">Welcome to ChatBox</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Start a conversation with the AI by typing a message below. 
                  You can also configure your API settings by clicking the settings icon.
                </p>
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <p className="text-indigo-700 dark:text-indigo-300 text-sm">
                    <strong>Tip:</strong> For best results, be clear and specific in your prompts. 
                    You can attach images by clicking the image icon.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  content={msg.content}
                  role={msg.role}
                  timestamp={msg.timestamp}
                  image={msg.image}
                  tokens={index === messages.length - 1 && msg.role === 'assistant' && tokenUsage ? tokenUsage : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>
      
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isStreaming={isStreaming} 
        onStopStream={handleStopStream} 
      />
      
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}

export default App;