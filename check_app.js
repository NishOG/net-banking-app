import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000); // Wait for potential async errors
  
  const content = await page.content();
  if (content.includes('id="root"')) {
    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    console.log('ROOT_HTML:', rootHtml);
  }
  
  await browser.close();
})();
