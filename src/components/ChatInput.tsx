import React, { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, Square } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, image?: File) => void;
  isStreaming: boolean;
  onStopStream: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isStreaming, onStopStream }) => {
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea at mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() || image) {
      onSendMessage(message, image || undefined);
      setMessage('');
      setImage(null);
      setImagePreviewUrl(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {imagePreviewUrl && (
        <div className="relative mb-2 inline-block">
          <img 
            src={imagePreviewUrl} 
            alt="Preview" 
            className="h-20 rounded border dark:border-gray-600" 
          />
          <button 
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-end space-x-2">
        <textarea
          ref={textareaRef}
          className="flex-grow p-3 border rounded-lg resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          placeholder="Type your message..."
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ minHeight: '44px', maxHeight: '200px' }}
        />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button
          className="chat-action-btn"
          onClick={triggerFileInput}
          aria-label="Attach image"
        >
          <ImagePlus className="w-6 h-6" />
        </button>
        {isStreaming ? (
          <button
            className="chat-action-btn chat-action-btn-stop"
            style={{ alignSelf: 'end', marginBottom: 0 }}
            onClick={onStopStream}
            aria-label="Stop streaming"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            className="chat-action-btn chat-action-btn-send"
            style={{ alignSelf: 'end', marginBottom: 0 }}
            onClick={handleSendMessage}
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;