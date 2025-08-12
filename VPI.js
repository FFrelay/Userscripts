// ==UserScript==
// @name         VOZ Post Ignorer (Dark Theme)
// @namespace    https://github.com/FFrelay/Userscripts
// @version      4.3
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/VPI.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/VPI.js
// @description  Ignore and hide ignored users and their quotes on voz.vn - Works only in normal tabs (not container tabs)
// @author       FFrelay
// @match        https://voz.vn/*
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
     * Prompts user for GitHub token if not already stored.
     * Recommends using 'gist' scope for security.
     * @returns {Promise<string>} GitHub token
     */
    async function getGitHubToken() {
        let token = await GM_getValue(TOKEN_KEY, null);
        if (!token) {
            token = prompt(
                "Enter your GitHub token (required for syncing ignored users).\n" +
                "For security, generate a token with ONLY 'gist' scope at:\n" +
                "https://github.com/settings/tokens\n\n" +
                "Token:"
            );
            if (token) {
                await GM_setValue(TOKEN_KEY, token);
            } else {
                console.warn("No GitHub token provided. Falling back to local mode.");
                throw new Error("GitHub token is required for Gist sync.");
            }
        }
        return token;
    }

    /**
     * Save ignored users list to GitHub Gist with timestamp.
     * @param {string[]} users - List of usernames to save
     */
    async function saveIgnoredUsersToGist(users) {
        try {
            const token = await getGitHubToken();
            const res = await fetch(API_URL, {
                headers: { Authorization: `token ${token}` }
            });

            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            const data = await res.json();

            const currentContent = data.files[FILENAME]?.content;
            const currentData = currentContent ? JSON.parse(currentContent) : {};

            // Save with timestamp
            const now = new Date().toISOString();
            const newList = {
                [IGNORED_USERS_KEY]: users,
                _lastUpdated: now
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
                await GM_setValue('ignoredUsers_timestamp', now);
                console.log("✅ Saved to Gist with timestamp:", now);
            } else {
                const errText = await patchRes.text();
                console.error("❌ Failed to save to Gist:", errText);
                throw new Error(`Save failed: ${patchRes.status}`);
            }
        } catch (error) {
            console.warn("⚠️ Save to Gist failed, keeping local copy.", error.message);
            // Still save locally
            await GM_setValue(IGNORED_USERS_KEY, users);
        }
    }

    /**
     * Load ignored users from Gist, but only use it if it's newer than local.
     * Falls back to local cache if Gist fails or is outdated.
     * @returns {Promise<string[]>} List of ignored usernames
     */
    async function loadIgnoredUsers() {
        try {
            const token = await getGitHubToken();
            const res = await fetch(API_URL, {
                headers: { Authorization: `token ${token}` }
            });

            if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
            const data = await res.json();

            const file = data.files[FILENAME];
            if (!file || !file.content) throw new Error("Gist file missing or empty");

            const gistData = JSON.parse(file.content);
            const gistUsers = Array.isArray(gistData[IGNORED_USERS_KEY]) ? gistData[IGNORED_USERS_KEY] : [];
            const gistTime = new Date(gistData._lastUpdated).getTime();

            // Get local data
            const localUsers = await GM_getValue(IGNORED_USERS_KEY, []);
            const localTimeStr = await GM_getValue('ignoredUsers_timestamp', '');
            const localTime = localTimeStr ? new Date(localTimeStr).getTime() : 0;

            // Decide: use newer list
            if (isNaN(gistTime)) {
                console.log("🔁 Gist has no valid timestamp. Keeping local list.");
                return localUsers;
            }

            if (gistTime > localTime) {
                console.log("🔁 Gist list is newer. Using Gist data.");
                await GM_setValue(IGNORED_USERS_KEY, gistUsers);
                await GM_setValue('ignoredUsers_timestamp', gistData._lastUpdated);
                return gistUsers;
            } else {
                console.log("🔁 Local list is newer or equal. Keeping local.");
                return localUsers;
            }
        } catch (error) {
            console.warn("⚠️ Gist load failed, using local list:", error.message);
            return await GM_getValue(IGNORED_USERS_KEY, []);
        }
    }

    // ——————————————————————————————————————
    // Immediate Initialization Using Local Cache
    // ——————————————————————————————————————

    // Read local cache immediately (synchronous)
    const localUsers = GM_getValue(IGNORED_USERS_KEY, []);
    let ignoredUsers = Array.isArray(localUsers) ? localUsers : [];

    // Hide posts and quotes immediately
    function hideIgnoredPosts() {
        document.querySelectorAll('article[data-author]').forEach(post => {
            const username = post.getAttribute('data-author');
            const isExcluded = isPostMarkedAsOne(post);
            post.style.display = username && ignoredUsers.includes(username) && !isExcluded ? 'none' : '';
        });
    }

    function isPostMarkedAsOne(postElement) {
        return Array.from(postElement.querySelectorAll('a')).some(a => a.textContent.trim() === '#1');
    }

    function hideIgnoredQuotes() {
        document.querySelectorAll('blockquote.bbCodeBlock--quote[data-quote]').forEach(quote => {
            const author = quote.getAttribute('data-quote');
            quote.style.display = author && ignoredUsers.includes(author) ? 'none' : '';
        });
    }

    // ——————————————————————————————————————
    // UI: Ignore Button
    // ——————————————————————————————————————


    function addIgnoreButton(postElement, username) {
        if (postElement.querySelector('.ignore-button')) return;

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

            if (ignoredUsers.includes(username)) return;

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
        const userCell = postElement.querySelector('.message-cell--user.message-cell');
        if (userCell) userCell.appendChild(buttonContainer);
    }

    // ——————————————————————————————————————
    // Management Panel
    // ——————————————————————————————————————

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
                    showManagePanel(); // Refresh
                }
            });
        });
    }

    // ——————————————————————————————————————
    // Process Posts (for new content)
    // ——————————————————————————————————————

    function processPosts() {
        document.querySelectorAll('article[data-author]').forEach(post => {
            const username = post.getAttribute('data-author');
            if (username) addIgnoreButton(post, username);
        });
        hideIgnoredPosts();
        hideIgnoredQuotes();
    }

    // ——————————————————————————————————————
    // Initialize
    // ——————————————————————————————————————

    // Hide immediately using cached list
    hideIgnoredPosts();
    hideIgnoredQuotes();
    console.log("🛡️ VOZ Post Ignorer: Using cached list to hide posts immediately.");

    // Load from Gist in background, update only if newer
    loadIgnoredUsers().then(freshUsers => {
        if (JSON.stringify(freshUsers) !== JSON.stringify(ignoredUsers)) {
            ignoredUsers = freshUsers;
            hideIgnoredPosts();
            hideIgnoredQuotes();
            console.log("🔁 Updated ignored users from Gist:", ignoredUsers);
        }
    }).catch(err => {
        console.warn("🔁 Using local list only:", err.message);
    });

    // Setup UI
    processPosts();

    document.body.appendChild(manageButton);
    manageButton.addEventListener('click', showManagePanel);

    // Watch for dynamically loaded posts (infinite scroll, etc.)
    const observer = new MutationObserver(processPosts);
    observer.observe(document.body, { childList: true, subtree: true });

})();