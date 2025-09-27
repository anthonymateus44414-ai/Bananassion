/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';

interface AddPersonPanelProps {
  onApplyAddPerson: (personFile: File, prompt: string) => void;
  isLoading: boolean;
}

const AddPersonPanel: React.FC<AddPersonPanelProps> = ({ onApplyAddPerson, isLoading }) => {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setPersonFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPersonPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personFile && prompt.trim()) {
      onApplyAddPerson(personFile, prompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Add Person</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Upload a reference image of a person to add to the scene. The AI will automatically remove their background.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Tooltip text="Upload a photo of the person you want to add. Their background will be removed automatically.">
          <label
            htmlFor="person-upload"
            className={`w-full p-6 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              handleFileChange(e.dataTransfer.files?.[0] || null);
            }}
          >
            {personPreview ? (
              <img src={personPreview} alt="Person preview" className="max-h-32 mx-auto rounded-md object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <UploadIcon className="w-8 h-8" />
                <span>Upload Reference Image</span>
              </div>
            )}
          </label>
        </Tooltip>
        <input id="person-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />
        
        <Tooltip text="Describe placement and scale, e.g., 'add her standing on the left, looking at the camera'">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'add this person standing on the right'"
              className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
              disabled={isLoading}
            />
        </Tooltip>

        <Tooltip text="Add the person from the reference image to the main scene">
            <button
              type="submit"
              className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
              disabled={isLoading || !personFile || !prompt.trim()}
            >
              Add Person to Scene
            </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default AddPersonPanel;