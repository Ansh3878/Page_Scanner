/**
 * Document Scanner Image Processing
 * Uses pure JavaScript/Canvas for edge detection and perspective correction
 * Algorithm: Canny edge detection -> Contour finding -> Quadrilateral detection -> Perspective warp
 */

export interface Point {
  x: number;
  y: number;
}

export interface ProcessingResult {
  processedImageData: string;
  corners: Point[];
  confidence: number;
  warning?: string;
}

/**
 * Convert image to grayscale
 */
function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(imageData.width * imageData.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/**
 * Apply Gaussian blur to reduce noise
 */
function gaussianBlur(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const kernelSum = 16;
  const result = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          sum += data[idx] * kernel[ky + 1][kx + 1];
        }
      }
      result[y * width + x] = sum / kernelSum;
    }
  }
  return result;
}

/**
 * Sobel edge detection
 */
function sobelEdgeDetection(data: Uint8ClampedArray, width: number, height: number): { magnitude: Float32Array; direction: Float32Array } {
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];

  const magnitude = new Float32Array(data.length);
  const direction = new Float32Array(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          gx += data[idx] * sobelX[ky + 1][kx + 1];
          gy += data[idx] * sobelY[ky + 1][kx + 1];
        }
      }
      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }
  return { magnitude, direction };
}

/**
 * Non-maximum suppression for edge thinning
 */
function nonMaxSuppression(magnitude: Float32Array, direction: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(magnitude.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx] * 180 / Math.PI;
      const normalizedAngle = angle < 0 ? angle + 180 : angle;

      let neighbor1 = 0, neighbor2 = 0;

      // Determine neighbors based on gradient direction
      if ((normalizedAngle >= 0 && normalizedAngle < 22.5) || (normalizedAngle >= 157.5 && normalizedAngle <= 180)) {
        neighbor1 = magnitude[y * width + (x + 1)];
        neighbor2 = magnitude[y * width + (x - 1)];
      } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
        neighbor1 = magnitude[(y + 1) * width + (x - 1)];
        neighbor2 = magnitude[(y - 1) * width + (x + 1)];
      } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
        neighbor1 = magnitude[(y + 1) * width + x];
        neighbor2 = magnitude[(y - 1) * width + x];
      } else {
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }

      if (magnitude[idx] >= neighbor1 && magnitude[idx] >= neighbor2) {
        result[idx] = magnitude[idx];
      }
    }
  }
  return result;
}

/**
 * Double threshold and edge tracking
 */
function doubleThreshold(edges: Float32Array, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(edges.length);
  
  // Calculate adaptive thresholds based on edge magnitudes
  let maxMag = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxMag) maxMag = edges[i];
  }
  
  const highThreshold = maxMag * 0.15;
  const lowThreshold = highThreshold * 0.4;

  // Apply thresholds
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] >= highThreshold) {
      result[i] = 255;
    } else if (edges[i] >= lowThreshold) {
      result[i] = 128;
    }
  }

  // Edge tracking by hysteresis
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (result[idx] === 128) {
        // Check if any neighbor is a strong edge
        let hasStrongNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (result[(y + dy) * width + (x + dx)] === 255) {
              hasStrongNeighbor = true;
              break;
            }
          }
          if (hasStrongNeighbor) break;
        }
        result[idx] = hasStrongNeighbor ? 255 : 0;
      }
    }
  }

  return result;
}

/**
 * Find contours using connected component analysis
 */
function findContours(edges: Uint8ClampedArray, width: number, height: number): Point[][] {
  const visited = new Uint8ClampedArray(edges.length);
  const contours: Point[][] = [];

  const directions = [
    [0, 1], [1, 1], [1, 0], [1, -1],
    [0, -1], [-1, -1], [-1, 0], [-1, 1]
  ];

  function traceContour(startX: number, startY: number): Point[] {
    const contour: Point[] = [];
    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] || edges[idx] === 0) continue;

      visited[idx] = 1;
      contour.push({ x, y });

      for (const [dx, dy] of directions) {
        stack.push([x + dx, y + dy]);
      }
    }

    return contour;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] === 255 && !visited[idx]) {
        const contour = traceContour(x, y);
        if (contour.length > 50) { // Filter small contours
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Find convex hull using Graham scan
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  // Find lowest point
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[lowest].y || 
        (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
      lowest = i;
    }
  }
  [points[0], points[lowest]] = [points[lowest], points[0]];

  const pivot = points[0];
  
  // Sort by polar angle
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    return angleA - angleB;
  });

  const hull: Point[] = [pivot];
  
  for (const point of sorted) {
    while (hull.length > 1) {
      const top = hull[hull.length - 1];
      const second = hull[hull.length - 2];
      const cross = (top.x - second.x) * (point.y - second.y) - 
                   (top.y - second.y) * (point.x - second.x);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Approximate polygon from convex hull
 */
function approximatePolygon(hull: Point[], epsilon: number): Point[] {
  if (hull.length < 4) return hull;

  const result: Point[] = [];
  const totalLength = hull.reduce((sum, p, i) => {
    const next = hull[(i + 1) % hull.length];
    return sum + Math.hypot(next.x - p.x, next.y - p.y);
  }, 0);

  // Douglas-Peucker algorithm
  function douglasPeucker(start: number, end: number): void {
    let maxDist = 0;
    let maxIdx = start;

    const startPoint = hull[start];
    const endPoint = hull[end % hull.length];

    for (let i = start + 1; i < end; i++) {
      const point = hull[i % hull.length];
      const dist = pointToLineDistance(point, startPoint, endPoint);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon * totalLength) {
      douglasPeucker(start, maxIdx);
      douglasPeucker(maxIdx, end);
    } else {
      if (!result.includes(hull[start])) result.push(hull[start]);
    }
  }

  douglasPeucker(0, hull.length);
  return result;
}

function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  return Math.hypot(point.x - xx, point.y - yy);
}

/**
 * Find the best quadrilateral from contours
 */
function findBestQuadrilateral(contours: Point[][], width: number, height: number): { corners: Point[]; confidence: number } {
  let bestQuad: Point[] = [];
  let bestScore = 0;

  for (const contour of contours) {
    const hull = convexHull(contour);
    const polygon = approximatePolygon(hull, 0.02);

    if (polygon.length === 4) {
      // Calculate area
      const area = Math.abs(
        (polygon[0].x * polygon[1].y - polygon[1].x * polygon[0].y) +
        (polygon[1].x * polygon[2].y - polygon[2].x * polygon[1].y) +
        (polygon[2].x * polygon[3].y - polygon[3].x * polygon[2].y) +
        (polygon[3].x * polygon[0].y - polygon[0].x * polygon[3].y)
      ) / 2;

      const imageArea = width * height;
      const areaRatio = area / imageArea;

      // Score based on area (should be significant portion of image)
      if (areaRatio > 0.1 && areaRatio < 0.95) {
        const score = areaRatio * 100;
        if (score > bestScore) {
          bestScore = score;
          bestQuad = polygon;
        }
      }
    }
  }

  // Fallback to image corners if no good quadrilateral found
  if (bestQuad.length !== 4) {
    const margin = Math.min(width, height) * 0.05;
    bestQuad = [
      { x: margin, y: margin },
      { x: width - margin, y: margin },
      { x: width - margin, y: height - margin },
      { x: margin, y: height - margin }
    ];
    bestScore = 30; // Low confidence
  }

  return { corners: orderCorners(bestQuad), confidence: Math.min(bestScore, 95) };
}

/**
 * Order corners: top-left, top-right, bottom-right, bottom-left
 */
function orderCorners(corners: Point[]): Point[] {
  const sorted = [...corners];
  
  // Sort by sum of coordinates (top-left has smallest sum)
  sorted.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft = sorted[0];
  const bottomRight = sorted[3];

  // Sort by difference (top-right has smallest x-y difference from remaining)
  const remaining = [sorted[1], sorted[2]];
  remaining.sort((a, b) => (b.x - b.y) - (a.x - a.y));
  const topRight = remaining[0];
  const bottomLeft = remaining[1];

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Perspective transform using homography
 */
function perspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[],
  outputWidth: number,
  outputHeight: number
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext('2d')!;
  const outputData = outputCtx.createImageData(outputWidth, outputHeight);

  const sourceCtx = sourceCanvas.getContext('2d')!;
  const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  // Destination corners
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outputWidth, y: 0 },
    { x: outputWidth, y: outputHeight },
    { x: 0, y: outputHeight }
  ];

  // Calculate inverse homography matrix
  const H = computeHomography(dst, corners);

  // Apply transformation
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Apply inverse homography to find source pixel
      const w = H[6] * x + H[7] * y + H[8];
      const srcX = (H[0] * x + H[1] * y + H[2]) / w;
      const srcY = (H[3] * x + H[4] * y + H[5]) / w;

      // Bilinear interpolation
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 >= 0 && x1 < sourceCanvas.width && y0 >= 0 && y1 < sourceCanvas.height) {
        const xWeight = srcX - x0;
        const yWeight = srcY - y0;

        for (let c = 0; c < 4; c++) {
          const idx00 = (y0 * sourceCanvas.width + x0) * 4 + c;
          const idx01 = (y0 * sourceCanvas.width + x1) * 4 + c;
          const idx10 = (y1 * sourceCanvas.width + x0) * 4 + c;
          const idx11 = (y1 * sourceCanvas.width + x1) * 4 + c;

          const value =
            sourceData.data[idx00] * (1 - xWeight) * (1 - yWeight) +
            sourceData.data[idx01] * xWeight * (1 - yWeight) +
            sourceData.data[idx10] * (1 - xWeight) * yWeight +
            sourceData.data[idx11] * xWeight * yWeight;

          outputData.data[(y * outputWidth + x) * 4 + c] = value;
        }
      }
    }
  }

  outputCtx.putImageData(outputData, 0, 0);
  return outputCanvas;
}

/**
 * Compute homography matrix from 4 point correspondences
 */
function computeHomography(src: Point[], dst: Point[]): number[] {
  // Build matrix A for Ax = 0
  const A: number[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y;
    const dx = dst[i].x, dy = dst[i].y;
    
    A.push([-sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx, dx]);
    A.push([0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy, dy]);
  }

  // Solve using SVD (simplified for 8x9 matrix)
  // Using least squares approximation
  const H = solveHomography(A);
  
  return H;
}

function solveHomography(A: number[][]): number[] {
  // Simplified solver using normal equations
  // AtA * x = At * b where b is the last column
  const n = 8;
  const AtA: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  const Atb: number[] = Array(n).fill(0);

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < 8; k++) {
        AtA[j][k] += A[i][j] * A[i][k];
      }
      Atb[j] += A[i][j] * (-A[i][8]);
    }
  }

  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(AtA[k][i]) > Math.abs(AtA[maxRow][i])) {
        maxRow = k;
      }
    }
    [AtA[i], AtA[maxRow]] = [AtA[maxRow], AtA[i]];
    [Atb[i], Atb[maxRow]] = [Atb[maxRow], Atb[i]];

    for (let k = i + 1; k < n; k++) {
      if (AtA[i][i] !== 0) {
        const c = AtA[k][i] / AtA[i][i];
        for (let j = i; j < n; j++) {
          AtA[k][j] -= c * AtA[i][j];
        }
        Atb[k] -= c * Atb[i];
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = Atb[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= AtA[i][j] * x[j];
    }
    if (AtA[i][i] !== 0) {
      x[i] /= AtA[i][i];
    }
  }

  return [...x, 1];
}

/**
 * Main processing function
 */
export async function processDocument(imageData: string): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Step 1: Convert to grayscale
      const gray = toGrayscale(imgData);

      // Step 2: Gaussian blur
      const blurred = gaussianBlur(gray, canvas.width, canvas.height);

      // Step 3: Edge detection
      const { magnitude, direction } = sobelEdgeDetection(blurred, canvas.width, canvas.height);

      // Step 4: Non-maximum suppression
      const thinEdges = nonMaxSuppression(magnitude, direction, canvas.width, canvas.height);

      // Step 5: Double threshold
      const edges = doubleThreshold(thinEdges, canvas.width, canvas.height);

      // Step 6: Find contours
      const contours = findContours(edges, canvas.width, canvas.height);

      // Step 7: Find best quadrilateral
      const { corners, confidence } = findBestQuadrilateral(contours, canvas.width, canvas.height);

      // Step 8: Calculate output dimensions
      const width1 = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
      const width2 = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
      const height1 = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
      const height2 = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

      const outputWidth = Math.round(Math.max(width1, width2));
      const outputHeight = Math.round(Math.max(height1, height2));

      // Step 9: Apply perspective transform
      const resultCanvas = perspectiveTransform(canvas, corners, outputWidth, outputHeight);

      // Convert to data URL
      const processedImageData = resultCanvas.toDataURL('image/jpeg', 0.92);

      resolve({
        processedImageData,
        corners,
        confidence,
        warning: confidence < 50 ? 'Low confidence detection. Document edges may not be accurate.' : undefined
      });
    };
    img.src = imageData;
  });
}

/**
 * Convert PDF page to image using PDF.js
 */
export async function pdfToImage(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2; // Higher quality
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.92);
}
