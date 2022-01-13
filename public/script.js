var myWin;
$(function() {
  $('head').append('<link rel="stylesheet" href="/CustomWindow.scss">');
  myWin = new BrowserWindow();
});

class CustomWindow {
  static template = fetch("/CustomWindow.html").then(d => d.text());
  
  constructor(width=0, height=0, {left=0, top=0, name="", icon="", groupWith="CustomWindow"} = {}) {
    this.width = width;
    this.height = height;
    this.init = (async () => {
      this.win = $(await CustomWindow.template).appendTo('body');
      this.fullscreen = width && height;
      this.width = width ? width : 500;
      this.height = height ? height : 500;
      // TODO: automaticly determine proper position based on screen & window size
      this.left = left; this.top = top;
      this.toggleSize();
      var appinfo = this.win.find('.appinfo');
      this.makeDragable(this.win[0], appinfo[0]);
      this.name = $().text.bind(appinfo);
      this.name(name);
      
      // Register functionalities
      this.win.find('button[title="Close"]').click(this.close.bind(this));
      this.win.find('.fa-window-restore').click(this.toggleSize.bind(this));
    })();
  }
  
  minimise() {
    
  }
  
  toggleSize() {
    this.fullscreen = !this.fullscreen;
    this.win.css({
      width: (this.fullscreen ? '100%' : this.width),
      height: (this.fullscreen ? '100%' : this.height),
      left: (this.fullscreen ? '0' : this.left),
      top: (this.fullscreen ? '0' : this.top),
    });
  }
  
  close() {
    this.win.css('animation-name', 'fadeout');
    window.setTimeout($().remove.bind(this.win), 300);
  }

  topbarVisible(visible) {
    if (visible) this.win.find('.topbar').show();
    else this.win.find('.topbar').hide();
  }

  makeDragable(elmnt, handle=undefined) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (handle != undefined) {
      // if present, the header is where you move the DIV from:
      handle.onmousedown = dragMouseDown.bind(this);
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown.bind(this);
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement.bind(this);
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag.bind(this);
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      this.left -= pos1; this.top -= pos2;
      console.debug("DRAGGING:", pos1, pos2, pos3, pos4)
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      
      if (this.fullscreen) this.toggleSize();
      else if (pos3 <= 0) { this.toggleSize(); this.win.css('width', '50%'); closeDragElement() }
      else if (pos4 <= 0) { this.toggleSize(); closeDragElement() }
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
}

class BrowserWindow extends CustomWindow {
  static template = fetch("/BrowserWindow.html").then(d => d.text())
  static stylesheet;
  static prefs = ObservableSlim.create({ bookmarks:[], showBook: true, tabs:[], startupBehavior:"restore|<url>|new", ...JSON.parse(localStorage.prefs || (localStorage.prefs = "{}")) }, true, function(changes) {
    localStorage.prefs = JSON.stringify(BrowserWindow.prefs);
  });
  static version = 1;
  
  constructor(width=0, height=0) {
    var parent = super(width, height);
    if (BrowserWindow.prefs.ver == undefined) BrowserWindow.prefs.ver = BrowserWindow.version;
    else if (BrowserWindow.prefs.ver != BrowserWindow.version) {
      localStorage.clear(); location.reload();
    }
    if (!BrowserWindow.stylesheet) BrowserWindow.stylesheet = !!$('head').append('<link rel="stylesheet" href="/BrowserWindow.scss">');
    this.init = (async () => {
      await parent.init;
      $(await BrowserWindow.template).appendTo(this.win);
      this.win.addClass('BrowserWindow');
      $('<button class="fas fa-plus"></button>').appendTo(this.win.find('.appinfo')).mousedown(e => e.stopPropagation())
        .click(this.newTab.bind(this, 'about:blank'));
      this.restoreTabs();
      for (var i=0; i<1; i++) this.newTab("about:blank");
      
      // Register functionalities
      this.win.find('.searchbox').on('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') {
          var fixedURL = (ev.target.value.match(/^https?:\/?\/?/) ? '' : 'http://') + (BrowserWindow.isURL(ev.target.value) ? '' : 'google.com/search?q=') + ev.target.value
          this.navigateTo(fixedURL);
          ev.target.value = fixedURL;
        }
      })
      .on('keyup', ev => ev.stopPropagation());
      
      this.win.find('.fa-star').click(this.addBookmark.bind(this));
      this.win.find('.fa-arrow-left').click(() => void this.win.find('.iframe:visible')[0].socket.emit("navigate", -1));
      this.win.find('.fa-arrow-right').click(() => void this.win.find('.iframe:visible')[0].socket.emit("navigate", 1));
      this.win.find('.fa-redo-alt').click(() => void this.win.find('.iframe:visible')[0].socket.emit("navigate", 0));
    })();
  }

  static isURL(str) {
    return !!str.match(/^(https?:\/\/)|^[a-zA-Z0-9\-\._~]+\.(com|net|co|gov|org|gg|me|info|io)/i);
  }

  addBookmark(e=null, url={}) {
    var data = {
      url: this.win.find('.searchbox').val(),
      img: this.win.find('.tab.selected img')[0].src,
      text: this.win.find('.tab.selected span').text(),
      ...url
    };
    var bookmark = $(`<button><img class="icon" src="${data.img}" />${data.text}</button>`).appendTo('.bookmarks');
    bookmark.click(this.navigateTo.bind(this, data.url));
    console.log(data);
    if (e) BrowserWindow.prefs.bookmarks.push(data);
  }
  
  showBookmarks() {
    for (var bookmark of BrowserWindow.prefs.bookmarks) {
      this.addBookmark(null, bookmark);
    }
  }
  
  restoreTabs() {
    
  }

  navigateTo(url) {
    this.win.find('.iframe:visible')[0].socket.emit("navigate", url);
    this.win.find('.searchbox').blur().val(url);
  }

  close() {
    super.close();
    window.setTimeout(location.reload.bind(location), 1000);
  }
  
  // TODO: make Tab class?
  newTab(url="about:blank") {
    var tab = $(`<div class="tab selected"><img class="icon" /><span>New Tab</span><button class="closeTab fas fa-times"></button></div>`).insertBefore(this.win.find('.appinfo .fa-plus'));
    tab[0].url = url;
    var img = $(newProxyClient(url)).appendTo(this.win).addClass('iframe');
    tab.mousedown(focus.bind(this));
    tab.find('button').mousedown(close.bind(this));
    tab.mousedown();
    this.win.find('.searchbox').select();
    tab.animate({maxWidth: 200});
    
    function focus(e) {
      e.stopPropagation();
      console.debug(e.target);
      this.win.find('.selected').removeClass('selected');
      tab.addClass('selected');
      
      this.win.find('.searchbox').val(tab[0].url)
      
      this.win.find('.iframe').hide();
      img.show();
      
      this.win.find('.fa-star').removeClass('fas far').addClass(BrowserWindow.prefs.bookmarks.includes(tab[0].url) ? 'fas' : 'far');
    }
    
    function close(e) {
      e.stopPropagation();
      if (tab.hasClass('selected')) {
        // Try to switch to the right tab, otherwise go left
        try { (tab.next('.tab')[0] || tab.prev('.tab')[0]).dispatchEvent(new Event('mousedown')) }
        catch (err) { this.close() } // there are no more tabs, so close entire window
      }
      tab.animate({maxWidth: 0, paddingRight: 0}, 200, tab.remove.bind(tab));
      img[0].socket.disconnect();
      img.remove();
    }
  }

  /*#Tab = class Tab {
    constructor(parent, url="https://www.google.com") {
      
      
    }
  }*/
}

class PopupWindow extends CustomWindow {
  constructor(url="about:blank", width=500, height=500) {
    super(width, height).init.then(() => {
      this.win.addClass('PopupWindow');
      this.name("Popup Window");
      this.img = newProxyClient(url)
      $(`<div style="background-color: var(--bg-color);">${url}</div>`).appendTo(this.win).after(this.img)
    });
  }
  
  close() {
    super.close();
    this.img.socket.disconnect();
  }
}