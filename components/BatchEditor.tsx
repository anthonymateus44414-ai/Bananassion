/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Tool } from '../types';
import Tooltip from './Tooltip';
import Spinner from './Spinner';
import { ArrowDownTrayIcon, TrashIcon, SparklesIcon, XCircleIcon, LightBulbIcon } from './icons';
import { dataURLtoFile } from '../utils';

// Import Panels
import AdjustmentPanel from './AdjustmentPanel';
import AnglePanel from './AnglePanel';
import BackgroundPanel from './BackgroundPanel';
import ColorPanel from './ColorPanel';
import EnhancePanel from './EnhancePanel';
import ExpandPanel from './ExpandPanel';
import FilterPanel from './FilterPanel';

// Import Gemini Services
import {
  generateFilteredImage,
  generateAdjustedImage,
  generateColorAdjustedImage,
  generateEnhancedImage,
  generateExpandedImage,
  generateUncroppedImage,
  generateNewAngleImage,
  generateReplacedBackground,
  generateBatchSuggestions,
} from '../services/geminiService';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface ImageFile {
  id: string;
  file: File;
  originalSrc: string;
  editedSrc: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  processingStep?: string; // For detailed progress
}

const BatchEditor: React.FC<{ files: File[]; onExit: () => void; }> = ({ files, onExit }) => {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [recipe, setRecipe] = useState<RecipeStep[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ currentImage: 0, totalImages: 0, currentStep: '' });
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const suggestionDebounceTimer = useRef<number | null>(null);
    const createdUrlsRef = useRef<Set<string>>(new Set());
    const [colorAdjustments, setColorAdjustments] = useState({ hue: 0, saturation: 0, brightness: 0 });


    useEffect(() => {
        const imageFiles: ImageFile[] = files.map((file, index) => {
            const url = URL.createObjectURL(file);
            createdUrlsRef.current.add(url);
            return {
                id: `${file.name}-${index}`,
                file,
                originalSrc: url,
                editedSrc: null,
                status: 'pending',
            };
        });
        setImages(imageFiles);
    
        return () => {
          createdUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
          createdUrlsRef.current.clear();
        };
      }, [files]);
      
    useEffect(() => {
        if (suggestionDebounceTimer.current) {
            clearTimeout(suggestionDebounceTimer.current);
        }

        if (recipe.length < 2) {
            setSuggestions([]);
            setShowSuggestions(true);
            return;
        }

        setIsSuggestionLoading(true);
        suggestionDebounceTimer.current = window.setTimeout(async () => {
            try {
                const recipeNames = recipe.map(step => step.name);
                const newSuggestions = await generateBatchSuggestions(recipeNames);
                setSuggestions(newSuggestions);
            } catch (error) {
                console.error("Failed to fetch suggestions:", error);
                setSuggestions([]);
            } finally {
                setIsSuggestionLoading(false);
            }
        }, 1500);

        return () => {
            if (suggestionDebounceTimer.current) {
                clearTimeout(suggestionDebounceTimer.current);
            }
        };
    }, [recipe]);
    
    const addToRecipe = (stepData: Omit<RecipeStep, 'id'>) => {
        const newStep: RecipeStep = { ...stepData, id: `step-${Date.now()}`};
        setRecipe(prev => [...prev, newStep]);
    };

    const removeFromRecipe = (id: string) => {
        setRecipe(prev => prev.filter(step => step.id !== id));
    };

    const handleStartProcessing = async () => {
        if (recipe.length === 0) return;
        setIsProcessing(true);
        setProgress({ currentImage: 1, totalImages: images.length, currentStep: 'Запуск...' });

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            setProgress(prev => ({ ...prev, currentImage: i + 1, currentStep: 'Подготовка...' }));
            setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'processing', processingStep: 'Подготовка...' } : img));

            try {
                let currentFile = image.file;
                for (const step of recipe) {
                    setProgress(prev => ({ ...prev, currentStep: step.name }));
                    setImages(prev => prev.map(img => img.id === image.id ? { ...img, processingStep: step.name } : img));
                    
                    let resultSrc: string;
                    switch (step.tool) {
                        case 'filter':
                            resultSrc = await generateFilteredImage(currentFile, step.params.prompt);
                            break;
                        case 'adjust':
                            resultSrc = await generateAdjustedImage(currentFile, step.params.prompt);
                            break;
                        case 'color':
                            resultSrc = await generateColorAdjustedImage(currentFile, step.params.prompt);
                            break;
                        case 'enhance':
                            resultSrc = await generateEnhancedImage(currentFile, step.params.prompt);
                            break;
                        case 'expand':
                            resultSrc = step.params.direction ? 
                                await generateExpandedImage(currentFile, step.params.direction, step.params.percentage)
                                : await generateUncroppedImage(currentFile, step.params.percentage);
                            break;
                        case 'camera':
                            resultSrc = await generateNewAngleImage(currentFile, step.params.prompt);
                            break;
                        case 'background':
                            resultSrc = await generateReplacedBackground(currentFile, step.params.prompt);
                            break;
                        default:
                          throw new Error(`Неподдерживаемый инструмент в пакетном режиме: ${step.tool}`);
                    }
                    currentFile = dataURLtoFile(resultSrc, `step-result.png`);
                }
                const finalSrc = URL.createObjectURL(currentFile);
                createdUrlsRef.current.add(finalSrc);
                setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'done', editedSrc: finalSrc, processingStep: undefined } : img));

            } catch (err: any) {
                console.error(`Failed to process ${image.file.name}:`, err);
                setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'error', error: err.message, processingStep: undefined } : img));
            }
        }
        setIsProcessing(false);
        setProgress({ currentImage: 0, totalImages: 0, currentStep: '' });
    };
    
    const handleDownload = (src: string, filename: string) => {
        const link = document.createElement('a');
        link.href = src;
        link.download = `pixshop-batch-${filename}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = () => {
        const processedImages = images.filter(img => img.status === 'done' && img.editedSrc);
        if (processedImages.length > 0) {
            processedImages.forEach((image, index) => {
                // Stagger downloads slightly to improve browser compatibility for multiple file downloads.
                setTimeout(() => {
                    handleDownload(image.editedSrc!, image.file.name);
                }, index * 300);
            });
        }
    };

    return (
        <div className="w-full h-full flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto p-4">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-text-primary">Пакетный редактор</h2>
                <Tooltip text="Выйти из пакетного режима и начать сначала">
                    <button onClick={onExit} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <XCircleIcon className="w-5 h-5" />
                        Выйти из пакетного режима
                    </button>
                </Tooltip>
            </div>
            
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                {/* Left Column: Recipe Builder */}
                <div className="lg:col-span-1 bg-bg-panel border border-border-color rounded-xl shadow-lg p-2 flex flex-col gap-2 overflow-y-auto">
                    <h3 className="text-xl font-bold text-center sticky top-0 bg-bg-panel py-2 z-10 text-text-primary">Конструктор рецептов</h3>
                    <div className="flex flex-col gap-4 p-2">
                        <FilterPanel onAddLayer={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <AdjustmentPanel onAddLayer={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <ColorPanel 
                            onAddLayer={() => {}} 
                            onAddToRecipe={addToRecipe} 
                            isLoading={isProcessing} 
                            mode="recipe" 
                            maskDataUrl={null} 
                            onToggleMasking={() => {}} 
                            adjustments={colorAdjustments}
                            onAdjustmentsChange={setColorAdjustments}
                        />
                        <EnhancePanel onAddLayer={() => {}} editHotspot={null} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <ExpandPanel onAddLayer={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <AnglePanel onAddLayer={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <BackgroundPanel onAddLayer={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                    </div>
                </div>

                {/* Right Column: Recipe and Images */}
                <div className="lg:col-span-2 bg-bg-panel border border-border-color rounded-xl shadow-lg p-4 flex flex-col gap-4 overflow-hidden">
                    {/* Recipe Summary */}
                    <div className="flex-shrink-0">
                        <h3 className="text-xl font-bold mb-2 text-text-primary">Текущий рецепт</h3>
                        {recipe.length === 0 ? (
                            <p className="text-text-secondary">Добавьте шаги из Конструктора рецептов слева.</p>
                        ) : (
                            <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {recipe.map((step, index) => (
                                    <li key={step.id} className="bg-stone-50 p-3 rounded-lg flex justify-between items-center text-sm border border-border-color">
                                        <span className="font-semibold text-text-primary">{index + 1}. {step.name}</span>
                                        <Tooltip text="Удалить этот шаг из рецепта">
                                            <button onClick={() => removeFromRecipe(step.id)} disabled={isProcessing} className="text-text-secondary hover:text-red-500 disabled:opacity-50">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </Tooltip>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button 
                            onClick={handleStartProcessing} 
                            disabled={isProcessing || recipe.length === 0}
                            className="w-full mt-4 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <SparklesIcon className="w-6 h-6" />
                            {isProcessing 
                                ? <span className="truncate">Изобр. {progress.currentImage}/{progress.totalImages}: {progress.currentStep}</span>
                                : `Применить рецепт к ${images.length} изобр.`
                            }
                        </button>
                        
                        { (isSuggestionLoading || (suggestions.length > 0 && showSuggestions)) && (
                            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg animate-fade-in relative transition-all">
                                <div className="flex items-start gap-4">
                                    <LightBulbIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-orange-800">Умные предложения</h4>
                                        {isSuggestionLoading && suggestions.length === 0 ? (
                                            <p className="text-sm text-orange-700 animate-pulse pt-2">Анализирую рецепт для советов...</p>
                                        ) : (
                                            <ul className="mt-2 space-y-1.5 text-sm text-orange-700">
                                                {suggestions.map((s, i) => <li key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-orange-500">{s}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <Tooltip text="Скрыть предложения">
                                        <button onClick={() => setShowSuggestions(false)} className="text-orange-700 hover:bg-orange-200 rounded-full p-1 transition-colors">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="border-border-color"/>

                    {/* Image Gallery */}
                    <div className="flex-grow overflow-y-auto">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold text-text-primary">Очередь изображений</h3>
                            <Tooltip text="Скачать все успешно обработанные изображения">
                                <button 
                                    onClick={handleDownloadAll} 
                                    disabled={!images.some(img => img.status === 'done')}
                                    className="flex items-center gap-2 font-semibold text-text-primary bg-stone-100 hover:bg-stone-200 transition-colors px-4 py-2 rounded-lg border border-border-color disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                    Скачать все
                                </button>
                            </Tooltip>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {images.map(image => (
                                <div key={image.id} className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden group border border-border-color">
                                    <img src={image.editedSrc || image.originalSrc} alt={image.file.name} className="w-full h-full object-contain" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-white">
                                        <p className="text-xs font-bold truncate">{image.file.name}</p>
                                        {image.status === 'done' && image.editedSrc && (
                                            <Tooltip text="Скачать отредактированное изображение">
                                                <button onClick={() => handleDownload(image.editedSrc!, image.file.name)} className="self-end p-2 bg-primary rounded-full hover:bg-primary-hover transition-colors">
                                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                    {image.status === 'processing' && (
                                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 text-center">
                                            <Spinner />
                                            <p className="mt-2 text-xs text-gray-200 animate-pulse truncate">{image.processingStep || 'Обработка...'}</p>
                                        </div>
                                    )}
                                     {image.status === 'error' && (
                                        <div className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center p-2 text-center text-white">
                                            <XCircleIcon className="w-8 h-8 mb-2"/>
                                            <p className="text-sm font-bold">Ошибка</p>
                                            <p className="text-xs line-clamp-3">{image.error}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchEditor;