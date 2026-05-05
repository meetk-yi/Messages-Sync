const fs = require('fs');
const path = require('path');
const { scrapeTeamsMessages } = require('./scraper');
const { appendToSheet } = require('./sheets');
require('dotenv').config();

const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { lastRun: new Date(0).toISOString() }; // Default to beginning of time
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runSync() {
    console.log('🏁 Starting Sync Process...');
    
    try {
        const state = loadState();
        console.log(`🕒 Last run: ${state.lastRun}`);

        const messages = await scrapeTeamsMessages();
        
        // Filter messages newer than last run
        const newMessages = messages.filter(msg => {
            return new Date(msg.timestamp) > new Date(state.lastRun);
        });

        if (newMessages.length === 0) {
            console.log('📭 No new messages found since last run.');
            return;
        }

        console.log(`✨ Found ${newMessages.length} new messages.`);

        // Sort by timestamp ascending before appending
        newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        await appendToSheet(newMessages);

        // Update state with the newest message timestamp
        const latestTimestamp = newMessages[newMessages.length - 1].timestamp;
        saveState({ lastRun: latestTimestamp });
        
        console.log('🎉 Sync completed successfully!');

    } catch (error) {
        console.error('💥 Critical error during sync:', error.message);
    }
}

runSync();
