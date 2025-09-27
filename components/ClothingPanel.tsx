/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';

interface ClothingPanelProps {
  onApplyClothing: (clothingFile: File, prompt: string) => void;
  isLoading: boolean;
}

const ClothingPanel: React.FC<ClothingPanelProps> = ({ onApplyClothing, isLoading }) => {
  const [clothingFile, setClothingFile] = useState<File | null>(null);
  const [clothingPreview, setClothingPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setClothingFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setClothingPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clothingFile && prompt.trim()) {
      onApplyClothing(clothingFile, prompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Change Clothing</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Upload a reference image of an item of clothing.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Tooltip text="Upload an image of a clothing item (e.g., a shirt on a white background)">
          <label
            htmlFor="clothing-upload"
            className={`w-full p-6 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              handleFileChange(e.dataTransfer.files?.[0] || null);
            }}
          >
            {clothingPreview ? (
              <img src={clothingPreview} alt="Clothing preview" className="max-h-32 mx-auto rounded-md object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <UploadIcon className="w-8 h-8" />
                <span>Click to upload or drag & drop</span>
              </div>
            )}
          </label>
        </Tooltip>
        <input id="clothing-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />

        <Tooltip text="Provide instructions for the AI, e.g., 'Replace my t-shirt with this one'">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'Change my shirt to this one'"
            className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
            disabled={isLoading}
          />
        </Tooltip>

        <Tooltip text="Apply the clothing change using the uploaded image and prompt">
          <button
            type="submit"
            className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !clothingFile || !prompt.trim()}
          >
            Apply Clothing
          </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default ClothingPanel;