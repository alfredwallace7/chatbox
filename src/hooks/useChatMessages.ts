import { useState, useRef } from 'react';
import { ChatMessageProps } from '../components/ChatMessage';

// Mock function to simulate streaming from an LLM
const mockStreamResponse = async (
  prompt: string,
  image: File | undefined,
  onChunk: (chunk: string) => void,
  settings: { baseUrl: string; apiKey: string; model: string; chatMemoryTurns: number; systemPrompt: string },
  abortSignal?: AbortSignal
) => {
  // In a real implementation, this would connect to your Python backend via WebSockets or SSE
  const response = `I'm a simulated AI response to your message: "${prompt}"${
    image ? " (I see you've attached an image too!)" : ""
  }
  
Here are some details about what I'd do in a real implementation:
- Send your prompt to the API at ${settings.baseUrl}
- Use the ${settings.model} model
- Process the image if provided
- Stream the response back to you in chunks, just like this text is appearing

This is just a frontend demo, but when connected to PyWebView and Promptic,
it would communicate with a real LLM API using your credentials.`;

  const chunks = response.split(' ');
  
  for (const chunk of chunks) {
    if (abortSignal?.aborted) {
      console.log('Streaming aborted! abortSignal.aborted:', abortSignal.aborted);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 70));
    onChunk(chunk + ' ');
  }
};

// Add type for token usage
export interface LLMTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export const useChatMessages = (settings: { baseUrl: string; apiKey: string; model: string; chatMemoryTurns: number; systemPrompt: string }) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<LLMTokenUsage | null>(null);
  const activeResponseIndex = useRef<number | null>(null);

  const sendMessage = async (content: string, image?: File, abortSignal?: AbortSignal) => {
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
      image: undefined // will set below if needed
    };
    if (image) {
      // Convert image to base64 before storing in history
      userMessage.image = await fileToDataUrl(image);
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
    setIsStreaming(true);

    // --- FIX: Ensure isStreaming is reset if aborted early ---
    let aborted = false;
    const abortListener = () => {
      aborted = true;
      setIsStreaming(false);
    };
    abortSignal?.addEventListener('abort', abortListener);

    try {
      // Prepare chat history for API (remove the empty assistant message)
      let chatMessages = newMsgs
        .filter((_, i) => i !== lastAssistantIdx)
        .map(({ content, role, image }) => {
          if (role === 'user' && image) {
            // Use the base64 image string from history
            return { role, content: [
              { type: 'text', text: content },
              { type: 'image_url', image_url: { url: image } },
            ]};
          }
          return { role, content };
        });

      // Debug log: show payload sent to backend
      console.log('Sending to backend:', JSON.stringify({
        model: settings.model,
        messages: chatMessages,
        stream: true
      }, null, 2));

      // Send prompt to backend
      // Allow empty apiKey for local/self-hosted backends
      if (settings.baseUrl && settings.model) {
        try {
          const response = await fetch(`${settings.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
            },
            body: JSON.stringify({
              model: settings.model,
              messages: chatMessages,
              stream: true
            }),
            signal: abortSignal,
          });
          if (!response.body) throw new Error('No response stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let done = false;
          // Token usage state
          let usage: LLMTokenUsage | null = null;
          while (!done) {
            if (abortSignal && abortSignal.aborted) break;
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (value) {
              buffer += decoder.decode(value, { stream: true });
              let lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data:')) {
                  const jsonStr = trimmed.slice(5).trim();
                  if (jsonStr === '[DONE]') continue;
                  try {
                    const data = JSON.parse(jsonStr);
                    // LOG RAW LLM OUTPUT
                    console.log('[LLM RAW OUTPUT]', data);
                    // Capture token usage if present (only update after stream ends)
                    if (data.usage) {
                      usage = data.usage;
                    }
                    const delta = data.choices?.[0]?.delta?.content;
                    if (delta) {
                      setMessages(prev => {
                        const updated = [...prev];
                        if (activeResponseIndex.current !== null && updated[activeResponseIndex.current]) {
                          // If currently showing streaming dots, replace with first chunk
                          if (updated[activeResponseIndex.current].content === '...STREAMING') {
                            updated[activeResponseIndex.current] = {
                              ...updated[activeResponseIndex.current],
                              content: delta
                            };
                          } else {
                            updated[activeResponseIndex.current] = {
                              ...updated[activeResponseIndex.current],
                              content: updated[activeResponseIndex.current].content + delta
                            };
                          }
                        }
                        return updated;
                      });
                    }
                  } catch (err) {
                    // Optionally handle JSON parse error
                  }
                }
              }
            }
          }
          // After stream ends, set token usage if found
          if (usage) setTokenUsage(usage);
        } catch (err) {
          if (abortSignal && abortSignal.aborted) {
            // Streaming was aborted by user
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
        }
      } else {
        // If backend is not available, fallback to mock
        await mockStreamResponse(
          content, 
          image,
          (chunk) => {
            setMessages(prev => {
              const updated = [...prev];
              if (activeResponseIndex.current !== null && updated[activeResponseIndex.current]) {
                // If currently showing streaming dots, replace with first chunk
                if (updated[activeResponseIndex.current].content === '...STREAMING') {
                  updated[activeResponseIndex.current] = {
                    ...updated[activeResponseIndex.current],
                    content: chunk
                  };
                } else {
                  updated[activeResponseIndex.current] = {
                    ...updated[activeResponseIndex.current],
                    content: updated[activeResponseIndex.current].content + chunk
                  };
                }
              }
              return updated;
            });
          },
          settings,
          abortSignal
        );
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