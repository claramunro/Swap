// Swap - Body Background Swap
// Your body shows the background image, everything else shows the webcam

let video;
let bodyPixModel;
let segmentation = null;
let backgroundImg;
let resultBuffer;
let modelReady = false;

function preload() {
  // Load background image
  backgroundImg = loadImage('data/hi.jpg');
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

  // Load BodyPix model
  loadBodyPix();
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

  // Process the swap
  if (segmentation && segmentation.data) {
    video.loadPixels();
    resultBuffer.loadPixels();

    // Scale factors for background image
    let bgScaleX = backgroundImg.width / 640;
    let bgScaleY = backgroundImg.height / 480;

    backgroundImg.loadPixels();

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
        let bgIndex = (bgY * backgroundImg.width + bgX) * 4;

        if (segmentation.data[segIndex] === 1) {
          // Person pixel - show background image
          resultBuffer.pixels[pixelIndex] = backgroundImg.pixels[bgIndex];
          resultBuffer.pixels[pixelIndex + 1] = backgroundImg.pixels[bgIndex + 1];
          resultBuffer.pixels[pixelIndex + 2] = backgroundImg.pixels[bgIndex + 2];
          resultBuffer.pixels[pixelIndex + 3] = 255;
        } else {
          // Background pixel - show webcam
          resultBuffer.pixels[pixelIndex] = video.pixels[videoIndex];
          resultBuffer.pixels[pixelIndex + 1] = video.pixels[videoIndex + 1];
          resultBuffer.pixels[pixelIndex + 2] = video.pixels[videoIndex + 2];
          resultBuffer.pixels[pixelIndex + 3] = 255;
        }
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
