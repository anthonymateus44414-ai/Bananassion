/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type Tool = 'crop' | 'filter' | 'adjust' | 'retouch' | 'background' | 'clothing' | 'enhance' | 'faceswap' | 'camera' | 'addPerson' | 'addObject' | 'color' | 'expand' | 'facial' | 'mix' | 'removeBackground' | 'colorize' | 'train' | null;

export interface Hotspot { 
  x: number; 
  y: number; 
}

export type EditorMode = 'normal' | 'masking';

export interface CustomStyle {
  id: string;
  name: string;
  referenceImageUrls: string[];
  thumbnailUrl: string;
}