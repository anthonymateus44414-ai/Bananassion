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
        setProgress({ currentImage: 1, totalImages: images.length, currentStep: 'Starting...' });

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            setProgress(prev => ({ ...prev, currentImage: i + 1, currentStep: 'Preparing...' }));
            setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'processing', processingStep: 'Preparing...' } : img));

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
                            resultSrc = await generateEnhancedImage(currentFile);
                            break;
                        case 'expand':
                            resultSrc = await generateExpandedImage(currentFile, step.params.direction, step.params.percentage);
                            break;
                        case 'camera':
                            resultSrc = await generateNewAngleImage(currentFile, step.params.prompt);
                            break;
                        case 'background':
                            resultSrc = await generateReplacedBackground(currentFile, step.params.prompt);
                            break;
                        default:
                          throw new Error(`Unsupported tool in batch mode: ${step.tool}`);
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

    return (
        <div className="w-full h-full flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Batch Editor</h2>
                <Tooltip text="Exit Batch Mode and start over">
                    <button onClick={onExit} className="bg-red-600/80 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <XCircleIcon className="w-5 h-5" />
                        Exit Batch Mode
                    </button>
                </Tooltip>
            </div>
            
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                {/* Left Column: Recipe Builder */}
                <div className="lg:col-span-1 bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 overflow-y-auto">
                    <h3 className="text-xl font-semibold text-center sticky top-0 bg-gray-800/50 py-2 z-10">Recipe Builder</h3>
                    <div className="flex flex-col gap-4">
                        <FilterPanel onApplyFilter={()=>{}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <AdjustmentPanel onApplyAdjustment={()=>{}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <ColorPanel onApplyColorAdjustment={()=>{}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" maskDataUrl={null} onToggleMasking={() => {}} />
                        <EnhancePanel onApplyEnhancement={()=>{}} onApplyAreaEnhancement={()=>{}} editHotspot={null} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <ExpandPanel onApplyExpansion={()=>{}} onApplyUncrop={() => {}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <AnglePanel onApplyAngleChange={()=>{}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                        <BackgroundPanel onApplyBackground={()=>{}} onApplyBackgroundImage={()=>{}} onAddToRecipe={addToRecipe} isLoading={isProcessing} mode="recipe" />
                    </div>
                </div>

                {/* Right Column: Recipe and Images */}
                <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 overflow-hidden">
                    {/* Recipe Summary */}
                    <div className="flex-shrink-0">
                        <h3 className="text-xl font-semibold mb-2">Current Recipe</h3>
                        {recipe.length === 0 ? (
                            <p className="text-gray-400">Add steps from the Recipe Builder on the left.</p>
                        ) : (
                            <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {recipe.map((step, index) => (
                                    <li key={step.id} className="bg-gray-700/60 p-3 rounded-lg flex justify-between items-center text-sm">
                                        <span>{index + 1}. {step.name}</span>
                                        <Tooltip text="Remove this step from the recipe">
                                            <button onClick={() => removeFromRecipe(step.id)} disabled={isProcessing} className="text-gray-400 hover:text-red-400 disabled:opacity-50">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </Tooltip>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button 
                            onClick={handleStartProcessing} 
                            disabled={isProcessing || recipe.length === 0}
                            className="w-full mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                        >
                            <SparklesIcon className="w-6 h-6" />
                            {isProcessing 
                                ? <span className="truncate">Img {progress.currentImage}/{progress.totalImages}: {progress.currentStep}</span>
                                : `Apply Recipe to ${images.length} Images`
                            }
                        </button>
                        
                        { (isSuggestionLoading || (suggestions.length > 0 && showSuggestions)) && (
                            <div className="mt-4 p-4 bg-gray-900/40 border border-gray-700 rounded-lg animate-fade-in relative transition-all">
                                <div className="flex items-start gap-4">
                                    <LightBulbIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-yellow-300">Smart Suggestions</h4>
                                        {isSuggestionLoading && suggestions.length === 0 ? (
                                            <p className="text-sm text-gray-400 animate-pulse pt-2">Analyzing recipe for tips...</p>
                                        ) : (
                                            <ul className="mt-2 space-y-1.5 text-sm text-gray-300">
                                                {suggestions.map((s, i) => <li key={i} className="pl-2 relative before:content-['•'] before:absolute before:left-0 before:text-yellow-400">{s}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <Tooltip text="Hide Suggestions">
                                        <button onClick={() => setShowSuggestions(false)} className="text-gray-500 hover:text-white transition-colors">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-700"/>

                    {/* Image Gallery */}
                    <div className="flex-grow overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-2">Image Queue</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {images.map(image => (
                                <div key={image.id} className="relative aspect-square bg-black/20 rounded-lg overflow-hidden group">
                                    <img src={image.editedSrc || image.originalSrc} alt={image.file.name} className="w-full h-full object-contain" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-white">
                                        <p className="text-xs truncate">{image.file.name}</p>
                                        {image.status === 'done' && image.editedSrc && (
                                            <Tooltip text="Download Edited Image">
                                                <button onClick={() => handleDownload(image.editedSrc!, image.file.name)} className="self-end p-2 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors">
                                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                    {image.status === 'processing' && (
                                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 text-center">
                                            <Spinner />
                                            <p className="mt-2 text-xs text-gray-300 animate-pulse truncate">{image.processingStep || 'Processing...'}</p>
                                        </div>
                                    )}
                                     {image.status === 'error' && (
                                        <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center p-2 text-center">
                                            <XCircleIcon className="w-8 h-8 text-red-300 mb-2"/>
                                            <p className="text-xs text-red-200 font-semibold">Error</p>
                                            <p className="text-xs text-red-300 line-clamp-3">{image.error}</p>
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