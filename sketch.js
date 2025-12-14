// Swap - Body Background Swap
// Two modes: Swap (body shows background) and Scene (you appear in scene)

let video;
let bodyPixModel;
let segmentation = null;
let swapImg;
let sceneImg;
let resultBuffer;
let modelReady = false;

// Current mode: 'swap' or 'scene'
let currentMode = 'scene';

function preload() {
  // Load both background images
  swapImg = loadImage('data/hi.jpg');
  sceneImg = loadImage('data/mountain.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // Create result buffer
  resultBuffer = createGraphics(640, 480);
  resultBuffer.pixelDensity(1);

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

function draw() {
  background(0);

  if (!modelReady) {
    return;
  }

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
