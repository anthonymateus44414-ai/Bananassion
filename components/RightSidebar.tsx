/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

// Import all panels
import AdjustmentPanel from './AdjustmentPanel.tsx';
import RetouchPanel from './RetouchPanel.tsx';
import TextEditPanel from './TextEditPanel.tsx';
import FaceSwapPanel from './FaceSwapPanel.tsx';
import BackgroundPanel from './BackgroundPanel.tsx';
import ClothingPanel from './ClothingPanel.tsx';
import AddPersonPanel from './AddPersonPanel.tsx';
import AddObjectPanel from './AddObjectPanel.tsx';
import EnhancePanel from './EnhancePanel.tsx';
import ExpandPanel from './ExpandPanel.tsx';
import AnglePanel from './AnglePanel.tsx';
import StylePanel from './StylePanel.tsx';
import LayersPanel from './LayersPanel.tsx';
import TranscribePanel from './TranscribePanel.tsx';
import MaskingPanel from './MaskingPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx';

// Import types
import { Tool, Layer, Hotspot, CustomStyle, DetectedObject, BrushShape } from '../types.ts';

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
    isFindingObjects: boolean;
    layers: Layer[];
    maskDataUrl: string | null;
    editHotspot: Hotspot | null;
    detectedObjects: DetectedObject[] | null;
    selectedObjectMasks: string[];
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
    selectedLayer: Layer | null;
    isInspecting: boolean;
    inspectionResult: { name: string; mask: string | null; css: object | null; error: string | null; } | null;

    // Handlers
    onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => void;
    onToggleMasking: () => void;
    onFindObjects: () => void;
    onObjectMaskToggle: (maskUrl: string) => void;
    onSetMaskDataUrl: (dataUrl: string | null) => void;
    onClearObjects: () => void;
    onConfirmSelection: () => void;
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
    onUpdateLayerTransform: (layerId: string, newTransform: Layer['transform']) => void;
    onClearInspection: () => void;
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
            case 'camera': return <AnglePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'style': return <StylePanel onAddLayer={props.onAddLayer} isLoading={props.isLoading} />;
            case 'transcribe': return <TranscribePanel 
                isRecording={props.isRecording}
                status={props.transcriptionStatus}
                text={props.transcribedText}
                error={props.transcriptionError}
                onStart={props.onStartRecording}
                onStop={props.onStopRecording}
            />;
            default: return <div className="p-4"><p>Select a tool</p></div>;
        }
    };

    const toolPanelHeader = props.isMasking ? "Режим маски" : "Параметры инструмента";

    return (
        <div className="w-96 flex-shrink-0 bg-bg-panel border-l border-border-color flex flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b border-border-color flex">
                <button
                    onClick={() => setActiveTab('tool')}
                    className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'tool' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                >
                    {toolPanelHeader}
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'layers' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                >
                    Слои
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 font-bold py-3 px-4 transition-colors duration-200 text-center ${activeTab === 'history' ? 'bg-blue-50 text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-50'}`}
                >
                    История
                </button>
            </div>

            {activeTab === 'tool' && (
                <div className="flex-grow overflow-y-auto p-4">
                    {renderToolPanel()}
                </div>
            )}
            {activeTab === 'layers' && (
                <LayersPanel
                    layers={props.layers}
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