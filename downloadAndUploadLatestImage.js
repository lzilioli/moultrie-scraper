const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file

// Import your existing helper function
const downloadRecentImages = require('./downloadRecentImages');

// Parse command-line arguments
const args = process.argv.slice(2);
const noRefresh = args.includes('--no-refresh');

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}

(async () => {
  try {
    // Credentials and API Key from environment variables
    const username = process.env.MOULTRIE_EMAIL;
    const password = process.env.MOULTRIE_PASSWORD;
    const pushcutApiKey = process.env.PUSHCUT_API_KEY;
    const imageNameForUpload = process.env.MOULTRIE_LATEST_IMAGE_NAME || 'MoultrieLatest.jpeg';

    if (!username || !password || !pushcutApiKey) {
      console.error(
        'Missing MOULTRIE_EMAIL, MOULTRIE_PASSWORD, or PUSHCUT_API_KEY in environment variables.'
      );
      process.exit(1);
    }

    // Ensure 'recent images' directory exists
    const imagesFolder = path.resolve(__dirname, 'recent images');
    await fs.ensureDir(imagesFolder);

    // Conditionally call your existing helper function to download recent images
    if (!noRefresh) {
      await downloadRecentImages();
      console.log('Downloaded recent images using helper function.');
    } else {
      console.log('Skipping image download as per --no-refresh flag.');
    }

    // Find the most recently downloaded image
    const files = await fs.readdir(imagesFolder);

    if (files.length === 0) {
      console.error('No images found in the recent images directory.');
      return;
    }

    // Filter image files and sort alphabetically (YYYY-MM-DD@HH:MM:SS.jpg sorts chronologically)
    const imageFiles = files
      .filter(file => file.endsWith('.jpg') && file.indexOf('.DS_Store') === -1)
      .sort(); // Alphabetical sort = chronological sort for this format

    if (imageFiles.length === 0) {
      console.error('No image files found.');
      return;
    }

    // Get the last (newest) file alphabetically
    const latestFilename = imageFiles[imageFiles.length - 1];
    const latestImage = path.join(imagesFolder, latestFilename);
    console.log(`Selected newest image: ${latestFilename}`);

    console.log(`Latest image identified: ${latestImage}`);

    // Read the image file
    const imageBuffer = await fs.readFile(latestImage);

    // Get the filename
    const filename = path.basename(latestImage);

    // Determine the MIME type
    const mimeType = getMimeType(filename);

    // Upload the image to Pushcut
    console.log('Uploading image to Pushcut...');

    const response = await axios.put(
      `https://api.pushcut.io/v1/images/${imageNameForUpload}`,
      imageBuffer,
      {
        headers: {
          'API-Key': pushcutApiKey,
          'Content-Type': mimeType,
        },
      }
    );

    // Accept HTTP status codes 200, 201, and 204 as success
    if (
      response.status === 200 ||
      response.status === 201 ||
      response.status === 204
    ) {
      console.log('Image uploaded to Pushcut successfully.');
    } else {
      console.error(
        'Failed to upload image to Pushcut:',
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error(
      'Error:',
      error.response ? error.response.data : error.message
    );
  }
})();
