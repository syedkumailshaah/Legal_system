// ============================================
// LEGAL AI SYSTEM - COMPLETE JAVASCRIPT
// Advanced AI-Powered Legal Platform
// ============================================

// Configuration
const API_BASE_URL = 'https://legal-system-xu6z.onrender.com';
let currentUser = null;
let searchType = 'hybrid';
let filters = {};
let selectedFiles = [];

// Modal state
let currentViewData = null;
let currentAIContext = '';
let advancedSearchType = 'hybrid';

// AI Status
let aiModelsStatus = {
    qa: false,
    summarization: false,
    embeddings: false
};

// Session management
let sessionData = {
    searchQuery: '',
    selectedFiles: [],
    lastPage: 'dashboard'
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} fade-in`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'ai') icon = 'robot';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function showLoading(show, text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (!overlay || !loadingText) {
        console.warn('Loading overlay elements not found');
        return;
    }
    
    if (show) {
        loadingText.textContent = text;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getInitials(name) {
    if (!name) return 'US';
    return name.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getTimeAgo(date) {
    if (!date) return 'Unknown date';
    
    const now = new Date();
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function setQueryParam(name, value) {
    const urlParams = new URLSearchParams(window.location.search);
    if (value) {
        urlParams.set(name, value);
    } else {
        urlParams.delete(name);
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
}

// ============================================
// AUTH FUNCTIONS
// ============================================

function showRegister() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (registerScreen) registerScreen.style.display = 'block';
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    
    if (registerScreen) registerScreen.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'block';
}

async function login() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!emailInput || !passwordInput) {
        showToast('Login form elements not found', 'error');
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error', 'Login Failed');
        return;
    }
    
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    try {
        showLoading(true, 'Logging in...');
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        currentUser = {
            id: data.user_id,
            username: data.username
        };
        
        // Store user info
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Show main app
        const authScreens = document.getElementById('authScreens');
        const mainApp = document.getElementById('mainApp');
        const usernameDisplay = document.getElementById('usernameDisplay');
        const userAvatar = document.getElementById('userAvatar');
        
        if (authScreens) authScreens.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
        if (userAvatar) userAvatar.innerHTML = getInitials(currentUser.username);
        
        showToast('Login successful!', 'success', 'Welcome Back');
        
        // Check AI status
        await checkAIStatus();
        
        // Load dashboard
        showPage('dashboard');
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Network error. Please check your connection.';
        if (error.message.includes('HTTP 400')) {
            errorMessage = 'Invalid email or password';
        } else if (error.message.includes('HTTP 500')) {
            errorMessage = 'Server error. Please try again later.';
        }
        
        showToast(errorMessage, 'error', 'Login Failed');
    } finally {
        showLoading(false);
    }
}

async function register() {
    const usernameInput = document.getElementById('registerUsername');
    const emailInput = document.getElementById('registerEmail');
    const fullNameInput = document.getElementById('registerFullName');
    const passwordInput = document.getElementById('registerPassword');
    
    if (!usernameInput || !emailInput || !passwordInput) {
        showToast('Registration form elements not found', 'error');
        return;
    }
    
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const fullName = fullNameInput ? fullNameInput.value.trim() : '';
    const password = passwordInput.value;
    
    if (!username || !email || !password) {
        showToast('Please fill all required fields', 'error', 'Registration Failed');
        return;
    }
    
    const formData = new FormData();
    formData.append('username', username);
    formData.append('email', email);
    formData.append('full_name', fullName);
    formData.append('password', password);
    
    try {
        showLoading(true, 'Creating account...');
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        showToast('Registration successful! Please login', 'success', 'Account Created');
        showLogin();
        
        // Clear form
        if (usernameInput) usernameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (fullNameInput) fullNameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        
    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'Network error. Please check your connection.';
        if (error.message.includes('HTTP 400')) {
            errorMessage = 'User already exists or invalid data';
        } else if (error.message.includes('HTTP 500')) {
            errorMessage = 'Server error. Please try again later.';
        }
        
        showToast(errorMessage, 'error', 'Registration Failed');
    } finally {
        showLoading(false);
    }
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('legalRagSession');
    currentUser = null;
    
    const mainApp = document.getElementById('mainApp');
    const authScreens = document.getElementById('authScreens');
    
    if (mainApp) mainApp.style.display = 'none';
    if (authScreens) authScreens.style.display = 'block';
    
    showLogin();
    
    showToast('Logged out successfully', 'info', 'Goodbye');
}

function checkAuth() {
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            
            const authScreens = document.getElementById('authScreens');
            const mainApp = document.getElementById('mainApp');
            const usernameDisplay = document.getElementById('usernameDisplay');
            const userAvatar = document.getElementById('userAvatar');
            
            if (authScreens) authScreens.style.display = 'none';
            if (mainApp) mainApp.style.display = 'block';
            if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
            if (userAvatar) userAvatar.innerHTML = getInitials(currentUser.username);
            
            // Load dashboard
            loadDashboard();
            
            // Check AI status
            checkAIStatus().then(status => {
                console.log('AI Status:', status);
            });
            
        } catch (e) {
            console.error('Auth parse error:', e);
            localStorage.removeItem('user');
            showLogin();
        }
    }
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(pageId) {
    console.log(`Switching to page: ${pageId}`);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(pageId + 'Page');
    if (pageElement) {
        pageElement.classList.add('active');
        pageElement.style.display = 'block';
    } else {
        console.error(`Page element not found: ${pageId}Page`);
        showToast(`Page not found: ${pageId}`, 'error');
        return;
    }
    
    // Set active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkText = link.textContent.toLowerCase();
        if (linkText.includes(pageId.toLowerCase()) || 
            link.getAttribute('onclick')?.includes(`'${pageId}'`)) {
            link.classList.add('active');
        }
    });
    
    // Load page data
    switch(pageId.toLowerCase()) {
        case 'documents':
            loadDocuments();
            break;
        case 'dashboard':
            loadDashboard();
            break;
        case 'search':
            // Focus on search input
            setTimeout(() => {
                const searchInput = document.getElementById('searchQuery');
                if (searchInput) {
                    searchInput.focus();
                    // Restore saved query
                    if (sessionData.searchQuery) {
                        searchInput.value = sessionData.searchQuery;
                    }
                }
            }, 100);
            break;
        case 'upload':
            // Reset upload form
            selectedFiles = [];
            const fileList = document.getElementById('fileList');
            if (fileList) fileList.innerHTML = '';
            
            const docTitle = document.getElementById('docTitle');
            if (docTitle) docTitle.value = '';
            
            const docDescription = document.getElementById('docDescription');
            if (docDescription) docDescription.value = '';
            break;
    }
    
    // Save to session
    sessionData.lastPage = pageId;
    saveSessionData();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        const originalOnClick = link.getAttribute('onclick');
        if (originalOnClick && originalOnClick.includes('showPage')) {
            return;
        }
        
        // Extract page name from link text
        const linkText = link.textContent.toLowerCase();
        let pageName = 'dashboard';
        
        if (linkText.includes('search')) pageName = 'search';
        else if (linkText.includes('upload')) pageName = 'upload';
        else if (linkText.includes('document')) pageName = 'documents';
        else if (linkText.includes('dashboard') || linkText.includes('home')) pageName = 'dashboard';
        
        link.setAttribute('onclick', `showPage('${pageName}'); return false;`);
    });
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

function setSearchType(type) {
    searchType = type;
    
    // Update UI
    document.querySelectorAll('.search-type').forEach(el => {
        el.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // If there's a search query, perform search
    const searchInput = document.getElementById('searchQuery');
    if (searchInput && searchInput.value.trim()) {
        performSearch();
    }
}

function setAdvancedSearchType(type) {
    advancedSearchType = type;
    
    // Update UI
    const modal = document.getElementById('advancedSearchModal');
    if (modal) {
        modal.querySelectorAll('.search-type').forEach(el => {
            el.classList.remove('active');
        });
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

function toggleFilter(filter) {
    const element = event.target;
    
    if (filters[filter]) {
        delete filters[filter];
        element.classList.remove('active');
    } else {
        // Clear other filters and set this one
        Object.keys(filters).forEach(key => delete filters[key]);
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        filters[filter] = true;
        element.classList.add('active');
    }
    
    // If there's a search query, perform search
    const searchInput = document.getElementById('searchQuery');
    if (searchInput && searchInput.value.trim()) {
        performSearch();
    }
}

async function performSearch() {
    const searchInput = document.getElementById('searchQuery');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'error', 'Search Error');
        return;
    }
    
    // Save query to session
    sessionData.searchQuery = query;
    saveSessionData();
    
    // Build query parameters
    const params = new URLSearchParams({
        q: query,
        search_type: searchType,
        limit: '20'
    });
    
    // Add filters
    const category = Object.keys(filters)[0];
    if (category) {
        params.append('category', category);
    }
    
    try {
        showLoading(true, 'Searching documents...');
        const response = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        displaySearchResults(data.results, query, data.count);
        
    } catch (error) {
        console.error('Search error:', error);
        
        let errorMessage = 'Search failed. Please try again.';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server. Make sure the backend is running.';
        } else if (error.message.includes('HTTP 500')) {
            errorMessage = 'Server error during search.';
        }
        
        showToast(errorMessage, 'error', 'Search Error');
        
        // Show fallback results
        displaySearchResults([], query, 0);
    } finally {
        showLoading(false);
    }
}

async function performAdvancedSearch() {
    const searchInput = document.getElementById('advancedSearchQuery');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'error', 'Search Error');
        return;
    }
    
    const categorySelect = document.getElementById('advancedCategory');
    const jurisdictionInput = document.getElementById('advancedJurisdiction');
    const yearFromInput = document.getElementById('yearFrom');
    const yearToInput = document.getElementById('yearTo');
    
    const category = categorySelect ? categorySelect.value : '';
    const jurisdiction = jurisdictionInput ? jurisdictionInput.value.trim() : '';
    const yearFrom = yearFromInput ? yearFromInput.value : '';
    const yearTo = yearToInput ? yearToInput.value : '';
    
    // Build query parameters for advanced search
    const params = new URLSearchParams({
        q: query,
        search_type: advancedSearchType,
        limit: '20'
    });
    
    if (category) params.append('category', category);
    if (jurisdiction) params.append('jurisdiction', jurisdiction);
    if (yearFrom) params.append('year_from', yearFrom);
    if (yearTo) params.append('year_to', yearTo);
    
    try {
        showLoading(true, 'Performing advanced search...');
        const response = await fetch(`${API_BASE_URL}/api/search/advanced?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        displaySearchResults(data.results, query, data.count);
        closeAdvancedSearch();
        
    } catch (error) {
        console.error('Advanced search error:', error);
        showToast('Advanced search failed. Please try again.', 'error', 'Search Error');
    } finally {
        showLoading(false);
    }
}

function displaySearchResults(results, query, count) {
    const container = document.getElementById('searchResults');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsCount = document.getElementById('resultsCount');
    
    if (!container || !resultsTitle || !resultsCount) {
        console.error('Search results containers not found');
        return;
    }
    
    console.log('Displaying results:', results);
    
    if (!results || results.length === 0) {
        resultsTitle.textContent = 'Search Results';
        resultsCount.textContent = 'No results found';
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h3>No Results Found</h3>
                <p>No documents found for "${escapeHtml(query)}"</p>
                <p class="text-gray mt-sm">Try using different keywords or search types</p>
                ${aiModelsStatus.qa ? `
                    <button class="btn btn-primary mt-lg" onclick="askAIQuestionDirect('${escapeHtml(query)}')">
                        <i class="fas fa-robot"></i> Ask AI About This Topic
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    resultsTitle.textContent = 'Search Results';
    resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
    
    let html = '';
    
    results.forEach(result => {
        const contentPreview = result.content && result.content.length > 300 
            ? result.content.substring(0, 300) + '...' 
            : result.content || 'No content available';
        
        const scorePercentage = result.score ? Math.round(result.score * 100) : 0;
        const safeContent = escapeHtml(result.content || '');
        const isLLM = result.search_type === 'llm' || result.llm_score;
        
        html += `
            <div class="result-card slide-in-up">
                <div class="result-header">
                    <div class="result-badges">
                        <span class="law-badge">${escapeHtml(result.law_title || 'Unknown Law')}</span>
                        <span class="category-badge">${escapeHtml(result.category || 'Legal')}</span>
                        ${isLLM ? `<span class="ai-badge-small"><i class="fas fa-robot"></i> AI</span>` : ''}
                    </div>
                    <div class="result-meta">
                        <div class="section-number">Section ${escapeHtml(result.section_number || 'N/A')}</div>
                        <div class="score-badge ${isLLM ? 'llm-score-badge' : ''}">
                            <i class="fas fa-chart-line"></i>
                            ${scorePercentage}% Match
                            ${result.llm_score ? ` (AI: ${Math.round(result.llm_score * 100)}%)` : ''}
                        </div>
                    </div>
                </div>
                <div class="result-title">${escapeHtml(result.title || 'No Title')}</div>
                <div class="result-content">${escapeHtml(contentPreview)}</div>
                <div class="result-tags">
                    <span class="tag ${isLLM ? 'llm' : ''}">${escapeHtml(result.search_type || 'search')}${isLLM ? ' (AI)' : ''}</span>
                    <span class="tag">${escapeHtml(result.category || 'Legal')}</span>
                    ${result.jurisdiction ? `<span class="tag">${escapeHtml(result.jurisdiction)}</span>` : ''}
                    ${result.year ? `<span class="tag">${escapeHtml(result.year.toString())}</span>` : ''}
                </div>
                <div class="result-actions">
                    <button class="action-btn" onclick="copyToClipboard('${safeContent.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\\/g, '\\\\')}')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="action-btn" onclick="viewDetails('${result.id || ''}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="action-btn ai-btn" onclick="askQuestionAbout('${safeContent.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\\/g, '\\\\')}')">
                        <i class="fas fa-robot"></i> Ask AI
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    if (modal) {
        modal.classList.add('active');
        
        // Set focus to query input
        const queryInput = document.getElementById('advancedSearchQuery');
        if (queryInput) {
            queryInput.focus();
        }
    }
}

function closeAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Filter only PDF files
    selectedFiles = Array.from(files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (selectedFiles.length === 0) {
        showToast('Please select PDF files only', 'error', 'Invalid Files');
        return;
    }
    
    // Check total size
    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
    
    if (totalSize > MAX_TOTAL_SIZE) {
        showToast('Total files size exceeds 100MB limit', 'error', 'File Size Limit');
        selectedFiles = [];
        event.target.value = '';
        return;
    }
    
    displaySelectedFiles();
    
    // Show toast
    showToast(`Added ${selectedFiles.length} PDF file${selectedFiles.length !== 1 ? 's' : ''}`, 'success', 'Files Added');
    
    // Save to session
    sessionData.selectedFiles = selectedFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
    }));
    saveSessionData();
}

function displaySelectedFiles() {
    const container = document.getElementById('fileList');
    if (!container) return;
    
    if (selectedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<h4 class="mb-md">Selected Files:</h4>';
    
    selectedFiles.forEach((file, index) => {
        const size = formatFileSize(file.size);
        html += `
            <div class="file-item slide-in-up">
                <div class="file-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-size">${size}</div>
                </div>
                <button class="file-remove" onclick="removeFile(${index})" title="Remove file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function removeFile(index) {
    if (index >= 0 && index < selectedFiles.length) {
        const removedFile = selectedFiles[index];
        selectedFiles.splice(index, 1);
        displaySelectedFiles();
        
        // Update session data
        sessionData.selectedFiles = selectedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));
        saveSessionData();
        
        showToast(`Removed: ${removedFile.name}`, 'info', 'File Removed');
    }
}

function triggerFileInput() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

async function uploadFiles() {
    if (selectedFiles.length === 0) {
        showToast('Please select files to upload', 'error', 'Upload Error');
        return;
    }
    
    const titleInput = document.getElementById('docTitle');
    const categorySelect = document.getElementById('docCategory');
    const jurisdictionInput = document.getElementById('docJurisdiction');
    const yearInput = document.getElementById('docYear');
    const descriptionInput = document.getElementById('docDescription');
    const enableAICheckbox = document.getElementById('enableAIProcessing');
    
    const title = titleInput ? titleInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : '';
    const jurisdiction = jurisdictionInput ? jurisdictionInput.value.trim() : '';
    const year = yearInput ? yearInput.value : '';
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    const enableAI = enableAICheckbox ? enableAICheckbox.checked : false;
    
    if (!category) {
        showToast('Please select a category', 'error', 'Upload Error');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    if (!uploadBtn) return;
    
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    
    let successCount = 0;
    let errorCount = 0;
    
    try {
        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title || file.name.replace('.pdf', ''));
            formData.append('category', category);
            formData.append('jurisdiction', jurisdiction || 'Pakistan');
            formData.append('year', year || new Date().getFullYear());
            formData.append('description', description);
            
            showLoading(true, `Uploading ${file.name}...`);
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    successCount++;
                    const data = await response.json();
                    showToast(`Uploaded: ${file.name} (${data.sections} sections)`, 'success', 'Upload Success');
                } else {
                    const errorData = await response.json();
                    errorCount++;
                    showToast(`Failed to upload ${file.name}: ${errorData.detail || 'Unknown error'}`, 'error', 'Upload Failed');
                }
            } catch (error) {
                errorCount++;
                showToast(`Failed to upload ${file.name}: ${error.message}`, 'error', 'Upload Failed');
            }
        }
        
        if (successCount > 0) {
            showToast(`Successfully uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`, 'success', 'Upload Complete');
            
            // Refresh documents list if on documents page
            const documentsPage = document.getElementById('documentsPage');
            if (documentsPage && documentsPage.classList.contains('active')) {
                loadDocuments();
            }
            // Refresh dashboard
            loadDashboard();
            
            // Clear form
            selectedFiles = [];
            sessionData.selectedFiles = [];
            saveSessionData();
            
            const fileList = document.getElementById('fileList');
            if (fileList) fileList.innerHTML = '';
            
            if (titleInput) titleInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
            if (categorySelect) categorySelect.value = '';
            
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
        }
        
        if (errorCount > 0) {
            showToast(`${errorCount} file${errorCount !== 1 ? 's' : ''} failed to upload`, 'warning', 'Partial Upload');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast(`Error uploading files: ${error.message}`, 'error', 'Upload Error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
        showLoading(false);
    }
}

// ============================================
// DOCUMENTS FUNCTIONS
// ============================================

async function loadDocuments() {
    try {
        showLoading(true, 'Loading documents...');
        const response = await fetch(`${API_BASE_URL}/api/documents?page=1&limit=50`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        displayDocuments(data.documents || []);
        
    } catch (error) {
        console.error('Error loading documents:', error);
        showToast('Failed to load documents. Please try again.', 'error', 'Load Error');
        
        // Show empty state
        displayDocuments([]);
    } finally {
        showLoading(false);
    }
}

function displayDocuments(documents) {
    const container = document.getElementById('documentsList');
    if (!container) return;
    
    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>No Documents Yet</h3>
                <p>Upload your first legal document to get started</p>
                <button class="btn btn-primary mt-lg" onclick="showPage('upload')">
                    <i class="fas fa-upload"></i> Upload Documents
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    documents.forEach(doc => {
        const date = doc.created_at ? 
            new Date(doc.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Unknown date';
        
        const fileSize = formatFileSize(doc.file_size || 0);
        
        html += `
            <div class="document-card slide-in-up">
                <div class="document-header">
                    <span class="document-category">${escapeHtml(doc.category || 'Uncategorized')}</span>
                    <span class="document-date">${date}</span>
                </div>
                <div class="document-title">${escapeHtml(doc.title || 'Untitled Document')}</div>
                <div class="document-meta">
                    <div class="meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(doc.jurisdiction || 'Not specified')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>Year: ${doc.year || 'N/A'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-layer-group"></i>
                        <span>${doc.sections_count || 0} sections</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-hdd"></i>
                        <span>${fileSize}</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="action-btn" onclick="viewDocument('${doc.id || ''}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="action-btn" onclick="searchInDocument('${escapeHtml(doc.title || '')}')">
                        <i class="fas fa-search"></i> Search
                    </button>
                    <button class="action-btn ai-btn" onclick="summarizeDocument('${doc.id || ''}')">
                        <i class="fas fa-file-contract"></i> AI Summary
                    </button>
                    <button class="action-btn btn-danger" onclick="deleteDocument('${doc.id || ''}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function searchInDocument(documentTitle) {
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        searchInput.value = documentTitle;
        showPage('search');
        setTimeout(() => {
            performSearch();
        }, 300);
    }
}

function searchDocuments() {
    const searchInput = document.getElementById('documentsSearch');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase().trim();
    const documents = document.querySelectorAll('.document-card');
    
    if (!query) {
        documents.forEach(doc => doc.style.display = 'block');
        return;
    }
    
    documents.forEach(doc => {
        const title = doc.querySelector('.document-title')?.textContent.toLowerCase() || '';
        const category = doc.querySelector('.document-category')?.textContent.toLowerCase() || '';
        const jurisdiction = doc.querySelector('.meta-item:nth-child(1) span')?.textContent.toLowerCase() || '';
        
        if (title.includes(query) || category.includes(query) || jurisdiction.includes(query)) {
            doc.style.display = 'block';
        } else {
            doc.style.display = 'none';
        }
    });
}

function refreshDocuments() {
    loadDocuments();
    showToast('Documents refreshed', 'success', 'Refresh Complete');
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

async function loadDashboard() {
    try {
        showLoading(true, 'Loading dashboard...');
        
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const statsData = await response.json();
        
        // Update stats
        const totalDocuments = document.getElementById('totalDocuments');
        const totalSections = document.getElementById('totalSections');
        const totalSearches = document.getElementById('totalSearches');
        const totalUploads = document.getElementById('totalUploads');
        const aiQueries = document.getElementById('aiQueries');
        const vectorCount = document.getElementById('vectorCount');
        
        if (totalDocuments) totalDocuments.textContent = statsData.total_documents || 0;
        if (totalSections) totalSections.textContent = statsData.total_sections || 0;
        if (totalSearches) totalSearches.textContent = statsData.total_queries || 0;
        if (totalUploads) totalUploads.textContent = statsData.total_documents || 0;
        if (aiQueries) aiQueries.textContent = statsData.ai_queries || 0;
        if (vectorCount) vectorCount.textContent = statsData.vector_count || 0;
        
        // Display recent activity
        displayRecentActivity(statsData.recent_documents || []);
        
        // Update AI status card
        updateAIStatusCard();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard data', 'error', 'Connection Error');
        
        // Set default values
        const elements = ['totalDocuments', 'totalSections', 'totalSearches', 'totalUploads', 'aiQueries', 'vectorCount'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
        
        displayRecentActivity([]);
    } finally {
        showLoading(false);
    }
}

function displayRecentActivity(documents) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-history"></i>
                </div>
                <h3>No Recent Activity</h3>
                <p>Activity will appear here as you use the system</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    documents.forEach(doc => {
        const timeAgo = doc.created_at ? getTimeAgo(new Date(doc.created_at)) : 'Recently';
        
        html += `
            <div class="activity-item slide-in-up">
                <div class="activity-icon">
                    <i class="fas fa-file-upload"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(doc.title || 'Untitled Document')}</div>
                    <div class="activity-time">Uploaded ${timeAgo} • ${escapeHtml(doc.category || 'Legal')} • ${doc.sections_count || 0} sections</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function checkAIStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            
            aiModelsStatus = {
                qa: data.ai_models?.qa === 'available',
                summarization: data.ai_models?.summarization === 'available',
                embeddings: data.ai_models?.embeddings === 'available'
            };
            
            // Update badge
            const badge = document.getElementById('aiStatusBadge');
            if (badge) {
                if (aiModelsStatus.qa && aiModelsStatus.embeddings) {
                    badge.innerHTML = '<i class="fas fa-brain"></i> AI Ready';
                    badge.style.background = 'var(--gradient-success)';
                } else if (aiModelsStatus.qa || aiModelsStatus.embeddings) {
                    badge.innerHTML = '<i class="fas fa-brain"></i> AI Limited';
                    badge.style.background = 'var(--gradient-gold)';
                } else {
                    badge.innerHTML = '<i class="fas fa-brain"></i> AI Offline';
                    badge.style.background = 'var(--gradient-error)';
                }
            }
            
            return aiModelsStatus;
        }
    } catch (error) {
        console.error('Error checking AI status:', error);
        aiModelsStatus = { qa: false, summarization: false, embeddings: false };
    }
    
    return aiModelsStatus;
}

function updateAIStatusCard() {
    const container = document.getElementById('aiStatusCard');
    if (!container) return;
    
    const models = [
        { name: 'Question Answering', key: 'qa', icon: 'question-circle' },
        { name: 'Summarization', key: 'summarization', icon: 'file-contract' },
        { name: 'Embeddings', key: 'embeddings', icon: 'brain' }
    ];
    
    let html = '<div class="ai-model-status">';
    
    models.forEach(model => {
        const isAvailable = aiModelsStatus[model.key];
        html += `
            <div class="ai-model-item">
                <div class="model-name">
                    <i class="fas fa-${model.icon}"></i>
                    ${model.name}
                </div>
                <div class="model-status ${isAvailable ? 'available' : 'unavailable'}">
                    ${isAvailable ? 'Available' : 'Unavailable'}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function testAIQuery() {
    askAIQuestionDirect('Test AI query: What is this system capable of?');
}

async function checkSystemHealth() {
    try {
        showLoading(true, 'Checking system health...');
        
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            
            let message = `System Status: ${data.status.toUpperCase()}\n`;
            message += `Database: ${data.database}\n`;
            message += `AI Models: ${data.ai_models?.qa || 'Not available'}`;
            
            showToast(message, 'success', 'System Health');
        } else {
            showToast('System check failed', 'error', 'Health Check');
        }
    } catch (error) {
        showToast('Could not connect to system', 'error', 'Health Check');
    } finally {
        showLoading(false);
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

async function viewDocument(docId) {
    if (!docId) {
        showToast('No document ID provided', 'error', 'View Error');
        return;
    }
    
    try {
        showLoading(true, 'Loading document details...');
        
        const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`);
        if (response.ok) {
            const data = await response.json();
            currentViewData = data;
            showDocumentModal(data);
        } else {
            throw new Error(`Failed to load document: ${response.status}`);
        }
    } catch (error) {
        console.error('Error loading document:', error);
        showToast('Error loading document details', 'error', 'Load Error');
        
        // Show modal with error message
        currentViewData = {
            title: 'Document Details',
            error: 'Failed to load document details. Please try again.'
        };
        showDocumentModal(currentViewData);
    } finally {
        showLoading(false);
    }
}

function showDocumentModal(data) {
    const modal = document.getElementById('viewModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    if (!modal || !title || !body) return;
    
    if (data.error) {
        title.textContent = 'Error';
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Error Loading Document</h3>
                <p>${escapeHtml(data.error)}</p>
            </div>
        `;
    } else {
        title.textContent = data.title || 'Document Details';
        
        const date = data.created_at ? 
            new Date(data.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'Unknown date';
        
        const fileSize = formatFileSize(data.file_size || 0);
        const sectionsCount = data.sections_count || 0;
        
        let sectionsHtml = '';
        if (data.sections && data.sections.length > 0) {
            sectionsHtml = `
                <div class="document-sections">
                    <h4>Document Sections (${sectionsCount})</h4>
                    <div class="sections-list">
                        ${data.sections.slice(0, 5).map(section => `
                            <div class="section-item">
                                <div class="section-header">
                                    <span class="section-number">${escapeHtml(section.section_number || 'N/A')}</span>
                                    <span class="section-title">${escapeHtml(section.title || '')}</span>
                                </div>
                                <div class="section-content">${escapeHtml(section.content_preview || '')}</div>
                            </div>
                        `).join('')}
                        ${data.sections.length > 5 ? `<p class="text-center mt-sm">... and ${data.sections.length - 5} more sections</p>` : ''}
                    </div>
                </div>
            `;
        }
        
        body.innerHTML = `
            <div class="document-details">
                <div class="document-meta-grid">
                    <div class="meta-item">
                        <div class="meta-label">Category</div>
                        <div class="meta-value">${escapeHtml(data.category || 'Legal')}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Jurisdiction</div>
                        <div class="meta-value">${escapeHtml(data.jurisdiction || 'Pakistan')}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Year</div>
                        <div class="meta-value">${data.year || 'N/A'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Sections</div>
                        <div class="meta-value">${sectionsCount}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">File Size</div>
                        <div class="meta-value">${fileSize}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Uploaded</div>
                        <div class="meta-value">${date}</div>
                    </div>
                </div>
                
                <div class="document-content">
                    <h4>Description</h4>
                    <p>${escapeHtml(data.description || 'No description available.')}</p>
                    
                    ${data.text_preview ? `
                        <h4>Content Preview</h4>
                        <p>${escapeHtml(data.text_preview)}</p>
                    ` : ''}
                </div>
                
                ${sectionsHtml}
                
                <div class="document-actions">
                    <button class="btn btn-primary" onclick="searchInDocument('${escapeHtml(data.title || '')}')">
                        <i class="fas fa-search"></i> Search in Document
                    </button>
                    <button class="btn btn-outline" onclick="askQuestionAboutDocument('${data.id}')">
                        <i class="fas fa-robot"></i> Ask AI About Document
                    </button>
                    ${aiModelsStatus.summarization ? `
                        <button class="btn btn-outline" onclick="summarizeDocument('${data.id}')">
                            <i class="fas fa-file-contract"></i> AI Summary
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentViewData = null;
}

function closeAIModal() {
    const modal = document.getElementById('askAIModal');
    const aiResponse = document.getElementById('aiResponse');
    const aiOptions = document.getElementById('aiOptions');
    
    if (modal) modal.classList.remove('active');
    if (aiResponse) {
        aiResponse.classList.remove('active');
        aiResponse.innerHTML = '';
    }
    if (aiOptions) aiOptions.style.display = 'none';
    
    const aiQuestion = document.getElementById('aiQuestion');
    if (aiQuestion) aiQuestion.value = '';
}

function copyModalContent() {
    if (!currentViewData) return;
    
    const textToCopy = currentViewData.description || 
                     currentViewData.text_preview || 
                     currentViewData.title || 
                     'No content available';
    
    copyToClipboard(textToCopy);
}

function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!', 'success', 'Copy Successful');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showToast('Failed to copy to clipboard', 'error', 'Copy Failed');
        }
        document.body.removeChild(textArea);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success', 'Copy Successful');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy to clipboard', 'error', 'Copy Failed');
    });
}

// ============================================
// AI FUNCTIONS
// ============================================

async function askAIQuestionDirect(question) {
    if (!question || question.trim() === '') {
        showToast('Please enter a question', 'error', 'AI Error');
        return;
    }
    
    currentAIContext = question;
    showAIModalWithOptions(question, true);
}

function askQuestionAbout(content) {
    if (!content || content.trim() === '') {
        showToast('No content provided for AI analysis', 'error', 'AI Error');
        return;
    }
    
    currentAIContext = content;
    showAIModalWithOptions(content);
}

function askQuestionAboutDocument(docId) {
    if (!currentViewData) return;
    
    const context = currentViewData.description || currentViewData.title || '';
    askQuestionAbout(context);
}

function showAIModalWithOptions(content, isDirectQuestion = false) {
    const modal = document.getElementById('askAIModal');
    const contextElement = document.getElementById('aiContext');
    const optionsElement = document.getElementById('aiOptions');
    
    if (!modal || !contextElement) return;
    
    // Truncate context for display
    const displayContent = content.length > 500 ? 
        content.substring(0, 500) + '...' : 
        content;
    
    contextElement.textContent = displayContent;
    
    const aiQuestion = document.getElementById('aiQuestion');
    if (aiQuestion) {
        aiQuestion.value = isDirectQuestion ? content : '';
    }
    
    const aiResponse = document.getElementById('aiResponse');
    if (aiResponse) {
        aiResponse.classList.remove('active');
        aiResponse.innerHTML = '';
    }
    
    // Show/hide options based on whether it's a direct question
    if (optionsElement) {
        if (isDirectQuestion) {
            optionsElement.style.display = 'none';
        } else {
            optionsElement.style.display = 'block';
        }
    }
    
    modal.classList.add('active');
    
    if (aiQuestion) {
        aiQuestion.focus();
    }
}

// AI Option Functions
function askForSummary() {
    const question = "Please provide a comprehensive summary of this legal document or section.";
    submitAIQuestion(question, true);
}

function askForKeywords() {
    const question = "What are the key legal terms and concepts mentioned in this content?";
    submitAIQuestion(question, true);
}

function askForAnalysis() {
    const question = "Provide a detailed legal analysis including implications and applications.";
    submitAIQuestion(question, true);
}

function askForImplications() {
    const question = "What are the legal implications and practical applications of this content?";
    submitAIQuestion(question, true);
}

async function submitAIQuestion(customQuestion = null, detailed = false) {
    const aiQuestionInput = document.getElementById('aiQuestion');
    const question = customQuestion || (aiQuestionInput ? aiQuestionInput.value.trim() : '');
    const context = currentAIContext;
    
    if (!question) {
        showToast('Please enter a question', 'error', 'AI Question Error');
        return;
    }
    
    const responseElement = document.getElementById('aiResponse');
    if (!responseElement) return;
    
    responseElement.classList.remove('active');
    
    // Show loading in response area
    responseElement.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>AI is analyzing with advanced models...</p>
        </div>
    `;
    responseElement.classList.add('active');
    
    try {
        showLoading(true, 'AI is thinking...');
        
        const params = new URLSearchParams({
            question: question,
            detailed: detailed.toString(),
            max_context_length: 2000
        });
        
        const response = await fetch(`${API_BASE_URL}/api/rag/ask?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        let sourcesHtml = '';
        if (data.sources && data.sources.length > 0) {
            sourcesHtml = `
                <div class="ai-sources">
                    <h5>Sources Used:</h5>
                    <div class="sources-list">
                        ${data.sources.map((source, index) => `
                            <div class="source-item">
                                <div class="source-title">
                                    <strong>${index + 1}. ${escapeHtml(source.law_title || 'Unknown Law')}</strong>
                                    (Section ${escapeHtml(source.section_number || 'N/A')})
                                </div>
                                <div class="source-preview">${escapeHtml(source.content_preview || '')}</div>
                                <div class="source-meta">
                                    Relevance: ${Math.round((source.relevance_score || 0) * 100)}%
                                    • Type: ${escapeHtml(source.search_type || 'search')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        responseElement.innerHTML = `
            <div class="ai-response-header">
                <i class="fas fa-robot"></i>
                <h4>AI Legal Analysis (${escapeHtml(data.model_used || 'transformers')})</h4>
                <span class="confidence-badge">Confidence: ${Math.round((data.confidence || 0) * 100)}%</span>
            </div>
            <div class="ai-response-content">
                ${data.answer || 'No answer provided.'}
            </div>
            ${sourcesHtml}
        `;
        
        // Show success toast
        showToast('AI analysis completed', 'ai', 'Analysis Ready');
        
    } catch (error) {
        console.error('AI query error:', error);
        
        let errorMessage = 'Sorry, I couldn\'t process your request. Please try again.';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to AI server. Make sure the backend is running.';
        }
        
        responseElement.innerHTML = `
            <div class="ai-response-header error">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Analysis Error</h4>
            </div>
            <div class="ai-response-content">
                <p>${errorMessage}</p>
                <p class="error-detail">${escapeHtml(error.message || 'Unknown error')}</p>
                <p class="mt-sm"><strong>Fallback Analysis:</strong></p>
                ${generateFallbackAIResponse(question, context)}
            </div>
        `;
        
        showToast('Using fallback analysis', 'warning', 'AI Limited');
    } finally {
        showLoading(false);
    }
}

function submitDetailedQuestion() {
    const question = document.getElementById('aiQuestion')?.value.trim();
    if (question) {
        submitAIQuestion(question, true);
    }
}

function generateFallbackAIResponse(question, context) {
    const lowerQuestion = question.toLowerCase();
    let response = '';
    
    if (lowerQuestion.includes('online harassment') || lowerQuestion.includes('cyber crime')) {
        response = `
            <p><strong>Online Harassment Analysis:</strong> Based on the legal context, online harassment is typically addressed under cybercrime laws. Penalties may include:</p>
            <ul>
                <li>Imprisonment ranging from months to years depending on severity</li>
                <li>Substantial fines</li>
                <li>Compensation to victims</li>
                <li>Confiscation of devices used in the offense</li>
            </ul>
            <p><strong>Key Provisions:</strong> Look for sections specifically mentioning "cyber harassment", "online stalking", "digital intimidation" or related terms in cybercrime legislation.</p>
        `;
    } else if (lowerQuestion.includes('summary') || lowerQuestion.includes('summarize')) {
        response = `
            <p><strong>Summary:</strong> The legal content discusses provisions related to legal frameworks and regulatory compliance. Key aspects include:</p>
            <ul>
                <li>Legal procedures and regulatory requirements</li>
                <li>Specific conditions and provisions for compliance</li>
                <li>Applicable legal standards and guidelines</li>
                <li>Implementation and enforcement mechanisms</li>
            </ul>
        `;
    } else if (lowerQuestion.includes('penalty') || lowerQuestion.includes('punishment') || lowerQuestion.includes('fine')) {
        response = `
            <p><strong>Penalty Analysis:</strong> The content addresses legal consequences for violations, which may include:</p>
            <ul>
                <li>Monetary fines based on offense severity</li>
                <li>Imprisonment terms as specified</li>
                <li>Combination of both fine and imprisonment</li>
                <li>Additional penalties like license revocation or asset forfeiture</li>
            </ul>
        `;
    } else if (lowerQuestion.includes('requirement') || lowerQuestion.includes('must') || lowerQuestion.includes('shall')) {
        response = `
            <p><strong>Requirements:</strong> The document specifies legal obligations including:</p>
            <ul>
                <li>Mandatory documentation and reporting</li>
                <li>Compliance measures and procedures</li>
                <li>Specific timelines and deadlines</li>
                <li>Verification and audit requirements</li>
            </ul>
        `;
    } else {
        response = `
            <p><strong>Analysis:</strong> This legal content relates to regulatory compliance and legal procedures. Key considerations include interpretation, application, and compliance with relevant legal standards.</p>
            <p><strong>Note:</strong> For specific legal advice applicable to your situation, consult qualified legal professionals licensed in the relevant jurisdiction.</p>
        `;
    }
    
    return response;
}

async function summarizeDocument(docId) {
    if (!docId) {
        showToast('No document ID provided', 'error', 'Summary Error');
        return;
    }
    
    try {
        showLoading(true, 'Generating AI summary...');
        
        const response = await fetch(`${API_BASE_URL}/api/documents/${docId}/summarize`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // Show summary in modal
        const summaryModal = document.getElementById('summaryModal');
        const summaryContent = document.getElementById('summaryContent');
        
        if (summaryModal && summaryContent) {
            summaryContent.innerHTML = `
                <div class="summary-header">
                    <h3>${escapeHtml(data.title || 'Document Summary')}</h3>
                    <div class="summary-meta">
                        <span>Original: ${data.original_length} chars</span>
                        <span>Summary: ${data.summary_length} chars</span>
                        <span>Compression: ${data.compression_ratio || 'N/A'}</span>
                        <span>Model: ${data.model_used || 'N/A'}</span>
                    </div>
                </div>
                <div class="summary-body">
                    <p>${escapeHtml(data.summary || 'No summary generated.')}</p>
                </div>
            `;
            summaryModal.classList.add('active');
        } else {
            // Fallback to alert
            alert(`Summary: ${data.summary || 'No summary generated.'}`);
        }
        
        showToast('Document summarized successfully', 'ai', 'AI Summary Generated');
        
    } catch (error) {
        console.error('Summarization error:', error);
        showToast('Failed to generate summary', 'error', 'Summary Error');
    } finally {
        showLoading(false);
    }
}

function closeSummaryModal() {
    const modal = document.getElementById('summaryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function summarizeCurrentDocument() {
    if (currentViewData && currentViewData.id) {
        await summarizeDocument(currentViewData.id);
    }
}

// ============================================
// OTHER FUNCTIONS
// ============================================

function viewDetails(sectionId) {
    if (!sectionId) {
        showToast('No section ID provided', 'error', 'View Error');
        return;
    }
    
    // For now, show a placeholder modal
    const modal = document.getElementById('viewModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    if (!modal || !title || !body) return;
    
    title.textContent = 'Section Details';
    body.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading section details...</p>
        </div>
    `;
    
    modal.classList.add('active');
    
    // Simulate API call (in real implementation, fetch from API)
    setTimeout(() => {
        body.innerHTML = `
            <div class="document-details">
                <div class="document-meta-grid">
                    <div class="meta-item">
                        <div class="meta-label">Section ID</div>
                        <div class="meta-value">${escapeHtml(sectionId)}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Type</div>
                        <div class="meta-value">Legal Section</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Relevance</div>
                        <div class="meta-value">High</div>
                    </div>
                </div>
                
                <div class="document-content">
                    <h4>Section Content Preview</h4>
                    <p>This is a sample legal section content. In a real implementation, this would show the actual legal text from the database.</p>
                    <p>The section contains provisions related to legal matters, with specific clauses and sub-clauses that define the legal framework.</p>
                    <p>Additional details about penalties, procedures, or rights would be displayed here based on the actual document content.</p>
                </div>
                
                <div class="document-actions">
                    <button class="btn btn-primary" onclick="copyToClipboard('Sample legal section content')">
                        <i class="fas fa-copy"></i> Copy Section
                    </button>
                    <button class="btn btn-outline" onclick="askQuestionAbout('Sample legal section content')">
                        <i class="fas fa-robot"></i> Ask AI
                    </button>
                </div>
            </div>
        `;
    }, 1000);
}

async function deleteDocument(docId) {
    if (!docId) {
        showToast('No document ID provided', 'error', 'Delete Error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading(true, 'Deleting document...');
        
        const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Document deleted successfully', 'success', 'Delete Successful');
            
            // Refresh documents list
            const documentsPage = document.getElementById('documentsPage');
            if (documentsPage && documentsPage.classList.contains('active')) {
                loadDocuments();
            }
            
            // Refresh dashboard
            loadDashboard();
            
            // Close modal if open
            closeModal();
            
        } else {
            const errorData = await response.json();
            showToast(errorData.detail || 'Failed to delete document', 'error', 'Delete Failed');
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        showToast('Network error while deleting document', 'error', 'Delete Error');
    } finally {
        showLoading(false);
    }
}

function batchAnalyzeSelected() {
    showToast('Batch analysis feature coming soon', 'info', 'Feature Preview');
}

// ============================================
// DRAG & DROP HANDLING
// ============================================

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            selectedFiles = Array.from(files).filter(file => 
                file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
            );
            
            if (selectedFiles.length > 0) {
                displaySelectedFiles();
                showToast(`Added ${selectedFiles.length} PDF file${selectedFiles.length !== 1 ? 's' : ''}`, 'success', 'Files Added');
                
                // Save to session
                sessionData.selectedFiles = selectedFiles.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type
                }));
                saveSessionData();
            } else {
                showToast('Please drop PDF files only', 'error', 'Invalid Files');
            }
        }
    });
    
    dropZone.addEventListener('click', function() {
        triggerFileInput();
    });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function saveSessionData() {
    try {
        const sessionToSave = {
            ...sessionData,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('legalRagSession', JSON.stringify(sessionToSave));
    } catch (e) {
        console.error('Error saving session:', e);
    }
}

function loadSessionData() {
    try {
        const savedSession = localStorage.getItem('legalRagSession');
        if (savedSession) {
            const loadedData = JSON.parse(savedSession);
            sessionData = {
                ...sessionData,
                ...loadedData
            };
            
            // Restore search query
            const searchInput = document.getElementById('searchQuery');
            if (searchInput && sessionData.searchQuery) {
                searchInput.value = sessionData.searchQuery;
            }
            
            // Restore page if not already on a page
            const activePage = document.querySelector('.page.active');
            if (!activePage && sessionData.lastPage) {
                setTimeout(() => {
                    showPage(sessionData.lastPage);
                }, 100);
            }
        }
    } catch (e) {
        console.error('Error loading session:', e);
    }
}

// ============================================
// EXPORT & PRINT FUNCTIONS
// ============================================

function exportSearchResults() {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    
    const results = resultsContainer.querySelectorAll('.result-card');
    
    if (results.length === 0) {
        showToast('No results to export', 'warning', 'Export Error');
        return;
    }
    
    let exportText = 'Legal AI System - Search Results\n';
    exportText += 'Generated on: ' + new Date().toLocaleString() + '\n';
    exportText += '='.repeat(50) + '\n\n';
    
    results.forEach((result, index) => {
        const title = result.querySelector('.result-title')?.textContent || 'No Title';
        const content = result.querySelector('.result-content')?.textContent || 'No Content';
        const law = result.querySelector('.law-badge')?.textContent || 'Unknown Law';
        const section = result.querySelector('.section-number')?.textContent || 'N/A';
        
        exportText += `Result ${index + 1}\n`;
        exportText += `Title: ${title}\n`;
        exportText += `Law: ${law}\n`;
        exportText += `Section: ${section}\n`;
        exportText += `Content: ${content.substring(0, 200)}...\n`;
        exportText += '-'.repeat(50) + '\n\n';
    });
    
    // Create blob and download
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legal-search-results-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Results exported successfully', 'success', 'Export Complete');
}

function printSearchResults() {
    const originalContent = document.body.innerHTML;
    const printContent = document.getElementById('searchResults')?.innerHTML;
    
    if (!printContent) {
        showToast('No results to print', 'warning', 'Print Error');
        return;
    }
    
    document.body.innerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Legal Search Results</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .result-card { border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; }
                .result-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; }
                .result-content { margin-bottom: 10px; line-height: 1.5; }
                .law-badge, .category-badge { 
                    background: #1E3A8A; color: white; padding: 3px 8px; 
                    border-radius: 12px; font-size: 12px; margin-right: 5px;
                }
            </style>
        </head>
        <body>
            <h1>Legal Search Results</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <hr>
            ${printContent}
        </body>
        </html>
    `;
    
    window.print();
    document.body.innerHTML = originalContent;
    
    // Re-initialize the page
    showPage('search');
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Only register shortcuts when user is not typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        // Ctrl/Cmd + K for search focus
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showPage('search');
            setTimeout(() => {
                const searchInput = document.getElementById('searchQuery');
                if (searchInput) searchInput.focus();
            }, 100);
        }
        
        // Ctrl/Cmd + U for upload
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            showPage('upload');
        }
        
        // Ctrl/Cmd + D for documents
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            showPage('documents');
        }
        
        // Ctrl/Cmd + H for dashboard
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            showPage('dashboard');
        }
        
        // Ctrl/Cmd + A for AI modal
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            if (currentViewData) {
                askQuestionAboutDocument(currentViewData.id);
            } else {
                askAIQuestionDirect('');
            }
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            closeModal();
            closeAIModal();
            closeAdvancedSearch();
            closeSummaryModal();
        }
        
        // Ctrl+Enter for advanced search
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            showAdvancedSearch();
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    console.log('Initializing Legal AI System...');
    
    // Check authentication on page load
    checkAuth();
    
    // Setup navigation
    setupNavigation();
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup search input enter key listener
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Setup AI question input enter key listener
    const aiQuestionInput = document.getElementById('aiQuestion');
    if (aiQuestionInput) {
        aiQuestionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                submitAIQuestion();
            }
        });
    }
    
    // Setup documents search input
    const documentsSearch = document.getElementById('documentsSearch');
    if (documentsSearch) {
        documentsSearch.addEventListener('input', debounce(searchDocuments, 300));
    }
    
    // Add beforeunload event to warn about unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (selectedFiles.length > 0) {
            e.preventDefault();
            e.returnValue = 'You have unsaved files. Are you sure you want to leave?';
        }
    });
    
    // Auto-save session data periodically
    setInterval(saveSessionData, 30000);
    
    // Load session data
    setTimeout(loadSessionData, 500);
    
    // Check if backend is running
    try {
        const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
        if (healthResponse.ok) {
            console.log('✅ Backend is running');
        } else {
            console.warn('⚠️ Backend may not be running properly');
            showToast('Backend connection issue detected', 'warning', 'System Warning');
        }
    } catch (error) {
        console.error('❌ Cannot connect to backend:', error);
        showToast('Cannot connect to backend server. Make sure it\'s running on http://localhost:8000', 'error', 'Connection Error');
    }
    
    // Show loading screen for a moment on initial load
    showLoading(true, 'Loading Legal AI System...');
    setTimeout(() => {
        showLoading(false);
        
        // If user is logged in, show dashboard
        if (currentUser) {
            loadDashboard();
        }
        
        // Check for URL parameters
        const queryParam = getQueryParam('q');
        if (queryParam) {
            const searchInput = document.getElementById('searchQuery');
            if (searchInput) {
                searchInput.value = queryParam;
                showPage('search');
                setTimeout(() => performSearch(), 500);
            }
        }
    }, 1000);
    
    console.log('Legal AI System initialized successfully');
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Also initialize if DOM is already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    init();
}