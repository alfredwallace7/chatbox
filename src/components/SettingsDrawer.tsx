import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface Settings {
  baseUrl: string;
  apiKey: string;
  chatMemoryTurns: number;
  systemPrompt: string;
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setLocalSettings((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
    setTestStatus('idle');
    setTestMessage('');
  };

  const handleTestConnexion = async (e: React.MouseEvent) => {
    e.preventDefault();
    setTestStatus('idle');
    setTestMessage('');
    try {
      // Use /v1/models as test endpoint, but avoid double /v1/v1
      let url = localSettings.baseUrl.replace(/\/$/, '');
      if (url.endsWith('/v1')) {
        url += '/models';
      } else {
        url += '/v1/models';
      }
      const headers: Record<string, string> = {};
      if (localSettings.apiKey) headers['Authorization'] = `Bearer ${localSettings.apiKey}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setTestStatus('success');
      setTestMessage('Connexion successful!');
      // Save settings and close drawer on success
      localStorage.setItem('settings', JSON.stringify(localSettings));
      if (onSaveSettings) onSaveSettings(localSettings);
      setTimeout(() => {
        onClose();
      }, 700); // Give user feedback before closing
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage('Error: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
        ></div>
      )}
      
      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form className="p-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Base URL
            </label>
            <input
              type="url"
              id="baseUrl"
              name="baseUrl"
              value={localSettings.baseUrl}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://api.example.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              value={localSettings.apiKey}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Your API key"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="chatMemoryTurns" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Number of turns in chat memory
            </label>
            <input
              type="number"
              id="chatMemoryTurns"
              name="chatMemoryTurns"
              min="1"
              value={localSettings.chatMemoryTurns ?? 10}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="10"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              System prompt
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              value={localSettings.systemPrompt ?? ''}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="You are a helpful assistant."
              rows={3}
            />
          </div>
          
          <div className="pt-4">
            <button
              type="button"
              onClick={handleTestConnexion}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:ring-offset-gray-800"
            >
              Test connexion
            </button>
            {testStatus === 'success' && (
              <div className="mt-2 text-green-600 dark:text-green-400 text-sm text-center">{testMessage}</div>
            )}
            {testStatus === 'error' && (
              <div className="mt-2 text-red-600 dark:text-red-400 text-sm text-center">{testMessage}</div>
            )}
          </div>
        </form>
      </div>
    </>
  );
};

export default SettingsDrawer;