// ==UserScript==
// @name         YouTube Grid Customization
// @namespace    http://tampermonkey.net/
// @version      0.2
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/YGC.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/YGC.js
// @description  Modify YouTube grid layout with custom CSS
// @author       FFrelay
// @match        https://*.youtube.com/*
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle(`
.style-scope.ytd-rich-grid-renderer {
    --ytd-rich-grid-items-per-row: 4 !important;
}

#contents > ytd-rich-grid-row,
#contents > ytd-rich-grid-row > #contents {
    display: contents !important;
}
`);
