import { writable } from "svelte/store";

// current active tab
export const activeTab = writable('page')

// current active menu
export const activeMenu = writable('color')

// current focus
export const activeFocusPage = writable(-1)
export const activeFocusSelection = writable(-1)

// current active option
export const activeOption = writable('tds');

// ran or not
export const ranPage = writable(false);

// ran or not selection
export const ranSelection = writable(false);

// error list per page
export const colorPage =  writable([{id: '3:1192', type: 'color', desc: 'Stroke color', name: 'Wrong Color 1'}, {id: '23:1192', type: 'color', desc: 'Stroke color', name: 'Navigation'}])
export const colorIgnorePage = writable([]);
export const fontPage = writable([{id: '3:1192', type: 'font', desc: 'Stroke color', name: 'Wrong Font', status: false}])
export const fontIgnorePage = writable([]);

// error list per page
export const colorSelection =  writable([{id: '3:1192', type: 'color', desc: 'Stroke color', name: 'Navigation', status: false}, {id: '23:1192', type: 'color', desc: 'Stroke color', name: 'Navigation', status: false}])
export const colorIgnoreSelection = writable([]);
export const fontSelection = writable([{id: '3:1192', type: 'font', desc: 'Stroke color', name: 'Navigation', status: false}, {id: '23:1192', type: 'font', desc: 'Stroke color', name: 'Navigation', status: false}])
export const fontIgnoreSelection = writable([]);