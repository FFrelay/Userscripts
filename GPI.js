// ==UserScript==
// @name         GVN Post Ignorer (Dark Theme)
// @namespace    https://github.com/FFrelay/Userscripts
// @version      1.8
// @homepageURL  https://github.com/FFrelay/Userscripts
// @updateURL    https://raw.githubusercontent.com/FFrelay/Userscripts/main/GPI.js
// @downloadURL  https://raw.githubusercontent.com/FFrelay/Userscripts/main/GPI.js
// @description  Ignore and hide ignored users and their quotes on gvn.co
// @author       ffrelay
// @match        http://gvn.co/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-in       normal-tabs
// ==/UserScript==

(function () {
    'use strict';

const IGNORED_USERS_KEY = 'ignoredUsers';
const GIST_ID = '8cc2fa59459ef0148554569dcb695c02';
const FILENAME = 'ignoredUsers.json';
const API_URL = `https://api.github.com/gists/${GIST_ID}`;
const TOKEN_KEY = 'github_token';

async function getGitHubToken() {
    let token = await GM_getValue(TOKEN_KEY, null);
    if (!token) {
        token = prompt("Enter your GitHub token (it will be stored securely and only used by this script):");
        if (token) {
            await GM_setValue(TOKEN_KEY, token);
        } else {
            throw new Error("GitHub token is required.");
        }
    }
    return token;
}

// Load Gist-stored ignored users
async function loadIgnoredUsers() {
    try {
        const token = await getGitHubToken();
        const res = await fetch(API_URL, {
            headers: { Authorization: `token ${token}` }
        });
        const data = await res.json();
        const json = JSON.parse(data.files[FILENAME].content || '{}');
        const users = json[IGNORED_USERS_KEY] || [];
        await GM_setValue(IGNORED_USERS_KEY, users); // cache locally
        return users;
    } catch (e) {
        console.warn("Falling back to local storage for ignored users");
        return await GM_getValue(IGNORED_USERS_KEY, []);
    }
}

// Save ignored users to Gist
async function saveIgnoredUsersToGist(users) {
    const token = await getGitHubToken();
    const currentData = JSON.parse((await (await fetch(API_URL, {
        headers: { Authorization: `token ${token}` }
    })).json()).files[FILENAME].content || '{}');

    currentData[IGNORED_USERS_KEY] = users;

    const body = {
        files: {
            [FILENAME]: {
                content: JSON.stringify(currentData, null, 2)
            }
        }
    };

    await fetch(API_URL, {
        method: 'PATCH',
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    await GM_setValue(IGNORED_USERS_KEY, users); // update local cache
}

let ignoredUsers = [];

async function initialize() {
    try {
        ignoredUsers = await loadIgnoredUsers();
    } catch (e) {
        console.error("Failed to load ignored users:", e);
        ignoredUsers = [];
    }

    console.log("Loaded ignored users:", ignoredUsers);

    processPosts();
    hideIgnoredPosts();
    hideIgnoredQuotes();

    document.body.appendChild(manageButton);
    manageButton.addEventListener('click', () => {
        showManagePanel();
    });

    const observer = new MutationObserver(() => {
        processPosts();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
initialize();

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
    padding: 7.2px 14.4px;
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

manageButton.addEventListener('mouseover', () => {
    manageButton.style.backgroundColor = '#333';
});
manageButton.addEventListener('mouseout', () => {
    manageButton.style.backgroundColor = '#000';
});

// ✅ Fixed: Now syncs both local and Gist
function saveIgnoredUsers() {
    GM_setValue(IGNORED_USERS_KEY, ignoredUsers);
    saveIgnoredUsersToGist(ignoredUsers).catch(e => {
        console.error("Failed to save ignored users to Gist:", e);
    });
}

function isUserIgnored(username) {
    return ignoredUsers.includes(username);
}

function hideIgnoredPosts() {
    document.querySelectorAll('ol#messageList.messageList li.message').forEach(post => {
        const username = getUsernameFromPost(post);
        const isExcludedPost = isPostMarkedAsOne(post);
        post.style.display = (username && isUserIgnored(username) && !isExcludedPost) ? 'none' : '';
    });
}

function isPostMarkedAsOne(postElement) {
    const hashPermalink = postElement.querySelector(
        'div.messageInfo.primaryContent div.messageMeta.ToggleTriggerAnchor div.publicControls a.item.muted.postNumber.hashPermalink.OverlayTrigger'
    );
    return hashPermalink?.textContent.trim() === '#1';
}

function getUsernameFromPost(postElement) {
    return postElement.getAttribute('data-author') || null;
}

function hideIgnoredQuotes() {
    document.querySelectorAll('div.bbCodeBlock.bbCodeQuote[data-author]').forEach(quote => {
        const quoteAuthor = getQuoteAuthor(quote);
        if (quoteAuthor && isUserIgnored(quoteAuthor)) {
            quote.style.display = 'none';
        } else {
            quote.style.display = '';
        }
    });
}

function getQuoteAuthor(quoteElement) {
    return quoteElement.getAttribute('data-author') || null;
}

function addIgnoreButton(postElement) {
    if (postElement.querySelector('.ignore-button')) return;

    const username = getUsernameFromPost(postElement);
    if (!username) return;

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
            hideIgnoredQuotes();

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

    const userBlock = postElement.querySelector('div.messageUserInfo div.messageUserBlock');
    userBlock?.appendChild(buttonContainer);
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

    panel.querySelector('#closePanel').addEventListener('click', () => {
        panel.style.display = 'none';
    });

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
                showManagePanel();
                hideIgnoredPosts();
                hideIgnoredQuotes();
            }
        });
    });
}

function processPosts() {
    document.querySelectorAll('ol#messageList.messageList li.message').forEach(post => {
        addIgnoreButton(post);
    });
    hideIgnoredPosts();
    hideIgnoredQuotes();
}
})();
