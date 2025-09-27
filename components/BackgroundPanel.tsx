/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';
import { Tool } from '../types';

interface BackgroundPanelProps {
  onApplyBackground: (prompt: string) => void;
  onApplyBackgroundImage: (backgroundFile: File) => void;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { prompt: string } }) => void;
}

type BackgroundTab = 'generate' | 'upload' | 'color';

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onApplyBackground, onApplyBackgroundImage, isLoading, mode = 'interactive', onAddToRecipe }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<BackgroundTab>('generate');
  
  const colors = [
    { name: 'White', prompt: 'a solid professional white background', color: '#FFFFFF' },
    { name: 'Gray', prompt: 'a solid neutral gray studio background', color: '#808080' },
    { name: 'Black', prompt: 'a solid pitch black background', color: '#000000' },
    { name: 'Blue', prompt: 'a solid sky blue background', color: '#3B82F6' },
    { name: 'Green', prompt: 'a solid vibrant green background', color: '#22C55E' },
    { name: 'Red', prompt: 'a solid bold red background', color: '#EF4444' },
  ];

  const handleApplyText = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      if (mode === 'interactive') {
        onApplyBackground(customPrompt);
      } else if (onAddToRecipe) {
        const stepName = `BG: "${customPrompt.substring(0, 15)}..."`;
        onAddToRecipe({
          name: stepName,
          tool: 'background',
          params: { prompt: customPrompt }
        });
        setCustomPrompt('');
      }
    }
  };

  const handleColorClick = (prompt: string, name: string) => {
    if (mode === 'interactive') {
      onApplyBackground(prompt);
    } else if (onAddToRecipe) {
      const stepName = `${name} Background`;
      onAddToRecipe({
        name: `BG: ${stepName}`,
        tool: 'background',
        params: { prompt }
      });
    }
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      setBackgroundFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (backgroundFile) {
      onApplyBackgroundImage(backgroundFile);
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'generate':
        return (
          <form onSubmit={handleApplyText} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip text="Describe a new background, e.g., 'a sandy beach at sunset'">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe a background (e.g., 'a forest at sunset')"
                className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                disabled={isLoading}
              />
            </Tooltip>
            <Tooltip text={mode === 'interactive' ? "Generate a new background from your text description" : "Add this background generation step to the recipe"}>
              <button
                type="submit"
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !customPrompt.trim()}
              >
                {mode === 'interactive' ? 'Generate from Text' : 'Add to Recipe'}
              </button>
            </Tooltip>
          </form>
        );
      case 'upload':
        if (mode === 'recipe') return <p className="text-center text-gray-400 text-sm p-4">Uploading a background is not available in batch mode.</p>;
        return (
          <form onSubmit={handleApplyImage} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip text="Upload an image to use as the new background">
              <label
                htmlFor="background-upload"
                className={`w-full p-6 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleFileChange(e.dataTransfer.files?.[0] || null);
                }}
              >
                {backgroundPreview ? (
                  <img src={backgroundPreview} alt="Background preview" className="max-h-24 mx-auto rounded-md object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <UploadIcon className="w-8 h-8" />
                    <span>Upload or drag & drop</span>
                  </div>
                )}
              </label>
            </Tooltip>
            <input id="background-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />

            <Tooltip text="Apply the uploaded image as the new background">
              <button
                type="submit"
                className="w-full bg-gradient-to-br from-indigo-600 to-purple-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-indigo-800 disabled:to-purple-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !backgroundFile}
              >
                Apply Image as Background
              </button>
            </Tooltip>
          </form>
        );
      case 'color':
        if (mode === 'recipe') return <p className="text-center text-gray-400 text-sm p-4">Solid color backgrounds are not available in batch mode.</p>;
        return (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 animate-fade-in">
            {colors.map(color => (
              <Tooltip key={color.name} text={`Set background to solid ${color.name.toLowerCase()}`}>
                <button
                  onClick={() => handleColorClick(color.prompt, color.name)}
                  disabled={isLoading}
                  className="w-full h-16 rounded-md transition-all duration-200 ease-in-out border-2 border-transparent hover:border-white/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                  style={{ backgroundColor: color.color }}
                  aria-label={`Set background to ${color.name}`}
                />
              </Tooltip>
            ))}
          </div>
        );
      default:
        return null;
    }
  }

  const tabs: { id: BackgroundTab, name: string }[] = [
    { id: 'generate', name: 'Generate' },
    { id: 'upload', name: 'Upload' },
    { id: 'color', name: 'Color' },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Change Background</h3>
      
      {mode === 'interactive' && (
        <div className="w-full bg-gray-900/40 rounded-lg p-1 flex items-center justify-center gap-1">
            {tabs.map(tab => (
                <Tooltip key={tab.id} text={`Change background by ${tab.id === 'generate' ? 'generating from text' : tab.id === 'upload' ? 'uploading an image' : 'choosing a solid color'}`}>
                  <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full capitalize font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                          activeTab === tab.id
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                      {tab.name}
                  </button>
                </Tooltip>
            ))}
        </div>
      )}

      <div className="mt-2">
        {renderContent()}
      </div>
    </div>
  );
};

export default BackgroundPanel;