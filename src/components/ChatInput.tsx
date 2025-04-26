import React, { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, Square } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, images?: File[]) => void;
  isStreaming: boolean;
  onStopStream: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isStreaming, onStopStream }) => {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
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
    if (message.trim() || images.length > 0) {
      onSendMessage(message, images.length > 0 ? images : undefined);
      setMessage('');
      setImages([]);
      setImagePreviewUrls([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setImages(prev => [...prev, ...fileArray]);
      // Generate previews
      fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviewUrls(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current && images.length === 1) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {imagePreviewUrls.length > 0 && (
        <div className="flex mb-2 gap-2 flex-wrap">
          {imagePreviewUrls.map((url, idx) => (
            <div key={idx} className="relative inline-block">
              <img 
                src={url} 
                alt={`Preview ${idx + 1}`} 
                className="h-20 rounded border dark:border-gray-600" 
              />
              <button 
                onClick={() => removeImage(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
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
          multiple
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