// Theme functionality
function loadThemeFromStorage() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

let currentEngine = 'duckduckgo';

// Search engine configurations
const searchEngines = {
    duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=',
        safeSearchParam: '&kp=1'
    },
    startpage: {
        name: 'Startpage',
        url: 'https://www.startpage.com/sp/search?query=',
        safeSearchParam: '&family_filter=1'
    },
    searx: {
        name: 'SearXNG',
        url: 'https://searx.be/?q=',
        safeSearchParam: '&safesearch=1'
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        safeSearchParam: '&adlt=strict'
    }
};

// Handle engine tab switching
function switchEngine(engine) {
    currentEngine = engine;
    
    // Update active tab
    document.querySelectorAll('.engine-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-engine="${engine}"]`).classList.add('active');
}

// Handle search keypress
function handleSearchKeypress(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

// Perform search
function performSearch() {
    const query = document.getElementById('search-query').value.trim();
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    const safeSearch = document.getElementById('safe-search').checked;
    const newTab = document.getElementById('new-tab').checked;
    
    let searchUrl = searchEngines[currentEngine].url + encodeURIComponent(query);
    
    if (safeSearch && searchEngines[currentEngine].safeSearchParam) {
        searchUrl += searchEngines[currentEngine].safeSearchParam;
    }
    
    if (newTab) {
        window.open(searchUrl, '_blank');
    } else {
        window.location.href = searchUrl;
    }
}

// Quick search function
function quickSearch(term) {
    document.getElementById('search-query').value = term;
    performSearch();
}

// Navigation
function goBack() {
    window.history.back();
}

// Initialize page
function initSearchPage() {
    loadThemeFromStorage();
    
    // Add event listeners to engine tabs
    document.querySelectorAll('.engine-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchEngine(tab.dataset.engine);
        });
    });
    
    // Focus on search input
    document.getElementById('search-query').focus();
}

// Initialize when page loads
window.addEventListener('load', initSearchPage);
