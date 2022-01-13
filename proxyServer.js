module.exports = function(http) {

const puppeteer = require('puppeteer'),
    io = require('socket.io')(http);

var browserWait, userCount = 0;

  const minimal_args = [
  '--autoplay-policy=user-gesture-required',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-domain-reliability',
  '--disable-extensions',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-setuid-sandbox',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--ignore-gpu-blacklist',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
  '--no-pings',
  '--no-sandbox',
  '--no-zygote',
  '--password-store=basic',
  '--use-gl=swiftshader',
  '--use-mock-keychain',
];


(async () => {
  browserWait = puppeteer.launch({
    args: minimal_args
  });
  var browser = await browserWait;
  console.log("BROWSER OPEN");
  
  browser.on("targetcreated", async (target)=>{  // prevent excessive tabs from opening
    console.log("target created", userCount, (await browser.pages()).length - 1)
    const page=await target.page();
    if(page && userCount < (await browser.pages()).length - 1) { console.log("CLOSING extra tabs"); page.close(); }
  });
})();

io.on('connection', async socket => {
  userCount++;
  console.log('User connected:', socket.id);
  var page, pageWait, interval;
  browserWait.then(async browser => {
    pageWait = browser.newPage();
    page = await pageWait;
    await page.emulateMedia('screen');
    
     page.on('popup', page => {
      socket.emit('popup', page.url());
      page.close();
    });
    
    page.on('dialog', async dialog => {
      socket.emit('dialog', {type: dialog.type(), message: dialog.message()});
      socket.on('closeDialog', async msg => { await dialog.accept(String(msg)); dialog.dismiss(); socket.off('closeDialog'); });
    });
    //page.evaluate(() => alert('1'));
  
    page.on('load', async () => {
      socket.emit('meta', {
        title: await page.title(),
        url: page.url(),
        icon: await page.$$eval('link[rel]', elems => elems.find(i => i.relList.contains('icon')).href)
      });
    });
    
    // create new tab & send every interval
    //interval = setInterval(update, 1000);
  });
  var lastRequest = new Date().getTime();
  var closeCountdown;
  
  async function update() {
    //lastRequest = new Date().getTime();
    console.log("SENDING...");
    var startTime = new Date().getTime();
    // TODO: maybe use binary instead of base64 for increased efficency?
    socket.emit('update', await page.screenshot({ fullPage: false, encoding: 'base64', type: 'jpeg', quality: 30 }) );
    console.log("SENT in", new Date() - startTime, 'ms');
    
    // if no interaction within 1 min, stop sending screenshots
    if (startTime - lastRequest > 60000) {
      console.log('PAUSED');
      clearInterval(interval);
      interval = null;
      // close connection in 9 minutes
      closeCountdown = setTimeout(socket.disconnect, 540000);
    }
  }
  
  function interact() {
    lastRequest = new Date().getTime();
    if (interval == null) { console.log("RESUME"); interval = setInterval(update, 1000); }
    if (closeCountdown) {
      clearTimeout(closeCountdown);
      closeCountdown = null;
    }
  }
  
  socket.on('disconnect', () => {
    userCount--;
    console.log('User disconnected');
    clearInterval(interval);
    page.close();
  });
  
  // Actions
  socket.on('navigate', async msg => {
    interact();
    await browserWait;
    await pageWait;
    console.log(`LOADING PAGE (${msg})...`);
    var startTime = new Date();
    if (typeof(msg) === 'string')
      await page.goto(msg, {waitUntil: 'networkidle2'});
    else
      (msg == 1) ? await page.goForward() : await page.goBack();
    console.log("LOADED in", new Date() - startTime, 'ms');
  });
  
  socket.on('click', msg => {
    interact();
    page.mouse.click(msg.x, msg.y);
  });
  
  socket.on('move', msg => {
    page.mouse.move(msg.x, msg.y);
  });
  
  socket.on('keydown', msg => {
    interact();
    page.keyboard.down(msg);
    update();
  });
  
  socket.on('keyup', msg => {
    page.keyboard.up(msg);
  });
  
  socket.on('resize', async msg => {
    await browserWait;
    await pageWait;
    page.setViewport({
      width: msg.width,
      height: msg.height,
      deviceScaleFactor: 1
    });
  });
  
  socket.on('scroll', async msg => {
    await page.evaluate(msg => {
      window.scrollBy(msg.x, msg.y);
    }, msg);
    update();
  });
  
  //while (!page.isClosed()) await update();
});
}