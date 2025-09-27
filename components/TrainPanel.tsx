/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, TrashIcon, BrainCircuitIcon } from './icons';
import Tooltip from './Tooltip';

interface TrainPanelProps {
  onTrainStyle: (name: string, files: File[]) => void;
  isLoading: boolean;
}

interface StyleFile {
    id: string;
    file: File;
    preview: string;
}

const TrainPanel: React.FC<TrainPanelProps> = ({ onTrainStyle, isLoading }) => {
    const [styleFiles, setStyleFiles] = useState<StyleFile[]>([]);
    const [styleName, setStyleName] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFileChange = (files: FileList | null) => {
        if (!files || styleFiles.length + files.length > 8) {
            // Optional: Add user feedback for exceeding the limit
            return;
        }
        
        const newItems: StyleFile[] = [];
        const fileArray = Array.from(files);
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
                    setStyleFiles(prev => [...prev, ...newItems].slice(0, 8)); // Enforce limit
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveFile = (id: string) => {
        setStyleFiles(prev => prev.filter(item => item.id !== id));
    }
  
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const files = styleFiles.map(item => item.file);
        if (files.length >= 2 && styleName.trim()) {
            onTrainStyle(styleName, files);
            setStyleFiles([]);
            setStyleName('');
        }
    };

    const hasMinFiles = styleFiles.length >= 2;

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-center text-gray-300">Create a Custom AI Style Preset</h3>
            <p className="text-sm text-center text-gray-400 -mt-2">Upload 2-8 images that define a style. The AI will reference their colors, textures, and mood to create a reusable filter.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* File Upload Area */}
                <div className="flex flex-col gap-2">
                    <Tooltip text="Upload 2 to 8 images to define your style.">
                        <label
                            htmlFor="style-train-upload"
                            className={`w-full p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                                isDraggingOver 
                                    ? 'border-blue-400 bg-blue-500/10' 
                                    : styleFiles.length < 8 ? 'border-gray-600 cursor-pointer hover:border-blue-500 hover:bg-blue-500/10' : 'border-gray-700 bg-gray-900/50 cursor-not-allowed'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); if (styleFiles.length < 8) setIsDraggingOver(true); }}
                            onDragLeave={() => setIsDraggingOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingOver(false);
                                if (styleFiles.length < 8) handleFileChange(e.dataTransfer.files);
                            }}
                        >
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                <UploadIcon className="w-8 h-8" />
                                <span>Upload Style Images ({styleFiles.length}/8)</span>
                                <span className="text-xs">or Drag & Drop</span>
                            </div>
                        </label>
                    </Tooltip>
                    <input id="style-train-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} disabled={isLoading || styleFiles.length >= 8} multiple/>
                </div>
                
                {/* Previews */}
                {styleFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 p-2 bg-black/20 rounded-lg max-h-48 overflow-y-auto">
                        {styleFiles.map(item => (
                            <div key={item.id} className="relative group aspect-square">
                                <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover rounded-md bg-gray-700/50" />
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
                
                {/* Style Name Input */}
                <Tooltip text="Give your style a memorable name.">
                    <input
                        type="text"
                        value={styleName}
                        onChange={(e) => setStyleName(e.target.value)}
                        placeholder="Enter Style Name..."
                        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                        disabled={isLoading}
                        aria-label="Style name input"
                    />
                </Tooltip>

                {/* Submit Button */}
                <Tooltip text="Save your style. It will appear in the 'Filter' tool panel.">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                        disabled={isLoading || !hasMinFiles || !styleName.trim()}
                    >
                        <BrainCircuitIcon className="w-6 h-6"/>
                        Save Style Preset
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default TrainPanel;