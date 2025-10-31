/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer } from '../types';
import { fileToDataURL } from '../utils';

interface AddImagePanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => void;
  isLoading: boolean;
}

const AddImagePanel: React.FC<AddImagePanelProps> = ({ onAddLayer, isLoading }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFileChange = async (file: File | null) => {
        if (!file) return;

        try {
            const dataUrl = await fileToDataURL(file);
            // Get image dimensions to set initial size
            const img = new Image();
            img.onload = () => {
                onAddLayer({
                    name: `Image: ${file.name.slice(0, 20)}...`,
                    tool: 'image',
                    params: { imageDataUrl: dataUrl },
                    transform: {
                        x: 50,
                        y: 50,
                        width: img.width > 512 ? 512 : img.width,
                        height: img.width > 512 ? (img.height * (512 / img.width)) : img.height,
                        rotation: 0,
                    }
                });
            };
            img.src = dataUrl;
        } catch (error) {
            console.error("Failed to add image layer:", error);
        }
    };

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Добавить изображение как слой</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">Загрузите изображение для добавления на холст. Вы сможете перемещать, изменять размер и вращать его с помощью инструмента "Трансформация".</p>
            
            <Tooltip side="left" text="Загрузить изображение для нового слоя">
              <label
                htmlFor="image-layer-upload"
                className={`w-full p-10 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors ${isDraggingOver ? 'border-primary bg-primary/10 animate-pulse' : 'border-border-color'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleFileChange(e.dataTransfer.files?.[0] || null);
                }}
              >
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
                    <UploadIcon className="w-10 h-10" />
                    <span className="font-semibold">Нажмите для загрузки или перетащите</span>
                  </div>
              </label>
            </Tooltip>
            <input id="image-layer-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />
        </div>
    );
};

export default AddImagePanel;