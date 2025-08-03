// server.js

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
dotenv.config();

const downloadRecentImages = require('./downloadRecentImages');

const app = express();
const port = process.env.PORT || 3000;

// Folder where images are saved
const imagesFolder = path.resolve(__dirname, 'recent images');

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
