/**
 * theme.js
 * Handles theme toggling for legal/support pages.
 * 
 * Logic:
 * 1. Checks localStorage for 'theme'.
 * 2. Applies 'dark-mode' class to body if 'dark'.
 * 3. Toggles theme on button click and updates localStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    // Function to sync icons
    function syncIcons() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        if (isDark) {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    // Initial sync (in case the class was added by the early script)
    syncIcons();

    // 2. Add Event Listener
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            const isDark = document.documentElement.classList.contains('dark-mode');

            // Save preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');

            // Update Icons
            syncIcons();
        });
    }
});
