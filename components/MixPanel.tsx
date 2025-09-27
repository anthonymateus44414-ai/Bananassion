/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, TrashIcon, LayersIcon } from './icons';
import Tooltip from './Tooltip';

interface MixPanelProps {
  onApplyMix: (itemFiles: File[], prompt: string) => void;
  isLoading: boolean;
}

interface ItemFile {
    id: string;
    file: File;
    preview: string;
}

const MixPanel: React.FC<MixPanelProps> = ({ onApplyMix, isLoading }) => {
    const [itemFiles, setItemFiles] = useState<ItemFile[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFileChange = (files: FileList | null) => {
        if (!files) return;
        const newItems: ItemFile[] = [];
        const fileArray = Array.from(files);

        // This ensures state is updated once after all files are read
        let filesProcessed = 0;

        fileArray.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newItems.push({
                    id: `${file.name}-${Date.now()}-${Math.random()}`,
                    file: file,
                    preview: reader.result as string,
                });
                filesProcessed++;
                if (filesProcessed === fileArray.length) {
                    setItemFiles(prev => [...prev, ...newItems]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveFile = (id: string) => {
        setItemFiles(prev => prev.filter(item => item.id !== id));
    }
  
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const files = itemFiles.map(item => item.file);
        if (files.length > 0 && prompt.trim()) {
            onApplyMix(files, prompt);
        }
    };

    const hasFiles = itemFiles.length > 0;

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-center text-gray-300">Mix & Match Studio</h3>
            <p className="text-sm text-center text-gray-400 -mt-2">Upload one or more items (clothing, accessories) and describe how to combine them on your photo.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* File Upload Area */}
                <div className="flex flex-col gap-2">
                    <Tooltip text="Upload images of clothing or accessories. You can select multiple files.">
                        <label
                            htmlFor="mix-match-upload"
                            className={`w-full p-6 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                            onDragLeave={() => setIsDraggingOver(false)}
                            onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                            handleFileChange(e.dataTransfer.files);
                            }}
                        >
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                            <UploadIcon className="w-8 h-8" />
                            <span>Upload Item(s) or Drag & Drop</span>
                            </div>
                        </label>
                    </Tooltip>
                    <input id="mix-match-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} disabled={isLoading} multiple/>
                </div>
                
                {/* Previews */}
                {hasFiles && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-2 bg-black/20 rounded-lg max-h-48 overflow-y-auto">
                        {itemFiles.map(item => (
                            <div key={item.id} className="relative group aspect-square">
                                <img src={item.preview} alt={item.file.name} className="w-full h-full object-contain rounded-md bg-gray-700/50" />
                                <Tooltip text={`Remove ${item.file.name}`}>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(item.id)}
                                        disabled={isLoading}
                                        className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-all scale-0 group-hover:scale-100"
                                        aria-label={`Remove ${item.file.name}`}
                                    >
                                        <TrashIcon className="w-3 h-3"/>
                                    </button>
                                </Tooltip>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Prompt Input */}
                <Tooltip text="e.g., 'Put the red shirt and the black sunglasses on me'">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe how to combine the items..."
                        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base resize-none h-24"
                        disabled={isLoading}
                        aria-label="Mix and match combination prompt"
                    />
                </Tooltip>

                {/* Submit Button */}
                <Tooltip text="Combine the uploaded items onto your photo using your prompt">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                        disabled={isLoading || !hasFiles || !prompt.trim()}
                    >
                        <LayersIcon className="w-6 h-6"/>
                        Apply Combination
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default MixPanel;