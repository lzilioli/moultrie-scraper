// server.js

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
dotenv.config();

const downloadRecentImages = require('./downloadRecentImages');
const axios = require('axios');

const app = express();
const port = process.env.GALLERY_PORT || process.env.PORT || 59526;

// Folder where images are saved
const imagesFolder = path.resolve(__dirname, 'recent images');

// Gallery page (zland.brainya.cc), loaded once at startup.
const GALLERY_PAGE = fs.readFileSync(path.join(__dirname, 'gallery.html'), 'utf8');

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

// ----------------------------------------------------------------------------
// Gallery (zland.brainya.cc) — read-only browser for the downloaded assets.
// ----------------------------------------------------------------------------

// Return all image filenames, newest first. Filenames use the format
// YYYY-MM-DD@HH:MM:SS.jpg, so a descending string sort is chronological.
async function listImages() {
  await fs.ensureDir(imagesFolder);
  const files = await fs.readdir(imagesFolder);
  return files
    .filter(f => f.endsWith('.jpg') && !f.startsWith('.'))
    .sort((a, b) => b.localeCompare(a));
}

// JSON list of every image, newest first.
app.get('/api/images', async (req, res) => {
  try {
    const images = await listImages();
    res.json({ count: images.length, images });
  } catch (err) {
    console.error('Error listing images:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve a single image. Guard against path traversal — only ever read a bare
// filename out of the images folder.
app.get('/img/:name', async (req, res) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.jpg')) {
    return res.status(400).send('Unsupported file type.');
  }
  const filePath = path.join(imagesFolder, name);
  if (!(await fs.pathExists(filePath))) {
    return res.status(404).send('Not found.');
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
});

// The single-page gallery UI.
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(GALLERY_PAGE);
});

// /.well-known/launcher — manifest consumed by the brainya.cc launcher. zland
// exposes no nav links, just the 3 most recent images as card thumbnails. URLs
// are relative; the launcher resolves them against this service's origin.
app.get('/.well-known/launcher', async (req, res) => {
  try {
    const images = await listImages(); // newest first
    const recent = images.slice(0, 3).map(name => {
      const base = name.replace(/\.jpg$/, '');  // 2026-05-23@01:23:00
      const d = new Date(base.replace('@', 'T'));
      const node = {
        url: '/img/' + encodeURIComponent(name),
        href: '/#' + encodeURIComponent(name), // gallery page w/ lightbox (chrome), not the raw file
        id: base,
      };
      if (!isNaN(d.getTime())) {
        node.timestamp = d.getTime();
        node.title = d.toLocaleString('en-US',
          { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      } else {
        node.title = base;
      }
      return node;
    });
    res.json({ service: { name: 'zland', kind: 'zland' }, images: recent });
  } catch (err) {
    console.error('Error building launcher manifest:', err);
    res.status(500).json({ error: err.message });
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

// Wrapper for the hourly job: download recent images, then upload the latest to
// Pushcut. Each step is guarded so a Pushcut failure never stops future runs and
// a download failure skips the upload (rather than re-pushing a stale image).
async function downloadRecentImagesWrapper() {
  try {
    console.log('Starting image download job...');
    await downloadRecentImages();
    console.log('Image download job completed.');
  } catch (error) {
    console.error('Error in image download job:', error);
    return;
  }

  try {
    const result = await uploadLatestImageToPushcut();
    console.log(`Pushcut upload: ${result.message} (${result.filename})`);
  } catch (error) {
    console.error('Error uploading to Pushcut:', error.message);
  }
}
