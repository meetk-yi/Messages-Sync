const { chromium } = require('playwright');
require('dotenv').config();

async function scrapeTeamsMessages() {
    const userDataDir = process.env.USER_DATA_DIR || './user_data';
    const headless = process.env.HEADLESS === 'true';
    const channelUrl = process.env.TEAMS_CHANNEL_URL;

    console.log('🚀 Starting browser...');
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: headless,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const page = await context.newPage();
    
    try {
        console.log(`🌐 Navigating to channel: ${channelUrl}`);
        await page.goto(channelUrl, { waitUntil: 'networkidle' });

        // Check if we are at the login page
        if (page.url().includes('login.microsoftonline.com')) {
            console.log('⚠️ Authentication required. Please log in manually in the browser window.');
            console.log('Waiting for you to complete login and 2FA...');
            
            // Wait for the app to load (indicated by the presence of the main navigation or specific Teams elements)
            await page.waitForSelector('[data-tid="team-name-text"], #teams-app-container', { timeout: 0 });
            console.log('✅ Login detected!');
        }

        console.log('⏳ Waiting for messages to load...');
        // Broad selectors to cover both Enterprise Channels and Personal Chats
        const messageSelector = '[data-tid="message-pane-list-item"], [data-tid="chat-item"], .ui-chat__item'; 
        await page.waitForSelector(messageSelector, { timeout: 60000 });

        console.log('📊 Scraping messages...');
        const messages = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('[data-tid="message-pane-list-item"], [data-tid="chat-item"], .ui-chat__item'));
            return items.map(item => {
                // 1. Extract Author/Sender (Common in Chats)
                const authorEl = item.querySelector('[data-tid="message-author"]') || 
                                item.querySelector('.ui-chat__message__author') ||
                                item.querySelector('[class*="author"]');
                
                // 2. Extract Title/Subject (Common in Channels)
                const titleEl = item.querySelector('[data-tid="message-subject"]') || 
                               item.querySelector('.ui-chat__message__header') ||
                               item.querySelector('b');
                               
                // 3. Extract Body
                const bodyEl = item.querySelector('[data-tid="message-body"]') || 
                              item.querySelector('.ui-chat__message__content') ||
                              item.querySelector('.message-body-container') ||
                              item.querySelector('[class*="message-body"]');
                
                // 4. Extract Timestamp
                const timeEl = item.querySelector('time') || 
                              item.querySelector('[data-tid="message-timestamp"]');
                
                // For Chats, we use the Author as the Title if no Subject exists
                const finalTitle = titleEl ? titleEl.innerText.trim() : (authorEl ? authorEl.innerText.trim() : 'Chat Message');

                return {
                    id: item.getAttribute('data-id') || item.getAttribute('id') || Math.random().toString(36),
                    title: finalTitle,
                    description: bodyEl ? bodyEl.innerText.trim() : 'No Content',
                    timestamp: timeEl ? (timeEl.getAttribute('datetime') || timeEl.innerText) : new Date().toISOString(),
                    link: window.location.href // Chats usually don't have direct message links like Channels
                };
            });
        });

        console.log(`✅ Scraped ${messages.length} messages.`);
        return messages;

    } catch (error) {
        console.error('❌ Error during scraping:', error);
        throw error;
    } finally {
        // Keep browser open if manual login is needed, otherwise close
        if (!page.url().includes('login')) {
            await context.close();
        }
    }
}

module.exports = { scrapeTeamsMessages };
