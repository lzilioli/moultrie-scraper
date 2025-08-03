# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js web scraper that automates downloading images from Moultrie Mobile trail cameras. The project consists of three main components:

1. **Web Scraper** (`downloadRecentImages.js`) - Puppeteer-based scraper that logs into Moultrie Mobile and downloads the 5 most recent images
2. **Upload Utility** (`downloadAndUploadLatestImage.js`) - Downloads images and uploads the latest to Pushcut API
3. **Express Server** (`server.js`) - HTTP server that serves the latest image and runs periodic download jobs

## Environment Configuration

The project requires a `.env` file with the following variables:
- `MOULTRIE_EMAIL` - Moultrie Mobile account email
- `MOULTRIE_PASSWORD` - Moultrie Mobile account password  
- `PUSHCUT_API_KEY` - API key for Pushcut service
- `MOULTRIE_LATEST_IMAGE_NAME` - Image filename for Pushcut upload (defaults to "MoultrieLatest.jpeg")
- `DEBUG` - Set to `moultrie:scraper` for debug logging
- `MOULTRIE_HEADLESS_OFF` - Set to disable headless mode for debugging
- `PORT` - Server port (defaults to 3000)

## Development Commands

- `node downloadRecentImages.js` - Run the image scraper once
- `node downloadAndUploadLatestImage.js` - Download images and upload latest to Pushcut
- `node downloadAndUploadLatestImage.js --no-refresh` - Upload latest image without downloading new ones
- `node server.js` - Start the Express server with hourly image downloads
- `npm install` - Install dependencies

## Architecture

- **Node Version**: 18 (specified in `.nvmrc`)
- **Key Dependencies**: puppeteer, express, axios, fs-extra, debug, dotenv
- **Image Storage**: `recent images/` directory with format `YYYY-MM-DD@HH:MM:SS.jpg`
- **Debug Output**: `debug/` directory contains screenshots and HTML dumps for troubleshooting
- **Scraping Strategy**: Uses CSS selectors `.gallery-wrapper` and `.image-item` to locate images, extracts URLs by removing query parameters for full-size versions

## Testing and Debugging

Set `DEBUG=moultrie:scraper` environment variable for detailed logging. The scraper saves debugging screenshots and HTML to the `debug/` folder at each step of the process.

Use `MOULTRIE_HEADLESS_OFF=1` to run Puppeteer in non-headless mode for visual debugging.

## File Structure

- Main scripts are in the root directory
- Images downloaded to `recent images/` (sorted chronologically by filename)
- Debug artifacts saved to `debug/`
- Configuration templates in `.env.sample`
- No tests are currently implemented

## Search Tools Note

When searching code, use `ag` (the silver searcher), not `rg` as it's not available on this system.