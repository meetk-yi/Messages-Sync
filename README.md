# Microsoft Teams to Google Sheets Sync

Automated script to scrape new messages from a Teams channel and store them in Google Sheets.

## Features
- **2FA Support**: Uses persistent browser profiles.
- **Deduplication**: Only syncs messages since the last run.
- **Headless Mode**: Can run in the background.

## Prerequisites
1. **Node.js** installed.
2. **Google Cloud Service Account**:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/).
   - Enable **Google Sheets API**.
   - Create a **Service Account**, download the JSON key, and rename it to `credentials.json` in this folder.
   - **Share** your Google Sheet with the Service Account email (found in the JSON).
3. **Teams Channel URL**: Get the link to the specific channel you want to monitor.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   - Copy `.env.example` to `.env`.
   - Fill in `TEAMS_CHANNEL_URL` and `SPREADSHEET_ID`.

3. **Initial Login (Mandatory)**:
   Teams has strict 2FA. You need to log in manually once to save your session.
   - Set `HEADLESS=false` in `.env`.
   - Run the script: `node index.js`.
   - A browser window will open. Log in to Teams and complete 2FA.
   - Once the messages load, the script will finish and save your session to `./user_data`.
   - Subsequent runs can use `HEADLESS=true`.

## Usage
Run on-demand:
```bash
node index.js
```

## State Management
The script stores the timestamp of the last synced message in `state.json`. To re-sync old messages, delete this file or modify the timestamp.
