/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, TrashIcon, BrainCircuitIcon, SparklesIcon, LightBulbIcon } from './icons';
import Tooltip from './Tooltip';
import { analyzeStyleFromImages } from '../services/geminiService';
import Spinner from './Spinner';

interface TrainPanelProps {
  onTrainStyle: (name: string, files: File[], description: string | null) => void;
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
    
    const [styleDescription, setStyleDescription] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handleFileChange = (files: FileList | null) => {
        if (!files || styleFiles.length + files.length > 8) {
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
                    setStyleFiles(prev => [...prev, ...newItems].slice(0, 8));
                    setStyleDescription(null); // Reset analysis if files change
                    setAnalysisError(null);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveFile = (id: string) => {
        setStyleFiles(prev => {
            const newFiles = prev.filter(item => item.id !== id);
            if (newFiles.length < 2) {
                setStyleDescription(null);
                setAnalysisError(null);
            }
            return newFiles;
        });
    }

    const handleAnalyze = async () => {
        const files = styleFiles.map(item => item.file);
        if (files.length < 2) return;

        setIsAnalyzing(true);
        setAnalysisError(null);
        setStyleDescription(null);
        try {
            const description = await analyzeStyleFromImages(files);
            setStyleDescription(description);
        } catch (err: any) {
            setAnalysisError(err.message || 'Произошла неизвестная ошибка при анализе.');
        } finally {
            setIsAnalyzing(false);
        }
    };
  
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const files = styleFiles.map(item => item.file);
        if (hasMinFiles && styleName.trim() && styleDescription) {
            onTrainStyle(styleName, files, styleDescription);
            // Reset state for next creation
            setStyleFiles([]);
            setStyleName('');
            setStyleDescription(null);
            setAnalysisError(null);
        }
    };

    const hasMinFiles = styleFiles.length >= 2;
    const isDisabled = isLoading || isAnalyzing;

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Создать пользовательский стиль ИИ</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">Загрузите 2-8 изображений, которые определяют стиль. ИИ проанализирует их и создаст многоразовый фильтр.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* File Upload Area */}
                <div className="flex flex-col gap-2">
                    <Tooltip side="left" text="Загрузите от 2 до 8 изображений, чтобы определить свой стиль.">
                        <label
                            htmlFor="style-train-upload"
                            className={`w-full p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                                isDraggingOver 
                                    ? 'border-primary bg-primary/10 animate-pulse' 
                                    : styleFiles.length < 8 ? 'border-border-color cursor-pointer hover:border-primary hover:bg-primary/10' : 'border-gray-300 bg-stone-100 cursor-not-allowed'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); if (styleFiles.length < 8) setIsDraggingOver(true); }}
                            onDragLeave={() => setIsDraggingOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingOver(false);
                                if (styleFiles.length < 8) handleFileChange(e.dataTransfer.files);
                            }}
                        >
                            <div className="flex flex-col items-center gap-2 text-text-secondary">
                                <UploadIcon className="w-8 h-8" />
                                <span>Загрузить изображения стиля ({styleFiles.length}/8)</span>
                                <span className="text-xs">или перетащить</span>
                            </div>
                        </label>
                    </Tooltip>
                    <input id="style-train-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} disabled={isDisabled || styleFiles.length >= 8} multiple/>
                </div>
                
                {/* Previews */}
                {styleFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 p-2 bg-stone-100 rounded-lg max-h-48 overflow-y-auto border border-border-color">
                        {styleFiles.map(item => (
                            <div key={item.id} className="relative group aspect-square">
                                <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover rounded-md bg-stone-50" />
                                <Tooltip side="left" text={`Удалить ${item.file.name}`}>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(item.id)}
                                        disabled={isDisabled}
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
                
                {hasMinFiles && (
                    <div className="w-full flex flex-col gap-4 animate-fade-in">
                        {/* Style Name Input */}
                        <Tooltip side="left" text="Дайте вашему стилю запоминающееся имя.">
                            <input
                                type="text"
                                value={styleName}
                                onChange={(e) => setStyleName(e.target.value)}
                                placeholder="Введите название стиля..."
                                className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                                disabled={isDisabled}
                                aria-label="Ввод названия стиля"
                            />
                        </Tooltip>

                        {isAnalyzing && (
                            <div className="flex items-center justify-center gap-2 p-4 text-text-secondary">
                                <Spinner />
                                <span>Анализ стиля...</span>
                            </div>
                        )}
                        
                        {analysisError && (
                            <p className="text-center text-red-700 bg-red-100 p-2 rounded-lg">{analysisError}</p>
                        )}

                        {styleDescription && !isAnalyzing && (
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg animate-fade-in">
                                <div className="flex items-start gap-3">
                                    <LightBulbIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-orange-800">Анализ стиля ИИ</h4>
                                        <p className="mt-1 text-sm text-orange-700 italic">"{styleDescription}"</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!styleDescription && !isAnalyzing && (
                             <Tooltip side="left" text="Позвольте ИИ проанализировать ваши изображения и описать стиль.">
                                <button
                                    type="button"
                                    onClick={handleAnalyze}
                                    className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                                    disabled={isDisabled || !styleName.trim()}
                                >
                                    {isAnalyzing ? <Spinner size="sm"/> : <><SparklesIcon className="w-6 h-6"/> Анализировать стиль</>}
                                </button>
                            </Tooltip>
                        )}
                        
                        {styleDescription && !isAnalyzing && (
                            <Tooltip side="left" text="Сохранить ваш стиль. Он появится на панели 'Фильтр'.">
                                <button
                                    type="submit"
                                    className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                                    disabled={isDisabled || !hasMinFiles || !styleName.trim() || !styleDescription}
                                >
                                    {isLoading ? <Spinner size="sm" /> : <><BrainCircuitIcon className="w-6 h-6"/> Сохранить пресет стиля</>}
                                </button>
                            </Tooltip>
                        )}
                    </div>
                )}

            </form>
        </div>
    );
};

export default TrainPanel;