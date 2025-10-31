/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import Tooltip from './Tooltip';
import { MicrophoneIcon } from './icons';

interface TranscribePanelProps {
    isRecording: boolean;
    status: 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
    text: string;
    error: string | null;
    onStart: () => void;
    onStop: () => void;
}

const TranscribePanel: React.FC<TranscribePanelProps> = ({
    isRecording,
    status,
    text,
    error,
    onStart,
    onStop,
}) => {
    const [copyButtonText, setCopyButtonText] = useState('Копировать');
    const [editableText, setEditableText] = useState(text);

    useEffect(() => {
        setEditableText(text);
    }, [text]);
    
    const handleCopy = () => {
        if (editableText) {
            navigator.clipboard.writeText(editableText).then(() => {
                setCopyButtonText('Скопировано!');
                setTimeout(() => setCopyButtonText('Копировать'), 2000);
            });
        }
    };
    
    const getStatusMessage = () => {
        switch (status) {
            case 'idle':
                return 'Готов к записи. Нажмите на микрофон, чтобы начать.';
            case 'recording':
                return 'Запись... Говорите четко в микрофон.';
            case 'done':
                return 'Транскрипция завершена. Теперь вы можете скопировать или отредактировать текст.';
            case 'error':
                return error || 'Произошла неизвестная ошибка.';
            default:
                return '';
        }
    };

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Голосовые команды</h3>
            
            <div className="flex flex-col items-center gap-4">
                <Tooltip side="left" text={isRecording ? "Остановить запись" : "Начать запись"}>
                    <button
                        onClick={isRecording ? onStop : onStart}
                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 ${
                            isRecording
                                ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-300 animate-pulse'
                                : 'bg-primary text-white hover:bg-primary-hover focus:ring-blue-300'
                        }`}
                        aria-label={isRecording ? "Остановить запись" : "Начать запись"}
                    >
                        <MicrophoneIcon className="w-12 h-12" />
                    </button>
                </Tooltip>
                <p className={`text-sm text-center font-semibold ${status === 'error' ? 'text-red-600' : 'text-text-secondary'}`}>
                    {getStatusMessage()}
                </p>
            </div>

            <div className="relative w-full flex-grow flex flex-col">
                <textarea
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    placeholder="Ваш транскрибированный текст появится здесь..."
                    className="w-full h-64 flex-grow bg-gray-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition resize-none text-base font-medium"
                    aria-label="Вывод транскрипции"
                />
                {editableText && (
                     <Tooltip side="left" text="Скопировать транскрибированный текст в буфер обмена">
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 text-text-primary font-semibold text-xs py-1 px-3 rounded-md transition-colors"
                        >
                            {copyButtonText}
                        </button>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default TranscribePanel;