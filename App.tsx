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
import Tooltip from './components/Tooltip.tsx';

import { Tool, Layer, Hotspot, ProjectState, BrushShape, DetectedObject, LayerParams } from './types.ts';
import { dataURLtoFile, fileToDataURL, downscaleImage, createGeminiBlob, decode, decodeAudioData } from './utils.ts';
import * as geminiService from './services/geminiService.ts';
import { GoogleGenAI, Modality } from '@google/genai';
import Konva from 'konva';
import { XCircleIcon } from './components/icons.tsx';

// --- State Management: History Reducer ---
type HistoryState = { past: Layer[][]; present: Layer[]; future: Layer[][]; };
type LayerAction =
    | { type: 'ADD'; payload: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'> }
    | { type: 'REMOVE'; payload: { layerId: string } }
    | { type: 'REORDER'; payload: { newOrder: Layer[] } }
    | { type: 'TOGGLE_VISIBILITY'; payload: { layerId: string } }
    | { type: 'UPDATE_CACHED_RESULT'; payload: { layerId: string; cachedResult: string | null } }
    | { type: 'UPDATE_LAYER'; payload: { layer: Layer } }
    | { type: 'CLEAR_VISIBLE_CACHE' };
type HistoryAction = LayerAction | { type: 'UNDO' } | { type: 'REDO' } | { type: 'SET_HISTORY'; payload: HistoryState } | { type: 'JUMP_TO_STATE'; payload: { index: number } };

const layersReducer = (state: Layer[], action: LayerAction): Layer[] => {
    switch (action.type) {
        case 'ADD': return [...state, { ...action.payload, id: Date.now().toString(), isVisible: true }];
        case 'REMOVE': {
            const i = state.findIndex(l => l.id === action.payload.layerId);
            if (i === -1) return state;
            return state.filter((_, idx) => idx !== i).map((l, newIdx) => newIdx >= i ? { ...l, cachedResult: undefined } : l);
        }
        case 'REORDER': {
            const newOrder = action.payload.newOrder;
            const firstChange = newOrder.findIndex((l, i) => i >= state.length || l.id !== state[i].id);
            if (firstChange === -1 && newOrder.length === state.length) return state;
            return newOrder.map((l, i) => i >= (firstChange === -1 ? newOrder.length : firstChange) ? { ...l, cachedResult: undefined } : l);
        }
        case 'TOGGLE_VISIBILITY': {
            const i = state.findIndex(l => l.id === action.payload.layerId);
            if (i === -1) return state;
            return state.map((l, idx) => {
                if (idx < i) return l;
                const newLayer = { ...l, cachedResult: undefined };
                if (idx === i) newLayer.isVisible = !l.isVisible;
                return newLayer;
            });
        }
        case 'UPDATE_CACHED_RESULT': return state.map(l => l.id === action.payload.layerId ? { ...l, cachedResult: action.payload.cachedResult ?? undefined } : l);
        case 'UPDATE_LAYER': return state.map(l => l.id === action.payload.layer.id ? action.payload.layer : l);
        case 'CLEAR_VISIBLE_CACHE': return state.map(l => l.isVisible && l.cachedResult ? { ...l, cachedResult: undefined } : l);
        default: return state;
    }
};
const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
    const { past, present, future } = state;
    switch (action.type) {
        case 'UNDO':
            if (past.length === 0) return state;
            return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
        case 'REDO':
            if (future.length === 0) return state;
            return { past: [...past, present], present: future[0], future: future.slice(1) };
        case 'SET_HISTORY': return action.payload;
        case 'JUMP_TO_STATE': {
            const all = [...past, present, ...future];
            const { index } = action.payload;
            if (index < 0 || index >= all.length) return state;
            return { past: all.slice(0, index), present: all[index], future: all.slice(index + 1) };
        }
        case 'UPDATE_CACHED_RESULT': return { ...state, present: layersReducer(present, action) };
        default:
            const newPresent = layersReducer(present, action as LayerAction);
            if (newPresent === present) return state;
            // For non-destructive updates like transform, don't create a new history state
            if ((action as LayerAction).type === 'UPDATE_LAYER' && (action as any).payload.layer.tool === 'image') {
                return { ...state, present: newPresent };
            }
            return { past: [...past, present], present: newPresent, future: [] };
    }
};
const initialHistory: HistoryState = { past: [], present: [], future: [] };

// --- Custom Hooks for Logic Abstraction ---

const useLayerHistory = () => {
    const [history, dispatch] = useReducer(historyReducer, initialHistory);
    const { present: layers, past, future } = history;

    const addLayer = useCallback((payload: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => dispatch({ type: 'ADD', payload }), []);
    const removeLayer = useCallback((layerId: string) => dispatch({ type: 'REMOVE', payload: { layerId } }), []);
    const reorderLayers = useCallback((newOrder: Layer[]) => dispatch({ type: 'REORDER', payload: { newOrder } }), []);
    const toggleVisibility = useCallback((layerId: string) => dispatch({ type: 'TOGGLE_VISIBILITY', payload: { layerId } }), []);
    const updateCachedResult = useCallback((layerId: string, cachedResult: string | null) => dispatch({ type: 'UPDATE_CACHED_RESULT', payload: { layerId, cachedResult } }), []);
    const updateLayer = useCallback((layer: Layer) => dispatch({ type: 'UPDATE_LAYER', payload: { layer } }), []);
    const clearVisibleCache = useCallback(() => dispatch({ type: 'CLEAR_VISIBLE_CACHE' }), []);
    const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
    const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
    const setHistory = useCallback((payload: HistoryState) => dispatch({ type: 'SET_HISTORY', payload }), []);
    const jumpToState = useCallback((index: number) => dispatch({ type: 'JUMP_TO_STATE', payload: { index } }), []);

    return { history, layers, hasUndo: past.length > 0, hasRedo: future.length > 0, addLayer, removeLayer, reorderLayers, toggleVisibility, updateCachedResult, updateLayer, clearVisibleCache, undo, redo, setHistory, jumpToState };
};

const useLayerProcessor = (baseImage: File | null, layers: Layer[], isFastMode: boolean, updateCachedResult: (id: string, url: string | null) => void) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Processing...');
    const [error, setError] = useState<string | null>(null);

    const applyLayer = useCallback(async (layer: Layer, inputFile: File): Promise<string | null> => {
        const { tool, params } = layer;
        // The type assertion helps TypeScript narrow down the params based on the tool
        const typedParams = params as LayerParams['params'];
        
        switch (tool) {
            case 'adjust': return geminiService.generateAdjustedImage(inputFile, (typedParams as any).prompt);
            case 'retouch': return geminiService.generateEditedImage(inputFile, (typedParams as any).prompt, await dataURLtoFile((typedParams as any).mask, 'mask.png'));
            case 'textEdit': return geminiService.generateTextEdit(inputFile, (typedParams as any).prompt);
            case 'faceSwap': {
                const p = typedParams as any;
                const target = await dataURLtoFile(p.targetImageDataUrl, 'target.png');
                const mask = await dataURLtoFile(p.targetFaceMaskDataUrl, 'mask.png');
                const refs = await Promise.all(p.referenceFaceDataUrls.map((url: string, i: number) => dataURLtoFile(url, `ref${i}.png`)));
                return geminiService.generateFaceSwap(target, refs, mask, p.options);
            }
            case 'background': {
                 const p = typedParams as any;
                 if (p.prompt) return geminiService.generateReplacedBackground(inputFile, p.prompt);
                 if (p.backgroundDataUrl) return geminiService.generateReplacedBackgroundFromImage(inputFile, await dataURLtoFile(p.backgroundDataUrl, 'bg.png'));
                 return null;
            }
            case 'clothing': {
                const p = typedParams as any;
                return geminiService.generateClothingChange(inputFile, await dataURLtoFile(p.clothingDataUrl, 'clothing.png'), p.prompt);
            }
            case 'addPerson': {
                 const p = typedParams as any;
                 return geminiService.generateAddedPerson(inputFile, await dataURLtoFile(p.personDataUrl, 'person.png'), p.prompt);
            }
            case 'addObject': {
                const p = typedParams as any;
                if (p.prompt) return geminiService.generateAddedObjectFromText(inputFile, p.prompt, p.hotspot, p.lighting, p.shadows);
                if (p.objectDataUrl) return geminiService.generateAddedObjectFromUpload(inputFile, await dataURLtoFile(p.objectDataUrl, 'obj.png'), p.hotspot, p.lighting, p.shadows);
                return null;
            }
            case 'enhance': {
                const p = typedParams as any;
                if (p.prompt && p.hotspot) return geminiService.generateAreaEnhancement(inputFile, p.prompt, p.hotspot);
                return geminiService.generateEnhancedImage(inputFile, p.prompt);
            }
            case 'expand': {
                const p = typedParams as any;
                if (p.direction) return geminiService.generateExpandedImage(inputFile, p.direction, p.percentage);
                return geminiService.generateUncroppedImage(inputFile, p.percentage);
            }
            case 'camera': return geminiService.generateNewAngleImage(inputFile, (typedParams as any).prompt, (typedParams as any).hotspot);
            case 'style': {
                const refs = await Promise.all((typedParams as any).referenceImages.map((url: string, i: number) => dataURLtoFile(url, `style${i}.png`)));
                return geminiService.generateStyledImage(inputFile, refs);
            }
            case 'filter': return geminiService.generateFilteredImage(inputFile, (typedParams as any).prompt);
            case 'color': {
                const p = typedParams as any;
                if (p.mask) return geminiService.generateEditedImage(inputFile, p.prompt, await dataURLtoFile(p.mask, 'mask.png'));
                return geminiService.generateColorAdjustedImage(inputFile, p.prompt);
            }
            case 'facial': return geminiService.generateEditedImage(inputFile, (typedParams as any).prompt, await dataURLtoFile((typedParams as any).mask, 'mask.png'));
            case 'magicEraser': return geminiService.generateInpaintedImage(inputFile, await dataURLtoFile((typedParams as any).mask, 'mask.png'), (typedParams as any).fillPrompt);
            case 'mix': {
                const items = await Promise.all((typedParams as any).itemDataUrls.map((url: string, i: number) => dataURLtoFile(url, `mix${i}.png`)));
                return geminiService.generateMixedImage(inputFile, items, (typedParams as any).prompt);
            }
            default: return null;
        }
    }, []);

    useEffect(() => {
        let isCancelled = false;
        const process = async () => {
            if (!baseImage) return;
            const firstUncached = layers.findIndex(l => l.isVisible && !l.cachedResult);
            if (firstUncached === -1) {
                if (!isCancelled) setIsLoading(false);
                return;
            }

            if (!isCancelled) { setIsLoading(true); setError(null); }
            
            let lastResultFile = baseImage;
            for (let i = firstUncached - 1; i >= 0; i--) {
                const prev = layers[i];
                if (prev.isVisible && prev.cachedResult) {
                    lastResultFile = await dataURLtoFile(prev.cachedResult, `cached-${i}.png`);
                    break;
                }
            }

            for (let i = firstUncached; i < layers.length; i++) {
                if (isCancelled) return;
                const layer = layers[i];
                if (!layer.isVisible) continue;

                if (!isCancelled) setLoadingMessage(`Применение: ${layer.name}`);

                try {
                    const input = isFastMode ? await downscaleImage(lastResultFile, 1024) : lastResultFile;
                    const result = await applyLayer(layer, input);
                    if (isCancelled) return;
                    if (result) {
                        updateCachedResult(layer.id, result);
                        lastResultFile = await dataURLtoFile(result, `result-${i}.png`);
                    }
                } catch (err: any) {
                    if (!isCancelled) setError(err.message);
                    break;
                }
            }
            if (!isCancelled) setIsLoading(false);
        };
        process();
        return () => { isCancelled = true; };
    }, [layers, baseImage, isFastMode, applyLayer, updateCachedResult]);

    // FIX: Expose setIsLoading and setLoadingMessage to be used by other parts of the app.
    return { isLoading, setIsLoading, loadingMessage, setLoadingMessage, error, setError };
};

const useVoiceCommands = (
    handleUndo: () => void,
    handleRedo: () => void,
    handleDownload: () => void,
    handleStartOver: () => void,
    handleRevertAll: () => void,
    setActiveTool: (tool: Tool) => void
) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'error'>('idle');
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const commandRef = useRef('');
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const processCommand = useCallback((command: string) => {
        const lower = command.toLowerCase();
        const toolMap: { [key: string]: { tool: Tool; name: string } } = { 'расширить': { tool: 'expand', name: 'Расширение' }, 'камера': { tool: 'camera', name: 'Камера' }, 'стиль': { tool: 'style', name: 'Стиль' }, 'настроить': { tool: 'adjust', name: 'Настройка' }, 'улучшить': { tool: 'enhance', name: 'Улучшение' }, 'ретушь': { tool: 'retouch', name: 'Ретушь' } };
        for (const key in toolMap) {
            if (lower.includes(key)) {
                setActiveTool(toolMap[key].tool);
                setFeedback(`Понял: Переключился на '${toolMap[key].name}'.`);
                return;
            }
        }
        if (lower.includes('отменить')) handleUndo();
        else if (lower.includes('повторить')) handleRedo();
        else if (lower.includes('скачать')) handleDownload();
        else if (lower.includes('начать сначала')) handleStartOver();
        else if (lower.includes('сбросить слои')) handleRevertAll();
        else setFeedback(`Не распознал: "${command}"`);
    }, [setActiveTool, handleUndo, handleRedo, handleDownload, handleStartOver, handleRevertAll]);

    const stopRecording = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (commandRef.current.trim()) processCommand(commandRef.current.trim());

        setStatus(text ? 'idle' : 'idle');
        sessionRef.current?.close();
        sessionRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
    }, [text, processCommand]);

    const startRecording = useCallback(async () => {
        setStatus('recording');
        setText('');
        setError(null);
        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const session = await ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} },
            });
            sessionRef.current = session;

            const source = audioCtxRef.current.createMediaStreamSource(streamRef.current);
            const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => session.sendRealtimeInput({ media: createGeminiBlob(e.inputBuffer.getChannelData(0)) });
            source.connect(processor);
            processor.connect(audioCtxRef.current.destination);

            for await (const message of session.response) {
                if (message.serverContent?.inputTranscription) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    const chunk = message.serverContent.inputTranscription.text;
                    commandRef.current += chunk;
                    setText(prev => prev + chunk);
                    debounceRef.current = window.setTimeout(() => {
                        if (commandRef.current.trim()) processCommand(commandRef.current.trim());
                        setText(prev => prev + '\n');
                        commandRef.current = '';
                    }, 1200);
                }
                if (message.serverContent?.turnComplete) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    if (commandRef.current.trim()) processCommand(commandRef.current.trim());
                    setText(prev => prev + '\n');
                    commandRef.current = '';
                }
            }
        } catch (err: any) {
            setError(err.message || 'Could not access microphone.');
            setStatus('error');
        }
    }, [processCommand]);

    return { status, text, error, feedback, setFeedback, startRecording, stopRecording };
};

// --- Main App Component ---

const App: React.FC = () => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [activeTool, setActiveTool] = useState<Tool>('adjust');
    const [isFastMode, setIsFastMode] = useState(true);
    
    const { history, layers, hasUndo, hasRedo, addLayer, removeLayer, reorderLayers, toggleVisibility, updateCachedResult, updateLayer, clearVisibleCache, undo, redo, setHistory, jumpToState } = useLayerHistory();
    const baseImage = imageFiles.length > 0 ? imageFiles[0] : null;
    // FIX: Destructure setIsLoading and setLoadingMessage to make them available in the component scope.
    const { isLoading, setIsLoading, loadingMessage, setLoadingMessage, error, setError } = useLayerProcessor(baseImage, layers, isFastMode, updateCachedResult);

    // UI & Canvas State
    const [stageState, setStageState] = useState({ scale: 1, x: 0, y: 0 });
    const [editHotspot, setEditHotspot] = useState<Hotspot | null>(null);
    const [cameraFocusPoint, setCameraFocusPoint] = useState<Hotspot | null>(null);
    const [isMasking, setIsMasking] = useState(false);
    const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
    const [brushSize, setBrushSize] = useState(30);
    const [brushShape, setBrushShape] = useState<BrushShape>('circle');
    const [brushHardness, setBrushHardness] = useState(1.0);
    const [maskPreviewOpacity, setMaskPreviewOpacity] = useState(0.5);
    const [colorAdjustments, setColorAdjustments] = useState({ hue: 0, saturation: 0, brightness: 0 });
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[] | null>(null);
    const [selectedObjectMasks, setSelectedObjectMasks] = useState<string[]>([]);
    const [isObjectSelectionMode, setIsObjectSelectionMode] = useState(false);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    const canvasRef = useRef<Konva.Stage>(null);
    const isInitialFastModeMount = useRef(true);
    
    const baseImageUrl = useMemo(() => baseImage ? URL.createObjectURL(baseImage) : '', [baseImage]);
    const selectedLayer = useMemo(() => layers.find(l => l.id === selectedLayerId) || null, [layers, selectedLayerId]);
    
    useEffect(() => () => { if (baseImageUrl) URL.revokeObjectURL(baseImageUrl); }, [baseImageUrl]);

    useEffect(() => {
        if (isInitialFastModeMount.current) { isInitialFastModeMount.current = false; return; }
        if (layers.some(l => l.cachedResult)) clearVisibleCache();
    }, [isFastMode, clearVisibleCache, layers]);

    const resetState = useCallback((keepImage = false) => {
        if (!keepImage) setImageFiles([]);
        setHistory({ past: [], present: [], future: [] });
        setError(null);
        setActiveTool('adjust');
        setEditHotspot(null);
        setCameraFocusPoint(null);
        setIsMasking(false);
        setMaskDataUrl(null);
        setStageState({ scale: 1, x: 0, y: 0 });
        setDetectedObjects(null);
        setSelectedObjectMasks([]);
        setIsObjectSelectionMode(false);
        setColorAdjustments({ hue: 0, saturation: 0, brightness: 0 });
        setSelectedLayerId(null);
    }, [setHistory, setError]);
    
    const handleUpdateLayerTransform = useCallback((layerId: string, newTransform: Layer['transform']) => {
        const layerToUpdate = layers.find(l => l.id === layerId);
        if (layerToUpdate) {
            updateLayer({ ...layerToUpdate, transform: newTransform });
        }
    }, [layers, updateLayer]);

    const handleStartOver = useCallback(() => { if(window.confirm("Вы уверены?")) resetState(); }, [resetState]);
    const handleRevertAll = useCallback(() => { if (window.confirm("Вы уверены, что хотите отменить все изменения?")) resetState(true); }, [resetState]);

    const handleDownload = useCallback(() => { /* ... (implementation unchanged) ... */ }, []);
    const handleClearCache = useCallback(() => { if (window.confirm("Это приведет к повторной обработке...")) clearVisibleCache(); }, [clearVisibleCache]);

    const handleUndo = useCallback(() => { undo(); setVoiceCommandFeedback('Действие: Отменено.'); }, [undo]);
    const handleRedo = useCallback(() => { redo(); setVoiceCommandFeedback('Действие: Повторено.'); }, [redo]);
    const handleJump = useCallback((index: number) => { jumpToState(index); setVoiceCommandFeedback(`Действие: История возвращена.`); }, [jumpToState]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInput = (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/);
            const isCtrl = navigator.platform.match(/Mac/) ? e.metaKey : e.ctrlKey;
            if (isInput) return;
            if (isCtrl && e.key === 'z') { e.preventDefault(); handleUndo(); }
            if (isCtrl && e.key === 'y') { e.preventDefault(); handleRedo(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const { status: transcriptionStatus, text: transcribedText, error: transcriptionError, feedback: voiceCommandFeedback, setFeedback: setVoiceCommandFeedback, startRecording: handleStartRecording, stopRecording: handleStopRecording } = useVoiceCommands(handleUndo, handleRedo, handleDownload, handleStartOver, handleRevertAll, setActiveTool);

    const handleToolSelect = useCallback((tool: Tool) => {
        setIsMasking(false); setMaskDataUrl(null); setEditHotspot(null); setCameraFocusPoint(null); setDetectedObjects(null); setSelectedObjectMasks([]); setIsObjectSelectionMode(false);
        if (tool !== 'transform') setSelectedLayerId(null);
        setActiveTool(tool);
    }, []);
    
    const handleFileSelect = (files: FileList | null) => {
        if (files?.length) { resetState(false); setImageFiles(Array.from(files)); }
    };
    
    const handleAddLayer = useCallback((newLayer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => {
        addLayer(newLayer);
        setMaskDataUrl(null); setIsMasking(false); setEditHotspot(null); setDetectedObjects(null); setSelectedObjectMasks([]); setIsObjectSelectionMode(false);
    }, [addLayer]);

    const handleGenerateFromPrompt = async (prompt: string) => {
        if (!prompt) return;
        // This is a special case outside the layer processor, so manage its state locally.
        const tempLoading = (msg: string) => { (document.querySelector('#root') as HTMLElement).innerHTML = `<div class="w-screen h-screen flex flex-col items-center justify-center bg-bg-main text-center p-8"><div class="animate-spin text-primary h-16 w-16 mx-auto">...</div><p class="mt-4 text-xl font-bold text-text-primary animate-pulse">${msg}</p></div>`; };
        tempLoading('Generating your image...');
        setError(null);
        try {
            const imageDataUrl = await geminiService.generateImageFromPrompt(prompt);
            const file = dataURLtoFile(imageDataUrl, `${prompt.slice(0, 20)}.png`);
            resetState(false);
            setImageFiles([file]);
        } catch (err: any) {
            setError(err.message);
            // If generation fails, go back to start screen
            resetState(false);
        }
    };

    const handleSaveProject = useCallback(async () => { /* ... (implementation unchanged) ... */ }, [baseImage, history]);
    const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { /* ... (implementation unchanged) ... */ }, [resetState, setHistory]);
    
    const handleFindObjects = useCallback(async () => {
        if (!baseImage) return;
        // Another special case for state management
        const tempState = (loading: boolean, msg: string) => { setIsLoading(loading); setLoadingMessage(msg); };
        tempState(true, 'Detecting objects...');
        setError(null); setDetectedObjects(null); setSelectedObjectMasks([]);
        try {
            const objects = await geminiService.detectObjects(baseImage);
            if (objects.length === 0) setError("No distinct objects were found.");
            setDetectedObjects(objects);
            setIsObjectSelectionMode(true);
        } catch (err: any) { setError(err.message); } finally { tempState(false, ''); }
    // FIX: Add setIsLoading and setLoadingMessage to the dependency array for useCallback.
    }, [baseImage, setError, setIsLoading, setLoadingMessage]);

    if (!baseImage) {
        return <StartScreen onFileSelect={handleFileSelect} onGenerateFromPrompt={handleGenerateFromPrompt} isLoading={isLoading} />;
    }
    
    return (
        <div className="w-screen h-screen flex flex-col bg-bg-main font-sans">
            <Header onSaveProject={handleSaveProject} onLoadProject={handleLoadProject} isFastMode={isFastMode} onFastModeChange={setIsFastMode} onDownload={handleDownload} />
            <main className="flex-grow flex overflow-hidden">
                <ToolsPalette activeTool={activeTool} onToolSelect={handleToolSelect} />
                <div className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
                    <EditorCanvas
                        ref={canvasRef} baseImage={baseImage} layers={layers} isMasking={isMasking} maskDataUrl={maskDataUrl}
                        onMaskChange={setMaskDataUrl} onHotspot={setEditHotspot} editHotspot={editHotspot} activeTool={activeTool}
                        stageState={stageState} onStageStateChange={setStageState} brushSize={brushSize} brushShape={brushShape}
                        brushHardness={brushHardness} maskPreviewOpacity={maskPreviewOpacity} detectedObjects={detectedObjects}
                        selectedObjectMasks={selectedObjectMasks} onObjectMaskToggle={setSelectedObjectMasks} isObjectSelectionMode={isObjectSelectionMode}
                        cameraFocusPoint={cameraFocusPoint} onCameraFocusPointChange={setCameraFocusPoint}
                    />
                </div>
                <RightSidebar
                    activeTool={activeTool} isLoading={isLoading} loadingMessage={loadingMessage} layers={layers}
                    maskDataUrl={maskDataUrl} editHotspot={editHotspot} history={history} hasRedo={hasRedo}
                    isRecording={transcriptionStatus === 'recording'} transcriptionStatus={transcriptionStatus as any} transcribedText={transcribedText}
                    transcriptionError={transcriptionError} isMasking={isMasking} brushSize={brushSize} brushShape={brushShape}
                    brushHardness={brushHardness} maskPreviewOpacity={maskPreviewOpacity} baseImageUrl={baseImageUrl}
                    colorAdjustments={colorAdjustments} detectedObjects={detectedObjects} selectedObjectMasks={selectedObjectMasks}
                    cameraFocusPoint={cameraFocusPoint} onAddLayer={handleAddLayer} onToggleMasking={() => setIsMasking(p => !p)}
                    onSetMaskDataUrl={setMaskDataUrl} onReorderLayers={reorderLayers} onToggleVisibility={toggleVisibility}
                    onRemoveLayer={removeLayer} onNewImage={handleStartOver} onDownload={handleDownload} onRevertAll={handleRevertAll}
                    onClearCache={handleClearCache} onUndo={handleUndo} onRedo={handleRedo} onJumpToState={handleJump}
                    onStartRecording={handleStartRecording} onStopRecording={handleStopRecording} onBrushSizeChange={setBrushSize}
                    onBrushShapeChange={setBrushShape} onBrushHardnessChange={setBrushHardness} onOpacityChange={setMaskPreviewOpacity}
                    onConfirmMasking={() => setIsMasking(false)} onCancelMasking={() => { setIsMasking(false); setMaskDataUrl(null); }}
                    onColorAdjustmentsChange={setColorAdjustments} onFindObjects={handleFindObjects} onObjectMaskToggle={(maskUrl) => setSelectedObjectMasks(p => p.includes(maskUrl) ? p.filter(m => m !== maskUrl) : [...p, maskUrl])}
                    onClearObjects={() => { setDetectedObjects(null); setSelectedObjectMasks([]); setIsObjectSelectionMode(false); setMaskDataUrl(null); }}
                    onConfirmSelection={() => setIsObjectSelectionMode(false)}
                    selectedLayer={selectedLayer}
                    onSelectLayer={setSelectedLayerId}
                    onUpdateLayerTransform={handleUpdateLayerTransform}
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
                    <Tooltip text="Закрыть"><button onClick={() => setVoiceCommandFeedback(null)} className="p-1 rounded-full hover:bg-blue-100"><XCircleIcon className="w-5 h-5 text-primary" /></button></Tooltip>
                </div>
            )}
            {error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-bg-panel border-2 border-red-500 text-text-primary px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 max-w-2xl">
                    <strong className="font-bold text-red-600">Ошибка:</strong>
                    <span className="block sm:inline flex-grow">{error}</span>
                    <Tooltip text="Закрыть"><button onClick={() => setError(null)} className="p-1 rounded-full hover:bg-red-100"><XCircleIcon className="w-5 h-5 text-red-600" /></button></Tooltip>
                </div>
            )}
            {imageFiles.length > 1 && <BatchEditor files={imageFiles} onExit={handleStartOver} />}
        </div>
    );
};

export default App;