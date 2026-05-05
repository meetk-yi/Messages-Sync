const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

async function appendToSheet(data) {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error('❌ credentials.json not found! Please place your Google Service Account key in the project root.');
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = `${process.env.SHEET_NAME}!A:D`;

    // Convert message objects to rows
    const rows = data.map(msg => [
        msg.timestamp,
        msg.title,
        msg.description,
        msg.link
    ]);

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values: rows },
        });
        console.log(`✅ Appended ${rows.length} rows to Google Sheet.`);
        return response;
    } catch (error) {
        console.error('❌ Error appending to Google Sheet:', error);
        throw error;
    }
}

module.exports = { appendToSheet };
