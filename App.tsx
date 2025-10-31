/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import StartScreen from './components/StartScreen.tsx';
import Header from './components/Header.tsx';
import ToolsPalette from './components/ToolsPalette.tsx';
import EditorCanvas from './components/EditorCanvas.tsx';
import RightSidebar from './components/RightSidebar.tsx';
import BatchEditor from './components/BatchEditor.tsx';
import Spinner from './components/Spinner.tsx';

import { Tool, Layer, Hotspot, CustomStyle, ProjectState, BrushShape, DetectedObject } from './types.ts';
import { dataURLtoFile, fileToDataURL, createStyleThumbnail, applyCrop, downscaleImage, createGeminiBlob, decode, decodeAudioData } from './utils.ts';
import * as geminiService from './services/geminiService.ts';
// FIX: The 'LiveSession' type is not exported from the '@google/genai' module.
// It has been removed from the import statement to resolve the error.
import { GoogleGenAI, Modality } from '@google/genai';
import Konva from 'konva';
import { XCircleIcon } from './components/icons.tsx';

// --- State Management Reducer ---

type HistoryState = {
    past: Layer[][];
    present: Layer[];
    future: Layer[][];
};

type LayerAction =
    | { type: 'ADD'; payload: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'> }
    | { type: 'REMOVE'; payload: { layerId: string } }
    | { type: 'REORDER'; payload: { newOrder: Layer[] } }
    | { type: 'TOGGLE_VISIBILITY'; payload: { layerId: string } }
    | { type: 'RESET' }
    | { type: 'UPDATE_CACHED_RESULT'; payload: { layerId: string; cachedResult: string | null } }
    | { type: 'CLEAR_VISIBLE_CACHE' }
    | { type: 'UPDATE_LAYER_TRANSFORM'; payload: { layerId: string; transform: Layer['transform'] } };

type HistoryAction = LayerAction | { type: 'UNDO' } | { type: 'REDO' } | { type: 'SET_HISTORY'; payload: HistoryState };

const layersReducer = (state: Layer[], action: LayerAction): Layer[] => {
    switch (action.type) {
        case 'ADD': {
            const newLayer: Layer = { ...action.payload, id: Date.now().toString(), isVisible: true };
            return [...state, newLayer];
        }
        case 'REMOVE': {
            const layerIndex = state.findIndex(l => l.id === action.payload.layerId);
            if (layerIndex === -1) return state;

            // When a layer is removed, the input for all subsequent layers changes.
            // We must filter out the removed layer and then clear the cache for all
            // layers that were positioned at or after the original index.
            const newLayers = state.filter((_, index) => index !== layerIndex);
            return newLayers.map((layer, newIndex) => {
                if (newIndex >= layerIndex && layer.tool !== 'image') {
                    return { ...layer, cachedResult: undefined };
                }
                return layer;
            });
        }
        case 'REORDER': {
            const newOrder = action.payload.newOrder;
            let firstChangeIndex = -1;
            const shorterLength = Math.min(state.length, newOrder.length);
            for (let i = 0; i < shorterLength; i++) {
                if (state[i].id !== newOrder[i].id) {
                    firstChangeIndex = i;
                    break;
                }
            }
            if (firstChangeIndex === -1 && state.length !== newOrder.length) {
                firstChangeIndex = shorterLength;
            }
            if (firstChangeIndex !== -1) {
                return newOrder.map((l, i) =>
                    i >= firstChangeIndex && l.tool !== 'image' ? { ...l, cachedResult: undefined } : l
                );
            }
            return newOrder;
        }
        case 'TOGGLE_VISIBILITY': {
            const layerIndex = state.findIndex(l => l.id === action.payload.layerId);
            if (layerIndex === -1) return state;

            return state.map((layer, index) => {
                // Layers before the toggled one are unaffected.
                if (index < layerIndex) {
                    return layer;
                }
                // For the target layer and all subsequent layers, invalidate the cache.
                const newLayer = (layer.tool !== 'image') ? { ...layer, cachedResult: undefined } : { ...layer };
                // For the target layer specifically, also toggle its visibility.
                if (index === layerIndex) {
                    newLayer.isVisible = !layer.isVisible;
                }
                return newLayer;
            });
        }
        case 'RESET': {
             return [];
        }
        case 'UPDATE_CACHED_RESULT': {
            return state.map(l =>
                l.id === action.payload.layerId
                    ? { ...l, cachedResult: action.payload.cachedResult ?? undefined }
                    : l
            );
        }
        case 'CLEAR_VISIBLE_CACHE': {
            let hasChanged = false;
            const newLayers = state.map(layer => {
                if (layer.isVisible && layer.cachedResult && layer.tool !== 'image') {
                    hasChanged = true;
                    return { ...layer, cachedResult: undefined };
                }
                return layer;
            });
            return hasChanged ? newLayers : state;
        }
        case 'UPDATE_LAYER_TRANSFORM': {
            return state.map(l =>
                l.id === action.payload.layerId
                    ? { ...l, transform: action.payload.transform }
                    : l
            );
        }
        default:
            return state;
    }
};

const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
    const { past, present, future } = state;

    switch (action.type) {
        case 'UNDO': {
            if (past.length === 0) return state;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);
            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        }
        case 'REDO': {
            if (future.length === 0) return state;
            const next = future[0];
            const newFuture = future.slice(1);
            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        }
        case 'SET_HISTORY': {
            return action.payload;
        }
        case 'UPDATE_CACHED_RESULT': {
            const newPresent = layersReducer(present, action);
            return { ...state, present: newPresent };
        }
        case 'RESET': {
             if (present.length === 0) return state;
             return {
                past: [...past, present],
                present: [],
                future: [],
            };
        }
        default: {
            const newPresent = layersReducer(present, action as LayerAction);
            if (newPresent === present) {
                return state;
            }
            return {
                past: [...past, present],
                present: newPresent,
                future: [],
            };
        }
    }
};

const initialHistory: HistoryState = {
    past: [],
    present: [],
    future: [],
};


const App: React.FC = () => {
    // State management
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Processing...');
    const [error, setError] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<Tool>('adjust');
    const [isFastMode, setIsFastMode] = useState(true);
    
    // Reducer for layer history
    const [history, dispatch] = useReducer(historyReducer, initialHistory);

    // Canvas state
    const [stageState, setStageState] = useState({ scale: 1, x: 0, y: 0 });
    const [editHotspot, setEditHotspot] = useState<Hotspot | null>(null);
    const [isMasking, setIsMasking] = useState(false);
    const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
    const [brushSize, setBrushSize] = useState(30);
    const [brushShape, setBrushShape] = useState<BrushShape>('circle');
    const [brushHardness, setBrushHardness] = useState(1.0);
    const [maskPreviewOpacity, setMaskPreviewOpacity] = useState(0.5);
    const [isFindingObjects, setIsFindingObjects] = useState(false);
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[] | null>(null);
    const [selectedObjectMasks, setSelectedObjectMasks] = useState<string[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    
    // UI state

    // CSS Inspector State
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectionResult, setInspectionResult] = useState<{ name: string; mask: string | null; css: object | null; error: string | null; } | null>(null);

    // Transcription & Voice Command State
    const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'recording' | 'transcribing' | 'done' | 'error'>('idle');
    const [transcribedText, setTranscribedText] = useState('');
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const [voiceCommandFeedback, setVoiceCommandFeedback] = useState<string | null>(null);

    // Refs for audio processing and live session
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const currentCommandRef = useRef('');
    const voiceCommandDebounceRef = useRef<number | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const baseImage = imageFiles.length > 0 ? imageFiles[0] : null;

    // Memoize the object URL for the base image to prevent leaks and re-renders
    const baseImageUrl = useMemo(() => {
        if (baseImage) return URL.createObjectURL(baseImage);
        return '';
    }, [baseImage]);

    useEffect(() => {
        // Clean up the object URL when the component unmounts or the URL changes
        return () => {
            if (baseImageUrl) {
                URL.revokeObjectURL(baseImageUrl);
            }
        };
    }, [baseImageUrl]);
    
    useEffect(() => {
        if (voiceCommandFeedback) {
            const timer = setTimeout(() => {
                setVoiceCommandFeedback(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [voiceCommandFeedback]);

    const canvasRef = useRef<Konva.Stage>(null);
    const isInitialFastModeMount = useRef(true);

    useEffect(() => {
        // On subsequent renders (not the initial one), if isFastMode changes,
        // we clear the cache to force reprocessing. This is crucial for switching
        // between low-res previews and high-res final outputs.
        if (isInitialFastModeMount.current) {
            isInitialFastModeMount.current = false;
            return;
        }

        if (history.present.some(l => l.cachedResult)) {
            dispatch({ type: 'CLEAR_VISIBLE_CACHE' });
        }
        // We intentionally omit history.present from dependencies to only run this effect
        // when isFastMode changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFastMode, dispatch]);

    const applyLayer = useCallback(async (layer: Layer, inputFile: File): Promise<string | null> => {
        const { tool, params } = layer;
        switch(tool) {
            case 'adjust': return geminiService.generateAdjustedImage(inputFile, params.prompt);
            case 'retouch': return geminiService.generateEditedImage(inputFile, params.prompt, dataURLtoFile(params.mask, 'mask.png'));
            case 'textEdit': return geminiService.generateTextEdit(inputFile, params.prompt);
            case 'magicEraser': return geminiService.generateInpaintedImage(inputFile, dataURLtoFile(params.mask, 'mask.png'), params.fillPrompt);
            case 'facial': return geminiService.generateFacialEnhancement(inputFile, params.prompt, dataURLtoFile(params.mask, 'mask.png'));
            case 'faceSwap': {
                const targetImageFile = await dataURLtoFile(params.targetImageDataUrl, 'target-face-swap.png');
                const maskFile = await dataURLtoFile(params.targetFaceMaskDataUrl, 'target-face-mask.png');
                const referenceFaceFiles = await Promise.all(params.referenceFaceDataUrls.map((url: string, i: number) => dataURLtoFile(url, `ref-face-${i}.png`)));
                return geminiService.generateFaceSwap(targetImageFile, referenceFaceFiles, maskFile, params.options);
            }
            case 'background':
                if (params.prompt) return geminiService.generateReplacedBackground(inputFile, params.prompt);
                if (params.backgroundDataUrl) {
                    const backgroundFile = dataURLtoFile(params.backgroundDataUrl, 'background.png');
                    return geminiService.generateReplacedBackgroundFromImage(inputFile, backgroundFile);
                }
                return null;
            case 'clothing': {
                const clothingFile = dataURLtoFile(params.clothingDataUrl, 'clothing.png');
                return geminiService.generateClothingChange(inputFile, clothingFile, params.prompt);
            }
            case 'addPerson': {
                const personFile = dataURLtoFile(params.personDataUrl, 'person.png');
                return geminiService.generateAddedPerson(inputFile, personFile, params.prompt);
            }
            case 'addObject':
                if (params.prompt) return geminiService.generateAddedObjectFromText(inputFile, params.prompt, params.hotspot, params.lighting, params.shadows);
                if (params.objectDataUrl) {
                    const objectFile = dataURLtoFile(params.objectDataUrl, 'object.png');
                    return geminiService.generateAddedObjectFromUpload(inputFile, objectFile, params.hotspot, params.lighting, params.shadows);
                }
                return null;
            case 'enhance':
                if (params.prompt && params.hotspot) {
                    return geminiService.generateAreaEnhancement(inputFile, params.prompt, params.hotspot);
                }
                return geminiService.generateEnhancedImage(inputFile, params.prompt);
            case 'expand':
                if (params.direction) return geminiService.generateExpandedImage(inputFile, params.direction, params.percentage);
                return geminiService.generateUncroppedImage(inputFile, params.percentage);
            case 'camera': return geminiService.generateNewAngleImage(inputFile, params.prompt);
            case 'mix': {
                const itemFiles = await Promise.all(params.itemDataUrls.map((url: string, i: number) => dataURLtoFile(url, `item-${i}.png`)));
                return geminiService.generateMixedImage(inputFile, itemFiles, params.prompt);
            }
            case 'style': {
                const referenceImages = await Promise.all(params.referenceImages.map((url: string, i: number) => dataURLtoFile(url, `style-ref-${i}.png`)));
                return geminiService.generateStyledImage(inputFile, referenceImages);
            }
            default: return null;
        }
    }, []);

    // --- Layer Processing Engine ---
    useEffect(() => {
        let isCancelled = false;
        const processLayers = async () => {
            if (!baseImage) return;
            const generativeLayers = history.present.filter(l => l.tool !== 'image');

            const firstUncachedIndex = generativeLayers.findIndex(l => l.isVisible && !l.cachedResult);

            if (firstUncachedIndex === -1) {
                if (!isCancelled) setIsLoading(false);
                return;
            }

            if (!isCancelled) {
                setIsLoading(true);
                setError(null);
            }
            
            let lastResultFile = baseImage;
            for (let i = firstUncachedIndex - 1; i >= 0; i--) {
                const prevLayer = generativeLayers[i];
                if (prevLayer.isVisible && prevLayer.cachedResult) {
                    lastResultFile = dataURLtoFile(prevLayer.cachedResult, `cached-${i}.png`);
                    break;
                }
            }

            for (let i = firstUncachedIndex; i < generativeLayers.length; i++) {
                if (isCancelled) return;

                const layer = generativeLayers[i];
                if (!layer.isVisible) continue;

                if (!isCancelled) setLoadingMessage(`Применение: ${layer.name}`);

                try {
                    const inputFile = isFastMode ? await downscaleImage(lastResultFile, 1024) : lastResultFile;
                    const resultDataUrl = await applyLayer(layer, inputFile);

                    if (isCancelled) return;

                    if (resultDataUrl) {
                        dispatch({
                            type: 'UPDATE_CACHED_RESULT',
                            payload: { layerId: layer.id, cachedResult: resultDataUrl }
                        });
                        lastResultFile = dataURLtoFile(resultDataUrl, `result-${i}.png`);
                    } else {
                        console.warn(`Layer "${layer.name}" did not produce a result.`);
                    }
                } catch (err: any) {
                    if (!isCancelled) setError(err.message);
                    break;
                }
            }
            
            if (!isCancelled) setIsLoading(false);
        };
    
        processLayers();

        return () => { isCancelled = true; };
    }, [history.present, baseImage, applyLayer, isFastMode]);

    // --- File & State Management ---
    const resetState = useCallback((keepImage = false) => {
        if (!keepImage) setImageFiles([]);
        dispatch({ type: 'SET_HISTORY', payload: { past: [], present: [], future: [] }});
        setError(null);
        setActiveTool('adjust');
        setEditHotspot(null);
        setIsMasking(false);
        setMaskDataUrl(null);
        setStageState({ scale: 1, x: 0, y: 0 });
        setDetectedObjects(null);
        setSelectedObjectMasks([]);
        setSelectedLayerId(null);
    }, [dispatch]);

    // --- History Management ---
    const handleUndo = useCallback(() => {
        dispatch({ type: 'UNDO' });
        // After undoing, transient states might be inconsistent with the restored layer stack.
        // Resetting them ensures a clean state.
        setEditHotspot(null);
        setIsMasking(false);
        setMaskDataUrl(null);
        setVoiceCommandFeedback('Действие: Последнее изменение отменено.');
    }, [dispatch]);

    const handleRedo = useCallback(() => {
        dispatch({ type: 'REDO' });
        // Also reset transient state on redo for consistency.
        setEditHotspot(null);
        setIsMasking(false);
        setMaskDataUrl(null);
        setVoiceCommandFeedback('Действие: Последнее изменение повторено.');
    }, [dispatch]);
    
    const handleStartOver = useCallback(() => {
      if(window.confirm("Вы уверены, что хотите начать сначала? Все несохраненные изменения будут потеряны.")) {
          resetState();
      }
    }, [resetState]);

    const handleDownload = useCallback(() => {
        if (!baseImage || !canvasRef.current) return;
        setVoiceCommandFeedback('Действие: Загрузка изображения...');

        const stage = canvasRef.current;
        const transformer = stage.findOne('Transformer');
        const transformerVisible = transformer?.isVisible();

        if (transformer) {
            transformer.hide();
            stage.draw();
        }

        const dataUrl = stage.toDataURL({ pixelRatio: 2 });

        if (transformer && transformerVisible) {
            transformer.show();
            stage.draw();
        }

        const link = document.createElement('a');
        link.download = `pixshop-${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [baseImage]);
    
    const handleRevertAll = useCallback(() => {
        if (window.confirm("Вы уверены, что хотите отменить все изменения? Все слои будут удалены, и это действие нельзя отменить.")) {
            resetState(true);
        }
    }, [resetState]);
    
    const handleClearCache = useCallback(() => {
        if (window.confirm("Это приведет к повторной обработке всех видимых слоев, что может занять некоторое время. Продолжить?")) {
            dispatch({ type: 'CLEAR_VISIBLE_CACHE' });
            setVoiceCommandFeedback('Действие: Кэш очищен, слои обрабатываются заново.');
        }
    }, [dispatch]);

    // --- Keyboard Shortcuts for Undo/Redo ---
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return; // Don't interfere with text editing
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrl = isMac ? event.metaKey : event.ctrlKey;

            if (isCtrl && event.key === 'z') {
                event.preventDefault();
                handleUndo();
            } else if (isCtrl && event.key === 'y') {
                event.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleUndo, handleRedo]);

    // --- Voice Command Processing ---
    const processVoiceCommand = useCallback((command: string) => {
        const lowerCaseCommand = command.toLowerCase();
        let feedbackMessage: string | null = null;
    
        const toolMap: { [key: string]: { tool: Tool; name: string } } = {
            'расширить': { tool: 'expand', name: 'Расширение' },
            'камера': { tool: 'camera', name: 'Камера' },
            'стиль': { tool: 'style', name: 'Применение стиля' },
            'настроить': { tool: 'adjust', name: 'Настройка' },
            'коррекция': { tool: 'adjust', name: 'Настройка' },
            'улучшить': { tool: 'enhance', name: 'Улучшение' },
            'ретушь': { tool: 'retouch', name: 'Ретушь' },
            'текстовая правка': { tool: 'textEdit', name: 'Текстовая правка' },
            'редактировать текст': { tool: 'textEdit', name: 'Текстовая правка' },
            'ластик': { tool: 'magicEraser', name: 'Волшебный ластик' },
            'лицо': { tool: 'facial', name: 'Лицо' },
            'замена лица': { tool: 'faceSwap', name: 'Замена лица' },
            'фон': { tool: 'background', name: 'Фон' },
            'одежда': { tool: 'clothing', name: 'Одежда' },
            'комбинировать': { tool: 'mix', name: 'Комбинирование' },
            'добавить человека': { tool: 'addPerson', name: 'Добавление человека' },
            'добавить объект': { tool: 'addObject', name: 'Добавление объекта' },
            'добавить изображение': { tool: 'image', name: 'Добавление изображения' },
        };
    
        let toolSwitched = false;
        for (const keyword in toolMap) {
            if (lowerCaseCommand.includes(keyword)) {
                const { tool, name } = toolMap[keyword];
                setActiveTool(tool);
                feedbackMessage = `Понял: Переключился на инструмент '${name}'.`;
                toolSwitched = true;
                break;
            }
        }
    
        if (toolSwitched) {
            // Do nothing more if we've switched a tool
        } else if (lowerCaseCommand.includes('отменить') || lowerCaseCommand.includes('отмена')) {
            handleUndo();
            return; // handleUndo sets its own feedback
        } else if (lowerCaseCommand.includes('повторить') || lowerCaseCommand.includes('возврат')) {
            handleRedo();
            return; // handleRedo sets its own feedback
        } else if (lowerCaseCommand.includes('скачать') || lowerCaseCommand.includes('загрузить')) {
            handleDownload();
            return;
        } else if (lowerCaseCommand.includes('начать сначала') || lowerCaseCommand.includes('новое изображение')) {
            handleStartOver();
            feedbackMessage = 'Действие: Начинаю сначала с новым изображением.';
        } else if (lowerCaseCommand.includes('сбросить слои') || lowerCaseCommand.includes('удалить слои')) {
            handleRevertAll();
            feedbackMessage = 'Действие: Сбрасываю все слои.';
        } else {
            feedbackMessage = `Извините, я не распознал команду: "${command}"`;
        }
    
        setVoiceCommandFeedback(feedbackMessage);
    
    }, [handleUndo, handleRedo, handleDownload, handleStartOver, handleRevertAll, setActiveTool]);

    // --- Transcription Management ---
    const handleStopRecording = useCallback(() => {
        if (voiceCommandDebounceRef.current) clearTimeout(voiceCommandDebounceRef.current);
        // Process any lingering command when recording is stopped manually
        if (currentCommandRef.current.trim()) {
            processVoiceCommand(currentCommandRef.current.trim());
            currentCommandRef.current = '';
        }

        setTranscriptionStatus(transcribedText ? 'done' : 'idle');
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        inputAudioContextRef.current = null;
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        outputAudioContextRef.current = null;

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }, [transcribedText, processVoiceCommand]);

    const handleStartRecording = useCallback(async () => {
        setTranscriptionStatus('recording');
        setTranscribedText('');
        setTranscriptionError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputAudioContext;
            
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputAudioContext;
            const outputNode = outputAudioContext.createGain();
            // Intentionally not connecting outputNode to destination to mute the audio response,
            // but we still process it to comply with the API.

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.debug('Live session opened.');
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createGeminiBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message) => {
                        // Handle the model's audio output to comply with API requirements, even if not played.
                        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;

                        if (base64EncodedAudioString && outputAudioContextRef.current) {
                            const outCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(
                                nextStartTimeRef.current,
                                outCtx.currentTime
                            );
                            const audioBuffer = await decodeAudioData(
                                decode(base64EncodedAudioString),
                                outCtx,
                                24000,
                                1
                            );
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }

                        // Handle transcription with debounce for command processing
                        if (message.serverContent?.inputTranscription) {
                            if (voiceCommandDebounceRef.current) clearTimeout(voiceCommandDebounceRef.current);
                            
                            const text = message.serverContent.inputTranscription.text;
                            currentCommandRef.current += text;
                            setTranscribedText(prev => prev + text);

                            voiceCommandDebounceRef.current = window.setTimeout(() => {
                                if (currentCommandRef.current.trim()) {
                                    processVoiceCommand(currentCommandRef.current.trim());
                                    setTranscribedText(prev => prev + '\n');
                                    currentCommandRef.current = '';
                                }
                            }, 1200); // 1.2 second delay after user stops speaking
                        }

                        if (message.serverContent?.turnComplete) {
                            if (voiceCommandDebounceRef.current) clearTimeout(voiceCommandDebounceRef.current);
                            if (currentCommandRef.current.trim()) {
                                processVoiceCommand(currentCommandRef.current.trim());
                            }
                            setTranscribedText(prev => prev + '\n');
                            currentCommandRef.current = '';
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        setTranscriptionError('An error occurred during transcription. Please try again.');
                        setTranscriptionStatus('error');
                        handleStopRecording();
                    },
                    onclose: () => { console.debug('Live session closed.'); },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                },
            });
            await sessionPromiseRef.current;
        } catch (err) {
            console.error('Failed to start recording:', err);
            let errorMessage = 'Could not access microphone. Please check permissions.';
            if (err instanceof DOMException) {
                switch (err.name) {
                    case 'NotAllowedError':
                        errorMessage = 'Microphone permission denied. Please enable it in your browser settings to use this feature.';
                        break;
                    case 'NotFoundError':
                        errorMessage = 'No microphone found. Please ensure a microphone is connected and enabled.';
                        break;
                    case 'NotReadableError':
                        errorMessage = 'Microphone is busy or unreadable. Please check if another app is using it.';
                        break;
                    default:
                        errorMessage = `Could not access microphone: ${err.message}. Check your browser and system settings.`;
                }
            } else if (err instanceof Error) {
                errorMessage = `An unexpected error occurred while accessing the microphone: ${err.message}`;
            }
            setTranscriptionError(errorMessage);
            setTranscriptionStatus('error');
        }
    }, [handleStopRecording, processVoiceCommand]);
    
    const handleToggleMasking = useCallback(() => {
        setIsMasking(prev => !prev);
    }, []);

    const handleConfirmMasking = useCallback(() => {
        setIsMasking(false);
    }, []);
    
    const handleCancelMasking = useCallback(() => {
        setIsMasking(false);
        setMaskDataUrl(null);
    }, []);

    const handleClearObjects = useCallback(() => {
        setDetectedObjects(null);
        setSelectedObjectMasks([]);
        setMaskDataUrl(null);
    }, []);

    const handleToolSelect = useCallback((tool: Tool) => {
        // Deactivate all interactive modes when switching tools to prevent
        // state from one tool interfering with another.
        setIsMasking(false);
        setMaskDataUrl(null);
        setEditHotspot(null);
        setSelectedLayerId(null);
    
        // Clear data related to object selection unless switching to the magic eraser tool.
        if (tool !== 'magicEraser') {
            handleClearObjects();
        }
    
        // Activate the new tool and its specific mode.
        setActiveTool(tool);
    }, [handleClearObjects]);
    
    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const fileArray = Array.from(files);
            resetState(false);
            setImageFiles(fileArray);
        }
    };
    
    // --- Layer Application Logic ---
    const handleAddLayer = useCallback((newLayer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => {
        dispatch({ type: 'ADD', payload: newLayer });
        setMaskDataUrl(null);
        setIsMasking(false);
        setEditHotspot(null);
        setDetectedObjects(null);
        setSelectedObjectMasks([]);
    }, [dispatch]);
    
    const handleUpdateLayerTransform = useCallback((layerId: string, newTransform: Layer['transform']) => {
        dispatch({ type: 'UPDATE_LAYER_TRANSFORM', payload: { layerId, transform: newTransform } });
    }, [dispatch]);

    const handleReorderLayers = useCallback((newOrder: Layer[]) => dispatch({ type: 'REORDER', payload: { newOrder } }), [dispatch]);
    const handleToggleVisibility = useCallback((layerId: string) => dispatch({ type: 'TOGGLE_VISIBILITY', payload: { layerId } }), [dispatch]);
    const handleRemoveLayer = useCallback((layerId: string) => dispatch({ type: 'REMOVE', payload: { layerId } }), [dispatch]);

    const handleGenerateFromPrompt = async (prompt: string) => {
        if (!prompt) return;
        setIsLoading(true);
        setLoadingMessage('Generating your image...');
        setError(null);
        try {
            const imageDataUrl = await geminiService.generateImageFromPrompt(prompt);
            const file = dataURLtoFile(imageDataUrl, `${prompt.slice(0, 20)}.png`);
            resetState(false);
            setImageFiles([file]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFindObjects = useCallback(async () => {
        if (!baseImage || isFindingObjects) return;
        setIsFindingObjects(true);
        setError(null);
        setDetectedObjects(null);
        try {
            const objects = await geminiService.detectAndSegmentObjects(baseImage);
            setDetectedObjects(objects);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsFindingObjects(false);
        }
    }, [baseImage, isFindingObjects]);

    const handleObjectMaskToggle = useCallback((maskUrl: string) => {
        setSelectedObjectMasks(prev => prev.includes(maskUrl) ? prev.filter(m => m !== maskUrl) : [...prev, maskUrl]);
    }, []);

    const handleConfirmSelection = useCallback(() => setDetectedObjects(null), []);
    
    const handleSaveProject = useCallback(async () => {
        if (!baseImage) {
            alert("Пожалуйста, загрузите изображение перед сохранением.");
            return;
        }
        setLoadingMessage('Saving project...');
        setIsLoading(true);
        try {
            const baseImageAsDataUrl = await fileToDataURL(baseImage);
            const projectState: ProjectState = {
                baseImage: baseImageAsDataUrl, history
            };
            const jsonString = JSON.stringify(projectState, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `pixshop-project-${Date.now()}.pixshop`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err: any) {
            setError('Failed to save project: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [baseImage, history]);
    
    const handleLoadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset everything before loading
        resetState();
        setIsLoading(true);
        setLoadingMessage('Loading project...');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!e.target?.result) throw new Error("Could not read project file");
                const projectState: ProjectState = JSON.parse(e.target.result as string);

                if (!projectState.baseImage) {
                    throw new Error("Project file is missing the base image.");
                }

                const imageFile = dataURLtoFile(projectState.baseImage, 'project-base-image.png');
                setImageFiles([imageFile]);

                // Backward compatibility for old project files
                if (projectState.layers && !projectState.history) {
                    const loadedHistory: HistoryState = {
                        past: [],
                        present: projectState.layers,
                        future: projectState.undoneLayers ? [projectState.undoneLayers] : [],
                    };
                    dispatch({ type: 'SET_HISTORY', payload: loadedHistory });
                } else if (projectState.history) {
                    const validHistory = {
                        ...projectState.history,
                        past: projectState.history.past || [],
                        present: projectState.history.present || [],
                        future: projectState.history.future || []
                    };
                    dispatch({ type: 'SET_HISTORY', payload: validHistory });
                }

            } catch (err: any) {
                setError('Failed to load project: ' + err.message);
                resetState(); // Clear out partial state on error
            } finally {
                setIsLoading(false);
                // Clear the input value to allow loading the same file again
                if(event.target) event.target.value = '';
            }
        };
        reader.onerror = () => {
            setError('Failed to read the project file.');
            setIsLoading(false);
        };
        reader.readAsText(file);
    }, [resetState]);
    
    const handleInspectElement = useCallback(async (point: Hotspot) => {
        if (!baseImage || isInspecting) return;
        setIsInspecting(true);
        setInspectionResult(null);
        setError(null);
        try {
            const result = await geminiService.getCssForElement(baseImage, point);
            setInspectionResult({ ...result, error: null });
        } catch (err: any) {
            setInspectionResult({ name: '', mask: null, css: null, error: err.message });
        } finally {
            setIsInspecting(false);
        }
    }, [baseImage, isInspecting]);

    const handleClearInspection = useCallback(() => {
        setInspectionResult(null);
    }, []);

    const selectedLayer = useMemo(() => {
        if (!selectedLayerId) return null;
        return history.present.find(l => l.id === selectedLayerId) || null;
    }, [selectedLayerId, history.present]);

    if (isLoading && !baseImage) { // Only show full-screen spinner if there's no image
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center bg-bg-main text-center p-8">
                <Spinner />
                <p className="mt-4 text-xl font-bold text-text-primary animate-pulse">{loadingMessage}</p>
            </div>
        );
    }

    if (!baseImage) {
        return <StartScreen onFileSelect={handleFileSelect} onGenerateFromPrompt={handleGenerateFromPrompt} isLoading={isLoading} />;
    }
    
    return (
        <div className="w-screen h-screen flex flex-col bg-bg-main font-sans">
            <Header
                onSaveProject={handleSaveProject}
                onLoadProject={handleLoadProject}
                isFastMode={isFastMode}
                onFastModeChange={setIsFastMode}
                onDownload={handleDownload}
            />

            <main className="flex-grow flex overflow-hidden">
                <ToolsPalette activeTool={activeTool} onToolSelect={handleToolSelect} />
                
                <div className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
                    <EditorCanvas
                        ref={canvasRef}
                        baseImage={baseImage}
                        layers={history.present}
                        isMasking={isMasking}
                        maskDataUrl={maskDataUrl}
                        onMaskChange={setMaskDataUrl}
                        onHotspot={setEditHotspot}
                        editHotspot={editHotspot}
                        activeTool={activeTool}
                        stageState={stageState}
                        onStageStateChange={setStageState}
                        brushSize={brushSize}
                        brushShape={brushShape}
                        brushHardness={brushHardness}
                        maskPreviewOpacity={maskPreviewOpacity}
                        detectedObjects={detectedObjects}
                        selectedObjectMasks={selectedObjectMasks}
// FIX: Pass the 'handleObjectMaskToggle' function to the 'onObjectMaskToggle' prop.
                        onObjectMaskToggle={handleObjectMaskToggle}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={setSelectedLayerId}
                        onUpdateLayerTransform={handleUpdateLayerTransform}
                        onInspectElement={handleInspectElement}
                        inspectedElementMask={inspectionResult?.mask ?? null}
                    />
                </div>

                <RightSidebar
                    // State
                    activeTool={activeTool}
                    isLoading={isLoading}
                    loadingMessage={isLoading ? loadingMessage : ''}
                    isFindingObjects={isFindingObjects}
                    layers={history.present}
                    maskDataUrl={maskDataUrl}
                    editHotspot={editHotspot}
                    detectedObjects={detectedObjects}
                    selectedObjectMasks={selectedObjectMasks}
                    hasUndo={history.past.length > 0}
                    hasRedo={history.future.length > 0}
                    isRecording={transcriptionStatus === 'recording'}
                    transcriptionStatus={transcriptionStatus}
                    transcribedText={transcribedText}
                    transcriptionError={transcriptionError}
                    isMasking={isMasking}
                    brushSize={brushSize}
                    brushShape={brushShape}
                    brushHardness={brushHardness}
                    maskPreviewOpacity={maskPreviewOpacity}
                    selectedLayer={selectedLayer}
                    isInspecting={isInspecting}
                    inspectionResult={inspectionResult}
                    // Handlers
                    onAddLayer={handleAddLayer}
                    onToggleMasking={handleToggleMasking}
                    onFindObjects={handleFindObjects}
// FIX: Pass the 'handleObjectMaskToggle' function to the 'onObjectMaskToggle' prop.
                    onObjectMaskToggle={handleObjectMaskToggle}
                    onSetMaskDataUrl={setMaskDataUrl}
                    onClearObjects={handleClearObjects}
                    onConfirmSelection={handleConfirmSelection}
                    onReorderLayers={handleReorderLayers}
                    onToggleVisibility={handleToggleVisibility}
                    onRemoveLayer={handleRemoveLayer}
                    onNewImage={handleStartOver}
                    onDownload={handleDownload}
                    onRevertAll={handleRevertAll}
                    onClearCache={handleClearCache}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    onBrushSizeChange={setBrushSize}
                    onBrushShapeChange={setBrushShape}
                    onBrushHardnessChange={setBrushHardness}
                    onOpacityChange={setMaskPreviewOpacity}
                    onConfirmMasking={handleConfirmMasking}
                    onCancelMasking={handleCancelMasking}
                    onUpdateLayerTransform={handleUpdateLayerTransform}
                    onClearInspection={handleClearInspection}
                />
            </main>
             {isLoading && baseImage && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-bg-panel border-2 border-primary text-text-primary px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 max-w-md animate-fade-in">
                    <Spinner size="sm" className="text-primary" />
                    <span className="block sm:inline flex-grow font-semibold">{loadingMessage}</span>
                </div>
            )}
            {voiceCommandFeedback && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-bg-panel border-2 border-primary text-text-primary px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 max-w-md animate-fade-in">
                    <span className="block sm:inline flex-grow">{voiceCommandFeedback}</span>
                    <button onClick={() => setVoiceCommandFeedback(null)} className="p-1 rounded-full hover:bg-blue-100 transition-colors">
                        <XCircleIcon className="w-5 h-5 text-primary" />
                    </button>
                </div>
            )}
            {error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-bg-panel border-2 border-red-500 text-text-primary px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 max-w-2xl">
                    <strong className="font-bold text-red-600">Ошибка:</strong>
                    <span className="block sm:inline flex-grow">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 rounded-full hover:bg-red-100 transition-colors">
                        <XCircleIcon className="w-5 h-5 text-red-600" />
                    </button>
                </div>
            )}
            {imageFiles.length > 1 && (
                <BatchEditor files={imageFiles} onExit={handleStartOver} />
            )}
        </div>
    );
};

export default App;