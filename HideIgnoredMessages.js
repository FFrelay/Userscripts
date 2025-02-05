// ==UserScript==
// @name         Hide Ignored Messages
// @namespace    https://voz.vn/
// @version      1.0
// @description  Hides ignored messages and nested ignored quotes on voz.vn
// @author       ffrelay
// @match        https://voz.vn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function hideIgnoredMessages() {
        // Hide ignored messages
        //document.querySelectorAll('article[class*="message"]').forEach(function(article) {
        //    if (article.querySelector('div.messageNotice.messageNotice--ignored')) {
        //        article.style.display = 'none';
        //    }
        //});

        // Hide nuisance elements
        document.querySelectorAll('div[class*="message message--post"]').forEach(function(div) {
                            div.style.display = 'none';
        });

        // Hide nested ignored messages in blockquotes
        document.querySelectorAll('blockquote[class*="bbCodeBlock"]').forEach(function(blockquote) {
            if (blockquote.querySelector('div.messageNotice.messageNotice--nested.messageNotice--ignored')) {
                blockquote.style.display = 'none';
            }
        });
    }

    // Run on page load
    hideIgnoredMessages();

    // Observe for dynamically loaded content
    const observer = new MutationObserver(hideIgnoredMessages);
    observer.observe(document.body, { childList: true, subtree: true });

})();
