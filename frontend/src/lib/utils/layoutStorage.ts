import { browser } from '$app/environment';

interface LayoutState {
    // Left panel state
    leftPanelVisible: boolean;
    leftPanelWidth: number;

    // Editor/Preview ratio (editor width / total width)
    editorPreviewRatio: number;

    // Preview zoom state
    zoomMode: 'fit-width' | 'fit-height' | 'fit-page' | 'custom';
    zoomScale: number;
}

const STORAGE_KEY = 'editor.layoutState';

const DEFAULT_LAYOUT: LayoutState = {
    leftPanelVisible: true,
    leftPanelWidth: 250,
    editorPreviewRatio: 0.6, // 60% editor, 40% preview
    zoomMode: 'custom',
    zoomScale: 1,
};

/**
 * Save layout state to localStorage
 */
export function saveLayoutState(state: Partial<LayoutState>): void {
    if (!browser) return;

    try {
        const currentState = loadLayoutState();
        const newState = { ...currentState, ...state };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
        console.error('Failed to save layout state:', error);
    }
}

/**
 * Load layout state from localStorage
 */
export function loadLayoutState(): LayoutState {
    if (!browser) return DEFAULT_LAYOUT;

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return DEFAULT_LAYOUT;

        const parsed = JSON.parse(saved);
        return { ...DEFAULT_LAYOUT, ...parsed };
    } catch (error) {
        console.error('Failed to load layout state:', error);
        return DEFAULT_LAYOUT;
    }
}

/**
 * Clear layout state from localStorage
 */
export function clearLayoutState(): void {
    if (!browser) return;

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear layout state:', error);
    }
}
