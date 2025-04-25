import React, { useState } from 'react';
import { Clipboard, ClipboardCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-plain_text';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import classNames from 'classnames';
import { detect } from 'lang-detector';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessageProps {
  content: string;
  role: MessageRole;
  timestamp?: string;
  image?: string;
}

interface ChatMessageWithTokens extends ChatMessageProps {
  tokens?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function detectLang(code: string): string {
  try {
    const detected = detect(code);
    if (typeof detected === 'string') {
      const map: Record<string, string> = {
        javascript: 'javascript',
        python: 'python',
        markdown: 'markdown',
        cpp: 'c_cpp',
        c: 'c_cpp',
        json: 'json',
        typescript: 'typescript',
        java: 'java',
        plaintext: 'plain_text',
        text: 'plain_text',
      };
      return map[detected.toLowerCase()] || 'plain_text';
    }
  } catch {}
  return 'plain_text';
}

const ChatMessage: React.FC<ChatMessageWithTokens> = ({ 
  content, 
  role, 
  timestamp,
  image,
  tokens
}) => {
  let formattedTime = '';
  if (timestamp) {
    // If timestamp is a string, try to parse it to a Date
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (date instanceof Date && !isNaN(date.getTime())) {
      formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      formattedTime = String(timestamp);
    }
  }
  
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const isAssistant = role === 'assistant';
  const isStreaming = typeof content === 'string' && content.endsWith('...STREAMING');

  if (isSystem) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 italic my-2 text-center">
        {content}
      </div>
    );
  }

  const showStreamingDots = isAssistant && (isStreaming || (!content && isStreaming));

  return (
    <div className={classNames('flex', isUser ? 'justify-end' : 'justify-start') + ' my-2'}>
      <div className={classNames(
        'rounded-lg px-4 py-2 max-w-[80%] shadow-sm',
        isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
      )}>
        {image && <img src={image} alt="Uploaded content" className="max-w-full rounded mb-2" />}
        {showStreamingDots ? (
          <span className="inline-flex items-center gap-1">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce delay-150">.</span>
            <span className="animate-bounce delay-300">.</span>
          </span>
        ) : (
          <ReactMarkdown
            components={{
              code({node, className = '', children, ...props}: any) {
                const match = /language-(\w+)/.exec(className);
                const isInline = node && node.tagName === 'inlineCode';
                const codeStr = String(children).replace(/\n$/, '');
                const [copied, setCopied] = useState(false);
                let lang = match?.[1]?.toLowerCase();
                if (!lang || lang === 'text' || lang === 'plain_text') {
                  lang = detectLang(codeStr);
                }
                // If language is plain_text, let markdown handle the block (do not use AceEditor)
                if (!isInline && lang !== 'plain_text') {
                  return (
                    <div className="relative my-2 group" style={{ background: '#23272e', borderRadius: 6 }}>
                      {/* Tag and Copy Row */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        margin: '10px 14px 0 0',
                        zIndex: 11
                      }}>
                        <span
                          style={{
                            background: 'rgba(40, 44, 52, 0.85)',
                            color: '#e2e8f0',
                            borderRadius: '999px',
                            padding: '2px 14px',
                            fontSize: '0.72em',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            boxShadow: '0 2px 10px #0003',
                            border: '1px solid #3b3f46',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            transition: 'background 0.2s',
                            display: 'inline-block'
                          }}
                        >
                          {lang.replace('_', ' ').toUpperCase()}
                        </span>
                        <button
                          className={classNames(
                            'p-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 transition',
                            copied && 'bg-green-500 text-white'
                          )}
                          style={{ boxShadow: '0 2px 10px #0003', border: '1px solid #3b3f46' }}
                          onClick={() => {
                            navigator.clipboard.writeText(codeStr).then(() => {
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1200);
                            });
                          }}
                          title={copied ? 'Copied!' : 'Copy code'}
                        >
                          {copied ? <ClipboardCheck className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                        </button>
                      </div>
                      <AceEditor
                        mode={lang}
                        theme={document.documentElement.classList.contains('dark') ? 'monokai' : 'github'}
                        value={codeStr}
                        readOnly={true}
                        minLines={Math.max(3, codeStr.split('\n').length)}
                        maxLines={Infinity}
                        fontSize={14}
                        showGutter={true}
                        highlightActiveLine={false}
                        setOptions={{
                          enableBasicAutocompletion: false,
                          enableLiveAutocompletion: false,
                          showLineNumbers: true,
                          tabSize: 2,
                          useWorker: false,
                          displayIndentGuides: false
                        }}
                        style={{ borderRadius: 0, background: 'none' }}
                      />
                    </div>
                  );
                }
                // Let markdown render the block for plain_text or inline
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {content.replace(/\.\.\.STREAMING$/, '')}
          </ReactMarkdown>
        )}
        {/* Only show time when not streaming for assistant */}
        {formattedTime && (!isAssistant || !isStreaming) && (
          <div className="text-xs text-left text-gray-400 mt-1">
            {formattedTime}
            {/* Token usage info */}
            {tokens && (
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                | Tokens: prompt {tokens.prompt_tokens}, generated {tokens.completion_tokens}, total {tokens.total_tokens}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;