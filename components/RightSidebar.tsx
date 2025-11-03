/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, lazy, Suspense } from 'react';

// Import types
import { Tool, Layer, Hotspot, CustomStyle, DetectedObject, BrushShape } from '../types.ts';
import Spinner from './Spinner.tsx';
import Tooltip from './Tooltip.tsx';

// Lazy load all panels for performance optimization
const AdjustmentPanel = lazy(() => import('./AdjustmentPanel.tsx'));
const RetouchPanel = lazy(() => import('./RetouchPanel.tsx'));
const TextEditPanel = lazy(() => import('./TextEditPanel.tsx'));
const FaceSwapPanel = lazy(() => import('./FaceSwapPanel.tsx'));
const BackgroundPanel = lazy(() => import('./BackgroundPanel.tsx'));
const ClothingPanel = lazy(() => import('./ClothingPanel.tsx'));
const AddPersonPanel = lazy(() => import('./AddPersonPanel.tsx'));
const AddObjectPanel = lazy(() => import('./AddObjectPanel.tsx'));
const EnhancePanel = lazy(() => import('./EnhancePanel.tsx'));
const ExpandPanel = lazy(() => import('./ExpandPanel.tsx'));
const AnglePanel = lazy(() => import('./AnglePanel.tsx'));
const StylePanel = lazy(() => import('./StylePanel.tsx'));
const TranscribePanel = lazy(() => import('./TranscribePanel.tsx'));
const MaskingPanel = lazy(() => import('./MaskingPanel.tsx'));
const FilterPanel = lazy(() => import('./FilterPanel.tsx'));
const ColorPanel = lazy(() => import('./ColorPanel.tsx'));
const FacialPanel = lazy(() => import('./FacialPanel.tsx'));
const MixPanel = lazy(() => import('./MixPanel.tsx'));
const MagicEraserPanel = lazy(() => import('./MagicEraserPanel.tsx'));
const AddImagePanel = lazy(() => import('./AddImagePanel.tsx'));
const TransformPanel = lazy(() => import('./TransformPanel.tsx'));

// Eager load core sidebar panels
import LayersPanel from './LayersPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx';


interface HistoryState {
    past: Layer[][];
    present: Layer[];
    future: Layer[][];
}

interface RightSidebarProps {
    // State
    activeTool: Tool;
    isLoading: boolean;
    loadingMessage: string;
    layers: Layer[];
    maskDataUrl: string | null;
    editHotspot: Hotspot | null;
    history: HistoryState;
    hasRedo: boolean;
    isRecording: boolean;
    transcriptionStatus: 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
    transcribedText: string;
    transcriptionError: string | null;
    isMasking: boolean;
    brushSize: number;
    brushShape: BrushShape;
    brushHardness: number;
    maskPreviewOpacity: number;
    baseImageUrl: string;
    colorAdjustments: { hue: number; saturation: number; brightness: number; };
    detectedObjects: DetectedObject[] | null;
    selectedObjectMasks: string[];
    cameraFocusPoint: Hotspot | null;
    selectedLayer: Layer | null;

    // Handlers
    onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => void;
    onToggleMasking: () => void;
    onSetMaskDataUrl: (dataUrl: string | null) => void;
    onReorderLayers: (layers: Layer[]) => void;
    onToggleVisibility: (id: string) => void;
    onRemoveLayer: (id: string) => void;
    onNewImage: () => void;
    onDownload: () => void;
    onRevertAll: () => void;
    onClearCache: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onJumpToState: (index: number) => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onBrushSizeChange: (size: number) => void;
    onBrushShapeChange: (shape: BrushShape) => void;
    onBrushHardnessChange: (hardness: number) => void;
    onOpacityChange: (opacity: number) => void;
    onConfirmMasking: () => void;
    onCancelMasking: () => void;
    onColorAdjustmentsChange: (adjustments: { hue: number; saturation: number; brightness: number; }) => void;
    onFindObjects: () => void;
    onObjectMaskToggle: (maskUrl: string) => void;
    onClearObjects: () => void;
    onConfirmSelection: () => void;
    onSelectLayer: (id: string) => void;
    onUpdateLayerTransform: (layerId: string, newTransform: Layer['transform']) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'tool' | 'layers' | 'history'>('tool');

    const renderToolPanel = () => {
        if (props.isMasking) {
            return (
                <MaskingPanel
                    brushSize={props.brushSize}
                    onBrushSizeChange={props.onBrushSizeChange}
                    brushShape={props.brushShape}
                    onBrushShapeChange={props.onBrushShapeChange}
                    brushHardness={props.brushHardness}
                    onBrushHardnessChange={props.onBrushHardnessChange}
                    previewOpacity={props.maskPreviewOpacity}
                    onOpacityChange={props.onOpacityChange}
                    onConfirm={props.onConfirmMasking}
                    onCancel={props.onCancelMasking}
                    isLoading={props.isLoading}
                />
            );
        }

        switch (props.activeTool) {
            case 'adjust': return <AdjustmentPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'retouch': return <RetouchPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} maskDataUrl={props.maskDataUrl} onToggleMasking={props.onToggleMasking} />;
            case 'textEdit': return <TextEditPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'faceSwap': return <FaceSwapPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'background': return <BackgroundPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'clothing': return <ClothingPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'addPerson': return <AddPersonPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'addObject': return <AddObjectPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} editHotspot={props.editHotspot} />;
            case 'enhance': return <EnhancePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} editHotspot={props.editHotspot} />;
            case 'expand': return <ExpandPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'camera': return <AnglePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} cameraFocusPoint={props.cameraFocusPoint} />;
            case 'style': return <StylePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'transcribe': return <TranscribePanel 
                isRecording={props.isRecording}
                status={props.transcriptionStatus}
                text={props.transcribedText}
                error={props.transcriptionError}
                onStart={props.onStartRecording}
                onStop={props.onStopRecording}
            />;
            case 'filter': return <FilterPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'color': return <ColorPanel 
                onAddLayer={props.onAddLayer} 
                isLoading={props.isLoading} 
                maskDataUrl={props.maskDataUrl}
                onToggleMasking={props.onToggleMasking}
                adjustments={props.colorAdjustments}
                onAdjustmentsChange={props.onColorAdjustmentsChange}
            />;
            case 'facial': return <FacialPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} maskDataUrl={props.maskDataUrl} onToggleMasking={props.onToggleMasking} />;
            case 'mix': return <MixPanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'magicEraser': return <MagicEraserPanel 
                onAddLayer={props.onAddLayer}
                isLoading={props.isLoading}
                maskDataUrl={props.maskDataUrl}
                onToggleMasking={props.onToggleMasking}
                onFindObjects={props.onFindObjects}
                detectedObjects={props.detectedObjects}
                selectedObjectMasks={props.selectedObjectMasks}
                onSetMaskDataUrl={props.onSetMaskDataUrl}
                onClearObjects={props.onClearObjects}
                onConfirmSelection={props.onConfirmSelection}
                onObjectMaskToggle={props.onObjectMaskToggle}
            />;
            case 'image': return <AddImagePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'transform': return <TransformPanel selectedLayer={props.selectedLayer} onUpdateTransform={props.onUpdateLayerTransform} isLoading={props.isLoading} />;
            default: return <div className="p-4"><p>Select a tool</p></div>;
        }
    };

    const toolPanelHeader = props.isMasking ? "Режим маски" : "Параметры инструмента";
    const suspenseFallback = (
        <div className="w-full h-full flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <Spinner />
                <span className="text-text-secondary font-semibold">Загрузка инструмента...</span>
            </div>
        </div>
    );

    return (
        <div className="w-96 flex-shrink-0 bg-bg-panel border-l border-border-color flex flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b border-border-color flex">
                <Tooltip text="Показать параметры для текущего выбранного инструмента">
                    <button
                        onClick={() => setActiveTab('tool')}
                        className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'tool' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                    >
                        {toolPanelHeader}
                    </button>
                </Tooltip>
                <Tooltip text="Управление слоями редактирования, видимостью и порядком">
                    <button
                        onClick={() => setActiveTab('layers')}
                        className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'layers' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                    >
                        Слои
                    </button>
                </Tooltip>
                <Tooltip text="Просмотр истории действий и возврат к предыдущим состояниям">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'history' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                    >
                        История
                    </button>
                </Tooltip>
            </div>

            {activeTab === 'tool' && (
                <div className="flex-grow overflow-y-auto p-4">
                    <Suspense fallback={suspenseFallback}>
                        {renderToolPanel()}
                    </Suspense>
                </div>
            )}
            {activeTab === 'layers' && (
                <LayersPanel
                    layers={props.layers}
                    baseImageUrl={props.baseImageUrl}
                    loadingMessage={props.loadingMessage}
                    onReorderLayers={props.onReorderLayers}
                    onToggleVisibility={props.onToggleVisibility}
                    onRemoveLayer={props.onRemoveLayer}
                    onNewImage={props.onNewImage}
                    onDownload={props.onDownload}
                    onRevertAll={props.onRevertAll}
                    onClearCache={props.onClearCache}
                    onUndo={props.onUndo}
                    onRedo={props.onRedo}
                    hasUndo={props.history.past.length > 0}
                    hasRedo={props.hasRedo}
                    selectedLayerId={props.selectedLayer?.id || null}
                    onSelectLayer={props.onSelectLayer}
                />
            )}
             {activeTab === 'history' && (
                <HistoryPanel
                    history={props.history}
                    onJumpToState={props.onJumpToState}
                />
            )}
        </div>
    );
};

export default RightSidebar;