import { useState, useRef } from 'react';
import { ChatMessageProps } from '../components/ChatMessage';

// Add type for token usage
export interface LLMTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export const useChatMessages = (settings: { baseUrl: string; apiKey: string; chatMemoryTurns: number; systemPrompt: string; model: string }) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<LLMTokenUsage | null>(null);
  const activeResponseIndex = useRef<number | null>(null);

  // Accept multiple images and send as OpenAI-compatible content array
  const sendMessage = async (content: string, images?: File[], abortSignal?: AbortSignal) => {
    // Compose OpenAI-compatible content array
    let messageContent: any[] = [];
    if (content.trim()) {
      messageContent.push({ type: 'text', text: content });
    }
    if (images && images.length > 0) {
      // Convert images to base64 data URLs (if backend supports it)
      for (const img of images) {
        const dataUrl = await fileToDataUrl(img);
        messageContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    }
    // Compose new message list in a single pass
    let newMsgs: ChatMessageProps[] = [];
    let msgs = [...messages];
    // Remove empty assistant message at the end, if present
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && !msgs[msgs.length - 1].content) {
      msgs.pop();
    }
    // Check for system prompt
    const hasSystemPrompt = msgs.length > 0 && msgs[0].role === 'system';
    // Remove oldest turns if over memory limit
    let turns = [];
    let start = hasSystemPrompt ? 1 : 0;
    for (let i = start; i < msgs.length; i += 2) {
      if (msgs[i].role === 'user' && msgs[i + 1]?.role === 'assistant') {
        turns.push([msgs[i], msgs[i + 1]]);
      }
    }
    // Keep only most recent N turns
    while (turns.length >= settings.chatMemoryTurns) {
      turns.shift();
    }
    // Flatten turns back to message array
    newMsgs = hasSystemPrompt ? [msgs[0]] : [];
    newMsgs = newMsgs.concat(turns.flat());
    // Add new user message
    let userMessage: ChatMessageProps = {
      content,
      role: 'user',
      timestamp: new Date().toISOString(),
      images: images && images.length > 0 ? await Promise.all(images.map(fileToDataUrl)) : undefined
    } as any; // 'as any' to allow images property for UI rendering
    // For backward compatibility, keep first image in 'image' property
    if (images && images.length > 0) {
      userMessage.image = userMessage.images?.[0];
    }
    newMsgs.push(userMessage);
    // Add assistant placeholder with streaming dots
    const assistantMessage: ChatMessageProps = {
      content: '...STREAMING',
      role: 'assistant',
      timestamp: new Date().toISOString()
    };
    newMsgs.push(assistantMessage);
    // Add system prompt if needed
    if (settings.systemPrompt && !(newMsgs.length > 0 && newMsgs[0].role === 'system')) {
      newMsgs.unshift({ content: settings.systemPrompt, role: 'system', timestamp: new Date().toISOString() });
    }
    setMessages(newMsgs);
    setTokenUsage(null);
    // Find index of last assistant placeholder in local array
    const lastAssistantIdx = newMsgs.map(m => m.role).lastIndexOf('assistant');
    activeResponseIndex.current = lastAssistantIdx;
    let aborted = false;
    const abortListener = () => {
      aborted = true;
      setIsStreaming(false);
    };
    abortSignal?.addEventListener('abort', abortListener);
    setIsStreaming(true);
    try {
      // Send to backend using OpenAI-compatible content array
      const chatMessages = [
        ...newMsgs
          .filter((_, i) => i !== lastAssistantIdx)
          .map(({ content, role, image }) => {
            // For user message, use messageContent array
            if (role === 'user') {
              return { role, content: messageContent };
            }
            return { role, content };
          })
      ];
      const payload = {
        model: settings.model,
        messages: chatMessages,
        stream: true
      };
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
        },
        body: JSON.stringify(payload),
        signal: abortSignal,
      });
      if (!response.body) {
        // Non-streaming fallback: parse as JSON
        const data = await response.json();
        const message = data.choices?.[0]?.message?.content;
        if (message) {
          setMessages(prev => {
            const updated = [...prev];
            if (activeResponseIndex.current !== null && updated[activeResponseIndex.current]) {
              updated[activeResponseIndex.current] = {
                ...updated[activeResponseIndex.current],
                content: message
              };
            }
            return updated;
          });
        }
        if (data.usage) setTokenUsage(data.usage);
        setIsStreaming(false);
        return;
      }
      // Streaming block
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      let usage: LLMTokenUsage | null = null;
      while (!done) {
        if (abortSignal && abortSignal.aborted) break;
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;
          let lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            let jsonStr = null;
            if (trimmed.startsWith('data:')) {
              jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') continue;
            } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              jsonStr = trimmed;
            }
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                if (data.usage) usage = data.usage;
                const delta = data.choices?.[0]?.delta?.content;
                const message = data.choices?.[0]?.message?.content;
                const text = delta ?? message;
                if (text) {
                  setMessages(prev => {
                    const updated = [...prev];
                    if (activeResponseIndex.current !== null && updated[activeResponseIndex.current]) {
                      if (updated[activeResponseIndex.current].content === '...STREAMING') {
                        updated[activeResponseIndex.current] = {
                          ...updated[activeResponseIndex.current],
                          content: text
                        };
                      } else {
                        updated[activeResponseIndex.current] = {
                          ...updated[activeResponseIndex.current],
                          content: updated[activeResponseIndex.current].content + text
                        };
                      }
                    }
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      }
      if (usage) setTokenUsage(usage);
      if (buffer.trim().startsWith('{') && buffer.trim().endsWith('}')) {
        try {
          const data = JSON.parse(buffer.trim());
          const message = data.choices?.[0]?.message?.content;
          if (message) {
            setMessages(prev => {
              const updated = [...prev];
              if (activeResponseIndex.current !== null && updated[activeResponseIndex.current]) {
                updated[activeResponseIndex.current] = {
                  ...updated[activeResponseIndex.current],
                  content: message
                };
              }
              return updated;
            });
          }
          if (data.usage) setTokenUsage(data.usage);
        } catch {}
      }
    } catch (err) {
      if (abortSignal && abortSignal.aborted) {
        setMessages(prev => {
          const updated = [...prev];
          const idx = activeResponseIndex.current !== null ? activeResponseIndex.current : updated.map(m => m.role).lastIndexOf('assistant');
          if (idx !== -1 && updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              content: (updated[idx].content ? updated[idx].content + '\n' : '') + '⏹️ Streaming stopped by user.'
            };
          }
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          const idx = activeResponseIndex.current !== null ? activeResponseIndex.current : updated.map(m => m.role).lastIndexOf('assistant');
          if (idx !== -1 && updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              content: (updated[idx].content ? updated[idx].content + '\n' : '') + `⚠️ LLM backend not responding. ${(err instanceof Error ? err.message : err)}`
            };
          }
          return updated;
        });
      }
    } finally {
      if (!aborted) setIsStreaming(false);
      abortSignal?.removeEventListener('abort', abortListener);
      activeResponseIndex.current = null;
    }
  };

  // Helper to convert File to base64 data URL
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  return {
    messages,
    sendMessage,
    isStreaming,
    setMessages,
    tokenUsage,
  };
};

export default useChatMessages;