/*
    Signal Meter Small v1.3.8 by AAD
    https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter

    Original concept by Analog Signal Meter: https://github.com/NO2CW/FM-DX-Webserver-analog-signal-meter
*/

'use strict';

// Global variables for other plugins
const pluginSignalMeterSmall = true;
var pluginSignalMeterSmallSquelchActive = false;

(() => {

  //////////////////////////////////////////////////

  const OUTSIDE_FIELD = true;                 // Display meter outside the SIGNAL panel
  const ENABLE_SQUELCH = true;                // Allow squelch function to be used
  const USE_THEME_COLORS = true;              // Background matches theme
  const RADIO_NOISE_FLOOR = -123;             // The reported dBm signal reading with no antenna connected used to calibrate low signal interpolation, or 0 to disable
  const AM_OFFSET = false;                    // For below 27 MHz, S9 becomes -73dBm, includes an additional offset of up to 20 dB, and disables RADIO_NOISE_FLOOR
  const METER_LOCATION = 'auto';              // Set to 'auto' for default position, or force with 'signal', 'sdr-graph', 'sdr-graph-only', 'peakmeter', or 'auto-rotator'

  //////////////////////////////////////////////////

  const pluginVersion = '1.3.8';
  const pluginName = "Signal Meter Small";
  const pluginHomepageUrl = "https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter";
  const pluginUpdateUrl = "https://raw.githubusercontent.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter/refs/heads/main/SignalMeterSmall/pluginSignalMeterSmall.js";
  const pluginSetupOnlyNotify = true;
  const CHECK_FOR_UPDATES = true;

  // Set initial stream volume and other variables
  if (window.location.pathname === '/setup') window.newVolumeGlobal = 0;
  let valueSquelchVolume = newVolumeGlobal || 1;
  let activeSquelch = false;
  let isEnabledSquelch = ENABLE_SQUELCH;
  let minMeterPosition = 15; // 8 + 7 (Meter begins at S0)
  let maxMeterPosition = 11; // 0 + 11 (Meter begins at S0)
  let minMeterStart = minMeterPosition + 1; // Starting position for needle and marker
  let fullHeight = 720;
  let offset, markerPosition, markerPositionMin, markerPositionMax, showMarker;
  let signalStrength, currentFrequency, signalStrengthHighest, needlePositionHighest;

  const rotatorOffset = METER_LOCATION === 'auto-rotator' ? 200 : 0;
  const debugMode = false; // For debugging purposes only

  function initSignalMeterSmall() {
      document.addEventListener('DOMContentLoaded', function() {
          const panels = Array.from(document.querySelectorAll('.panel-33'));
          let isOutsideField = OUTSIDE_FIELD;
          let setMeterLocation = METER_LOCATION;
          if (setMeterLocation === 'sdr-graph-only' && window.innerWidth < 480 && window.innerHeight > window.innerWidth) setMeterLocation = 'auto';
          if (setMeterLocation === 'auto-rotator') setMeterLocation = 'auto';
          if (localStorage.getItem("showPeakmeter") !== null && (setMeterLocation === 'auto' || setMeterLocation === 'sdr-graph-only')) {
            if (setMeterLocation === 'auto') {
              setMeterLocation = (localStorage.getItem("showPeakmeter") === 'true') ? 'auto' : 'sdr-graph';
            } else if (setMeterLocation === 'sdr-graph-only') {
              setMeterLocation = (localStorage.getItem("showPeakmeter") === 'true') ? 'auto' : 'sdr-graph-only';
            }
          }
          let existsPeakmeter;
          if (setMeterLocation !== 'sdr-graph' && setMeterLocation !== 'sdr-graph-only') {
              existsPeakmeter = panels.find(panel => panel.querySelector('h2') && panel.querySelector('h2').textContent.includes('PEAKMETER'));
          }

          let existsSignal;

          if (METER_LOCATION !== "sdr-graph-only") {
              existsSignal = panels.find(panel => panel.querySelector('h2') && panel.querySelector('h2').textContent.includes("SIGNAL"));
          } else {
              existsSignal = document.querySelector('#sdr-graph');
          }

          let offsetPeakmeter = -50;
          let container;
          const signalMeter = document.createElement('canvas');

          // Canvas positioning variables for SDR graph integration
          let canChangeState = true;
          let currentSdrGraphState = false;
          let isGraphReady = false;
          let lastSdrGraphState = null;
          let canChangeStateTimeout;
          let isSdrGraphVisible;
          let isSignalCanvasVisible;
          let isOnTop;
          let opacitySdrGraph;

          function manageCanvasPosition() {
              const sdrGraph = document.querySelector('#sdr-graph');
              const signalCanvas = document.querySelector('#signal-canvas');

              const sdrCanvasCheck = document.getElementById('sdr-graph');
              if (sdrCanvasCheck) opacitySdrGraph = window.getComputedStyle(sdrCanvasCheck).opacity;

              const smallCanvas = document.querySelector('#signal-meter-small-canvas');
              const markerCanvas = document.querySelector('#signal-meter-small-marker-canvas');

              // If no panel found with SIGNAL, return
              if (!existsSignal) {
                  console.log("Signal Meter Small: No SIGNAL panel found.");
                  return;
              }

              const originalContainer = existsSignal;

              if (!smallCanvas || !markerCanvas || !originalContainer || existsPeakmeter || !isOutsideField ||
                  (setMeterLocation !== 'sdr-graph' && setMeterLocation !== 'sdr-graph-only' && setMeterLocation !== 'auto')) {
                  return;
              }

              if (sdrGraph) {
                  isSdrGraphVisible = Number(window.getComputedStyle(sdrGraph).opacity);
              }
              if (signalCanvas) {
                  isSignalCanvasVisible = Number(window.getComputedStyle(signalCanvas).opacity);
              }

              if (!isGraphReady && !isSdrGraphVisible && isSignalCanvasVisible) {
                  isGraphReady = true;
              }

              if (sdrGraph && signalCanvas) {
                  const rect1 = sdrGraph.getBoundingClientRect();
                  const rect2 = signalCanvas.getBoundingClientRect();
                  const tolerance = 1;
                  isOnTop = Math.abs(rect1.left - rect2.left) < tolerance;
              }

              if (isOnTop) {
                  if (sdrGraph) {
                      currentSdrGraphState = window.getComputedStyle(sdrGraph).display === 'block';
                  }
                  if (opacitySdrGraph && opacitySdrGraph < 0.5) {
                      currentSdrGraphState = false;
                  }
              } else {
                  if (isSdrGraphVisible && isSignalCanvasVisible && canChangeState) {
                      currentSdrGraphState = !currentSdrGraphState;
                      canChangeState = false;
                  }
                  if (!isSdrGraphVisible && isSignalCanvasVisible && currentSdrGraphState) {
                      currentSdrGraphState = false;
                  } else if (isSdrGraphVisible && !isSignalCanvasVisible && !currentSdrGraphState) {
                      currentSdrGraphState = true;
                  }
              }

              if (currentSdrGraphState !== lastSdrGraphState) {
                  lastSdrGraphState = currentSdrGraphState;
                  clearTimeout(canChangeStateTimeout);
                  canChangeStateTimeout = setTimeout(() => {
                      canChangeState = true;
                  }, 400);

                  if (currentSdrGraphState && isGraphReady) {
                      if (smallCanvas.parentElement !== sdrGraph.parentElement) {
                          smallCanvas.style.opacity = 0;
                          markerCanvas.style.opacity = 0;
                          smallCanvas.style.transform = 'scale(0.96)';
                          markerCanvas.style.transform = 'scale(0.96)';

                          sdrGraph.parentElement.appendChild(smallCanvas);
                          sdrGraph.parentElement.appendChild(markerCanvas);
                          smallCanvas.style.position = 'absolute';
                          markerCanvas.style.position = 'absolute';
                          smallCanvas.style.top = '10px';
                          markerCanvas.style.top = '10px';
                          smallCanvas.style.left = 172 + rotatorOffset + 'px';
                          markerCanvas.style.left = 172 + rotatorOffset + 'px';
                          smallCanvas.offsetHeight;
                          markerCanvas.offsetHeight;

                          smallCanvas.style.opacity = 1;
                          markerCanvas.style.opacity = 1;
                          smallCanvas.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
                          markerCanvas.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
                          smallCanvas.style.transform = 'scale(1)';
                          markerCanvas.style.transform = 'scale(1)';

                          smallCanvas.style.boxShadow = '0px 0px 12px rgba(10, 10, 10, 0.25)';
                          smallCanvas.style.background = 'rgba(10, 10, 10, 0.1)';
                          smallCanvas.style.backdropFilter = 'blur(10px)';
                      }
                  } else {
                      if (smallCanvas.parentElement !== originalContainer) {
                          setTimeout(() => {
                              if (setMeterLocation !== 'sdr-graph-only') {
                                smallCanvas.style.opacity = 1;
                                markerCanvas.style.opacity = 1;
                              }
                              smallCanvas.style.transform = 'scale(1)';
                              markerCanvas.style.transform = 'scale(1)';

                              originalContainer.appendChild(smallCanvas);
                              originalContainer.appendChild(markerCanvas);
                              smallCanvas.style.top = '';
                              smallCanvas.style.left = '';
                              markerCanvas.style.top = '';
                              markerCanvas.style.left = '';
                              markerCanvas.style.zIndex = '';
                              smallCanvas.style.zIndex = '';
                              smallCanvas.style.boxShadow = '';
                              smallCanvas.style.background = '';
                          }, 250);
                          smallCanvas.style.opacity = 0;
                          markerCanvas.style.opacity = 0;
                          smallCanvas.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                          markerCanvas.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                          smallCanvas.style.transform = 'scale(0.96)';
                          markerCanvas.style.transform = 'scale(0.96)';
                      }
                  }
              }
          }

          setTimeout(() => {
              const smallCanvasSdrOnly = document.querySelector('#signal-meter-small-canvas');
              const markerCanvasSdrOnly = document.querySelector('#signal-meter-small-marker-canvas');

              if (setMeterLocation === 'sdr-graph-only') {
                  if (smallCanvasSdrOnly) smallCanvasSdrOnly.style.opacity = 0;
                  if (markerCanvasSdrOnly) markerCanvasSdrOnly.style.opacity = 0;
              }

              const observer = new MutationObserver(() => {
                  manageCanvasPosition();
              });

              setTimeout(() => {
                  observer.observe(document.body, {
                      childList: true,
                      subtree: true,
                      attributes: true,
                      attributeFilter: ['style', 'class', 'visibility', 'display']
                  });
              }, 40);
          }, 0);

          if (setMeterLocation === 'signal') {
              container = existsSignal;
          } else if (!existsPeakmeter && (setMeterLocation === 'auto')) {
              container = existsSignal;
          } else if (existsPeakmeter && (setMeterLocation === 'auto' || setMeterLocation === 'peakmeter')) {
              container = existsPeakmeter;
              isOutsideField = false;
              signalMeter.style.top = offsetPeakmeter + 'px';
          } else {
              container = existsSignal;
          }

          signalMeter.id = 'signal-meter-small-canvas';
          if (!existsPeakmeter && setMeterLocation === 'auto') {
              signalMeter.style.backdropFilter = 'blur(5px)';
          }
          signalMeter.style.width = '256px';
          signalMeter.style.height = '13px';
          signalMeter.style.imageRendering = 'auto';

          const markerCanvas = document.createElement('canvas');
          markerCanvas.id = 'signal-meter-small-marker-canvas';
          markerCanvas.style.width = '256px';
          markerCanvas.style.height = '13px';
          markerCanvas.style.imageRendering = 'auto';
          markerCanvas.style.top = signalMeter.style.top;
          markerCanvas.style.left = signalMeter.style.left;

          if (isOutsideField) {
              offset = -128;
              signalMeter.style.margin = '4px 0 0 ' + offset + 'px';
              signalMeter.style.position = 'absolute';
              markerCanvas.style.margin = '4px 0 0 ' + offset + 'px';
              markerCanvas.style.position = 'absolute';
          } else {
              offset = 0;
              signalMeter.style.margin = '4px 0 0 ' + offset + 'px';
              signalMeter.style.position = 'relative';
              markerCanvas.style.margin = '4px 0 0 -256px';
              markerCanvas.style.position = 'relative';

              if (document.querySelector('.dashboard-panel-plugin-list')) {
                  let styleElement = document.createElement('style');
                  styleElement.textContent = `
                    .wrapper-outer #wrapper .flex-container .panel-100.no-bg .flex-container .panel-33 {
                        max-height: unset !important;
                    }
                    .wrapper-outer #wrapper .flex-container .panel-100.no-bg .flex-container .panel-33 .text-big {
                        max-height: 48px;
                    }
                    @media (min-height: ${fullHeight + 1}px) {
                        .wrapper-outer #wrapper .flex-container .panel-100.no-bg .flex-container .panel-33 .text-big {
                            max-height: 64px;
                        }
                    }
                    @media only screen and (max-width: 768px) and (max-height: 720px) {
                        .wrapper-outer #wrapper .flex-container .panel-100.no-bg .flex-container .panel-33 {
                            margin-bottom: 36px; /* For Peakmeter with mobile view and height below 720px */
                        }
                    }
                  `;
                  document.head.appendChild(styleElement);
              } else {
                  fullHeight = 860;
              }
          }
          if (window.location.pathname !== '/setup') {
              container.appendChild(signalMeter);
              container.appendChild(markerCanvas);
          }

          markerPosition = minMeterStart;
          markerPositionMin = '';
          markerPositionMax = '';
          showMarker = true;

          // Override breadcrumbs.css to make this canvas visible on mobile devices
          if (window.location.pathname !== '/setup') {
              document.getElementById('signal-meter-small-canvas').style.display = 'inline-block';
              document.getElementById('signal-meter-small-marker-canvas').style.display = 'inline-block';
          }

          let firstTooltip = `Double-click 'S' to toggle show/hide S-Meter.${isEnabledSquelch ? '<br><strong>Squelch does not affect other listeners.</strong>' : ''}`;
          markerCanvas.classList.add('tooltip-meter');
          markerCanvas.setAttribute('data-tooltip', firstTooltip);
          markerCanvas.style.cursor = 'pointer';
          initMeterTooltips();

          const ctx = signalMeter.getContext('2d');
          signalMeter.width = 256;
          signalMeter.height = 13;

          const markerCtx = markerCanvas.getContext('2d');
          markerCanvas.width = 256;
          markerCanvas.height = 13;

          function drawMarker() {
              if (isEnabledSquelch && markerPositionMin && showMarker) {
                  markerCtx.clearRect(0, 0, markerCanvas.width, markerCanvas.height);
                  markerCtx.beginPath();
                  markerCtx.moveTo(markerPosition, 0);
                  markerCtx.lineTo(markerPosition, markerCanvas.height);
                  if (USE_THEME_COLORS) {
                    const computedStyleMarker = getComputedStyle(document.documentElement);
                    const colorBackgroundMarker = computedStyleMarker.getPropertyValue('--color-5').trim();
                    ctx.strokeStyle = colorBackgroundMarker;
                    markerCtx.strokeStyle = colorBackgroundMarker;
                  } else {
                    markerCtx.strokeStyle = '#FEEE33';
                  }
                  markerCtx.lineWidth = 2;
                  markerCtx.globalAlpha = 0.95;
                  markerCtx.stroke();
              }
          }

          if (isEnabledSquelch) {
              let isDragging = false;
              let offsetX = 0;

              markerCanvas.addEventListener('mousedown', startDragging);
              markerCanvas.addEventListener('touchstart', startDragging);

              function startDragging(event) {
                  event.preventDefault();

                  const savedOpacity = localStorage.getItem('SignalMeterSmallVisibility') || 1;
                  showMarker = true;
                  if (savedOpacity != 1) {
                      showMarker = false;
                      markerPosition = minMeterStart;
                      return;
                  }

                  if (event.button === 1 || (event.touches && event.touches.length > 1)) {
                      event.preventDefault();
                  } else {
                      const rect = markerCanvas.getBoundingClientRect();
                      let mouseX, touchX;
                      const scaleX = markerCanvas.width / rect.width;

                      if (event.type === 'mousedown') {
                          mouseX = (event.clientX - rect.left) * scaleX;
                      } else if (event.type === 'touchstart') {
                          touchX = (event.touches[0].clientX - rect.left) * scaleX;
                      }

                      markerPosition = mouseX || touchX;
                      markerPosition = Math.max(markerPosition, markerPositionMin);
                      markerPosition = Math.min(markerPosition, markerPositionMax);

                      drawMarker(markerPosition);
                      offsetX = (mouseX || touchX) - markerPosition;
                      isDragging = true;

                      document.body.style.userSelect = 'none';
                      document.getElementById('signal-meter-small-marker-canvas').oncontextmenu = function(e) { e.preventDefault(); };

                      window.addEventListener('mousemove', mouseMoveHandler);
                      window.addEventListener('touchmove', touchMoveHandler);

                      markerCanvas.classList.remove('tooltip-meter');
                      markerCanvas.removeAttribute('data-tooltip');
                      initMeterTooltips();
                      removeTooltips();
                  }
              }

              function mouseMoveHandler(event) {
                  if (isDragging) {
                      const rect = markerCanvas.getBoundingClientRect();
                      const scaleX = markerCanvas.width / rect.width;
                      let mouseX = (event.clientX - rect.left) * scaleX;
                      markerPosition = mouseX - offsetX;
                      markerPosition = Math.max(markerPosition, markerPositionMin);
                      markerPosition = Math.min(markerPosition, markerPositionMax);
                      drawMarker(markerPosition);
                  }
              }

              // Touch move handler function
              function touchMoveHandler(event) {
                  if (isDragging) {
                      const rect = markerCanvas.getBoundingClientRect();
                      const scaleX = markerCanvas.width / rect.width; // Consider width percentage
                      let touchX = (event.touches[0].clientX - rect.left) * scaleX; // X position relative to canvas
                      markerPosition = touchX - offsetX;

                      // Ensure marker stays within canvas bounds
                      markerPosition = Math.max(markerPosition, markerPositionMin);
                      markerPosition = Math.min(markerPosition, markerPositionMax);
                      drawMarker(markerPosition);
                  }
              }

              // Event listener to stop dragging
              window.addEventListener('mouseup', stopDragging);
              window.addEventListener('touchend', stopDragging);

              function stopDragging(event) {
                  if (isDragging) {
                      isDragging = false;

                      // Re-enable text selection
                      document.body.style.userSelect = '';

                      // Stop tracking mouse movement globally
                      window.removeEventListener('mousemove', mouseMoveHandler);
                      window.removeEventListener('touchmove', touchMoveHandler);
                  }
              }

              function onMouseMove(event) {
                  const rect = markerCanvas.getBoundingClientRect();
                  markerPosition = Math.max(markerPositionMin, Math.min(event.clientX - rect.left, markerPositionMax));
                  drawMarker();
              }

              markerCanvas.addEventListener('mouseleave', function() {
                  markerCanvas.removeEventListener('mousemove', onMouseMove);
              });

              // Function to handle mouse wheel scroll event
              function handleWheelScroll(event) {
                  // Calculate new position based on scroll direction
                  if (event.deltaY > 0) {
                      // Scroll down
                      markerPosition -= 2;
                  } else {
                      // Scroll up
                      markerPosition += 2;
                  }

                  // Ensure markerPosition stays within canvas bounds
                  markerPosition = Math.max(markerPosition, markerPositionMin);
                  markerPosition = Math.min(markerPosition, markerPositionMax);

                  // Clear previous marker and redraw at new position
                  markerCtx.clearRect(0, 0, markerCanvas.width, markerCanvas.height);
                  drawMarker(markerPosition);
              }

              // Add event listener for wheel event
              markerCanvas.addEventListener('wheel', handleWheelScroll);

              // Event listener to prevent webpage scrolling while scrolling over the canvas
              markerCanvas.addEventListener('wheel', function(event) {
                  event.preventDefault(); // Prevent default scrolling behaviour

                  // Remove tooltip after first tap/click
                  markerCanvas.classList.remove('tooltip-meter');
                  markerCanvas.removeAttribute('data-tooltip');
                  initMeterTooltips();
                  removeTooltips();
              });
          }

          setInterval(function() {
              let windowWidth = window.innerWidth;
              let windowHeight = window.innerHeight;
              // PEAKMETER
              if (setMeterLocation === 'signal' && existsPeakmeter) {
                  windowWidth = (window.innerWidth / 1.5).toFixed(0);
                  if (windowWidth < 769 && window.innerWidth > 768) {
                      windowWidth = 769;
                  }
              }
              if (existsPeakmeter && container === existsPeakmeter && windowWidth < 768) {
                  isOutsideField = true;
                  signalMeter.style.top = '-28px';
                  markerCanvas.style.top = '-28px';
                  offset = -128;
                  signalMeter.style.margin = '4px 0 0 ' + offset + 'px';
                  signalMeter.style.position = 'absolute';
                  markerCanvas.style.margin = '4px 0 0 ' + offset + 'px';
                  markerCanvas.style.position = 'absolute';
              } else if (existsPeakmeter && container === existsPeakmeter && windowWidth > 768) {
                  isOutsideField = false;
                  signalMeter.style.top = offsetPeakmeter + 'px';
                  markerCanvas.style.top = offsetPeakmeter + 'px';
                  offset = 0;
                  signalMeter.style.margin = '4px 0 0 ' + offset + 'px';
                  signalMeter.style.position = 'relative';
                  markerCanvas.style.margin = '4px 0 0 -256px';
                  markerCanvas.style.position = 'relative';
              }
              // Store current signal strength in variable
              const signalElement = document.getElementById('data-signal');
              const signalDecimalElement = document.getElementById('data-signal-decimal');
              const signalStrengthText = signalElement ? signalElement.textContent : '0';
              const signalStrengthDecimalText = signalDecimalElement ? signalDecimalElement.textContent : '0';
              signalStrength = parseFloat(signalStrengthText) + (signalStrengthText >= 0 ? parseFloat(signalStrengthDecimalText) : -parseFloat(signalStrengthDecimalText));
              const textContent = localStorage.getItem('signalUnit');
              signalStrength += (textContent === 'dbm' ? 120 : textContent === 'dbuv' ? 11.25 : 0);

              // Store peak signal strength in variable
              const signalHighestElement = document.getElementById('data-signal-highest');
              const signalStrengthHighestText = signalHighestElement ? signalHighestElement.textContent : '0';
              signalStrengthHighest = parseFloat(signalStrengthHighestText);
              signalStrengthHighest += (textContent === 'dbm' ? 120 : textContent === 'dbuv' ? 11.25 : 0);

              // AM offset formula
              if (AM_OFFSET) {
                  const frequencyElement = document.getElementById('data-frequency');
                  currentFrequency = frequencyElement ? frequencyElement.textContent : '87.5';
                  if (currentFrequency <= 27) {
                      let amTefOffset;

                      if (currentFrequency <= 10) {
                          amTefOffset = 40;
                      } else {
                          // Linear interpolation between an offset of 40 up to 10 MHz and an offset of 20 at 27 MHz
                          const t = (currentFrequency - 10) / (27 - 10);
                          amTefOffset = 40 - t * (40 - 20);
                      }

                      signalStrength -= amTefOffset;
                      signalStrengthHighest -= amTefOffset;
                  }
              }

              // Resize if needed
              let width, margin;

              // Drawn numbers
              if (windowWidth > 768 && !isSdrGraphVisible) {
                  // Width and margin adjustments here
                  width = '76.655%';
                  if (
                      (!existsPeakmeter && isOutsideField) ||
                      (existsPeakmeter && isOutsideField && setMeterLocation === 'signal')
                  ) {
                      margin = '-38.333%';
                  } else {
                      margin = '0';
                  }

                  signalMeter.style.maxWidth = '256px';
                  signalMeter.style.width = width;
                  signalMeter.width = 256;
                  markerCanvas.style.width = width;
                  markerCanvas.width = 256;
                  if (window.location.pathname !== '/setup') {
                      if (windowWidth < 1180 || existsSignal.offsetWidth <= 320) if (isOutsideField) { signalMeter.style.margin = '4px 0 0 ' + margin; }
                      if (windowWidth < 1180 || existsSignal.offsetWidth <= 320) if (isOutsideField) { markerCanvas.style.margin = '4px 0 0 ' + margin; } else { markerCanvas.style.margin = '4px 0 0 -' + width; }
                  }
                  if (isEnabledSquelch) { drawMarker(markerPosition); }
              } else {
                  width = '256px';
                  signalMeter.style.maxWidth = '256px';
                  margin = offset + 'px';
                  signalMeter.style.width = width;
                  signalMeter.width = parseInt(width);
                  if (isEnabledSquelch) { markerCanvas.style.width = width; }
                  if (isEnabledSquelch) { markerCanvas.width = parseInt(width); }
                  if (isOutsideField) { signalMeter.style.margin = '2px 0 0 ' + margin; }
                  if (isOutsideField) { markerCanvas.style.margin = '2px 0 0 ' + margin; } else if (isEnabledSquelch) { markerCanvas.style.margin = '2px 0 0 -' + width; }
                  if (isEnabledSquelch) { drawMarker(markerPosition); }
              }

              if (!(/Mobi|Android/i.test(navigator.userAgent)) && windowWidth > 768 && windowHeight > fullHeight) {
                  if (isOutsideField) {
                      if (document.getElementById('wrapper-outer')) {
                          // v1.2.4 compatibility
                          signalMeter.style.margin = '4px 0 0 ' + margin; // 4px is already the default
                          markerCanvas.style.margin = '4px 0 0 ' + margin; // 4px is already the default
                      } else if (document.querySelector('#wrapper-outer #wrapper .flex-container')) {
                          // v1.3.4 and below compatibility
                          signalMeter.style.margin = '9px 0 0 ' + margin;
                          markerCanvas.style.margin = '9px 0 0 ' + margin;
                      }
                  } else {
                      signalMeter.style.margin = '0 0 0 ' + margin;
                      if (windowWidth > 768 && windowHeight < fullHeight) {
                          // If isOutsideField equals false and height is below 'fullHeight' px
                          markerCanvas.style.margin = '0 0 0 -256px';
                      } else {
                          markerCanvas.style.margin = '0 0 0 -' + width;
                      }
                  }
              }

              if (!isNaN(signalStrength)) {
                  drawSignalMeter(signalStrength, signalStrengthHighest, ctx, signalMeter);
              }
          }, 125);

          // Set initial opacity from localStorage or default to 1 (visible)
          const savedOpacity = localStorage.getItem('SignalMeterSmallVisibility') || 1;
          showMarker = savedOpacity == 1;
          signalMeter.style.opacity = savedOpacity;

          // Track if the initial mouse down position is within the first 6 pixels
          let isMouseDownWithin = false;

          // Add mousedown event listener to track initial click position
          markerCanvas.addEventListener('mousedown', function(event) {
              const rect = signalMeter.getBoundingClientRect();
              const x = event.clientX - rect.left;
              isMouseDownWithin = x <= 6;
          });

          let isMouseDoubleClickWithin = false;

          // Add dblclick event listener to track double click
          markerCanvas.addEventListener('dblclick', function(event) {
              const rect = signalMeter.getBoundingClientRect();
              const x = event.clientX - rect.left;
              isMouseDoubleClickWithin = x <= minMeterPosition - 1;

              // Handle the double click action
              if (isMouseDoubleClickWithin) {
                  const currentOpacity = signalMeter.style.opacity;
                  signalMeter.style.opacity = currentOpacity === '1' ? '0' : '1';
                  markerCanvas.style.opacity = currentOpacity === '1' ? '0' : '1'; // Hide squelch marker
                  showMarker = true;
                  localStorage.setItem('SignalMeterSmallVisibility', signalMeter.style.opacity);
                  isMouseDoubleClickWithin = false; // Reset double click
              }
          });

          // Add hover effect for opacity when opacity is 0%
          markerCanvas.addEventListener('mouseover', function() {
              const currentOpacity = signalMeter.style.opacity;
              if (currentOpacity === '0') {
                  signalMeter.style.opacity = '0.2';
              }
          });

          // Remove hover effect when mouse leaves
          markerCanvas.addEventListener('mouseleave', function() {
              const currentOpacity = signalMeter.style.opacity;
              if (currentOpacity === '0.2') {
                  signalMeter.style.opacity = '0';
              }
          });
      });
  }

  function removeTooltips() {
      let tooltips = document.querySelectorAll('.tooltiptext');
      tooltips.forEach(function(tooltip) {
          tooltip.parentNode.removeChild(tooltip);
      });
  }

  let needlePosition = minMeterStart;

  // Functions to check squelch level and set volume
  function checkSquelch() {
      // Disable during playback initiation to avoid volume change conflicts
      if ($('.playbutton.bg-gray').length > 0) {
          isEnabledSquelch = false;
          markerPosition = minMeterStart;
      } else {
          isEnabledSquelch = true;
      }
      // Override any manual volume changes
      if (newVolumeGlobal !== valueSquelchVolume) {
          activeSquelch = false;
          pluginSignalMeterSmallSquelchActive = false;
      }
      valueSquelchVolume = newVolumeGlobal || 1;
      // Set volume to 0 if squelch is activated
      if ((markerPosition - needlePosition > 0) && !activeSquelch) {
          muteVolume(1 / 100); // Squelch mute percentage
          activeSquelch = true;
          pluginSignalMeterSmallSquelchActive = true;
      } else if ((markerPosition - needlePosition <= 0) && activeSquelch) {
          muteVolume(valueSquelchVolume);
          activeSquelch = false;
          pluginSignalMeterSmallSquelchActive = false;
      }
  }

  function muteVolume(muteValue) {
      if (Stream) {
          setTimeout(() => Stream.Volume = muteValue, 100);
          Stream.Volume = muteValue;
      }
  }

  if (isEnabledSquelch) {
      setInterval(checkSquelch, 1000);
  }

  // Function to draw scale marks and numbers manually (similar to peakmeter.js)
  function drawScaleMarks(ctx, signalMeter) {
      const meterWidth = signalMeter.width - maxMeterPosition;

      // Draw background bar for meter area
      ctx.fillStyle = USE_THEME_COLORS ?
          getComputedStyle(document.documentElement).getPropertyValue('--color-1-transparent').trim() :
          '#0f0f0f';
      // Draw background for the meter bar area
      ctx.fillRect(minMeterPosition, 0, meterWidth - minMeterPosition, 4);

      // Draw "S" in top-left corner
      ctx.font = '8px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText('S', 5, 6);

      let allTickPositions, numberPositions, numberValues;

      ctx.font = '9px Arial, sans-serif';

      // Tick positions
      allTickPositions = [16, 28, 40, 52, 64, 76, 88, 100, 112, 124, 144, 164, 184, 204, 224, 244];

      // Number positions
      let baseNumberPositions = [28, 52, 76, 100, 124, 144, 164, 184, 204, 224, 244];

      // Adjust +10 to +60 number positions by shifting slightly left, ignoring "+"
      numberPositions = baseNumberPositions.map((pos, index) => {
          return index >= 5 ? pos - 3 : pos;
      });

      numberValues = ['1', '3', '5', '7', '9', '+10', '+20', '+30', '+40', '+50', '+60'];

      // Text alignment for numbers
      ctx.textAlign = 'center';

      // Draw tick marks
      allTickPositions.forEach((pos, index) => {
          if (pos < meterWidth) {
              ctx.beginPath();
              ctx.moveTo(pos, 3);
              ctx.lineTo(pos, 5);

              if (index <= 9) {
                  ctx.strokeStyle = '#08C818'; // Green
              } else {
                  ctx.strokeStyle = '#E81808'; // Red
              }
              ctx.lineWidth = 2;
              ctx.stroke();
          }
      });

      // Draw numbers
      ctx.fillStyle = '#FFFFFF';

      numberPositions.forEach((pos, index) => {
          if (pos < meterWidth && index < numberValues.length) {
              ctx.fillText(numberValues[index], pos, signalMeter.height);
          }
      });
  }

  function drawSignalMeter(signalValue, signalValueHighest, ctx, signalMeter) {
      const meterWidth = signalMeter.width - maxMeterPosition;

      // Clear the canvas before redrawing
      ctx.clearRect(0, 0, signalMeter.width, signalMeter.height);

      // Draw scale marks and numbers
      drawScaleMarks(ctx, signalMeter);

      // Invert canvas colour if text colour is dark
      if (USE_THEME_COLORS) {
          function getLuminance(rgb) {
              const [r, g, b] = rgb.map(value => value / 255);
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          }
          const computedStyleBackgroundColor = getComputedStyle(document.documentElement);
          const colorMain = computedStyleBackgroundColor.getPropertyValue('--color-text').trim();
          const rgbMatch = colorMain.match(/\d+/g);
          if (rgbMatch) {
              const rgbValues = rgbMatch.map(Number); // Convert strings to numbers
              const luminance = getLuminance(rgbValues);
              if (luminance < 0.5) {
                  const imageData = ctx.getImageData(0, 0, signalMeter.width, signalMeter.height);
                  const data = imageData.data;
                  for (let i = 0; i < data.length; i += 4) {
                      data[i] = 255 - data[i];         // Invert red
                      data[i + 1] = 255 - data[i + 1]; // Invert green
                      data[i + 2] = 255 - data[i + 2]; // Invert blue
                  }
                  ctx.putImageData(imageData, 0, 0);
              }
          }
      }

      // Draw the dark gray line in the background
      ctx.beginPath();
      ctx.moveTo(minMeterPosition, 0); // Start from the top left corner
      ctx.lineTo(meterWidth, 0); // Move horizontally to the right
      if (USE_THEME_COLORS) {
        const computedStyleBackground = getComputedStyle(document.documentElement);
        const colorBackground = computedStyleBackground.getPropertyValue('--color-2-transparent').trim();
        ctx.strokeStyle = colorBackground; // Dark background
      } else {
        ctx.strokeStyle = '#212223'; // Dark Grey
      }
      ctx.lineWidth = 8;
      ctx.stroke();

      // Calculate the needle position
      const maxPosition = (signalMeter.width + 8) / 100;
      const normalizedStrength = ((signalValue + 35) / (132)) * 100;
      needlePosition = Math.min(normalizedStrength * maxPosition, meterWidth);

      // Calculate the peak needle position
      const normalizedStrengthHighest = ((signalValueHighest + 35) / (132)) * 100;
      needlePositionHighest = Math.min(normalizedStrengthHighest * maxPosition, meterWidth);

      // Low signal interpolation
      if (RADIO_NOISE_FLOOR && (!AM_OFFSET || currentFrequency > 27)) {
          let sRepValue;
          if (RADIO_NOISE_FLOOR >= -150 && RADIO_NOISE_FLOOR <= -114) {
              sRepValue = ((2 * RADIO_NOISE_FLOOR) + 310).toFixed(1);
          } else {
              sRepValue = 64;
          }
          let sIntValue = 18; // Value in px of the interpolated noise floor
          let sMaxValue = 86; // Value in px where signal begins to deviate
          if (needlePosition < sMaxValue) {
              needlePosition = sIntValue + (needlePosition - sRepValue) * (sMaxValue - sIntValue) / (sMaxValue - sRepValue);
          }
          if (needlePositionHighest < sMaxValue) {
              needlePositionHighest = sIntValue + (needlePositionHighest - sRepValue) * (sMaxValue - sIntValue) / (sMaxValue - sRepValue);
          }
      }

      // Never fall below line starting position
      needlePosition = Math.max(needlePosition, minMeterStart);
      needlePositionHighest = Math.max(needlePositionHighest, minMeterStart);

      // Squelch marker to never fall outside the region
      markerPositionMin = minMeterStart;
      markerPositionMax = meterWidth - 1;

      if (debugMode) {
          console.log('normalizedStrength: ' + Math.round(normalizedStrength),
                     '|| needlePosition: ' + Math.round(needlePosition),
                     '|| signalStrength: ' + (signalStrength).toFixed(1),
                     '|| signalStrengthHighest: ' + (signalStrengthHighest).toFixed(1));
      }

      ctx.beginPath();
      ctx.moveTo(minMeterPosition, 0); // Start from the top left corner
      ctx.lineTo(Math.min((needlePositionHighest), signalMeter.width), 0); // Move horizontally to the right up to half width
      if (USE_THEME_COLORS) {
        const computedStylePeak = getComputedStyle(document.documentElement);
        const colorBackgroundPeak = computedStylePeak.getPropertyValue('--color-2').trim();
        ctx.strokeStyle = colorBackgroundPeak; // Background peak
      } else {
        ctx.strokeStyle = '#35373A'; // Grey
      }
      ctx.lineWidth = 8;
      ctx.stroke();

      // Draw the first half of the needle in green
      ctx.beginPath();
      ctx.moveTo(minMeterPosition, 0); // Start from the top left corner
      ctx.lineTo(Math.min(needlePosition, (signalMeter.width / 2) - 4), 0); // Move horizontally to the right up to half width
      ctx.strokeStyle = '#08B818'; // Green
      if (debugMode && needlePosition < sMaxValue) {
          ctx.strokeStyle = '#08FF18';
      }
      ctx.lineWidth = 8;
      ctx.stroke();

      // Draw the second half of the needle in red
      ctx.beginPath();
      ctx.moveTo((signalMeter.width / 2) - 4, 0); // Start from the top middle
      ctx.lineTo(Math.max((signalMeter.width / 2) - 4, needlePosition), 0); // Move horizontally to the right from half width
      ctx.strokeStyle = '#E01808'; // Red
      ctx.lineWidth = 8;
      ctx.stroke();
  }

  initSignalMeterSmall();

  // Tooltip
  function initMeterTooltips() {
      $('.tooltip-meter').hover(function(e){
          // Never display again after first click
          $(document).on('mousedown', () => { clearTimeout($(this).data('timeout')); return; });
          if (!document.querySelector('.tooltip-meter')) { return; }

          let tooltipText = $(this).data('tooltip');
          // Add a delay of 500 milliseconds before creating and appending the tooltip
          $(this).data('timeout', setTimeout(() => {
              let tooltip = $('<div class="tooltiptext"></div>').html(tooltipText);
              $('body').append(tooltip);

              let posX = e.pageX;
              let posY = e.pageY;

              let tooltipWidth = tooltip.outerWidth();
              let tooltipHeight = tooltip.outerHeight();
              posX -= tooltipWidth / 2;
              posY -= tooltipHeight + 10;
              tooltip.css({ top: posY, left: posX, opacity: .99 }); // Set opacity to 1
          }, 500));
      }, function() {
          // Clear the timeout if the mouse leaves before the delay completes
          clearTimeout($(this).data('timeout'));
          $('.tooltiptext').remove();
      }).mousemove(function(e){
          let tooltipWidth = $('.tooltiptext').outerWidth();
          let tooltipHeight = $('.tooltiptext').outerHeight();
          let posX = e.pageX - tooltipWidth / 2;
          let posY = e.pageY - tooltipHeight - 10;

          $('.tooltiptext').css({ top: posY, left: posX });
      });
  }

    // Function for update notification in /setup
    function checkUpdate(setupOnly, pluginVersion, pluginName, urlUpdateLink, urlFetchLink) {
        if (setupOnly && window.location.pathname !== '/setup') return;

        // Function to check for updates
        async function fetchFirstLine() {
            const urlCheckForUpdate = urlFetchLink;

            try {
                const response = await fetch(urlCheckForUpdate);
                if (!response.ok) {
                    throw new Error(`[${pluginName}] update check HTTP error! status: ${response.status}`);
                }

                const text = await response.text();
                const lines = text.split('\n');

                let version;

                if (lines.length > 2) {
                    const versionLine = lines.find(line => line.includes("const pluginVersion =") || line.includes("const plugin_version ="));
                    if (versionLine) {
                        const match = versionLine.match(/const\s+plugin[_vV]ersion\s*=\s*['"]([^'"]+)['"]/);
                        if (match) {
                            version = match[1];
                        }
                    }
                }

                if (!version) {
                    const firstLine = lines[0].trim();
                    version = /^\d/.test(firstLine) ? firstLine : "Unknown"; // Check if first character is a number
                }

                return version;
            } catch (error) {
                console.error(`[${pluginName}] error fetching file:`, error);
                return null;
            }
        }

        // Check for updates
        fetchFirstLine().then(newVersion => {
            if (newVersion) {
                if (newVersion !== pluginVersion) {
                    let updateConsoleText = "There is a new version of this plugin available";
                    // Any custom code here
                    
                    console.log(`[${pluginName}] ${updateConsoleText}`);
                    setupNotify(pluginVersion, newVersion, pluginName, urlUpdateLink);
                }
            }
        });

        function setupNotify(pluginVersion, newVersion, pluginName, urlUpdateLink) {
            if (window.location.pathname === '/setup') {
              const pluginSettings = document.getElementById('plugin-settings');
              if (pluginSettings) {
                const currentText = pluginSettings.textContent.trim();
                const newText = `<a href="${urlUpdateLink}" target="_blank">[${pluginName}] Update available: ${pluginVersion} --> ${newVersion}</a><br>`;

                if (currentText === 'No plugin settings are available.') {
                  pluginSettings.innerHTML = newText;
                } else {
                  pluginSettings.innerHTML += ' ' + newText;
                }
              }

              const updateIcon = document.querySelector('.wrapper-outer #navigation .sidenav-content .fa-puzzle-piece') || document.querySelector('.wrapper-outer .sidenav-content') || document.querySelector('.sidenav-content');

              const redDot = document.createElement('span');
              redDot.style.display = 'block';
              redDot.style.width = '12px';
              redDot.style.height = '12px';
              redDot.style.borderRadius = '50%';
              redDot.style.backgroundColor = '#FE0830' || 'var(--color-main-bright)'; // Theme colour set here as placeholder only
              redDot.style.marginLeft = '82px';
              redDot.style.marginTop = '-12px';

              updateIcon.appendChild(redDot);
            }
        }
    }

    if (CHECK_FOR_UPDATES) {
        checkUpdate(pluginSetupOnlyNotify, pluginVersion, pluginName, pluginHomepageUrl, pluginUpdateUrl);
    }

})();
