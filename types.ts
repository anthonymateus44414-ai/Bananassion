/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type Tool =
  | 'expand'
  | 'camera'
  | 'style' // New tool for applying custom styles
  | 'adjust'
  | 'enhance'
  | 'retouch'
  | 'textEdit'
  | 'faceSwap' // New: for swapping faces
  | 'background'
  | 'clothing'
  | 'addPerson'
  | 'addObject'
  | 'transcribe'
  // FIX: Add missing tool types to resolve multiple comparison and assignment errors across the application.
  | 'image'
  | 'transform'
  | 'filter'
  | 'color'
  | 'facial'
  | 'mix'
  | 'magicEraser';

export interface Layer {
  id: string;
  name: string;
  tool: Tool;
  params: any;
  isVisible: boolean;
  cachedResult?: string;
  transform?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

export interface Hotspot {
    x: number; // percentage
    y: number; // percentage
}

export interface CustomStyle {
    id: string;
    name: string;
    description: string | null;
    thumbnailUrl: string;
    files: string[]; // Store as data URLs for localStorage compatibility
}

// FIX: Exported the missing 'FilterSuggestion' type.
export interface FilterSuggestion {
  name: string;
  prompt: string;
}

export interface DetectedObject {
  name: string;
  mask: string; // Base64 Data URL of the mask
}

export interface ProjectState {
    baseImage: string | null;
    history?: {
        past: Layer[][];
        present: Layer[];
        future: Layer[][];
    };
    customStyles?: CustomStyle[];
    // For backward compatibility with old project files
    layers?: Layer[];
    undoneLayers?: Layer[];
}

export type BrushShape = 'circle' | 'square';