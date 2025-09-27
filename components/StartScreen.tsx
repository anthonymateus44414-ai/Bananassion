/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, SparklesIcon } from './icons';
import Tooltip from './Tooltip';

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onGenerateFromPrompt: (prompt: string) => void;
  isLoading: boolean;
}

type Tab = 'edit' | 'generate';

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onGenerateFromPrompt, isLoading }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [prompt, setPrompt] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };
  
  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerateFromPrompt(prompt);
    }
  };

  const renderEditContent = () => (
    <div 
      className={`relative mt-6 transition-all duration-300 p-8 rounded-2xl border-2 ${isDraggingOver ? 'bg-blue-500/10 border-dashed border-blue-400' : 'border-transparent'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onFileSelect(e.dataTransfer.files);
      }}
    >
        <div className="flex flex-col items-center gap-4">
            <Tooltip text="Select one or more images from your device to start editing">
                <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white bg-blue-600 rounded-full cursor-pointer group hover:bg-blue-500 transition-colors">
                    <UploadIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
                    Upload Image(s)
                </label>
            </Tooltip>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} multiple />
            <p className="text-sm text-gray-500">or drag and drop file(s)</p>
        </div>
    </div>
  );

  const renderGenerateContent = () => (
    <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-2xl">
        <p className="text-lg text-gray-400">Describe the image you want to create from your imagination.</p>
        <form onSubmit={handleGenerateSubmit} className="w-full flex flex-col items-center gap-4">
            <Tooltip text="Enter a detailed description of the image to generate">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A cinematic shot of a raccoon astronaut commandeering a spaceship, detailed, 4k"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition h-32 resize-none"
                    disabled={isLoading}
                    aria-label="Image generation prompt"
                />
            </Tooltip>
            <Tooltip text="Create a new image from your text description">
                <button 
                    type="submit"
                    className="relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white bg-blue-600 rounded-full cursor-pointer group hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                    disabled={isLoading || !prompt.trim()}
                >
                    <SparklesIcon className="w-6 h-6 mr-3" />
                    Generate
                </button>
            </Tooltip>
        </form>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto text-center p-8">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-100 sm:text-6xl md:text-7xl">
          AI-Powered Photo Editor & <span className="text-blue-400">Creator</span>.
        </h1>
        <p className="max-w-3xl text-lg text-gray-400 md:text-xl">
            Retouch photos, generate new images, apply creative filters, or make professional adjustments using simple text prompts.
        </p>

        <div className="w-full max-w-sm bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm mt-6">
            <Tooltip text="Switch to Photo Editing mode">
                <button
                    onClick={() => setActiveTab('edit')}
                    className={`w-full font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === 'edit' 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    Edit Photo
                </button>
            </Tooltip>
            <Tooltip text="Switch to Image Generation mode">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`w-full font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === 'generate' 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    Generate Image
                </button>
            </Tooltip>
        </div>
        
        {activeTab === 'edit' ? renderEditContent() : renderGenerateContent()}

        <div className="mt-16 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <MagicWandIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Precise Retouching</h3>
                    <p className="mt-2 text-gray-400">Click any point on your image to remove blemishes, change colors, or add elements with pinpoint accuracy.</p>
                </div>
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <PaletteIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Creative Filters</h3>
                    <p className="mt-2 text-gray-400">Transform photos with artistic styles. From vintage looks to futuristic glows, find or create the perfect filter.</p>
                </div>
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <SunIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Pro Adjustments</h3>
                    <p className="mt-2 text-gray-400">Enhance lighting, blur backgrounds, or change the mood. Get studio-quality results without complex tools.</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default StartScreen;