# Moultrie Trail Camera Image Scraper

A Node.js application that automatically downloads images from Moultrie Mobile trail cameras and uploads the latest image to Pushcut for use in iOS widgets.

## Features

- **Automated Scraping**: Uses Puppeteer to log into Moultrie Mobile and download recent images
- **Image Management**: Downloads and organizes the 5 most recent trail camera images
- **Pushcut Integration**: Uploads the latest image to Pushcut API for use in iOS widgets
- **Express Server**: Provides HTTP endpoint to serve the latest image
- **Scheduled Execution**: Can be configured to run automatically via macOS LaunchAgent
- **Debug Support**: Comprehensive debugging with screenshots and HTML dumps

## Prerequisites

- Node.js 18+ (see `.nvmrc`)
- macOS (for LaunchAgent scheduling)
- Moultrie Mobile account with trail camera
- Pushcut account and API key

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd moultrie-scraper
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.sample .env
   ```
   Edit `.env` with your actual credentials and configuration.

## Configuration

### Environment Variables

Copy `.env.sample` to `.env` and configure the following:

| Variable | Description | Required |
|----------|-------------|----------|
| `MOULTRIE_EMAIL` | Your Moultrie Mobile account email | Yes |
| `MOULTRIE_PASSWORD` | Your Moultrie Mobile account password | Yes |
| `PUSHCUT_API_KEY` | Your Pushcut API key from [pushcut.io/account](https://pushcut.io/account) | Yes |
| `MOULTRIE_LATEST_IMAGE_NAME` | Image filename for Pushcut upload (default: `MoultrieLatest.jpeg`) | No |
| `PORT` | Express server port (default: `3000`) | No |
| `DEBUG` | Set to `moultrie:scraper` for debug logging | No |
| `MOULTRIE_HEADLESS_OFF` | Set to `1` to disable headless mode for debugging | No |

### Pushcut Widget Setup

1. Get your API key from [pushcut.io/account](https://pushcut.io/account)
2. Create a new widget in the Pushcut app
3. Import the following widget configuration (copy and paste into Pushcut):

```json
{"type":"column","name":"ZLand Latest","properties":{"background":{"value":{"startPoint":{"x":0,"y":0},"type":"linear","colors":["rgba(13.92%, 19.02%, 15.49%, 1.00)","rgba(30.20%, 33.73%, 24.12%, 1.00)"],"endPoint":{"x":1,"y":1}},"type":"gradient","corners":null}},"children":[{"children":[{"value":{"aspectRatio":"fit","imageURL":"MoultrieLatest.jpeg"},"type":"image"}],"type":"column"}]}
```

**Note:** If you change the `MOULTRIE_LATEST_IMAGE_NAME` environment variable, update the `imageURL` in the widget JSON to match.

## Usage

### Manual Execution

**Download images and upload latest to Pushcut:**
```bash
node downloadAndUploadLatestImage.js
```

**Upload latest image without downloading new ones:**
```bash
node downloadAndUploadLatestImage.js --no-refresh
```

**Download images only:**
```bash
node downloadRecentImages.js
```

**Start the Express server (with hourly downloads):**
```bash
node server.js
```

### Automated Execution with LaunchAgent

For automated execution on macOS, set up a LaunchAgent:

1. **Create the plist file** at `~/Library/LaunchAgents/moultrie-pushcut.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
       "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Unique Label for the LaunchAgent -->
    <key>Label</key>
    <string>com.yourusername.moultrie-scraper</string>

    <!-- The command and its arguments -->
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/your/node</string>
        <string>downloadAndUploadLatestImage.js</string>
    </array>

    <!-- Set the working directory -->
    <key>WorkingDirectory</key>
    <string>/path/to/your/moultrie-scraper</string>

    <!-- Environment variables -->
    <key>EnvironmentVariables</key>
    <dict>
        <key>MOULTRIE_EMAIL</key>
        <string>your-email@example.com</string>
        <key>MOULTRIE_PASSWORD</key>
        <string>your-password</string>
        <key>PUSHCUT_API_KEY</key>
        <string>your-pushcut-api-key</string>
        <key>MOULTRIE_LATEST_IMAGE_NAME</key>
        <string>MoultrieLatest.jpeg</string>
    </dict>

    <!-- Run the script every 3600 seconds (1 hour) -->
    <key>StartInterval</key>
    <integer>3600</integer>

    <!-- Optionally run the script immediately upon loading -->
    <key>RunAtLoad</key>
    <true/>

    <!-- Redirect standard output and error to log files -->
    <key>StandardOutPath</key>
    <string>/Users/yourusername/Library/Logs/moultrie-pushcut/out.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/yourusername/Library/Logs/moultrie-pushcut/err.log</string>
</dict>
</plist>
```

2. **Update the plist with your actual paths:**
   - Find your Node.js path: `which node`
   - Update the working directory path
   - Update your username in log paths
   - Add your actual credentials

3. **Create the log directory:**
   ```bash
   mkdir -p ~/Library/Logs/moultrie-pushcut
   ```

4. **Load the LaunchAgent:**
   ```bash
   launchctl load ~/Library/LaunchAgents/moultrie-pushcut.plist
   ```

5. **Manage the LaunchAgent:**
   ```bash
   # Check if it's loaded
   launchctl list | grep moultrie-scraper
   
   # Start manually
   launchctl start com.yourusername.moultrie-scraper
   
   # Stop
   launchctl stop com.yourusername.moultrie-scraper
   
   # Unload
   launchctl unload ~/Library/LaunchAgents/moultrie-pushcut.plist
   ```

## API Endpoints

When running the Express server:

- `GET /latest-image` - Returns the most recent downloaded image as JPEG

## File Structure

```
moultrie-scraper/
├── downloadRecentImages.js      # Core scraping functionality
├── downloadAndUploadLatestImage.js  # Main script for download + upload
├── server.js                    # Express server with scheduled downloads
├── package.json                 # Node.js dependencies
├── .env.sample                  # Environment variables template
├── .env                         # Your actual environment variables (gitignored)
├── recent images/               # Downloaded images directory
├── debug/                       # Debug screenshots and HTML dumps
└── node_modules/                # Installed dependencies
```

## Debugging

1. **Enable debug logging:**
   ```bash
   DEBUG=moultrie:scraper node downloadRecentImages.js
   ```

2. **Run in non-headless mode:**
   ```bash
   MOULTRIE_HEADLESS_OFF=1 node downloadRecentImages.js
   ```

3. **Check debug artifacts:**
   - Screenshots and HTML dumps are saved in the `debug/` folder
   - Server logs are saved to the paths specified in your LaunchAgent plist

## Troubleshooting

**Common Issues:**

1. **Login fails**: Check your Moultrie Mobile credentials in `.env`
2. **Images not uploading**: Verify your Pushcut API key and image name configuration
3. **LaunchAgent not running**: Check the log files specified in your plist
4. **No images found**: Ensure your trail camera has recent images on Moultrie Mobile

**Debug Steps:**

1. Run with debug logging enabled
2. Check the `debug/` folder for screenshots showing where the process failed
3. Verify all environment variables are set correctly
4. Test manual execution before setting up automated scheduling

## Security Notes

- Never commit your `.env` file to version control
- Keep your Moultrie Mobile and Pushcut credentials secure
- Consider using environment variables in your LaunchAgent plist instead of hardcoding credentials

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]