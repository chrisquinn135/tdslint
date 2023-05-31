import { writable } from "svelte/store";

// current active tab
export const activeTab = writable('swap')

// current active menu
export const activeMenu = writable('color')

// current focus
export const activeFocus = writable(-1)