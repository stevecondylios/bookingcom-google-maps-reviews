// Extract property name and location from Booking.com page
function extractPropertyInfo() {
  // Find the property name using the stable ID
  const nameElement = document.querySelector('#hp_hotel_name_reviews');
  if (!nameElement) {
    console.warn('Hotel name element not found');
    return null;
  }

  const propertyName = nameElement.textContent.trim();
  if (!propertyName) {
    console.warn('Hotel name is empty');
    return null;
  }

  // Find the address using the robust approach: find map link, then nearest button
  // 1. Find the map link (very stable on Booking pages)
  const mapLink = document.querySelector('a[data-atlas-latlng], a[title*="Check location"]');
  if (!mapLink) {
    console.warn('Map link not found');
    return null;
  }

  // 2. Find the nearest button containing the address
  const container = mapLink.closest('div');
  const button = container?.querySelector('button');
  if (!button) {
    console.warn('Address button not found');
    return null;
  }

  // 3. Extract only the first line (address)
  const address = button.innerText
    .split('\n')
    .map(s => s.trim())
    .find(Boolean);

  if (!address) {
    console.warn('Address text is empty');
    return null;
  }

  // Extract just the city and country (after the last comma)
  const parts = address.split(',');
  if (parts.length < 2) {
    console.warn('Address does not contain enough parts');
    return null;
  }

  const location = parts.slice(-2).join(',').trim();

  return {
    propertyName,
    location,
    fullQuery: `${propertyName}, ${location}`
  };
}

// Create and insert the Google Maps button
function addGoogleMapsButton() {
  const info = extractPropertyInfo();
  if (!info) {
    console.log('Could not extract property information');
    return;
  }

  // Create Google Maps URL
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.fullQuery)}`;

  // Find the container with wishlist and share buttons
  const shareContainer = document.querySelector('.property_share_wrapper');
  if (!shareContainer) {
    console.log('Could not find share container');
    return;
  }

  // Create the button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'google-maps-button-container';

  // Create the link/button
  const link = document.createElement('a');
  link.href = mapsUrl;
  link.target = '_blank';
  link.className = 'google-maps-button';
  link.setAttribute('aria-label', 'View on Google Maps');
  link.title = 'View on Google Maps';

  // Set a flag when clicked so the Maps page knows to auto-open reviews
  link.addEventListener('click', () => {
    chrome.storage.local.set({
      autoOpenReviews: true,
      timestamp: Date.now()
    });
  });

  // Create the SVG icon (Google Maps style pin)
  link.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle fill="#FFFFFF" cx="12" cy="9" r="2.5"/>
    </svg>
  `;

  buttonContainer.appendChild(link);

  // Insert after the share button
  shareContainer.parentNode.insertBefore(buttonContainer, shareContainer.nextSibling);

  console.log('Google Maps button added for:', info.fullQuery);
}

// Wait for the page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addGoogleMapsButton);
} else {
  addGoogleMapsButton();
}

// Also observe for dynamic content changes
const observer = new MutationObserver(() => {
  if (!document.querySelector('.google-maps-button-container')) {
    addGoogleMapsButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
