// Auto-click the Reviews tab on Google Maps if opened from our extension
(function() {
  'use strict';

  // Check if we should auto-open reviews
  chrome.storage.local.get(['autoOpenReviews', 'timestamp'], (result) => {
    if (!result.autoOpenReviews) return;

    // Check if the flag is recent (within 5 seconds)
    const now = Date.now();
    if (now - result.timestamp > 5000) {
      // Clear old flag
      chrome.storage.local.remove(['autoOpenReviews', 'timestamp']);
      return;
    }

    // Clear the flag immediately to prevent multiple triggers
    chrome.storage.local.remove(['autoOpenReviews', 'timestamp']);

    // Function to find and click the Reviews tab
    function clickReviewsTab() {
      // Google Maps uses different selectors, try multiple approaches
      const selectors = [
        'button[aria-label*="Reviews"]',
        'button[data-value="Reviews"]',
        'button[role="tab"][aria-label*="Reviews"]',
        '[role="tab"]:has-text("Reviews")',
        'button.hh2c6[data-value="Reviews"]',
        'button[jsaction*="pane.reviewChart"]'
      ];

      for (const selector of selectors) {
        const reviewsTab = document.querySelector(selector);
        if (reviewsTab) {
          console.log('Found Reviews tab, clicking:', selector);
          reviewsTab.click();
          return true;
        }
      }

      // Try finding by text content
      const buttons = document.querySelectorAll('button[role="tab"]');
      for (const button of buttons) {
        if (button.textContent.trim().toLowerCase().includes('review')) {
          console.log('Found Reviews tab by text content');
          button.click();
          return true;
        }
      }

      return false;
    }

    // Try immediately
    if (clickReviewsTab()) {
      console.log('Reviews tab clicked immediately');
      return;
    }

    // If not found, wait for the page to load and try again
    const observer = new MutationObserver(() => {
      if (clickReviewsTab()) {
        console.log('Reviews tab clicked after mutation');
        observer.disconnect();
      }
    });

    // Observe for changes in the side panel area
    const targetNode = document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });

    // Give up after 10 seconds
    setTimeout(() => {
      observer.disconnect();
      console.log('Stopped looking for Reviews tab');
    }, 10000);
  });
})();
