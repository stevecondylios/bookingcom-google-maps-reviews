// Check if we're in map view
function isMapView() {
  return window.location.hash === '#map_opened';
}

// Extract city name from URL (e.g., ss=da+nang or ss=Paris)
function extractCityFromUrl() {
  const url = new URL(window.location.href);
  const ssParam = url.searchParams.get('ss');
  if (ssParam) {
    // Replace + and %20 with spaces, clean up
    return ssParam.replace(/\+/g, ' ').trim();
  }
  return null;
}

// Extract property info from the map view info window
function extractPropertyInfoFromMapCard(infoWindow) {
  // Find hotel name using the header-title data-testid (robust selector)
  const titleElement = infoWindow.querySelector('[data-testid="header-title"]');
  if (!titleElement) {
    console.warn('Map card: Hotel title element not found');
    return null;
  }

  // Get text content, stripping any extra whitespace
  const propertyName = titleElement.textContent.trim();
  if (!propertyName) {
    console.warn('Map card: Hotel name is empty');
    return null;
  }

  // Get city from URL
  const city = extractCityFromUrl();
  if (!city) {
    console.warn('Map card: Could not extract city from URL');
    return null;
  }

  return {
    propertyName,
    location: city,
    fullQuery: `${propertyName}, ${city}`
  };
}

// Extract property name and location from Booking.com hotel page
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

// Create a Google Maps button element
function createGoogleMapsButton(info, isMapViewButton = false) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.fullQuery)}`;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = isMapViewButton 
    ? 'google-maps-button-container google-maps-button-map-view' 
    : 'google-maps-button-container';

  const link = document.createElement('a');
  link.href = mapsUrl;
  link.target = '_blank';
  link.className = 'google-maps-button';
  link.setAttribute('aria-label', 'View on Google Maps');
  link.title = 'View on Google Maps';

  // Set a flag when clicked so the Maps page knows to auto-open reviews
  link.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering the card's click handler
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
  return buttonContainer;
}

// Add button to map view info window
function addGoogleMapsButtonToMapCard(infoWindow) {
  // Check if button already exists in this info window
  if (infoWindow.querySelector('.google-maps-button-container')) {
    return;
  }

  const info = extractPropertyInfoFromMapCard(infoWindow);
  if (!info) {
    console.log('Map view: Could not extract property information');
    return;
  }

  // Find the header container to insert the button
  const headerContainer = infoWindow.querySelector('[data-testid="header-container"]');
  if (!headerContainer) {
    console.log('Map view: Could not find header container');
    return;
  }

  const buttonContainer = createGoogleMapsButton(info, true);
  headerContainer.appendChild(buttonContainer);

  console.log('Google Maps button added to map card for:', info.fullQuery);
}

// Create and insert the Google Maps button on hotel page
function addGoogleMapsButton() {
  const info = extractPropertyInfo();
  if (!info) {
    console.log('Could not extract property information');
    return;
  }

  // Find the container with wishlist and share buttons
  const shareContainer = document.querySelector('.property_share_wrapper');
  if (!shareContainer) {
    console.log('Could not find share container');
    return;
  }

  const buttonContainer = createGoogleMapsButton(info, false);

  // Insert after the share button
  shareContainer.parentNode.insertBefore(buttonContainer, shareContainer.nextSibling);

  console.log('Google Maps button added for:', info.fullQuery);
}

// Handle map view info windows
function handleMapView() {
  // Find all info windows and add buttons to them
  const infoWindows = document.querySelectorAll('[data-testid="info-window-wrapper"]');
  infoWindows.forEach(addGoogleMapsButtonToMapCard);
}

// Initialize based on page type
function initialize() {
  if (isMapView()) {
    handleMapView();
  } else {
    // Regular hotel page
    if (!document.querySelector('.google-maps-button-container')) {
      addGoogleMapsButton();
    }
  }
}

// Wait for the page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Observe for dynamic content changes (both hotel pages and map view info windows)
const observer = new MutationObserver(() => {
  if (isMapView()) {
    // In map view, check for new info windows
    handleMapView();
  } else {
    // On hotel page, add button if missing
    if (!document.querySelector('.google-maps-button-container')) {
      addGoogleMapsButton();
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also listen for hash changes (switching to/from map view)
window.addEventListener('hashchange', initialize);
