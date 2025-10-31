/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Tool } from '../types';
import { ScissorsIcon, ArrowsPointingOutIcon, CameraIcon, BrainCircuitIcon, PaletteIcon, SunIcon, SwatchIcon, SparklesIcon, BullseyeIcon, FaceSmileIcon, MagicWandIcon, PhotoIcon, TshirtIcon, LayersIcon, UserCircleIcon, UserPlusIcon, CubeTransparentIcon, VideoCameraIcon, MicrophoneIcon, PaintBrushIcon, PencilSquareIcon, DocumentDuplicateIcon, TransformIcon, CodeBracketSquareIcon } from './icons';
import Tooltip from './Tooltip';

interface ToolsPaletteProps {
  activeTool: Tool;
  onToolSelect: (tool: Tool) => void;
}

const ToolButton: React.FC<{
  label: string;
  tooltipText: string;
  icon: React.ReactElement;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, tooltipText, icon, isActive, onClick, disabled }) => {
    const IconComponent = icon.type;
    return (
        <Tooltip side="right" text={tooltipText}>
            <button
                onClick={onClick}
                disabled={disabled}
                aria-label={tooltipText}
                className={`flex flex-col items-center justify-center gap-1 p-1 w-16 h-16 text-center transition-all duration-200 rounded-xl ${
                    isActive 
                        ? 'bg-primary text-white shadow-md' 
                        : 'bg-bg-panel text-text-secondary hover:bg-blue-50 hover:text-primary border border-border-color'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <IconComponent className="w-6 h-6" />
                <span className="text-xs font-bold leading-tight uppercase">{label}</span>
            </button>
        </Tooltip>
    );
};

const ToolsPalette: React.FC<ToolsPaletteProps> = ({ activeTool, onToolSelect }) => {
  const tools: { id: Tool; label: string; icon: React.ReactElement; title: string }[] = [
    { id: 'expand', label: 'Расширить', icon: <ArrowsPointingOutIcon />, title: "Расширить холст: Используйте ИИ, чтобы расширить изображение за его первоначальные границы. Идеально для 'раскадрирования' или изменения соотношения сторон." },
    { id: 'camera', label: 'Камера', icon: <CameraIcon />, title: "Интерактивная камера: Вращайтесь на 360° вокруг объекта и приближайте или отдаляйте. ИИ перерисовывает сцену с новой перспективы." },
    { id: 'style', label: 'Применить стиль', icon: <PaintBrushIcon />, title: "Применить стиль: Примените художественный стиль с одного или нескольких изображений-примеров к вашей фотографии." },
    { id: 'transcribe', label: 'Голос', icon: <MicrophoneIcon />, title: "Голосовые команды: Управляйте редактором с помощью голоса. Переключайте инструменты, отменяйте действия и многое другое." },
    { id: 'adjust', label: 'Настроить', icon: <SunIcon />, title: "Профессиональные настройки: Применяйте глобальные улучшения, такие как 'студийное освещение' или 'размытый фон' (боке)." },
    { id: 'enhance', label: 'Улучшить', icon: <SparklesIcon />, title: "Улучшить качество: Автоматически улучшайте разрешение, резкость и уменьшайте шум, глобально или в выделенной области." },
    { id: 'retouch', label: 'Ретушь', icon: <BullseyeIcon />, title: "Ретушь области: Выделите область с помощью кисти, чтобы удалить, заменить или изменить ее содержимое." },
    { id: 'textEdit', label: 'Текст. правка', icon: <PencilSquareIcon />, title: "Текстовое редактирование: Опишите любое изменение, которое ИИ должен применить ко всему изображению, от стилистических фильтров до удаления содержимого." },
    { id: 'cssInspector', label: 'CSS', icon: <CodeBracketSquareIcon />, title: "CSS-инспектор: Кликните на элемент в вашем изображении, чтобы получить предложения по стилям CSS от ИИ." },
    { id: 'magicEraser', label: 'Ластик', icon: <MagicWandIcon />, title: "Волшебный ластик: Проведите кистью по объекту, чтобы удалить его. ИИ интеллектуально заполнит фон." },
    { id: 'facial', label: 'Лицо', icon: <FaceSmileIcon />, title: "Улучшение лица: Деликатно ретушируйте черты лица, такие как кожа или глаза, в выделенной области." },
    { id: 'faceSwap', label: 'Замена лица', icon: <UserCircleIcon />, title: "Замена лица: Замените лицо на вашей фотографии, используя от 1 до 8 эталонных изображений." },
    { id: 'background', label: 'Фон', icon: <PhotoIcon />, title: "Замена фона: Замените фон сгенерированной сценой, загруженным изображением или сплошным цветом." },
    { id: 'image', label: 'Добавить изобр.', icon: <DocumentDuplicateIcon />, title: "Добавить слой изображения: Загрузите изображение, чтобы добавить его как новый, трансформируемый слой." },
    { id: 'clothing', label: 'Одежда', icon: <TshirtIcon />, title: "Виртуальная примерка: Измените одежду человека, используя эталонное фото предмета одежды." },
    { id: 'mix', label: 'Комбинир.', icon: <LayersIcon />, title: "Комбинирование предметов: Создайте полный образ, комбинируя несколько загруженных предметов на вашем объекте." },
    { id: 'addPerson', label: 'Добавить чел.', icon: <UserPlusIcon />, title: "Добавить человека: Добавьте человека с эталонного фото в ваше основное изображение." },
    { id: 'addObject', label: 'Добавить объект', icon: <CubeTransparentIcon />, title: "Добавить объект: Вставьте новый объект, описав его текстом или загрузив эталонное изображение." },
  ];
  
  return (
    <div className="h-full bg-bg-panel border-r border-border-color p-2 grid grid-cols-2 gap-2 content-start overflow-y-auto">
      {tools.map(tool => (
        <ToolButton
            key={tool.id}
            label={tool.label}
            tooltipText={tool.title}
            icon={tool.icon}
            isActive={activeTool === tool.id}
            onClick={() => onToolSelect(tool.id)}
        />
      ))}
    </div>
  );
};

export default React.memo(ToolsPalette);