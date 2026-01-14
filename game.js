
import { db, auth } from "./firebase.js";
import {
  ref,
  set,
  onValue,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let gameStarted = false;

const isTouchDevice =
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  document.getElementById("joystick").style.display = "block";
}
/* ===============================
   CANVAS SETUP
================================ */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 450;
ctx.imageSmoothingEnabled = false;


/* ===============================
   INPUT
================================ */

const keys = {};
window.addEventListener("keydown", e => {
  if (!gameStarted) return;
  keys[e.key] = true;
});

window.addEventListener("keyup", e => {
  if (!gameStarted) return;
  keys[e.key] = false;
});

const joy = {
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  max: 40
};

const joyBase = document.getElementById("joy-base");
const joyStick = document.getElementById("joy-stick");

joyBase.addEventListener("touchstart", e => {
  joy.active = true;
  const t = e.touches[0];
  joy.startX = t.clientX;
  joy.startY = t.clientY;
});

joyBase.addEventListener("touchmove", e => {
  if (!joy.active) return;

  const t = e.touches[0];
  let dx = t.clientX - joy.startX;
  let dy = t.clientY - joy.startY;

  const dist = Math.hypot(dx, dy);
  if (dist > joy.max) {
    dx = (dx / dist) * joy.max;
    dy = (dy / dist) * joy.max;
  }

  joy.x = dx;
  joy.y = dy;

  joyStick.style.transform = `translate(${dx}px, ${dy}px)`;

  // Reset keys
  keys.w = keys.a = keys.s = keys.d = false;

  if (dy < -10) keys.w = true;
  if (dy > 10) keys.s = true;
  if (dx < -10) keys.a = true;
  if (dx > 10) keys.d = true;
});

joyBase.addEventListener("touchend", () => {
  joy.active = false;
  joy.x = joy.y = 0;
  joyStick.style.transform = "translate(0, 0)";
  keys.w = keys.a = keys.s = keys.d = false;
});



/* ===============================
   HELPERS
================================ */

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

/* ===============================
   CAMERA
================================ */

const camera = {
  x: 0,
  y: 0,
  followSpeed: 0.15
};


/* ===============================
   CHARACTER
================================ */
let playerId = null;
let otherPlayers = {};

class Character {
  constructor(x, y, sprites) {
    this.x = x;
    this.y = y;
    this.speed = 2;

    this.width = 32;
    this.height = 32;

    this.direction = "down";
    this.frame = 0;
    this.timer = 0;
    this.interval = 150;

    this.sprites = sprites;
  }

  update(dt) {
    let dx = 0, dy = 0;

if (keys.w || keys.ArrowUp) dy -= 1;
if (keys.s || keys.ArrowDown) dy += 1;
if (keys.a || keys.ArrowLeft) dx -= 1;
if (keys.d || keys.ArrowRight) dx += 1;

// Normalize for diagonal movement
if (dx !== 0 || dy !== 0) {
  const length = Math.sqrt(dx * dx + dy * dy);
  dx /= length;
  dy /= length;

  this.x += dx * this.speed;
  this.y += dy * this.speed;

  // Set direction for animation
  if (Math.abs(dx) > Math.abs(dy))
    this.direction = dx > 0 ? "right" : "left";
  else
    this.direction = dy > 0 ? "down" : "up";

  // Animation timer
  this.timer += dt;
  if (this.timer > this.interval) {
    this.frame = (this.frame + 1) % this.sprites[this.direction].length;
    this.timer = 0;
  }
} else {
  this.frame = 0; // idle
}

  }

  draw() {
    const img = this.sprites[this.direction][this.frame];
    ctx.drawImage(
      img,
      canvas.width / 2 - this.width / 2,
      canvas.height / 2 - this.height / 2,
      this.width,
      this.height
    );
  }
}

/* ===============================
   SPRITES
================================ */

const playerSprites = {
  up: [
    loadImage("assets/sprites/player/up_1.png"),
    loadImage("assets/sprites/player/up_2.png"),
    loadImage("assets/sprites/player/up_3.png"),
    loadImage("assets/sprites/player/up_4.png")
  ],
  down: [
    loadImage("assets/sprites/player/down_1.png"),
    loadImage("assets/sprites/player/down_2.png"),
    loadImage("assets/sprites/player/down_3.png"),
    loadImage("assets/sprites/player/down_4.png")
  ],
  left: [
    loadImage("assets/sprites/player/left_1.png"),
    loadImage("assets/sprites/player/left_2.png"),
    loadImage("assets/sprites/player/left_3.png"),
    loadImage("assets/sprites/player/left_4.png")
  ],
  right: [
    loadImage("assets/sprites/player/right_1.png"),
    loadImage("assets/sprites/player/right_2.png"),
    loadImage("assets/sprites/player/right_3.png"),
    loadImage("assets/sprites/player/right_4.png")
  ]
};

/* ===============================
   MAP & TILES
================================ */


let TILE_SIZE = 16;


const tilesetImage = new Image();
tilesetImage.src = "assets/tiles/map2.png"; // your PNG

let mapLayer = null;

fetch("map2_project.json")
  .then(res => res.json())
  .then(data => {

    const root = data.tilesetEditing?.[0];

    if (!root) {
      console.error("No tilesetEditing[0]");
      return;
    }

    // 🔍 Try all known Pixelab layouts
    if (root.map?.layers) {
      mapLayer = root.map.layers[0];
    } else if (root.map?.layer) {
      mapLayer = root.map.layer;
    } else if (root.layers) {
      mapLayer = root.layers[0];
    } else if (root.map?.data?.layers) {
      mapLayer = root.map.data.layers[0];
    } else {
      console.error("Could not find map layer", root);
      return;
    }

    mapLayer.visible = true;

    console.log(
      "MAP LAYER FOUND ✅",
      mapLayer,
      "tiles:",
      Object.keys(mapLayer.tiles || {}).length
    );
  });



function drawMap() {
  if (!mapLayer || !mapLayer.tiles) return;
  if (!tilesetImage.complete || tilesetImage.naturalWidth === 0) return;


  const offsetX = canvas.width / 2 - player.width / 2 - camera.x;
  const offsetY = canvas.height / 2 - player.height / 2 - camera.y;

  for (const key in mapLayer.tiles) {
    const [tx, ty] = key.split("-").map(Number);
    const tile = mapLayer.tiles[key];

    ctx.drawImage(
      tilesetImage,
      tile.x * TILE_SIZE,
      tile.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      tx * TILE_SIZE + offsetX,
      ty * TILE_SIZE + offsetY,
      TILE_SIZE,
      TILE_SIZE
    );
  }
}







/* ===============================
   GAME SETUP
================================ */

const player = new Character(400, 225, playerSprites);
camera.x = player.x;
camera.y = player.y;


/* ===============================
   GAME LOOP
================================ */

let last = 0;

function loop(time) {
  const dt = time - last;
  last = time;

  player.update(dt);

  // Camera follows player
  if (last === 0) {
  camera.x = player.x;
  camera.y = player.y;
} else {
  camera.x += (player.x - camera.x) * camera.followSpeed;
  camera.y += (player.y - camera.y) * camera.followSpeed;
}


  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  player.draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

document.getElementById("startBtn").onclick = () => {
  gameStarted = true;
  document.getElementById("betaNotice").style.display = "none";
};




