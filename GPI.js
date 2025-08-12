// ==UserScript==
// @name         GVN Post Ignorer (Dark Theme)
// @namespace    https://github.com/FFrelay/Userscripts
// @version      2.0
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/GPI.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/GPI.js
// @description  Ignore and hide ignored users and their quotes on gvn.co - Works only in normal tabs (not container tabs)
// @author       ffrelay
// @match        http://gvn.co/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @run-in       normal-tabs
// ==/UserScript==

(function () {
    'use strict';

    const IGNORED_USERS_KEY = 'ignoredUsers';
    const GIST_ID = '8cc2fa59459ef0148554569dcb695c02';
    const FILENAME = 'ignoredUsers.json';
    const API_URL = `https://api.github.com/gists/${GIST_ID}`;
    const TOKEN_KEY = 'github_token';

    /**
     * Get GitHub token from user or storage
     */
    async function getGitHubToken() {
        let token = await GM_getValue(TOKEN_KEY, null);
        if (!token) {
            token = prompt(
                "Enter your GitHub token (required for syncing).\n" +
                "Use 'gist' scope only:\n" +
                "https://github.com/settings/tokens\n\n" +
                "Token:"
            );
            if (token) {
                await GM_setValue(TOKEN_KEY, token);
            } else {
                throw new Error("GitHub token is required.");
            }
        }
        return token;
    }

    /**
     * Save ignored users to Gist with timestamp
     */
    async function saveIgnoredUsersToGist(users) {
        try {
            const token = await getGitHubToken();
            const res = await fetch(API_URL, {
                headers: { Authorization: `token ${token}` }
            });

            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            const data = await res.json();

            const file = data.files[FILENAME];
            const current = file?.content ? JSON.parse(file.content) : {};

            const newList = {
                [IGNORED_USERS_KEY]: users,
                _lastUpdated: new Date().toISOString()
            };

            const body = {
                files: {
                    [FILENAME]: {
                        content: JSON.stringify(newList, null, 2)
                    }
                }
            };

            const patchRes = await fetch(API_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (patchRes.ok) {
                await GM_setValue(IGNORED_USERS_KEY, users);
                await GM_setValue('ignoredUsers_timestamp', newList._lastUpdated);
                console.log("✅ Saved to Gist:", newList._lastUpdated);
            } else {
                throw new Error(`Save failed: ${patchRes.status}`);
            }
        } catch (error) {
            console.warn("⚠️ Save to Gist failed, keeping local", error.message);
            await GM_setValue(IGNORED_USERS_KEY, users);
        }
    }

    /**
     * Load from Gist, but only use if newer than local
     */
    async function loadIgnoredUsers() {
        try {
            const token = await getGitHubToken();
            const res = await fetch(API_URL, {
                headers: { Authorization: `token ${token}` }
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);
            const data = await res.json();

            const file = data.files[FILENAME];
            if (!file || !file.content) throw new Error("Empty Gist");

            const gistData = JSON.parse(file.content);
            const gistUsers = Array.isArray(gistData[IGNORED_USERS_KEY]) ? gistData[IGNORED_USERS_KEY] : [];
            const gistTime = new Date(gistData._lastUpdated).getTime();

            const localTimeStr = await GM_getValue('ignoredUsers_timestamp', '');
            const localTime = localTimeStr ? new Date(localTimeStr).getTime() : 0;

            if (isNaN(gistTime) || gistTime <= localTime) {
                console.log("🔁 Gist is outdated. Keeping local list.");
                return await GM_getValue(IGNORED_USERS_KEY, []);
            } else {
                console.log("🔁 Gist is newer. Updating.");
                await GM_setValue(IGNORED_USERS_KEY, gistUsers);
                await GM_setValue('ignoredUsers_timestamp', gistData._lastUpdated);
                return gistUsers;
            }
        } catch (error) {
            console.warn("⚠️ Gist load failed, using local", error.message);
            return await GM_getValue(IGNORED_USERS_KEY, []);
        }
    }

    // ————————————————————————
    // ✅ Immediate Initialization
    // ————————————————————————

    // Read local cache immediately
    const cachedUsers = GM_getValue(IGNORED_USERS_KEY, []);
    let ignoredUsers = Array.isArray(cachedUsers) ? cachedUsers : [];

    function isUserIgnored(username) {
        return ignoredUsers.includes(username);
    }

    function getUsernameFromPost(postElement) {
        return postElement.getAttribute('data-author') || null;
    }

    function getQuoteAuthor(quoteElement) {
        return quoteElement.getAttribute('data-author') || null;
    }

    function isPostMarkedAsOne(postElement) {
        const permalink = postElement.querySelector(
            'a.item.muted.postNumber.hashPermalink.OverlayTrigger'
        );
        return permalink?.textContent.trim() === '#1';
    }

    function hideIgnoredPosts() {
        document.querySelectorAll('ol#messageList.messageList li.message').forEach(post => {
            const username = getUsernameFromPost(post);
            const isExcluded = isPostMarkedAsOne(post);
            post.style.display = username && isUserIgnored(username) && !isExcluded ? 'none' : '';
        });
    }

    function hideIgnoredQuotes() {
        document.querySelectorAll('div.bbCodeBlock.bbCodeQuote[data-author]').forEach(quote => {
            const author = getQuoteAuthor(quote);
            quote.style.display = author && isUserIgnored(author) ? 'none' : '';
        });
    }

    // ————————————————————————
    // Add Ignore Button
    // ————————————————————————

    function addIgnoreButton(postElement) {
        if (postElement.querySelector('.ignore-button')) return;

        const username = getUsernameFromPost(postElement);
        if (!username) return;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: center; margin-top: 9px;';

        const button = document.createElement('button');
        button.textContent = 'Ignore';
        button.className = 'ignore-button';
        button.style.cssText = `
            background: #000; color: white; padding: 6px 15px; font-size: 12px;
            border: 1.2px solid #444; border-radius: 15px; cursor: pointer;
            transition: all 0.3s; font-weight: bold; box-shadow: 0 1.2px 3px rgba(255,255,255,0.1);
        `;

        ['mouseover', 'mouseout'].forEach(evt =>
            button.addEventListener(evt, e =>
                button.style.backgroundColor = evt === 'mouseover' ? '#333' : '#000'
            )
        );

        button.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();

            if (isUserIgnored(username)) return;

            ignoredUsers.push(username);
            saveIgnoredUsersToGist(ignoredUsers);
            hideIgnoredPosts();
            hideIgnoredQuotes();

            button.textContent = 'Ignored';
            button.style.backgroundColor = '#4CAF50';
            button.style.borderColor = '#4CAF50';
            setTimeout(() => {
                button.textContent = 'Ignore';
                button.style.backgroundColor = '#000';
                button.style.borderColor = '#444';
            }, 1000);
        });

        buttonContainer.appendChild(button);
        const userBlock = postElement.querySelector('div.messageUserInfo div.messageUserBlock');
        if (userBlock) userBlock.appendChild(buttonContainer);
    }

    // ————————————————————————
    // Manage Panel
    // ————————————————————————

    const manageButton = Object.assign(document.createElement('button'), {
        textContent: 'Ignored Users'
    });
    manageButton.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 7.2px 14.4px;
        font-size: 12px; background: #000; color: white; border: 1.2px solid #444;
        border-radius: 15px; cursor: pointer; box-shadow: 0 1.2px 3px rgba(255,255,255,0.1);
        z-index: 10001; font-weight: bold; transition: background-color 0.3s;
    `;

    ['mouseover', 'mouseout'].forEach(evt =>
        manageButton.addEventListener(evt, e =>
            manageButton.style.backgroundColor = evt === 'mouseover' ? '#333' : '#000'
        )
    );

    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #000; color: white; padding: 20px; border: 1px solid #333;
        border-radius: 8px; box-shadow: 0 0 10px rgba(255,255,255,0.1);
        max-width: 400px; max-height: 80vh; overflow-y: auto; display: none; z-index: 10000;
    `;

    function showManagePanel() {
        panel.innerHTML = `
            <h3 style="margin-top: 0; color: white;">Ignored Users (${ignoredUsers.length})</h3>
            <button id="closePanel" style="
                float: right; margin: 6px 0; background: #333; color: white;
                padding: 4.8px 9.6px; font-size: 12px; border-radius: 2.4px;
                border: none; cursor: pointer;
            ">Close</button>
            <div id="userList" style="max-height: 300px; overflow-y: auto; margin-top: 12px;"></div>
        `;

        const userList = panel.querySelector('#userList');
        if (ignoredUsers.length === 0) {
            userList.innerHTML = '<p style="color: #999">No users ignored yet</p>';
        } else {
            ignoredUsers.forEach(user => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex; justify-content: space-between;
                    padding: 7.2px 0; border-bottom: 0.6px solid #444; color: white;
                `;
                item.innerHTML = `
                    <span style="color: #ddd">${user}</span>
                    <button class="removeUser" style="
                        background: #444; color: white; padding: 2.4px 7.2px;
                        font-size: 12px; border-radius: 2.4px; border: none; cursor: pointer;
                    ">Remove</button>
                `;
                userList.appendChild(item);
            });
        }

        panel.style.display = 'block';
        document.body.appendChild(panel);

        panel.querySelector('#closePanel').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        panel.querySelectorAll('.removeUser').forEach(btn => {
            btn.addEventListener('mouseover', e => e.target.style.backgroundColor = '#666');
            btn.addEventListener('mouseout', e => e.target.style.backgroundColor = '#444');
            btn.addEventListener('click', () => {
                const username = btn.parentElement.querySelector('span').textContent.trim();
                const index = ignoredUsers.indexOf(username);
                if (index > -1) {
                    ignoredUsers.splice(index, 1);
                    saveIgnoredUsersToGist(ignoredUsers);
                    hideIgnoredPosts();
                    hideIgnoredQuotes();
                    showManagePanel();
                }
            });
        });
    }

    // ————————————————————————
    // Process Posts
    // ————————————————————————

    function processPosts() {
        document.querySelectorAll('ol#messageList.messageList li.message').forEach(addIgnoreButton);
        hideIgnoredPosts();
        hideIgnoredQuotes();
    }

    // ————————————————————————
    // ✅ Initialize: Immediate Hide + Background Sync
    // ————————————————————————

    // ✅ Hide posts immediately using cached list
    hideIgnoredPosts();
    hideIgnoredQuotes();
    console.log("🛡️ GVN Post Ignorer: Using local cache to hide posts immediately.");

    // Load fresh list in background
    loadIgnoredUsers().then(freshUsers => {
        if (JSON.stringify(freshUsers) !== JSON.stringify(ignoredUsers)) {
            ignoredUsers = freshUsers;
            hideIgnoredPosts();
            hideIgnoredQuotes();
            console.log("🔁 Updated from Gist:", ignoredUsers);
        }
    }).catch(err => {
        console.warn("🔁 Using local list only:", err.message);
    });

    // Setup UI
    processPosts();
    document.body.appendChild(manageButton);
    manageButton.addEventListener('click', showManagePanel);

    // Watch for new posts (infinite scroll, etc.)
    const observer = new MutationObserver(processPosts);
    observer.observe(document.body, { childList: true, subtree: true });

})();