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

// Navigation
function goBack() {
    window.history.back();
}

// Initialize page
function initSearchPage() {
    loadThemeFromStorage();
    
    // Handle iframe loading
    const iframe = document.getElementById('search-frame');
    if (iframe) {
        iframe.addEventListener('load', function() {
            iframe.classList.add('loaded');
        });
    }
}

// Initialize when page loads
window.addEventListener('load', initSearchPage);
