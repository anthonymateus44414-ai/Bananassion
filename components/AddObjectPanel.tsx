/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';
import { Hotspot } from '../types';

interface AddObjectPanelProps {
  onApplyAddObjectFromText: (prompt: string) => void;
  onApplyAddObjectFromUpload: (objectFile: File) => void;
  isLoading: boolean;
  editHotspot: Hotspot | null;
}

type AddObjectTab = 'generate' | 'upload';

const AddObjectPanel: React.FC<AddObjectPanelProps> = ({ onApplyAddObjectFromText, onApplyAddObjectFromUpload, isLoading, editHotspot }) => {
  const [prompt, setPrompt] = useState('');
  const [objectFile, setObjectFile] = useState<File | null>(null);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<AddObjectTab>('generate');

  const handleApplyText = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && editHotspot) {
      onApplyAddObjectFromText(prompt);
    }
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      setObjectFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setObjectPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectFile && editHotspot) {
      onApplyAddObjectFromUpload(objectFile);
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'generate':
        return (
          <form onSubmit={handleApplyText} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip text="Describe the object to add at the selected point, e.g., 'a red coffee mug'">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={editHotspot ? "e.g., 'a small potted cactus'" : "First click a point on the image"}
                className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                disabled={isLoading || !editHotspot}
              />
            </Tooltip>
            <Tooltip text="Generate the object at the selected point">
              <button
                type="submit"
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !prompt.trim() || !editHotspot}
              >
                Generate Object
              </button>
            </Tooltip>
          </form>
        );
      case 'upload':
        return (
          <form onSubmit={handleApplyImage} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip text="Upload an image of the object to add. Its background will be removed.">
              <label
                htmlFor="object-upload"
                className={`w-full p-6 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleFileChange(e.dataTransfer.files?.[0] || null);
                }}
              >
                {objectPreview ? (
                  <img src={objectPreview} alt="Object preview" className="max-h-24 mx-auto rounded-md object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <UploadIcon className="w-8 h-8" />
                    <span>Upload or drag & drop</span>
                  </div>
                )}
              </label>
            </Tooltip>
            <input id="object-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />

            <Tooltip text="Add the uploaded object to the scene at the selected point">
              <button
                type="submit"
                className="w-full bg-gradient-to-br from-indigo-600 to-purple-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-indigo-800 disabled:to-purple-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !objectFile || !editHotspot}
              >
                Add Object from Image
              </button>
            </Tooltip>
          </form>
        );
      default:
        return null;
    }
  }

  const tabs: { id: AddObjectTab, name: string }[] = [
    { id: 'generate', name: 'Generate' },
    { id: 'upload', name: 'Upload' },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Add Object</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">
        {editHotspot ? "A placement point has been selected. Now describe or upload the object." : "Click a point on the image to choose where to add the object."}
      </p>
      
      <div className="w-full bg-gray-900/40 rounded-lg p-1 flex items-center justify-center gap-1">
          {tabs.map(tab => (
              <Tooltip key={tab.id} text={`Add an object by ${tab.id === 'generate' ? 'generating it from text' : 'uploading a photo'}`}>
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

      <div className="mt-2">
        {renderContent()}
      </div>
    </div>
  );
};

export default AddObjectPanel;