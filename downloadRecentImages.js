// downloadRecentImages.js

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const debug = require('debug')('moultrie:scraper');
require('dotenv').config();

async function downloadRecentImages() {
  // Credentials - replace with your actual credentials or use environment variables
  const username = process.env.MOULTRIE_EMAIL;    // Replace with your email
  const password = process.env.MOULTRIE_PASSWORD; // Replace with your password

  debug('Starting image download process');
  debug('Username configured: %s', username ? 'Yes' : 'No');
  debug('Password configured: %s', password ? 'Yes' : 'No');

  // Folder to save images
  const imagesFolder = path.resolve(__dirname, 'recent images');
  await fs.ensureDir(imagesFolder);

  // Create debug folder for screenshots and HTML
  const debugFolder = path.resolve(__dirname, 'debug');
  await fs.ensureDir(debugFolder);

  // Launch the browser
  const isDebugMode = process.env.DEBUG && process.env.DEBUG.includes('moultrie');
  const browser = await puppeteer.launch({
    headless: !process.env.MOULTRIE_HEADLESS_OFF,
    defaultViewport: null,
    devtools: isDebugMode,
  });
  
  debug('Browser launched in %s mode', process.env.MOULTRIE_HEADLESS_OFF ? 'non-headless' : 'headless');

  try {
    const page = await browser.newPage();

    // 1. Navigate to the Moultrie Mobile web page, which redirects to login
    debug('Navigating to Moultrie Mobile web page');
    await page.goto('https://web.moultriemobile.com/', { waitUntil: 'networkidle2' });
    console.log('Navigated to Moultrie Mobile web page');
    
    // Take screenshot for debugging
    await page.screenshot({ path: path.join(debugFolder, '01-initial-page.png') });
    debug('Screenshot saved: 01-initial-page.png');

    // 2. Wait for the login page to load
    debug('Waiting for login form');
    await page.waitForSelector('input#signInName', { visible: true });
    await page.screenshot({ path: path.join(debugFolder, '02-login-page.png') });
    debug('Login form found and screenshot saved');

    // 3. Fill in the login credentials
    debug('Filling login credentials');
    await page.type('input#signInName', username, { delay: 50 });
    await page.type('input#password', password, { delay: 50 });
    console.log('Entered login credentials');
    await page.screenshot({ path: path.join(debugFolder, '03-credentials-entered.png') });

    // 4. Submit the login form
    debug('Submitting login form');
    await Promise.all([
      page.click('button#next'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('Logged in successfully');
    await page.screenshot({ path: path.join(debugFolder, '04-logged-in.png') });
    debug('Login successful, screenshot saved');

    // 5. Wait for the gallery to load (it loads after authentication automatically)
    debug('Waiting for gallery to load after authentication');
    
    // The site redirects automatically after login, so we just wait for the gallery to appear
    await page.waitForSelector('.gallery-wrapper', { visible: true, timeout: 15000 });
    debug('Gallery wrapper found');
    console.log('Gallery loaded successfully');
    
    // Save page HTML for analysis
    const pageHtml = await page.content();
    await fs.writeFile(path.join(debugFolder, '05-gallery-page.html'), pageHtml);
    await page.screenshot({ path: path.join(debugFolder, '05-gallery-page.png') });
    debug('Gallery page HTML and screenshot saved');

    // 6. Wait for image items to load
    debug('Waiting for image items to load');
    await page.waitForSelector('.image-item', { visible: true, timeout: 10000 });
    
    const imageElements = await page.$$('.image-item');
    debug('Found %d image items', imageElements.length);
    
    console.log(`Images loaded: found ${imageElements.length} image items`);

    // 7. Extract image data from .image-item elements
    debug('Extracting image data from .image-item elements');
    
    const imagesData = await page.evaluate(() => {
      // Select all image item containers
      const containers = document.querySelectorAll('.image-item');
      console.log('Found image items:', containers.length);

      // Prepare an array to hold image data
      const data = [];
      const debugInfo = [];

      // Loop over the containers
      containers.forEach((container, index) => {
        console.log(`Processing image item ${index}`);
        
        // Get the main image element
        const imgElement = container.querySelector('.main-image');
        if (!imgElement || !imgElement.src) {
          debugInfo.push({ container: index, issue: 'No main-image found' });
          return;
        }

        // Remove w= and h= parameters to get full-size image
        const thumbnailUrl = imgElement.src;
        const imageUrl = thumbnailUrl.split('?')[0]; // Remove query parameters for full size
        
        console.log(`Thumbnail: ${thumbnailUrl}`);
        console.log(`Full-size: ${imageUrl}`);
        
        // Extract date from filename
        // Format: 1082938-20250803163445-100MFCAM_MFDC1935.jpg
        // We need: 20250803163445
        const filename = imageUrl.split('/').pop();
        const dateMatch = filename.match(/-([0-9]{14})-/);
        
        if (!dateMatch) {
          debugInfo.push({ container: index, issue: 'Could not extract date from filename', filename });
          return;
        }
        
        const dateTimeString = dateMatch[1]; // e.g., "20250803163445"
        // Convert to readable format: "08/03/2025 at 4:34 PM"
        const year = dateTimeString.substring(0, 4);
        const month = dateTimeString.substring(4, 6);
        const day = dateTimeString.substring(6, 8);
        const hour = parseInt(dateTimeString.substring(8, 10));
        const minute = dateTimeString.substring(10, 12);
        const second = dateTimeString.substring(12, 14);
        
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        
        const dateTimeText = `${month}/${day}/${year} at ${displayHour}:${minute} ${ampm}`;
        
        debugInfo.push({
          container: index,
          thumbnailUrl: thumbnailUrl,
          imageUrl: imageUrl,
          filename: filename,
          extractedDateTime: dateTimeString,
          formattedDateTime: dateTimeText
        });
        
        // Add to the data array
        data.push({
          imageUrl,
          dateTimeText,
        });
      });

      // Return both data and debug info
      return { data, debugInfo };
    });
    
    // Save debug info
    await fs.writeFile(path.join(debugFolder, '07-extraction-debug.json'), JSON.stringify(imagesData.debugInfo, null, 2));
    debug('Extraction debug info saved');
    
    const actualImagesData = imagesData.data;

    console.log(`Found ${actualImagesData.length} images`);
    debug('Images data: %o', actualImagesData.slice(0, 2)); // Log first 2 for debugging

    // 8. Sort images by timestamp (newest first) and process the last 5 images
    const sortedImages = actualImagesData.sort((a, b) => {
      // Extract timestamp from filename for comparison
      const getTimestamp = (url) => {
        const filename = url.split('/').pop();
        const match = filename.match(/-([0-9]{14})-/);
        return match ? match[1] : '0';
      };
      
      const timestampA = getTimestamp(a.imageUrl);
      const timestampB = getTimestamp(b.imageUrl);
      
      // Sort in descending order (newest first)
      return timestampB.localeCompare(timestampA);
    });
    
    debug('Sorted images by timestamp (newest first)');
    debug('First few timestamps: %o', sortedImages.slice(0, 3).map(img => {
      const filename = img.imageUrl.split('/').pop();
      const match = filename.match(/-([0-9]{14})-/);
      return { filename, timestamp: match ? match[1] : 'none', dateTime: img.dateTimeText };
    }));
    
    const maxImages = parseInt(process.env.MOULTRIE_MAX_IMAGES) || 5;
    const imagesToDownload = sortedImages.slice(0, maxImages); // Get the newest images
    console.log(`Preparing to download ${imagesToDownload.length} images (max: ${maxImages})`);

    for (const imageData of imagesToDownload) {
      const { imageUrl, dateTimeText } = imageData;

      // Format dateTimeText to "YYYY-MM-DD@HH:MM:SS" (keeping original format)
      // Example dateTimeText: "08/03/2025 at 4:34 PM"

      // Parse the date and time
      const [datePart, timePartWithAMPM] = dateTimeText.split(' at ');
      const [month, day, year] = datePart.split('/');
      const [timePart, AMPM] = timePartWithAMPM.split(' ');
      let [hour, minute] = timePart.split(':');

      // Convert strings to numbers
      let hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);

      // Convert hour to 24-hour format
      if (AMPM.toUpperCase() === 'PM' && hourNum !== 12) {
        hourNum += 12;
      }
      if (AMPM.toUpperCase() === 'AM' && hourNum === 12) {
        hourNum = 0;
      }

      // Build the formatted date string (keeping original format)
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}@${hourNum.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00`;

      const formattedFilename = formattedDate + '.jpg';
      
      debug('Processing image: %s -> %s', imageUrl.split('/').pop(), formattedFilename);

      const imagePath = path.join(imagesFolder, formattedFilename);

      // Check if the image already exists
      if (fs.existsSync(imagePath)) {
        console.log(`Image already exists: ${imagePath}`);
        continue; // Skip downloading this image
      }

      console.log(`Downloading image from ${imageUrl}`);

      // Download and save the image
      const viewSource = await page.goto(imageUrl);
      const imageBuffer = await viewSource.buffer();

      // Save the image to the folder
      await fs.writeFile(imagePath, imageBuffer);
      console.log(`Image saved as ${imagePath}`);
    }

  } catch (error) {
    console.error('Error occurred:', error.message);
    debug('Full error details: %o', error);
    
    // Save error screenshot if page exists
    try {
      if (page) {
        await page.screenshot({ path: path.join(debugFolder, 'error-screenshot.png') });
        const errorHtml = await page.content();
        await fs.writeFile(path.join(debugFolder, 'error-page.html'), errorHtml);
        debug('Error debugging info saved');
      }
    } catch (screenshotError) {
      debug('Could not save error screenshot: %s', screenshotError.message);
    }
    
    throw error; // Re-throw the error to be handled by the caller
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
      debug('Browser closed');
    }
    console.log('Browser closed');
  }
}

// Export the function
module.exports = downloadRecentImages;
