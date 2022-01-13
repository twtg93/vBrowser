document.onkeydown = ev => {
  ev.preventDefault();
  console.log("KEYPRESS", ev.key);
  $('img.iframe:visible')[0].socket.emit('keydown', ev.code);
};

document.onkeyup = ev => {
  ev.preventDefault();
  $('img.iframe:visible')[0].socket.emit('keyup', ev.code);
};

function newProxyClient(startURL='https://wikipedia.org') {
const img = document.createElement('img');
// Ignore Glitch.com `'io' is undefined` warnings; imported in index.html
const socket = io();

socket.on('update', function(data) {
  console.debug("RECIEVED", (data.length || data.byteLength) / 1000, 'kb');
  img.src = 'data:image/jpeg;base64,' + data;
});

img.onclick = ev => {
  console.debug("CLICKED");
  socket.emit('click', {x: ev.offsetX, y: ev.offsetY});
};
  
img.onmousemove = ev => {
  socket.emit('move', {x: ev.offsetX, y: ev.offsetY});
};

img.onwheel = ev => {
  //console.debug("SCROLL");
  socket.emit('scroll', { x: ev.deltaX, y: ev.deltaY });
}

window.onresize = function(ev) {
  console.debug("RESIZED");
  socket.emit('resize', {width: window.innerWidth, height: window.innerHeight});
}
  
socket.on('meta', function(data) {
  console.log(data);
  $('.tab.selected span').text(data.title);  // TODO: change correct tab title even if focus changed
  $('.searchbox').val(data.url);
  $('.tab.selected')[0].url = data.url;
  $('.tab.selected img')[0].src = data.icon;
  // TODO: could cause problems if page finishes loading wile another tab is selected
  //document.querySelector('link[rel=icon]').href = data.icon;
});
  
socket.on('dialog', function(dialog) {
  console.debug(dialog);
  window.beforeunload = confirm.bind(window, "Leave site?\nChanges you made may not be saved");
  socket.emit('closeDialog', window[dialog.type](dialog.message));
});

socket.on('connect', function(data) {
  console.debug("CONNECTED");
  socket.emit("navigate", startURL);
  window.onresize();
});
 
img.socket = socket;
img.draggable = false;
return img;
}