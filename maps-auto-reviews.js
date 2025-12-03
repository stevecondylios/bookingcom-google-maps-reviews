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

    // Function to find and click the "Newest" sort option
    function clickNewestSort() {
      // Try multiple selectors for the sort dropdown
      const sortSelectors = [
        'button[aria-label*="Sort"]',
        'button[aria-label*="sort"]',
        'button[data-value*="Sort"]',
        'button[jsaction*="pane.reviewSort"]'
      ];

      for (const selector of sortSelectors) {
        const sortButton = document.querySelector(selector);
        if (sortButton) {
          console.log('Found sort button, clicking:', selector);
          sortButton.click();

          // Wait a bit for the dropdown to appear
          setTimeout(() => {
            // Find and click "Newest" option
            const newestSelectors = [
              'div[role="menuitemradio"][data-index="1"]',
              'div[role="menuitem"]:has-text("Newest")',
              'div[data-value="Newest"]',
              '[role="menuitemradio"][aria-label*="Newest"]'
            ];

            for (const newestSelector of newestSelectors) {
              const newestOption = document.querySelector(newestSelector);
              if (newestOption) {
                console.log('Found Newest option, clicking:', newestSelector);
                newestOption.click();
                return true;
              }
            }

            // Try finding by text content in menu items
            const menuItems = document.querySelectorAll('div[role="menuitemradio"], div[role="menuitem"]');
            for (const item of menuItems) {
              if (item.textContent.trim().toLowerCase().includes('newest')) {
                console.log('Found Newest option by text content');
                item.click();
                return true;
              }
            }

            console.log('Could not find Newest option');
          }, 300);

          return true;
        }
      }

      // Try finding by text content
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent.trim().toLowerCase();
        if (text.includes('sort') || text.includes('most relevant')) {
          console.log('Found sort button by text content');
          button.click();

          setTimeout(() => {
            const menuItems = document.querySelectorAll('div[role="menuitemradio"], div[role="menuitem"]');
            for (const item of menuItems) {
              if (item.textContent.trim().toLowerCase().includes('newest')) {
                console.log('Found Newest option by text content');
                item.click();
                return true;
              }
            }
          }, 300);

          return true;
        }
      }

      return false;
    }

    let reviewsTabClicked = false;
    let sortAttempted = false;

    // Try immediately
    if (clickReviewsTab()) {
      console.log('Reviews tab clicked immediately');
      reviewsTabClicked = true;

      // Wait a bit for reviews to load, then try to change sort
      setTimeout(() => {
        clickNewestSort();
        sortAttempted = true;
      }, 1000);
    }

    // If not found, wait for the page to load and try again
    const observer = new MutationObserver(() => {
      if (!reviewsTabClicked && clickReviewsTab()) {
        console.log('Reviews tab clicked after mutation');
        reviewsTabClicked = true;

        // Wait for reviews to load, then try to change sort
        setTimeout(() => {
          if (!sortAttempted) {
            clickNewestSort();
            sortAttempted = true;
          }
        }, 1000);
      }

      // If reviews tab was clicked but sort wasn't attempted yet, keep checking
      if (reviewsTabClicked && !sortAttempted) {
        if (clickNewestSort()) {
          sortAttempted = true;
        }
      }

      // Disconnect if both actions completed
      if (reviewsTabClicked && sortAttempted) {
        observer.disconnect();
      }
    });

    // Observe for changes in the side panel area
    const targetNode = document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });

    // Give up after 15 seconds
    setTimeout(() => {
      observer.disconnect();
      console.log('Stopped looking for Reviews tab and sort button');
    }, 15000);
  });
})();
