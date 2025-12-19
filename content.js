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

// Cache for Apollo data to avoid re-parsing
let apolloDataCache = null;
let apolloDataCacheTime = 0;
const APOLLO_CACHE_TTL = 5000; // 5 seconds - data may update when map moves

// Recursively search an object for basicPropertyData with location
function findPropertyData(obj, propertyMap, visited = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return;

  // Prevent infinite loops with circular references
  if (visited.has(obj)) return;
  visited.add(obj);

  // Check if this object has basicPropertyData with location
  if (obj.basicPropertyData?.location?.address && obj.basicPropertyData?.pageName) {
    const loc = obj.basicPropertyData.location;
    const pageName = obj.basicPropertyData.pageName;

    propertyMap.set(pageName, {
      address: loc.address,
      city: loc.city || '',
      latitude: loc.latitude,
      longitude: loc.longitude
    });
  }

  // Recurse into all properties
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      findPropertyData(value, propertyMap, visited);
    }
  }
}

// Parse and cache Apollo JSON data from the page
function getApolloData() {
  const now = Date.now();

  // Return cached data if still valid
  if (apolloDataCache && (now - apolloDataCacheTime) < APOLLO_CACHE_TTL) {
    return apolloDataCache;
  }

  // Find the Apollo data script tag
  const scripts = document.querySelectorAll('script[type="application/json"][data-capla-store-data="apollo"]');
  const propertyMap = new Map();

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      // Recursively search the entire data structure
      findPropertyData(data, propertyMap);
    } catch (e) {
      console.warn('Failed to parse Apollo data:', e);
    }
  }

  apolloDataCache = propertyMap;
  apolloDataCacheTime = now;

  console.log('Apollo data parsed, found', propertyMap.size, 'properties');

  return propertyMap;
}

// Extract pageName from hotel URL
function extractPageNameFromUrl(url) {
  // URL format: /hotel/vn/hung-anh-danang2.en-gb.html or similar
  const match = url.match(/\/hotel\/[^/]+\/([^.]+)\./);
  return match ? match[1] : null;
}

// Extract property info from the map view info window
function extractPropertyInfoFromMapCard(infoWindow) {
  // Find hotel name using the header-title data-testid (robust selector)
  const titleElement = infoWindow.querySelector('[data-testid="header-title"]');
  if (!titleElement) {
    // Don't log - this is expected when info window is still loading
    return null;
  }

  // Get text content, stripping any extra whitespace
  const propertyName = titleElement.textContent.trim();
  if (!propertyName) {
    return null;
  }

  // Try to get address from Apollo data using the hotel link
  const hotelLink = titleElement.querySelector('a[href*="/hotel/"]');
  let address = null;
  let city = null;

  if (hotelLink) {
    const pageName = extractPageNameFromUrl(hotelLink.href);
    console.log('Map card: Looking up pageName:', pageName);

    if (pageName) {
      const apolloData = getApolloData();
      console.log('Map card: Apollo data has', apolloData.size, 'properties');

      const propertyData = apolloData.get(pageName);

      if (propertyData) {
        address = propertyData.address;
        city = propertyData.city;
        console.log('Map card: Found address:', address, ', city:', city);
      } else {
        console.log('Map card: No data found for pageName:', pageName);
      }
    }
  } else {
    console.log('Map card: No hotel link found in title element');
  }

  // Fall back to city from URL if not found in Apollo data
  if (!city) {
    city = extractCityFromUrl();
  }

  if (!city) {
    return null;
  }

  // Build the full query - include address if available
  let fullQuery;
  if (address) {
    fullQuery = `${propertyName}, ${address}, ${city}`;
  } else {
    fullQuery = `${propertyName}, ${city}`;
  }

  return {
    propertyName,
    address,
    location: city,
    fullQuery
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

  // Check if the info window has the required elements before processing
  // This prevents processing incomplete/loading info windows
  const headerContainer = infoWindow.querySelector('[data-testid="header-container"]');
  if (!headerContainer) {
    return; // Info window not fully loaded yet
  }

  const info = extractPropertyInfoFromMapCard(infoWindow);
  if (!info) {
    return; // Could not extract info, will retry on next mutation
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

// Throttle function to limit how often a function can be called
let pendingUpdate = null;
function throttledUpdate() {
  if (pendingUpdate) return;

  pendingUpdate = requestAnimationFrame(() => {
    pendingUpdate = null;

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
}

// Observe for dynamic content changes (both hotel pages and map view info windows)
const observer = new MutationObserver(throttledUpdate);

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also listen for hash changes (switching to/from map view)
window.addEventListener('hashchange', initialize);
