/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type Tool =
  | 'expand'
  | 'camera'
  | 'style'
  | 'adjust'
  | 'enhance'
  | 'retouch'
  | 'textEdit'
  | 'faceSwap'
  | 'background'
  | 'clothing'
  | 'addPerson'
  | 'addObject'
  | 'transcribe'
  | 'filter'
  | 'color'
  | 'facial'
  | 'mix'
  | 'magicEraser'
  | 'image'
  | 'transform';

export interface Hotspot {
    x: number; // percentage
    y: number; // percentage
}

// --- Specific Layer Parameter Types ---

export type AdjustLayerParams = { prompt: string };
export type RetouchLayerParams = { prompt: string; mask: string };
export type TextEditLayerParams = { prompt: string };
export type FaceSwapLayerParams = {
    targetImageDataUrl: string;
    targetFaceMaskDataUrl: string;
    referenceFaceDataUrls: string[];
    options: { expression: 'original' | 'reference'; blending: number };
};
export type BackgroundLayerParams = { prompt?: string; backgroundDataUrl?: string };
export type ClothingLayerParams = { clothingDataUrl: string; prompt: string };
export type AddPersonLayerParams = { personDataUrl: string; prompt: string };
export type AddObjectLayerParams = {
    prompt?: string;
    objectDataUrl?: string;
    hotspot: Hotspot;
    lighting?: string;
    shadows?: string;
};
export type EnhanceLayerParams = { prompt?: string; hotspot?: Hotspot };
export type ExpandLayerParams = { direction?: 'up' | 'down' | 'left' | 'right'; percentage: number };
export type CameraLayerParams = { prompt: string; hotspot?: Hotspot };
export type StyleLayerParams = { referenceImages: string[] };
export type FilterLayerParams = { prompt: string };
export type ColorLayerParams = { prompt: string; mask: string | null };
export type FacialLayerParams = { prompt: string; mask: string };
export type MagicEraserLayerParams = { mask: string; fillPrompt: string | null };
export type MixLayerParams = { itemDataUrls: string[]; prompt: string };
export type ImageLayerParams = { imageDataUrl: string; };
export type TransformLayerParams = {}; // No specific params, uses layer's top-level transform

// --- Discriminated Union for Layer Parameters ---

export type LayerParams =
  | { tool: 'adjust'; params: AdjustLayerParams }
  | { tool: 'retouch'; params: RetouchLayerParams }
  | { tool: 'textEdit'; params: TextEditLayerParams }
  | { tool: 'faceSwap'; params: FaceSwapLayerParams }
  | { tool: 'background'; params: BackgroundLayerParams }
  | { tool: 'clothing'; params: ClothingLayerParams }
  | { tool: 'addPerson'; params: AddPersonLayerParams }
  | { tool: 'addObject'; params: AddObjectLayerParams }
  | { tool: 'enhance'; params: EnhanceLayerParams }
  | { tool: 'expand'; params: ExpandLayerParams }
  | { tool: 'camera'; params: CameraLayerParams }
  | { tool: 'style'; params: StyleLayerParams }
  | { tool: 'filter'; params: FilterLayerParams }
  | { tool: 'color'; params: ColorLayerParams }
  | { tool: 'facial'; params: FacialLayerParams }
  | { tool: 'magicEraser'; params: MagicEraserLayerParams }
  | { tool: 'mix'; params: MixLayerParams }
  | { tool: 'image'; params: ImageLayerParams }
  | { tool: 'transform'; params: TransformLayerParams };


export interface Layer {
  id: string;
  name: string;
  tool: Tool;
  params: LayerParams['params'];
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

export interface CustomStyle {
    id: string;
    name: string;
    description: string | null;
    thumbnailUrl: string;
    files: string[];
}

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
    layers?: Layer[];
    undoneLayers?: Layer[];
}

export type BrushShape = 'circle' | 'square';