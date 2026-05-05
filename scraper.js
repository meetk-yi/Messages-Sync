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
        console.log(`🌐 Navigating to Teams...`);
        await page.goto(channelUrl, { waitUntil: 'domcontentloaded' });

        // Handle the "Download the app" splash screen
        try {
            const useWebBtn = 'button:has-text("Use the web app instead"), .use-web-app';
            await page.waitForSelector(useWebBtn, { timeout: 5000 });
            console.log('🖱️ Clicking "Use the web app instead"...');
            await page.click(useWebBtn);
        } catch (e) {
            // Button didn't appear, which is fine
        }

        // Wait a few seconds to see if we get redirected to login
        console.log('⏳ Checking authentication state...');
        
        // Race condition: Wait for either the login page OR the Teams app to load
        const loginSelector = 'input[type="email"], .login-paginated-page, #i0116';
        const appSelector = '[data-tid="team-name-text"], #teams-app-container, [data-tid="chat-item"], [data-tid="message-list"], .fui-ChatList';

        try {
            await Promise.race([
                page.waitForSelector(loginSelector, { timeout: 20000 }),
                page.waitForSelector(appSelector, { timeout: 20000 })
            ]);
        } catch (e) {
            console.log('⚠️ Page loading slowly, continuing to check...');
        }

        // If we are at the login page, stop and wait for the user
        if (page.url().includes('login.microsoftonline.com') || await page.$(loginSelector)) {
            console.log('\n---------------------------------------------------------');
            console.log('⚠️  ACTION REQUIRED: AUTHENTICATION NEEDED');
            console.log('Please log in and complete 2FA in the browser window.');
            console.log('The script will resume automatically once you are inside Teams.');
            console.log('---------------------------------------------------------\n');
            
            // Wait indefinitely for the app to load
            await page.waitForSelector(appSelector, { timeout: 0 });
            console.log('✅ Login successful! Resuming sync...');
        }

        console.log('⏳ Waiting for app to fully stabilize...');
        // Anchor: Wait for the "Post" or "New Conversation" button which signifies the channel is ready
        const anchorSelector = 'button:has-text("Post"), button:has-text("New conversation"), [data-tid="new-conversation-button"]';
        
        try {
            await page.waitForSelector(anchorSelector, { timeout: 60000 });
            console.log('✅ Channel anchor found.');
        } catch (error) {
            console.log('📸 Capture debug screenshot...');
            await page.screenshot({ path: 'debug_error.png', fullPage: true });
            console.log('❌ Could not find the "Post" button anchor. Check debug_error.png.');
            throw error;
        }

        // Give it a moment for messages to render after the button appears
        await page.waitForTimeout(3000);

        console.log('📊 Scraping messages by pattern...');
        const messages = await page.evaluate(() => {
            // New Teams (v2) often uses 'role="presentation"' or nested divs for messages
            // We search for elements that contain a timestamp-like pattern
            const timePattern = /\d{1,2}:\d{2}/;
            
            // Get all divs that might be messages
            const allDivs = Array.from(document.querySelectorAll('div, [role="listitem"], [role="article"]'));
            
            const messageItems = allDivs.filter(div => {
                // A message usually has a timestamp and some text, and shouldn't be the whole page
                const text = div.innerText || '';
                const isTooBig = text.length > 2000;
                const hasTime = timePattern.test(text);
                const isMessageCard = div.classList.contains('fui-MessageCard') || 
                                    div.getAttribute('data-tid') === 'message-card' ||
                                    div.querySelector('[data-tid="message-author"]');
                
                return (hasTime && text.length > 10 && !isTooBig) || isMessageCard;
            });

            // Deduplicate (filter out parents if children are already caught)
            const finalItems = messageItems.filter((item, index) => {
                return !messageItems.some((other, otherIndex) => 
                    index !== otherIndex && other.contains(item)
                );
            });

            const parseTeamsDate = (dateStr) => {
                const now = new Date();
                const timePattern = /(\d{1,2}):(\d{2})\s*(am|pm)?/i;
                const match = dateStr.match(timePattern);

                if (match) {
                    const d = new Date();
                    let hours = parseInt(match[1]);
                    const minutes = parseInt(match[2]);
                    const ampm = match[3] ? match[3].toLowerCase() : null;

                    if (ampm === 'pm' && hours < 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;

                    d.setHours(hours, minutes, 0, 0);
                    
                    // If the string contains "Yesterday", subtract a day
                    if (dateStr.toLowerCase().includes('yesterday')) {
                        d.setDate(d.getDate() - 1);
                    }
                    // Handle day names (e.g., "Monday")
                    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayIndex = days.findIndex(day => dateStr.toLowerCase().includes(day));
                    if (dayIndex !== -1) {
                        const currentDay = now.getDay();
                        let diff = currentDay - dayIndex;
                        if (diff <= 0) diff += 7;
                        d.setDate(now.getDate() - diff);
                    }

                    return d.toISOString();
                }
                return new Date(dateStr).toISOString() || new Date().toISOString();
            };

            return finalItems.map(item => {
                const text = item.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                
                const sender = lines[0] || 'Unknown';
                const timeStr = lines.find(l => timePattern.test(l)) || '';
                const timestamp = parseTeamsDate(timeStr);
                
                const content = lines.slice(2).join(' ').substring(0, 500);

                return {
                    id: item.getAttribute('id') || item.getAttribute('data-id') || Math.random().toString(36),
                    title: sender,
                    description: content || 'No Content',
                    timestamp: timestamp,
                    link: window.location.href
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
