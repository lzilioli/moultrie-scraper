// server.js

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
dotenv.config();

const downloadRecentImages = require('./downloadRecentImages');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Folder where images are saved
const imagesFolder = path.resolve(__dirname, 'recent images');

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

async function uploadLatestImageToPushcut() {
  const pushcutApiKey = process.env.PUSHCUT_API_KEY;
  const imageNameForUpload = process.env.MOULTRIE_LATEST_IMAGE_NAME || 'MoultrieLatest.jpeg';

  if (!pushcutApiKey) {
    throw new Error('Missing PUSHCUT_API_KEY in environment variables.');
  }

  // Find the most recently downloaded image
  const files = await fs.readdir(imagesFolder);

  if (files.length === 0) {
    throw new Error('No images found in the recent images directory.');
  }

  // Filter image files and sort alphabetically (YYYY-MM-DD@HH:MM:SS.jpg sorts chronologically)
  const imageFiles = files
    .filter(file => file.endsWith('.jpg') && file.indexOf('.DS_Store') === -1)
    .sort(); // Alphabetical sort = chronological sort for this format

  if (imageFiles.length === 0) {
    throw new Error('No image files found.');
  }

  // Get the last (newest) file alphabetically
  const latestFilename = imageFiles[imageFiles.length - 1];
  const latestImage = path.join(imagesFolder, latestFilename);

  // Read the image file
  const imageBuffer = await fs.readFile(latestImage);

  // Get the filename
  const filename = path.basename(latestImage);

  // Determine the MIME type
  const mimeType = getMimeType(filename);

  // Upload the image to Pushcut
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
  if (response.status === 200 || response.status === 201 || response.status === 204) {
    return { success: true, filename: latestFilename, message: 'Image uploaded to Pushcut successfully.' };
  } else {
    throw new Error(`Failed to upload image to Pushcut: ${response.status} ${response.statusText}`);
  }
}

// Function to get the latest image file
async function getLatestImageFile() {
  try {
    // Ensure the images folder exists
    await fs.ensureDir(imagesFolder);

    // Read all image files in the folder
    const files = await fs.readdir(imagesFolder);

    // Filter out non-image files and sort them in descending order
    const imageFiles = files
      .filter(file => file.endsWith('.jpg'))
      .sort((a, b) => b.localeCompare(a));

    if (imageFiles.length === 0) {
      return null;
    }

    // Get the latest image
    const latestImage = imageFiles[0];
    const imagePath = path.join(imagesFolder, latestImage);

    return imagePath;

  } catch (error) {
    console.error('Error getting the latest image file:', error);
    return null;
  }
}

// Endpoint to refresh images (download latest and optionally upload to Pushcut)
app.get('/refresh', async (req, res) => {
  try {
    const uploadToPushcut = req.query.pushcut === 'true';
    
    console.log('Starting manual refresh job...');
    
    // Download recent images
    await downloadRecentImages();
    console.log('Downloaded recent images successfully.');
    
    let result = {
      success: true,
      message: 'Images downloaded successfully.',
      downloadComplete: true
    };
    
    // Optionally upload to Pushcut
    if (uploadToPushcut) {
      const uploadResult = await uploadLatestImageToPushcut();
      result.pushcutUpload = uploadResult;
      result.message += ` ${uploadResult.message}`;
    }
    
    console.log('Manual refresh job completed.');
    res.json(result);
    
  } catch (error) {
    console.error('Error in manual refresh job:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint to get the latest image
app.get('/latest-image', async (req, res) => {
  try {
    // Get the latest image file
    const imagePath = await getLatestImageFile();

    if (!imagePath) {
      return res.status(404).send('No images available at the moment.');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg');

    // Stream the image to the client
    const stream = fs.createReadStream(imagePath);
    stream.pipe(res);

  } catch (error) {
    console.error('Error serving the latest image:', error);
    res.status(500).send('Server error.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);

  // Start the image download job immediately upon server startup
  scheduleImageDownloadJob();
});

// Function to schedule the image download job
function scheduleImageDownloadJob() {
  // Run the job immediately upon startup
  downloadRecentImagesWrapper();

  // Schedule the job to run every hour (3600000 milliseconds)
  setInterval(() => {
    downloadRecentImagesWrapper();
  }, 3600000);
}

// Wrapper function for downloadRecentImages with error handling
async function downloadRecentImagesWrapper() {
  try {
    console.log('Starting image download job...');
    await downloadRecentImages();
    console.log('Image download job completed.');
  } catch (error) {
    console.error('Error in image download job:', error);
  }
}
