/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { CursorArrowRaysIcon, SparklesIcon, XCircleIcon } from './icons.tsx';
import Spinner from './Spinner.tsx';
import Tooltip from './Tooltip.tsx';

interface CssInspectorPanelProps {
  isInspecting: boolean;
  inspectionResult: {
    name: string;
    mask: string | null;
    css: object | null;
    error: string | null;
  } | null;
  onClearInspection: () => void;
}

const formatCss = (styles: object | null): string => {
    if (!styles) return '';
    return Object.entries(styles)
      .map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
        return `  ${cssKey}: ${value};`;
      })
      .join('\n');
};

const CssInspectorPanel: React.FC<CssInspectorPanelProps> = ({ isInspecting, inspectionResult, onClearInspection }) => {
    const [copyButtonText, setCopyButtonText] = useState('Копировать CSS');

    const handleCopy = () => {
        const cssString = `.${inspectionResult?.name.toLowerCase().replace(/\s+/g, '-') || 'element'} {\n${formatCss(inspectionResult?.css)}\n}`;
        navigator.clipboard.writeText(cssString).then(() => {
            setCopyButtonText('Скопировано!');
            setTimeout(() => setCopyButtonText('Копировать CSS'), 2000);
        });
    };

    if (isInspecting) {
        return (
            <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in items-center justify-center text-center h-full">
                <Spinner />
                <h3 className="text-xl font-bold text-center text-text-primary">Анализ элемента</h3>
                <p className="text-text-secondary">ИИ анализирует пиксели...</p>
            </div>
        );
    }

    if (inspectionResult?.error) {
         return (
            <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in items-center justify-center text-center h-full">
                <XCircleIcon className="w-12 h-12 text-red-500"/>
                <h3 className="text-xl font-bold text-center text-text-primary">Ошибка анализа</h3>
                <p className="text-text-secondary bg-red-50 p-3 rounded-lg border border-red-200">{inspectionResult.error}</p>
                 <button
                    onClick={onClearInspection}
                    className="w-full mt-4 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base"
                >
                    Попробовать снова
                </button>
            </div>
        );
    }
    
    if (inspectionResult?.css) {
        const cssString = formatCss(inspectionResult.css);
        return (
            <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center gap-3">
                    <SparklesIcon className="w-8 h-8 text-primary flex-shrink-0" />
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">Стиль элемента</h3>
                        <p className="text-sm text-text-secondary font-semibold">{inspectionResult.name}</p>
                    </div>
                </div>
                
                {inspectionResult.mask && (
                     <div className="w-full p-2 border-2 border-dashed border-border-color rounded-lg bg-gray-50">
                        <img src={inspectionResult.mask} alt="Element mask" className="w-full h-auto object-contain max-h-32" />
                    </div>
                )}

                <div className="relative">
                    <pre className="bg-gray-800 text-white p-4 rounded-lg text-sm overflow-x-auto">
                        <code>
{`.${inspectionResult.name.toLowerCase().replace(/\s+/g, '-')} {\n${cssString}\n}`}
                        </code>
                    </pre>
                    <Tooltip text={copyButtonText}>
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold text-xs py-1 px-3 rounded-md transition-colors"
                        >
                            {copyButtonText}
                        </button>
                    </Tooltip>
                </div>
                
                <button
                    onClick={onClearInspection}
                    className="w-full mt-2 bg-secondary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-opacity-80 active:scale-[0.98] text-base"
                >
                    Проверить другой элемент
                </button>
            </div>
        );
    }

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in items-center justify-center text-center h-full">
            <CursorArrowRaysIcon className="w-16 h-16 text-text-secondary" />
            <h3 className="text-xl font-bold text-center text-text-primary">CSS-инспектор</h3>
            <p className="text-text-secondary">Кликните на любой элемент в изображении, чтобы сгенерировать его CSS-стили.</p>
        </div>
    );
};

export default CssInspectorPanel;
