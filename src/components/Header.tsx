import React from 'react';
import { Settings, Plus, Moon, Sun, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onNewChat: () => void;
  models: string[];
  selectedModel: string;
  onChangeModel: (model: string) => void;
  theme: string;
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings, onNewChat, models, selectedModel, onChangeModel, theme, onToggleTheme }) => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
      <div className="flex justify-between items-center px-4 py-3">
        <div className="flex items-center">
          <div className="relative">
            <select
              value={selectedModel}
              onChange={e => onChangeModel(e.target.value)}
              className="bg-transparent border-none text-xl font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-0 appearance-none pr-8 dark:!text-white py-2 pl-3 rounded-md min-w-[200px] cursor-pointer"
              style={{ minWidth: 200, cursor: 'pointer' }}
              title="Select Model"
            >
              {models.map(model => (
                <option key={model} value={model} className="text-gray-900 dark:!text-white bg-white dark:bg-gray-800">{model}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none w-5 h-5 text-gray-400 dark:text-gray-300" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="p-2 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 focus:outline-none transition duration-150 ease-in-out rounded-md"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleTheme}
            className="p-2 text-gray-600 hover:text-yellow-500 dark:text-gray-300 dark:hover:text-yellow-300 focus:outline-none transition duration-150 ease-in-out rounded-md"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 focus:outline-none transition duration-150 ease-in-out rounded-md"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;