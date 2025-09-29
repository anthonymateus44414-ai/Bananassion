/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Tool } from '../types';
import { UndoIcon, RedoIcon, ArrowDownTrayIcon, ArrowPathIcon, PhotoIcon, SunIcon, PaletteIcon, BullseyeIcon, MagicWandIcon, SparklesIcon, UserCircleIcon, CameraIcon, UserPlusIcon, CubeTransparentIcon, SwatchIcon, ArrowsPointingOutIcon, FaceSmileIcon, ScissorsIcon, LayersIcon, TshirtIcon, ColorizeIcon, BrainCircuitIcon } from './icons';
import Tooltip from './Tooltip';

interface ToolbarProps {
  activeTool: Tool;
  onToolSelect: (tool: Tool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onDownload: () => void;
  onReset: () => void;
  onNewImage: () => void;
}

// Small, icon-only button for top-level actions
const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, icon, onClick, disabled }) => (
    <Tooltip text={label}>
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`flex items-center justify-center p-3 rounded-lg w-12 h-12 transition-colors duration-200 bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {icon}
        </button>
    </Tooltip>
);

// Larger button with icon and text for the main tool grid
const ToolButton: React.FC<{
  label: string;
  tooltipText: string;
  // Fix: Use React.ReactElement for icon prop to allow cloning with props.
  icon: React.ReactElement;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, tooltipText, icon, isActive, onClick, disabled }) => (
    <Tooltip text={tooltipText}>
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={tooltipText}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-24 h-24 text-center transition-colors duration-200 ${
                isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {/* Fix: removed type assertion as icon is now correctly typed as React.ReactElement */}
            {React.cloneElement(icon, { className: "w-8 h-8 mb-1" })}
            <span className="text-xs font-medium leading-tight">{label}</span>
        </button>
    </Tooltip>
);


const Divider: React.FC = () => <div className="h-px w-full bg-gray-600 my-1" />;

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolSelect,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDownload,
  onReset,
  onNewImage,
}) => {
  // Fix: Use React.ReactElement for icon type as all icons are elements.
  const tools: { id: Tool; label: string; icon: React.ReactElement; title: string }[] = [
    // Composition Tools
    { id: 'crop', label: 'Crop', icon: <ScissorsIcon className="w-6 h-6" />, title: "Crop & Resize: Freely crop, or select a specific aspect ratio (e.g., 1:1, 16:9). Great for reframing your subject." },
    { id: 'expand', label: 'Expand', icon: <ArrowsPointingOutIcon className="w-6 h-6" />, title: "Expand Canvas: Use AI to extend the image beyond its borders in any direction. Perfect for 'uncropping' or changing aspect ratios without losing content." },
    { id: 'camera', label: 'Camera', icon: <CameraIcon className="w-6 h-6" />, title: "Change Camera Angle: Re-render the image from a new perspective. Simulate camera movements like 'dolly in', 'pan out', or 'rotate left' while keeping the subject unchanged." },
    // Global Edits
    { id: 'train', label: 'Train AI', icon: <BrainCircuitIcon className="w-6 h-6" />, title: "Train AI: Create a custom style from your own images to use as a unique filter." },
    { id: 'filter', label: 'Filter', icon: <PaletteIcon className="w-6 h-6" />, title: "Artistic Filters: Transform your photo's entire look. Apply preset styles like Anime or Synthwave, or describe any aesthetic you can imagine." },
    { id: 'adjust', label: 'Adjust', icon: <SunIcon className="w-6 h-6" />, title: "Pro Adjustments: Apply global, professional-level enhancements. Best for complex edits like adding 'studio lighting' or creating a 'blurry background' (bokeh)." },
    { id: 'color', label: 'Color', icon: <SwatchIcon className="w-6 h-6" />, title: "Color Correction: Adjust Hue, Saturation, and Brightness. Apply changes to the entire image or paint a mask to edit specific areas." },
    { id: 'colorize', label: 'Colorize', icon: <ColorizeIcon className="w-6 h-6" />, title: "Colorize B&W Photos: Bring black and white images to life. Describe the desired colors (e.g., 'a red dress and blue eyes') for realistic results." },
    { id: 'enhance', label: 'Enhance', icon: <SparklesIcon className="w-6 h-6" />, title: "Enhance Quality: Improve overall image fidelity. Upscale resolution, increase sharpness, and reduce noise automatically. You can also select a specific area to enhance." },
    // Local / Object Tools
    { id: 'retouch', label: 'Retouch', icon: <BullseyeIcon className="w-6 h-6" />, title: "Retouch Area: Select an area with the brush tool to remove, replace, or modify its contents. Ideal for removing blemishes or changing an object's color." },
    { id: 'facial', label: 'Facial', icon: <FaceSmileIcon className="w-6 h-6" />, title: "Facial Enhancement: Subtly retouch facial features. Select an area (e.g., skin, eyes) and apply natural enhancements like 'smooth skin' or 'brighten eyes'." },
    { id: 'removeBackground', label: 'Remove BG', icon: <MagicWandIcon className="w-6 h-6" />, title: "Remove Background: Instantly detect the main subject and make the background transparent. Perfect for creating PNGs or product shots." },
    { id: 'background', label: 'Background', icon: <PhotoIcon className="w-6 h-6" />, title: "Replace Background: Swap out the existing background. Choose a solid color, upload your own image, or generate a brand new scene with a text prompt." },
    { id: 'clothing', label: 'Clothing', icon: <TshirtIcon className="w-6 h-6" />, title: "Virtual Try-On: Change the clothing on a person. Upload a photo of a garment and describe how to apply it (e.g., 'replace my t-shirt with this one')." },
    { id: 'mix', label: 'Mix & Match', icon: <LayersIcon className="w-6 h-6" />, title: "Mix & Match Items: Create a full outfit. Upload multiple items (shirts, hats, sunglasses) and describe how to combine them on your subject." },
    { id: 'faceswap', label: 'Face Swap', icon: <UserCircleIcon className="w-6 h-6" />, title: "Face Swap: Replace a face in your photo with one from reference images. For best results, upload multiple angles (front, side) of the new face." },
    { id: 'addPerson', label: 'Add Person', icon: <UserPlusIcon className="w-6 h-6" />, title: "Add Person: Add a person from a reference photo into your main image. The AI will automatically remove their background and blend them into the scene." },
    { id: 'addObject', label: 'Add Object', icon: <CubeTransparentIcon className="w-6 h-6" />, title: "Add Object: Insert a new object into your scene. Click a location, then either describe the object with text or upload a reference image." },
  ];
  
  return (
    <div className="h-full bg-gray-800/50 border-l border-gray-700 p-2 flex flex-col items-center gap-2 backdrop-blur-sm w-56">
        <div className="flex items-center justify-around w-full">
            <ActionButton label="New Image" icon={<ArrowPathIcon className="w-6 h-6" />} onClick={onNewImage} />
            <ActionButton label="Undo (Ctrl+Z)" icon={<UndoIcon className="w-6 h-6" />} onClick={onUndo} disabled={!canUndo} />
            <ActionButton label="Redo (Ctrl+Y)" icon={<RedoIcon className="w-6 h-6" />} onClick={onRedo} disabled={!canRedo} />
        </div>
        
        <Divider />

        <div className="grid grid-cols-2 gap-2">
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
        
        <div className="flex-grow" />

        <Divider />

        <Tooltip text="Save the current image to your device">
            <button onClick={onDownload} className="w-full p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 font-semibold text-base">
                <ArrowDownTrayIcon className="w-6 h-6" />
                Download
            </button>
        </Tooltip>
    </div>
  );
};

export default Toolbar;