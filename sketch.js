// Swap - Body Background Swap
// Three modes: Swap, Scene, and Summit

let video;
let bodyPixModel;
let segmentation = null;
let swapImg;
let sceneImg;
let summitImg;
let resultBuffer;
let personBuffer;
let modelReady = false;

// Current mode: 'swap', 'scene', or 'summit'
let currentMode = 'summit';

function preload() {
  // Load all background images
  swapImg = loadImage('data/hi.jpg');
  sceneImg = loadImage('data/mountain.jpg');
  summitImg = loadImage('data/summit.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // Create buffers
  resultBuffer = createGraphics(640, 480);
  resultBuffer.pixelDensity(1);

  personBuffer = createGraphics(640, 480);
  personBuffer.pixelDensity(1);

  // Set up video
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // Set up button handlers
  setupButtons();

  // Load BodyPix model
  loadBodyPix();
}

function setupButtons() {
  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });
}

async function loadBodyPix() {
  updateLoading('Loading body detection model...');

  try {
    bodyPixModel = await bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2
    });

    modelReady = true;
    hideLoading();
    showControls();

    // Start segmentation loop
    segmentBody();
  } catch (err) {
    updateLoading('Error loading model: ' + err.message);
  }
}

async function segmentBody() {
  if (!modelReady || !video.elt.videoWidth) {
    requestAnimationFrame(segmentBody);
    return;
  }

  try {
    segmentation = await bodyPixModel.segmentPerson(video.elt, {
      flipHorizontal: false,
      internalResolution: 'medium',
      segmentationThreshold: 0.6
    });
  } catch (err) {
    // Silently continue
  }

  requestAnimationFrame(segmentBody);
}

function getPersonBounds(segData) {
  let minX = 640, maxX = 0, minY = 480, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 640; x++) {
      if (segData[y * 640 + x] === 1) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

function draw() {
  background(0);

  if (!modelReady) {
    return;
  }

  if (currentMode === 'summit') {
    drawSummitMode();
  } else {
    drawSwapSceneMode();
  }
}

function drawSummitMode() {
  if (!segmentation || !segmentation.data) {
    // Just show the summit background
    let scale = max(width / summitImg.width, height / summitImg.height);
    let w = summitImg.width * scale;
    let h = summitImg.height * scale;
    let x = (width - w) / 2;
    let y = (height - h) / 2;
    image(summitImg, x, y, w, h);
    return;
  }

  // Get person bounding box
  let bounds = getPersonBounds(segmentation.data);

  if (!bounds) {
    // No person detected, just show background
    let scale = max(width / summitImg.width, height / summitImg.height);
    let w = summitImg.width * scale;
    let h = summitImg.height * scale;
    let x = (width - w) / 2;
    let y = (height - h) / 2;
    image(summitImg, x, y, w, h);
    return;
  }

  // Extract person from video
  video.loadPixels();
  personBuffer.loadPixels();

  // Clear person buffer
  for (let i = 0; i < personBuffer.pixels.length; i += 4) {
    personBuffer.pixels[i] = 0;
    personBuffer.pixels[i + 1] = 0;
    personBuffer.pixels[i + 2] = 0;
    personBuffer.pixels[i + 3] = 0;
  }

  // Copy person pixels (mirrored)
  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 640; x++) {
      let segIndex = y * 640 + x;
      if (segmentation.data[segIndex] === 1) {
        let mirrorX = 639 - x;
        let pixelIndex = (y * 640 + mirrorX) * 4;
        let videoIndex = (y * 640 + x) * 4;

        personBuffer.pixels[pixelIndex] = video.pixels[videoIndex];
        personBuffer.pixels[pixelIndex + 1] = video.pixels[videoIndex + 1];
        personBuffer.pixels[pixelIndex + 2] = video.pixels[videoIndex + 2];
        personBuffer.pixels[pixelIndex + 3] = 255;
      }
    }
  }
  personBuffer.updatePixels();

  // Determine if close-up (face) or far (full body)
  // If person height takes up more than 60% of frame, they're close
  let heightRatio = bounds.height / 480;
  let isCloseUp = heightRatio > 0.6;

  // Draw background scaled to fill
  let bgScale = max(width / summitImg.width, height / summitImg.height);
  let bgW = summitImg.width * bgScale;
  let bgH = summitImg.height * bgScale;
  let bgX = (width - bgW) / 2;
  let bgY = (height - bgH) / 2;
  image(summitImg, bgX, bgY, bgW, bgH);

  // Position person on the summit
  // Summit position (where person should stand) - roughly bottom center area
  let summitX = width * 0.5;
  let summitY = height * 0.85; // Near bottom

  if (isCloseUp) {
    // Face mode - make them smaller and position at summit
    // Scale person to about 25% of screen height
    let targetHeight = height * 0.25;
    let personScale = targetHeight / bounds.height;

    let personW = 640 * personScale;
    let personH = 480 * personScale;

    // Center the person at summit position
    let personX = summitX - (639 - bounds.centerX) * personScale;
    let personY = summitY - (bounds.y + bounds.height) * personScale;

    image(personBuffer, personX - personW/2 + (639 - bounds.centerX) * personScale, personY, personW, personH);
  } else {
    // Full body mode - scale to fit nicely on summit
    // Scale person to about 40% of screen height
    let targetHeight = height * 0.4;
    let personScale = targetHeight / bounds.height;

    let personW = 640 * personScale;
    let personH = 480 * personScale;

    // Position so their feet are at the summit
    let personX = summitX - personW / 2;
    let personY = summitY - (bounds.y + bounds.height) * personScale;

    image(personBuffer, personX, personY, personW, personH);
  }
}

function drawSwapSceneMode() {
  // Get the right background image for current mode
  let bgImg = currentMode === 'swap' ? swapImg : sceneImg;

  // Process the swap
  if (segmentation && segmentation.data) {
    video.loadPixels();
    resultBuffer.loadPixels();

    // Scale factors for background image
    let bgScaleX = bgImg.width / 640;
    let bgScaleY = bgImg.height / 480;

    bgImg.loadPixels();

    for (let y = 0; y < 480; y++) {
      for (let x = 0; x < 640; x++) {
        // Mirror the x coordinate for display
        let mirrorX = 639 - x;
        let segIndex = y * 640 + x;
        let pixelIndex = (y * 640 + mirrorX) * 4;
        let videoIndex = (y * 640 + x) * 4;

        // Background image coordinates
        let bgX = floor(mirrorX * bgScaleX);
        let bgY = floor(y * bgScaleY);
        let bgIndex = (bgY * bgImg.width + bgX) * 4;

        let isPerson = segmentation.data[segIndex] === 1;

        if (currentMode === 'swap') {
          // Swap mode: body shows background, rest shows webcam
          if (isPerson) {
            resultBuffer.pixels[pixelIndex] = bgImg.pixels[bgIndex];
            resultBuffer.pixels[pixelIndex + 1] = bgImg.pixels[bgIndex + 1];
            resultBuffer.pixels[pixelIndex + 2] = bgImg.pixels[bgIndex + 2];
          } else {
            resultBuffer.pixels[pixelIndex] = video.pixels[videoIndex];
            resultBuffer.pixels[pixelIndex + 1] = video.pixels[videoIndex + 1];
            resultBuffer.pixels[pixelIndex + 2] = video.pixels[videoIndex + 2];
          }
        } else {
          // Scene mode: body shows webcam (you), rest shows background scene
          if (isPerson) {
            resultBuffer.pixels[pixelIndex] = video.pixels[videoIndex];
            resultBuffer.pixels[pixelIndex + 1] = video.pixels[videoIndex + 1];
            resultBuffer.pixels[pixelIndex + 2] = video.pixels[videoIndex + 2];
          } else {
            resultBuffer.pixels[pixelIndex] = bgImg.pixels[bgIndex];
            resultBuffer.pixels[pixelIndex + 1] = bgImg.pixels[bgIndex + 1];
            resultBuffer.pixels[pixelIndex + 2] = bgImg.pixels[bgIndex + 2];
          }
        }
        resultBuffer.pixels[pixelIndex + 3] = 255;
      }
    }

    resultBuffer.updatePixels();
  }

  // Draw result scaled to fill screen
  let scale = max(width / 640, height / 480);
  let w = 640 * scale;
  let h = 480 * scale;
  let x = (width - w) / 2;
  let y = (height - h) / 2;

  image(resultBuffer, x, y, w, h);
}

function updateLoading(msg) {
  let el = document.getElementById('loading');
  if (el) el.textContent = msg;
}

function hideLoading() {
  let el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

function showControls() {
  let el = document.getElementById('controls');
  if (el) el.classList.remove('hidden');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
