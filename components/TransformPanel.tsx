/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React,
 
{
 
useState, useEffect } from 'react';
import { Layer } from '../types';
import Tooltip from './Tooltip';

interface TransformPanelProps {
  selectedLayer: Layer | null;
  onUpdateTransform: (layerId: string, newTransform: Layer['transform']) => void;
  isLoading: boolean;
}

const TransformInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    unit?: string;
    step?: number;
    disabled: boolean;
}> = ({ label, value, onChange, unit = 'px', step = 1, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">{label} ({unit})</label>
        <input
            type="number"
            value={Math.round(value)}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            step={step}
            disabled={disabled}
            className="w-full bg-gray-50 border-2 border-border-color text-text-primary rounded-lg p-2 focus:ring-2 ring-primary focus:outline-none transition disabled:opacity-60"
        />
    </div>
);


const TransformPanel: React.FC<TransformPanelProps> = ({ selectedLayer, onUpdateTransform, isLoading }) => {
    
    if (!selectedLayer || selectedLayer.tool !== 'image') {
        return (
             <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
                <h3 className="text-xl font-bold text-center text-text-primary">Трансформация</h3>
                <p className="text-center text-text-secondary p-4 bg-gray-50 rounded-lg">
                    Выберите слой с изображением на холсте, чтобы увидеть его свойства и начать трансформацию.
                </p>
            </div>
        );
    }
    
    const transform = selectedLayer.transform!;
    
    const handleTransformChange = (prop: keyof Layer['transform'], value: number) => {
        if (selectedLayer) {
            onUpdateTransform(selectedLayer.id, { ...transform, [prop]: value });
        }
    };
    
    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Свойства трансформации</h3>
            <p className="text-sm text-center text-text-secondary -mt-2 truncate">
                Слой: <span className="font-semibold text-text-primary">{selectedLayer.name}</span>
            </p>
            
            <div className="grid grid-cols-2 gap-4">
                <TransformInput label="X" value={transform.x} onChange={v => handleTransformChange('x', v)} disabled={isLoading} />
                <TransformInput label="Y" value={transform.y} onChange={v => handleTransformChange('y', v)} disabled={isLoading} />
                <TransformInput label="Ширина" value={transform.width} onChange={v => handleTransformChange('width', v)} disabled={isLoading} />
                <TransformInput label="Высота" value={transform.height} onChange={v => handleTransformChange('height', v)} disabled={isLoading} />
            </div>
            <TransformInput
                label="Вращение"
                value={transform.rotation}
                onChange={v => handleTransformChange('rotation', v)}
                unit="°"
                disabled={isLoading}
            />
        </div>
    );
};

export default TransformPanel;