/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, TrashIcon, PaintBrushIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer } from '../types';
import Spinner from './Spinner';

interface StylePanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
}

interface ReferenceFile {
    id: string;
    file: File;
    preview: string;
}

const StylePanel: React.FC<StylePanelProps> = ({ onAddLayer, isLoading }) => {
    const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFileChange = (files: FileList | null) => {
        if (!files || referenceFiles.length + files.length > 8) {
            // Silently fail if too many files are selected to prevent alerts.
            // The UI indicates the limit.
            return;
        }
        
        const newItems: ReferenceFile[] = [];
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
                    setReferenceFiles(prev => [...prev, ...newItems].slice(0, 8));
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveFile = (id: string) => {
        setReferenceFiles(prev => prev.filter(item => item.id !== id));
    }
  
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const referenceDataUrls = referenceFiles.map(item => item.preview);
        if (referenceDataUrls.length > 0) {
            onAddLayer({
              name: `Перенос стиля`,
              tool: 'style',
              params: { referenceImages: referenceDataUrls }
            });
            setReferenceFiles([]);
        }
    };

    const hasFiles = referenceFiles.length > 0;

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Применить стиль с изображения</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">Загрузите одно или несколько эталонных изображений, чтобы перенести их стиль на вашу фотографию.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* File Upload Area */}
                <div className="flex flex-col gap-2">
                    <Tooltip side="left" text="Загрузите от 1 до 8 изображений для использования в качестве эталона стиля.">
                        <label
                            htmlFor="style-apply-upload"
                            className={`w-full p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                                isDraggingOver 
                                ? 'border-primary bg-primary/10 animate-pulse' 
                                : referenceFiles.length < 8 ? 'border-border-color cursor-pointer hover:border-primary hover:bg-primary/10' : 'border-gray-300 bg-stone-100 cursor-not-allowed'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); if (referenceFiles.length < 8) setIsDraggingOver(true); }}
                            onDragLeave={() => setIsDraggingOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingOver(false);
                                if (referenceFiles.length < 8) handleFileChange(e.dataTransfer.files);
                            }}
                        >
                            <div className="flex flex-col items-center gap-2 text-text-secondary">
                                <UploadIcon className="w-8 h-8" />
                                <span>Загрузить изображение(я) стиля ({referenceFiles.length}/8)</span>
                            </div>
                        </label>
                    </Tooltip>
                    <input id="style-apply-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} disabled={isLoading || referenceFiles.length >= 8} multiple/>
                </div>
                
                {/* Previews */}
                {hasFiles && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 bg-stone-100 rounded-lg max-h-48 overflow-y-auto border border-border-color">
                        {referenceFiles.map(item => (
                            <div key={item.id} className="relative group aspect-square">
                                <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover rounded-md bg-stone-50" />
                                <Tooltip side="left" text={`Удалить ${item.file.name}`}>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(item.id)}
                                        disabled={isLoading}
                                        className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-all scale-0 group-hover:scale-100"
                                        aria-label={`Удалить ${item.file.name}`}
                                    >
                                        <TrashIcon className="w-3 h-3"/>
                                    </button>
                                </Tooltip>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Submit Button */}
                <Tooltip side="left" text="Перенести стиль с загруженных изображений на вашу фотографию.">
                    <button
                        type="submit"
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                        disabled={isLoading || !hasFiles}
                    >
                        {isLoading ? <Spinner size="sm"/> : <><PaintBrushIcon className="w-6 h-6"/> Применить стиль</>}
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default StylePanel;