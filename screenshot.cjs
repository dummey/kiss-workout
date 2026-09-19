const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Navigate to the app
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Check if we're on an error page
  const isError = await page.evaluate(() => {
    return document.body.innerHTML.includes('Something went wrong') || 
           document.body.innerHTML.includes('Reload App');
  });
  
  if (isError) {
    console.log('App showed error, reloading...');
    await page.evaluate(() => window.location.reload());
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Go to Settings
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const settingsLink = links.find(l => l.textContent.trim() === 'Settings');
    if (settingsLink) settingsLink.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Load Seed button (the main one on the settings page)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const loadSeedBtn = btns.find(b => b.textContent.trim() === 'Load Seed');
    if (loadSeedBtn) loadSeedBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  
  // The modal appeared - click Load Seed in the modal (last Load Seed button in DOM)
  const confirmClicked = await page.evaluate(() => {
    const modal = document.querySelector('.modal');
    if (modal) {
      const btns = modal.querySelectorAll('button');
      const confirmBtn = Array.from(btns).find(b => b.textContent.trim() === 'Load Seed');
      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Confirmed seed:', confirmClicked);
  await new Promise(r => setTimeout(r, 2000));
  
  // Verify seed loaded
  const exerciseCount = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(\d+)\s+Exercises/);
    return match ? match[1] : '0';
  });
  console.log('Exercise count after seed:', exerciseCount);
  
  // Navigate to Workouts
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const workoutsLink = links.find(l => l.textContent.trim() === 'Workouts');
    if (workoutsLink) workoutsLink.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  
  // Screenshot the Workouts page with Rename button
  await page.screenshot({ path: 'screenshot_workouts.png', fullPage: false });
  
  // Now click the Rename button to show the modal
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const renameBtn = buttons.find(b => b.textContent.trim() === 'Rename');
    if (renameBtn) renameBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  
  // Screenshot the Rename modal
  await page.screenshot({ path: 'screenshot_rename_modal.png', fullPage: false });
  
  await browser.close();
  console.log('Done');
})();
