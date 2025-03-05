// ==UserScript==
// @name         Copilot Font Override
// @namespace    http://tampermonkey.net/
// @version      0.4
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/CFO.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/CFO.js
// @description  Hides ignored messages and nested ignored quotes on voz.vn
// @author       ffrelay
// @match        https://copilot.microsoft.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Remove existing font links
    document.querySelectorAll('link[href*="fonts"]').forEach(link => link.remove());

    // Override font settings
    const style = document.createElement('style');
    style.textContent = `
        * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                         "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", 
                         "Segoe UI Emoji", "Segoe UI Symbol" !important;
        }
        @font-face {
            font-family: 'Copilot Default';
            src: local('Segoe UI');
            unicode-range: U+000-5FF; /* Basic Latin */
        }
    `;
    document.head.appendChild(style);
})();
