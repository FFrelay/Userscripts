// ==UserScript==
// @name         VOZ Post Ignorer (Dark Theme)
// @namespace    https://github.com/FFrelay/Userscripts
// @version      3.6
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/VPI.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/VPI.js
// @description  Ignore and hide ignored users and their quotes on voz.vn
// @author       ffrelay
// @match        https://voz.vn/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-in       normal-tabs
// ==/UserScript==

(function () {
    'use strict';

    const IGNORED_USERS_KEY = 'ignoredUsers';
    let ignoredUsers = GM_getValue(IGNORED_USERS_KEY, []);

    // Management panel setup
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #000;
        color: white;
        padding: 20px;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(255,255,255,0.1);
        max-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        display: none;
        z-index: 10000;
    `;

    // Floating manage button
    const manageButton = document.createElement('button');
    manageButton.textContent = 'Ignored Users';
    manageButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 7.2px 14.4px; /* Scaled down */
        font-size: 12px;
        background: #000;
        color: white;
        border: 1.2px solid #444;
        border-radius: 15px;
        cursor: pointer;
        box-shadow: 0 1.2px 3px rgba(255,255,255,0.1);
        z-index: 10001;
        font-weight: bold;
        transition: all 0.3s;
    `;

    // Button hover effects
    manageButton.addEventListener('mouseover', () => {
        manageButton.style.backgroundColor = '#333';
    });
    manageButton.addEventListener('mouseout', () => {
        manageButton.style.backgroundColor = '#000';
    });

    function saveIgnoredUsers() {
        GM_setValue(IGNORED_USERS_KEY, ignoredUsers);
    }

    function isUserIgnored(username) {
        return ignoredUsers.includes(username);
    }

    function hideIgnoredPosts() {
        document.querySelectorAll('article[data-author]').forEach(post => {
            const username = post.getAttribute('data-author');
            const isExcludedPost = isPostMarkedAsOne(post);

            // Hide if user is ignored and not excluded by #1
            post.style.display = (username && isUserIgnored(username) && !isExcludedPost) ? 'none' : '';
        });
    }

    // Function to check if a post is marked with #1
    function isPostMarkedAsOne(postElement) {
        const anchors = postElement.querySelectorAll('a'); // Get all <a> elements in the post
        for (const anchor of anchors) {
            if (anchor.textContent.trim() === '#1') { // Check if the text content is exactly "#1"
                return true;
            }
        }
        return false;
    }

    // Function to hide quotes from ignored users
    function hideIgnoredQuotes() {
        document.querySelectorAll('blockquote.bbCodeBlock.bbCodeBlock--expandable.bbCodeBlock--quote.js-expandWatch').forEach(quote => {
            const quoteAuthor = getQuoteAuthor(quote);
            if (quoteAuthor && isUserIgnored(quoteAuthor)) {
                quote.style.display = 'none'; // Hide the quote block
            } else {
                quote.style.display = ''; // Ensure visible if not ignored
            }
        });
    }

    // Function to extract the author of a quote using data-quote attribute
    function getQuoteAuthor(quoteElement) {
        return quoteElement.getAttribute('data-quote') || null;
    }

    function addIgnoreButton(postElement, username) {
        if (postElement.querySelector('.ignore-button')) return;

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: center;
            margin-top: 9px;
        `;

        const button = document.createElement('button');
        button.textContent = 'Ignore';
        button.className = 'ignore-button';
        button.style.cssText = `
            background: #000;
            color: white !important;
            padding: 6px 15px;
            font-size: 12px;
            border: 1.2px solid #444;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: bold;
            box-shadow: 0 1.2px 3px rgba(255,255,255,0.1);
        `;

        // Hover effects
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#333';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#000';
        });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isUserIgnored(username)) {
                ignoredUsers.push(username);
                saveIgnoredUsers();
                hideIgnoredPosts();
                hideIgnoredQuotes(); // Also hide quotes from the ignored user

                // Visual feedback
                button.textContent = 'Ignored';
                button.style.backgroundColor = '#4CAF50';
                button.style.borderColor = '#4CAF50';
                setTimeout(() => {
                    button.textContent = 'Ignore';
                    button.style.backgroundColor = '#000';
                    button.style.borderColor = '#444';
                }, 1000);
            }
        });

        buttonContainer.appendChild(button);

        const userCell = postElement.querySelector('.message-cell--user.message-cell');
        userCell?.appendChild(buttonContainer);
    }

    function showManagePanel() {
        panel.innerHTML = `
            <h3 style="margin-top: 0; color: white">Ignored Users (${ignoredUsers.length})</h3>
            <button id="closePanel" style="
                float: right;
                margin: 6px 0;
                background: #333;
                color: white;
                padding: 4.8px 9.6px;
                font-size: 12px;
                border-radius: 2.4px;
                border: none;
                cursor: pointer;
            ">Close</button>
            <div id="userList" style="max-height: 300px; overflow-y: auto; margin-top: 12px"></div>
        `;

        const userList = panel.querySelector('#userList');
        if (ignoredUsers.length === 0) {
            userList.innerHTML = '<p style="color: #999">No users ignored yet</p>';
        } else {
            ignoredUsers.forEach(user => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    padding: 7.2px 0;
                    border-bottom: 0.6px solid #444;
                    color: white;
                `;
                item.innerHTML = `
                    <span style="color: #ddd">${user}</span>
                    <button class="removeUser" style="
                        background: #444;
                        color: white;
                        padding: 2.4px 7.2px;
                        font-size: 12px;
                        border-radius: 2.4px;
                        border: none;
                        cursor: pointer;
                    ">Remove</button>
                `;
                userList.appendChild(item);
            });
        }

        panel.style.display = 'block';
        document.body.appendChild(panel);

        // Close button
        panel.querySelector('#closePanel').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // Remove user buttons
        panel.querySelectorAll('.removeUser').forEach(button => {
            button.addEventListener('mouseover', (e) => {
                e.target.style.backgroundColor = '#666';
            });
            button.addEventListener('mouseout', (e) => {
                e.target.style.backgroundColor = '#444';
            });
            button.addEventListener('click', () => {
                const username = button.parentElement.querySelector('span').textContent;
                const index = ignoredUsers.indexOf(username);
                if (index > -1) {
                    ignoredUsers.splice(index, 1);
                    saveIgnoredUsers();
                    showManagePanel(); // Refresh the list
                    hideIgnoredPosts(); // Show unignored posts
                    hideIgnoredQuotes(); // Refresh quotes visibility
                }
            });
        });
    }

    function processPosts() {
        document.querySelectorAll('article[data-author]').forEach(post => {
            const username = post.getAttribute('data-author');
            if (username) addIgnoreButton(post, username);
        });
        hideIgnoredPosts(); // Apply hiding logic after processing posts
        hideIgnoredQuotes(); // Apply hiding logic for quotes
    }

    // Initialize
    (function init() {
        hideIgnoredPosts();
        hideIgnoredQuotes(); // Initial hiding of quotes
        processPosts();

        // Add manage button
        document.body.appendChild(manageButton);
        manageButton.addEventListener('click', () => {
            showManagePanel();
        });

        // Observe DOM changes
        const observer = new MutationObserver(() => {
            processPosts();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    })();
})();
