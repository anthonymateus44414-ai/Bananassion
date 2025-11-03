/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, TrashIcon, UserCircleIcon, SparklesIcon, XCircleIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer, DetectedObject } from '../types';
import Spinner from './Spinner';
import { fileToDataURL } from '../utils';
import { detectFaces } from '../services/geminiService';

interface FaceSwapPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
}

interface ReferenceFile {
    id: string;
    file: File;
    preview: string;
}

const FaceSwapPanel: React.FC<FaceSwapPanelProps> = ({ onAddLayer, isLoading }) => {
    const [targetFile, setTargetFile] = useState<File | null>(null);
    const [targetPreview, setTargetPreview] = useState<string | null>(null);
    const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
    
    // State for the new intelligent workflow
    const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'analyzed' | 'error'>('idle');
    const [detectedFaces, setDetectedFaces] = useState<DetectedObject[]>([]);
    const [selectedFaceMask, setSelectedFaceMask] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    
    // State for advanced options
    const [expressionOption, setExpressionOption] = useState<'original' | 'reference'>('original');
    const [blendingStrength, setBlendingStrength] = useState(50); // 0-100 scale

    const [isDraggingTarget, setIsDraggingTarget] = useState(false);
    const [isDraggingRefs, setIsDraggingRefs] = useState(false);
    
    const resetState = () => {
        setTargetFile(null);
        setTargetPreview(null);
        setReferenceFiles([]);
        setAnalysisState('idle');
        setDetectedFaces([]);
        setSelectedFaceMask(null);
        setAnalysisError(null);
        setExpressionOption('original');
        setBlendingStrength(50);
    };

    const handleTargetFileChange = async (file: File | null) => {
        if (!file) return;

        resetState();
        setTargetFile(file);
        setAnalysisState('analyzing');
        
        try {
            const previewUrl = await fileToDataURL(file);
            setTargetPreview(previewUrl);

            const faces = await detectFaces(file);
            if (faces.length === 0) {
                setAnalysisError('Не удалось найти лица на целевом изображении. Пожалуйста, попробуйте другую фотографию.');
                setAnalysisState('error');
            } else {
                setDetectedFaces(faces);
                setAnalysisState('analyzed');
                // Auto-select if only one face is found
                if (faces.length === 1) {
                    setSelectedFaceMask(faces[0].mask);
                }
            }
        } catch(err: any) {
            setAnalysisError(err.message);
            setAnalysisState('error');
        }
    };

    const handleReferenceFilesChange = (files: FileList | null) => {
        if (!files || referenceFiles.length + files.length > 8) {
            alert("Вы можете загрузить до 8 эталонных изображений.");
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

    const handleRemoveReferenceFile = (id: string) => {
        setReferenceFiles(prev => prev.filter(item => item.id !== id));
    }
  
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const referenceDataUrls = referenceFiles.map(item => item.preview);
        if (targetPreview && selectedFaceMask && referenceDataUrls.length > 0) {
            onAddLayer({
                name: `Замена лица`,
                tool: 'faceSwap',
                params: { 
                    targetImageDataUrl: targetPreview,
                    targetFaceMaskDataUrl: selectedFaceMask, 
                    referenceFaceDataUrls: referenceDataUrls,
                    options: {
                        expression: expressionOption,
                        blending: blendingStrength,
                    }
                }
            });
            resetState();
        }
    };
    
    const getBlendingDescription = (value: number) => {
        if (value <= 33) return 'Приоритет плавного смешивания';
        if (value >= 67) return 'Приоритет точного соответствия';
        return 'Сбалансированный результат';
    }

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Интеллектуальная замена лица</h3>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* --- STEP 1: TARGET IMAGE --- */}
                <div className="p-3 bg-stone-50 rounded-lg border border-border-color">
                    <h4 className="font-bold text-text-primary mb-2">Шаг 1: Загрузите целевое изображение</h4>
                    <Tooltip side="left" text="Загрузите изображение, на котором вы хотите заменить лицо.">
                        <div
                            className={`relative w-full p-4 border-2 border-dashed rounded-lg text-center transition-colors ${isDraggingTarget ? 'border-primary bg-primary/10 animate-pulse' : 'border-border-color'} ${targetPreview ? '' : 'cursor-pointer hover:border-primary hover:bg-primary/10'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingTarget(true); }}
                            onDragLeave={() => setIsDraggingTarget(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingTarget(false);
                                handleTargetFileChange(e.dataTransfer.files?.[0] || null);
                            }}
                        >
                             <input id="target-image-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleTargetFileChange(e.target.files?.[0] || null)} disabled={isLoading || analysisState === 'analyzing'} />
                            { !targetPreview ? (
                                <label htmlFor="target-image-upload" className="flex flex-col items-center gap-2 text-text-secondary py-4 cursor-pointer">
                                    <UploadIcon className="w-8 h-8" />
                                    <span>Загрузить или перетащить</span>
                                </label>
                            ) : (
                                <div className="relative w-full max-h-48 flex items-center justify-center">
                                    <img src={targetPreview} alt="Target preview" className="max-h-48 w-auto rounded-md object-contain" />
                                    {analysisState === 'analyzing' && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-md"><Spinner /><p className="text-white mt-2 text-sm">Анализ лиц...</p></div>}
                                    {analysisState === 'analyzed' && (
                                        <div className="absolute inset-0">
                                            {detectedFaces.map(face => (
                                                <Tooltip key={face.mask} text="Выбрать это лицо для замены">
                                                    <button type="button" onClick={() => setSelectedFaceMask(face.mask)} className={`absolute inset-0 transition-all duration-200 rounded-md ${selectedFaceMask === face.mask ? 'ring-4 ring-primary ring-inset bg-primary/20' : 'bg-black/50 hover:bg-primary/30'}`}>
                                                        <img src={face.mask} alt="face mask" className="w-full h-full object-contain" style={{ mixBlendMode: 'screen', filter: 'brightness(0) invert(1)' }}/>
                                                    </button>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Tooltip>
                    {analysisState === 'analyzed' && (
                         <p className="text-sm font-semibold text-center mt-2 text-text-secondary">{detectedFaces.length > 1 ? 'Лица обнаружены! Выберите то, которое нужно заменить.' : 'Лицо обнаружено и выбрано автоматически.'}</p>
                    )}
                    {analysisState === 'error' && (
                        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center justify-center gap-2">
                            <XCircleIcon className="w-5 h-5"/> {analysisError}
                        </div>
                    )}
                </div>
                
                {/* --- STEP 2: REFERENCE FACES --- */}
                <div className={`p-3 bg-stone-50 rounded-lg border border-border-color transition-opacity duration-300 ${!selectedFaceMask ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h4 className="font-bold text-text-primary mb-2">Шаг 2: Загрузите эталонные лица ({referenceFiles.length}/8)</h4>
                    <Tooltip side="left" text="Загрузите от 1 до 8 изображений лица, которое вы хотите использовать.">
                        <label
                            htmlFor="reference-faces-upload"
                            className={`w-full p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                                isDraggingRefs 
                                    ? 'border-primary bg-primary/10 animate-pulse' 
                                    : referenceFiles.length < 8 ? 'border-border-color cursor-pointer hover:border-primary hover:bg-primary/10' : 'border-gray-300 bg-stone-100 cursor-not-allowed'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); if (referenceFiles.length < 8) setIsDraggingRefs(true); }}
                            onDragLeave={() => setIsDraggingRefs(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingRefs(false);
                                if (referenceFiles.length < 8) handleReferenceFilesChange(e.dataTransfer.files);
                            }}
                        >
                            <div className="flex flex-col items-center gap-2 text-text-secondary">
                                <UploadIcon className="w-8 h-8" />
                                <span>Загрузить или перетащить</span>
                            </div>
                        </label>
                    </Tooltip>
                    <input id="reference-faces-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleReferenceFilesChange(e.target.files)} disabled={isLoading || referenceFiles.length >= 8 || !selectedFaceMask} multiple/>
                    {referenceFiles.length > 0 && (
                        <div className="mt-2 grid grid-cols-4 gap-2 p-2 bg-stone-100 rounded-lg max-h-48 overflow-y-auto border border-border-color">
                            {referenceFiles.map(item => (
                                <div key={item.id} className="relative group aspect-square">
                                    <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover rounded-md bg-stone-50" />
                                    <Tooltip side="left" text={`Удалить ${item.file.name}`}>
                                        <button type="button" onClick={() => handleRemoveReferenceFile(item.id)} disabled={isLoading} className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-all scale-0 group-hover:scale-100" aria-label={`Удалить ${item.file.name}`}>
                                            <TrashIcon className="w-3 h-3"/>
                                        </button>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- STEP 3: ADVANCED OPTIONS --- */}
                <div className={`p-3 bg-stone-50 rounded-lg border border-border-color transition-opacity duration-300 ${!selectedFaceMask || referenceFiles.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h4 className="font-bold text-text-primary mb-2">Шаг 3: Расширенные настройки (необязательно)</h4>
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-text-primary mb-2">Управление выражением</label>
                            <div className="flex bg-stone-200 p-1 rounded-lg">
                                <Tooltip text="Сохранить выражение лица с исходного (целевого) изображения">
                                    <button type="button" onClick={() => setExpressionOption('original')} className={`w-1/2 p-2 text-sm font-bold rounded-md transition-colors ${expressionOption === 'original' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:bg-stone-300'}`}>Сохранить оригинал</button>
                                </Tooltip>
                                <Tooltip text="Попробовать перенести выражение лица с эталонного изображения">
                                    <button type="button" onClick={() => setExpressionOption('reference')} className={`w-1/2 p-2 text-sm font-bold rounded-md transition-colors ${expressionOption === 'reference' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:bg-stone-300'}`}>Взять с эталона</button>
                                </Tooltip>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="blending-strength" className="block text-sm font-semibold text-text-primary mb-2">
                                Сила смешивания: <span className="font-normal text-text-secondary">{getBlendingDescription(blendingStrength)}</span>
                            </label>
                             <Tooltip side="left" text={`Сила смешивания: ${blendingStrength}%. Настройте баланс между точным соответствием эталону (вправо) и плавным смешиванием (влево).`}>
                                <input
                                    id="blending-strength"
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={blendingStrength}
                                    onChange={(e) => setBlendingStrength(Number(e.target.value))}
                                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                                />
                             </Tooltip>
                        </div>
                    </div>
                </div>
                
                {/* Submit Button */}
                <Tooltip side="left" text="Заменить лицо на целевом изображении, используя эталонные лица.">
                    <button
                        type="submit"
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                        disabled={isLoading || !targetFile || !selectedFaceMask || referenceFiles.length === 0}
                    >
                        {isLoading ? <Spinner size="sm"/> : <><UserCircleIcon className="w-6 h-6"/> Заменить лицо</>}
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default FaceSwapPanel;