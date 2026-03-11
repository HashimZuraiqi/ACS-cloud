const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function takeScreenshots() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set consistent 3:2 ratio view port per requirements
  await page.setViewport({ width: 1200, height: 800 });
  const galleryDir = path.join(__dirname, '..', 'gallery');

  if (!fs.existsSync(galleryDir)){
    fs.mkdirSync(galleryDir);
  }

  try {
    // Wait for vite to be ready
    await new Promise(r => setTimeout(r, 2000));
    
    // Screenshot 1: Landing Page
    console.log('Navigating to Landing Page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(galleryDir, '1_landing_page.jpg'), type: 'jpeg', quality: 90 });
    console.log('Saved 1_landing_page.jpg');

    // Screenshot 2: Login Page/Auth view as placeholder for UI aesthetic
    console.log('Navigating to Login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(galleryDir, '2_auth_portal.jpg'), type: 'jpeg', quality: 90 });
    console.log('Saved 2_auth_portal.jpg');

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();
