// ==UserScript==
// @name         YouTube Grid Customization
// @namespace    http://tampermonkey.net/
// @version      0.6
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/YGC.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/YGC.js
// @description  Modify YouTube grid layout with custom CSS
// @author       FFrelay
// @match        https://*.youtube.com/*
// @exclude      https://*.youtube.com/embed/*
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

//Hide Continue Watching miniplayer
(function() {
    document.body.addEventListener("yt-navigate-finish", function(event) {
        if (document.getElementsByTagName('ytd-miniplayer').length) {
            document.querySelector('ytd-miniplayer').parentNode.removeChild(document.querySelector('ytd-miniplayer'));
        }
        if (document.getElementsByClassName('ytp-miniplayer-button').length) {
            document.querySelector('.ytp-miniplayer-button').parentNode.removeChild(document.querySelector('.ytp-miniplayer-button'))
        }
        if (window.location.pathname != "/watch") {
            document.querySelector('#movie_player video').parentNode.removeChild(document.querySelector('#movie_player video'));
        }
    });
})();
