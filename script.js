const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const introGate = document.getElementById('intro-gate');
if (introGate) {
  const INTRO_DURATION_MS = 5000;
  const FORM_PHASE_MS = 2600;
  const DISSOLVE_PHASE_MS = INTRO_DURATION_MS - FORM_PHASE_MS;
  const INTRO_FPS = 60;
  const introParticleCanvas = document.getElementById('intro-particle-canvas');

  const startIntroParticles = (canvas, durationMs, formPhaseMs, dissolvePhaseMs, fps, gateElement) => {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const random = (min, max) => min + Math.random() * (max - min);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const parseCssColor = (value, fallback) => {
      const raw = (value || '').trim().toLowerCase();
      if (!raw) {
        return fallback;
      }
      if (raw.startsWith('#')) {
        let hex = raw.slice(1);
        if (hex.length === 3) {
          hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
        }
        if (/^[0-9a-f]{6}$/i.test(hex)) {
          return [
            Number.parseInt(hex.slice(0, 2), 16),
            Number.parseInt(hex.slice(2, 4), 16),
            Number.parseInt(hex.slice(4, 6), 16)
          ];
        }
      }
      const rgbMatch = raw.match(/rgba?\(([^)]+)\)/);
      if (rgbMatch) {
        const parts = rgbMatch[1]
          .split(',')
          .map((part) => Number.parseFloat(part.trim()))
          .filter((part) => Number.isFinite(part));
        if (parts.length >= 3) {
          return [
            Math.max(0, Math.min(255, Math.round(parts[0]))),
            Math.max(0, Math.min(255, Math.round(parts[1]))),
            Math.max(0, Math.min(255, Math.round(parts[2])))
          ];
        }
      }
      return fallback;
    };
    const shuffleInPlace = (list) => {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
      return list;
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = Math.max(70, bounds.height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.floor(width);
    offscreen.height = Math.floor(height);
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) {
      return () => {};
    }

    const label = 'SUZUKI YUMA';
    const fontSize = clamp(width * 0.16, 92, 260);
    offCtx.clearRect(0, 0, width, height);
    offCtx.font = `700 ${fontSize}px "Oswald", "Space Grotesk", sans-serif`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = '#ffffff';
    offCtx.fillText(label, width * 0.5, height * 0.55);

    const image = offCtx.getImageData(0, 0, width, height).data;
    const sampleStep = Math.max(2, Math.floor(width / 340));
    const targets = [];
    for (let y = 0; y < height; y += sampleStep) {
      const row = y * width;
      for (let x = 0; x < width; x += sampleStep) {
        const alpha = image[(row + x) * 4 + 3];
        if (alpha > 150 && Math.random() > 0.18) {
          targets.push({ x, y });
        }
      }
    }

    if (targets.length < 40) {
      return () => {};
    }

    const centerX = width * 0.5;
    const centerY = height * 0.55;
    const spawnFromStormRing = () => {
      const angle = random(0, Math.PI * 2);
      const maxR = Math.max(width, height) * 0.86;
      const minR = Math.max(width, height) * 0.38;
      const radius = random(minR, maxR);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    };

    const shuffledTargets = shuffleInPlace(targets.slice());
    const particleCount = Math.min(3600, Math.max(1200, Math.floor(targets.length * 1.1)));

    const posX = new Float32Array(particleCount);
    const posY = new Float32Array(particleCount);
    const velX = new Float32Array(particleCount);
    const velY = new Float32Array(particleCount);
    const targetX = new Float32Array(particleCount);
    const targetY = new Float32Array(particleCount);
    const size = new Float32Array(particleCount);
    const seed = new Float32Array(particleCount);
    const tone = new Uint8Array(particleCount);
    const orbitDir = new Int8Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      const start = spawnFromStormRing();
      const targetIndex = Math.floor((i / particleCount) * shuffledTargets.length);
      const target = shuffledTargets[targetIndex];
      posX[i] = start.x;
      posY[i] = start.y;
      velX[i] = random(-1.2, 1.2);
      velY[i] = random(-1.2, 1.2);
      targetX[i] = target.x;
      targetY[i] = target.y;
      size[i] = random(0.7, 1.75);
      seed[i] = random(0, Math.PI * 2);
      tone[i] = Math.random() > 0.48 ? 0 : 1;
      orbitDir[i] = Math.random() > 0.5 ? 1 : -1;
    }

    const STORM_PHASE_RATIO = 0.88;
    const formFrameCount = Math.max(2, Math.ceil((formPhaseMs / 1000) * fps) + 1);
    const formStride = particleCount * 2;
    const formTrajectory = new Float32Array(formFrameCount * formStride);

    // Precompute text-forming particle motion.
    for (let frame = 0; frame < formFrameCount; frame += 1) {
      const progress = frame / (formFrameCount - 1);
      const stormProgress = clamp(progress / STORM_PHASE_RATIO, 0, 1);
      const gather = easeOutCubic(clamp((stormProgress - 0.34) / 0.66, 0, 1));
      const storm = Math.pow(1 - stormProgress, 1.08);
      const simTime = progress * formPhaseMs;

      if (frame > 0) {
        for (let i = 0; i < particleCount; i += 1) {
          const px = posX[i];
          const py = posY[i];
          const pcx = px - centerX;
          const pcy = py - centerY;
          const distC = Math.hypot(pcx, pcy) || 1;
          const nx = pcx / distC;
          const ny = pcy / distC;
          const tx = -ny * orbitDir[i];
          const ty = nx * orbitDir[i];
          const radialNudge = Math.sin(simTime * 0.0036 + seed[i]) * (10 + storm * 24);
          const dxToTarget = targetX[i] + radialNudge * nx - px;
          const dyToTarget = targetY[i] + radialNudge * ny - py;

          const tangentialForce =
            (0.32 + storm * 1.55) * (0.34 + clamp(distC / (Math.max(width, height) * 0.62), 0, 1));
          const centerPull = 0.008 + storm * 0.08;
          const targetPull = 0.006 + gather * 0.42;
          let vx = velX[i] + tx * tangentialForce - nx * centerPull + dxToTarget * targetPull * 0.06;
          let vy = velY[i] + ty * tangentialForce - ny * centerPull + dyToTarget * targetPull * 0.06;

          const damping = 0.915 - gather * 0.17;
          vx *= damping;
          vy *= damping;

          let nextX = px + vx;
          let nextY = py + vy;

          if (stormProgress > 0.82) {
            const snap = (stormProgress - 0.82) / 0.18;
            const snapStrength = 0.15 + snap * 0.52;
            nextX += (targetX[i] - nextX) * snapStrength;
            nextY += (targetY[i] - nextY) * snapStrength;
          }

          posX[i] = nextX;
          posY[i] = nextY;
          velX[i] = vx;
          velY[i] = vy;
        }
      }

      const base = frame * formStride;
      for (let i = 0; i < particleCount; i += 1) {
        const p = base + i * 2;
        formTrajectory[p] = posX[i];
        formTrajectory[p + 1] = posY[i];
      }
    }

    const bgColor = parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--bg'), [12, 14, 18]);
    const totalFrameCount = Math.max(2, Math.ceil((durationMs / 1000) * fps) + 1);
    const totalStride = particleCount * 2;
    const timelinePos = new Float32Array(totalFrameCount * totalStride);
    const frameAlpha = new Float32Array(totalFrameCount);
    const frameSizeScale = new Float32Array(totalFrameCount);
    const frameGateOpacity = new Float32Array(totalFrameCount);
    const brightR = new Uint8Array(totalFrameCount);
    const brightG = new Uint8Array(totalFrameCount);
    const brightB = new Uint8Array(totalFrameCount);
    const softR = new Uint8Array(totalFrameCount);
    const softG = new Uint8Array(totalFrameCount);
    const softB = new Uint8Array(totalFrameCount);

    const MAX_RIPPLES_PER_FRAME = 22;
    const ringData = new Float32Array(totalFrameCount * MAX_RIPPLES_PER_FRAME * 4);
    const ringCount = new Uint8Array(totalFrameCount);

    const rippleEventCount = 12;
    const rippleEvents = new Array(rippleEventCount).fill(0).map((_, index) => {
      const lane = (index + 0.5) / rippleEventCount;
      return {
        x: lane * width + random(-width * 0.09, width * 0.09),
        y: random(height * 0.28, height * 0.9),
        startMs: formPhaseMs + index * (dissolvePhaseMs * 0.08) + random(-90, 120),
        speed: random(0.16, 0.24),
        band: random(22, 38),
        amp: random(3.6, 7.8),
        decay: random(0.0036, 0.0054),
        phaseSpeed: random(0.028, 0.042),
        maxRadius: Math.max(width, height) * 1.26,
        freq: random(0.16, 0.23)
      };
    });

    // Precompute full timeline: ripple dissolve offsets + color + opacity.
    for (let frame = 0; frame < totalFrameCount; frame += 1) {
      const tMs = (frame / (totalFrameCount - 1)) * durationMs;
      const formProgress = clamp(tMs / formPhaseMs, 0, 1);
      const dissolveProgress = clamp((tMs - formPhaseMs) / dissolvePhaseMs, 0, 1);
      const dissolveEase = easeOutCubic(dissolveProgress);
      const blendToBg = Math.pow(dissolveEase, 0.88);

      frameAlpha[frame] = (0.2 + (1 - dissolveEase) * 0.74) * (1 - dissolveProgress * 0.44);
      frameSizeScale[frame] = 1.52 - dissolveProgress * 0.46;
      frameGateOpacity[frame] = 1 - Math.pow(dissolveEase, 1.05);

      brightR[frame] = Math.round(250 + (bgColor[0] - 250) * blendToBg);
      brightG[frame] = Math.round(250 + (bgColor[1] - 250) * blendToBg);
      brightB[frame] = Math.round(250 + (bgColor[2] - 250) * blendToBg);
      softR[frame] = Math.round(200 + (bgColor[0] - 200) * blendToBg);
      softG[frame] = Math.round(200 + (bgColor[1] - 200) * blendToBg);
      softB[frame] = Math.round(200 + (bgColor[2] - 200) * blendToBg);

      let activeRingCount = 0;
      for (let r = 0; r < rippleEvents.length; r += 1) {
        const event = rippleEvents[r];
        const age = tMs - event.startMs;
        if (age < 0) {
          continue;
        }

        const radius = age * event.speed;
        const ringAlpha = Math.exp(-age * event.decay) * (0.18 + (1 - dissolveEase) * 0.28);
        if (ringAlpha < 0.014 || radius > event.maxRadius) {
          continue;
        }

        if (activeRingCount >= MAX_RIPPLES_PER_FRAME) {
          break;
        }

        const ringBase = frame * MAX_RIPPLES_PER_FRAME * 4 + activeRingCount * 4;
        ringData[ringBase] = event.x;
        ringData[ringBase + 1] = event.y;
        ringData[ringBase + 2] = radius;
        ringData[ringBase + 3] = ringAlpha;
        activeRingCount += 1;
      }
      ringCount[frame] = activeRingCount;

      const formFramePos = formProgress * (formFrameCount - 1);
      const formA = Math.floor(formFramePos);
      const formB = Math.min(formFrameCount - 1, formA + 1);
      const formBlend = formFramePos - formA;
      const formBaseA = formA * formStride;
      const formBaseB = formB * formStride;

      const dissolveDriftY = dissolveEase * dissolveEase * (height * 0.18);
      const rippleAttenuation = 1 - dissolveProgress * 0.58;

      for (let i = 0; i < particleCount; i += 1) {
        const pIndex = i * 2;
        const ax = formTrajectory[formBaseA + pIndex];
        const ay = formTrajectory[formBaseA + pIndex + 1];
        const bx = formTrajectory[formBaseB + pIndex];
        const by = formTrajectory[formBaseB + pIndex + 1];

        let x = ax + (bx - ax) * formBlend;
        let y = ay + (by - ay) * formBlend;

        if (dissolveProgress > 0) {
          x += Math.sin(seed[i] + tMs * 0.0053) * dissolveEase * 1.2;
          y += dissolveDriftY + Math.cos(seed[i] * 1.27 + tMs * 0.0047) * dissolveEase * 1.7;

          let offX = 0;
          let offY = 0;
          for (let r = 0; r < rippleEvents.length; r += 1) {
            const event = rippleEvents[r];
            const age = tMs - event.startMs;
            if (age < 0) {
              continue;
            }

            const radius = age * event.speed;
            if (radius > event.maxRadius) {
              continue;
            }

            const dx = x - event.x;
            const dy = y - event.y;
            const dist = Math.hypot(dx, dy) || 1;
            const diff = dist - radius;
            const absDiff = Math.abs(diff);
            if (absDiff > event.band) {
              continue;
            }

            const envelope = 1 - absDiff / event.band;
            const wave = Math.sin(diff * event.freq - age * event.phaseSpeed + seed[i]) * event.amp;
            const displacement = wave * envelope * rippleAttenuation;
            offX += (dx / dist) * displacement * 0.34;
            offY += (dy / dist) * displacement * 0.88;
          }
          x += offX;
          y += offY;
        }

        const base = frame * totalStride + pIndex;
        timelinePos[base] = x;
        timelinePos[base + 1] = y;
      }
    }

    const startCanvas2DRenderer = (ctx) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let rafId = 0;
      let stopped = false;
      const startAt = performance.now();

      const render = (timestamp) => {
        if (stopped) {
          return;
        }

        const elapsed = timestamp - startAt;
        const progress = clamp(elapsed / durationMs, 0, 1);
        const framePos = progress * (totalFrameCount - 1);
        const frameA = Math.floor(framePos);
        const frameB = Math.min(totalFrameCount - 1, frameA + 1);
        const blend = framePos - frameA;
        const baseA = frameA * totalStride;
        const baseB = frameB * totalStride;

        ctx.clearRect(0, 0, width, height);

        const dissolveNow = clamp((elapsed - formPhaseMs) / dissolvePhaseMs, 0, 1);
        const ringBlendColor = Math.pow(easeOutCubic(dissolveNow), 0.86);
        const ringR = Math.round(255 + (bgColor[0] - 255) * ringBlendColor);
        const ringG = Math.round(255 + (bgColor[1] - 255) * ringBlendColor);
        const ringB = Math.round(255 + (bgColor[2] - 255) * ringBlendColor);

        const activeRingCount = ringCount[frameA];
        if (activeRingCount > 0) {
          ctx.lineWidth = 1.1;
          for (let i = 0; i < activeRingCount; i += 1) {
            const rb = frameA * MAX_RIPPLES_PER_FRAME * 4 + i * 4;
            const x = ringData[rb];
            const y = ringData[rb + 1];
            const radius = ringData[rb + 2];
            const alpha = ringData[rb + 3];
            ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${alpha})`;
            ctx.beginPath();
            ctx.ellipse(x, y, radius, Math.max(1, radius * 0.34), 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const alpha = frameAlpha[frameA] + (frameAlpha[frameB] - frameAlpha[frameA]) * blend;
        const sizeScale = frameSizeScale[frameA] + (frameSizeScale[frameB] - frameSizeScale[frameA]) * blend;

        const bR = Math.round(brightR[frameA] + (brightR[frameB] - brightR[frameA]) * blend);
        const bG = Math.round(brightG[frameA] + (brightG[frameB] - brightG[frameA]) * blend);
        const bB = Math.round(brightB[frameA] + (brightB[frameB] - brightB[frameA]) * blend);
        const sR = Math.round(softR[frameA] + (softR[frameB] - softR[frameA]) * blend);
        const sG = Math.round(softG[frameA] + (softG[frameB] - softG[frameA]) * blend);
        const sB = Math.round(softB[frameA] + (softB[frameB] - softB[frameA]) * blend);

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${bR}, ${bG}, ${bB}, ${alpha})`;
        for (let i = 0; i < particleCount; i += 1) {
          if (tone[i] !== 0) {
            continue;
          }
          const p = i * 2;
          const ax = timelinePos[baseA + p];
          const ay = timelinePos[baseA + p + 1];
          const bx = timelinePos[baseB + p];
          const by = timelinePos[baseB + p + 1];
          const x = ax + (bx - ax) * blend;
          const y = ay + (by - ay) * blend;
          const radius = size[i] * sizeScale;
          ctx.fillRect(x - radius * 0.5, y - radius * 0.5, radius, radius);
        }

        ctx.fillStyle = `rgba(${sR}, ${sG}, ${sB}, ${alpha})`;
        for (let i = 0; i < particleCount; i += 1) {
          if (tone[i] !== 1) {
            continue;
          }
          const p = i * 2;
          const ax = timelinePos[baseA + p];
          const ay = timelinePos[baseA + p + 1];
          const bx = timelinePos[baseB + p];
          const by = timelinePos[baseB + p + 1];
          const x = ax + (bx - ax) * blend;
          const y = ay + (by - ay) * blend;
          const radius = size[i] * sizeScale;
          ctx.fillRect(x - radius * 0.5, y - radius * 0.5, radius, radius);
        }
        ctx.globalCompositeOperation = 'source-over';

        if (gateElement) {
          const gateOpacity = frameGateOpacity[frameA] + (frameGateOpacity[frameB] - frameGateOpacity[frameA]) * blend;
          gateElement.style.opacity = `${gateOpacity}`;
        }

        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
      return () => {
        stopped = true;
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
      };
    };

    const startWebGL2Renderer = (gl) => {
      const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        if (!shader) {
          return null;
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const linkProgram = (vertexSource, fragmentSource) => {
        const vs = compileShader(gl.VERTEX_SHADER, vertexSource);
        const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vs || !fs) {
          if (vs) {
            gl.deleteShader(vs);
          }
          if (fs) {
            gl.deleteShader(fs);
          }
          return null;
        }

        const program = gl.createProgram();
        if (!program) {
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          return null;
        }

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.deleteProgram(program);
          return null;
        }

        return program;
      };

      const vertexSource = `#version 300 es
      precision highp float;

      layout(location = 0) in float aIndex;
      layout(location = 1) in float aSize;
      layout(location = 2) in float aTone;

      uniform sampler2D uPositions;
      uniform float uFrameA;
      uniform float uFrameB;
      uniform float uBlend;
      uniform float uParticleCount;
      uniform float uFrameCount;
      uniform vec2 uResolution;
      uniform float uSizeScale;
      uniform float uDpr;

      out float vTone;

      void main() {
        float u = (aIndex + 0.5) / uParticleCount;
        float vA = (uFrameA + 0.5) / uFrameCount;
        float vB = (uFrameB + 0.5) / uFrameCount;

        vec2 posA = texture(uPositions, vec2(u, vA)).rg;
        vec2 posB = texture(uPositions, vec2(u, vB)).rg;
        vec2 pos = mix(posA, posB, uBlend);

        vec2 clip = vec2(
          (pos.x / uResolution.x) * 2.0 - 1.0,
          1.0 - (pos.y / uResolution.y) * 2.0
        );

        gl_Position = vec4(clip, 0.0, 1.0);
        gl_PointSize = max(1.0, aSize * uSizeScale * uDpr);
        vTone = aTone;
      }
      `;

      const fragmentSource = `#version 300 es
      precision highp float;

      in float vTone;
      uniform vec4 uBrightColor;
      uniform vec4 uSoftColor;

      out vec4 outColor;

      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float falloff = exp(-dot(p, p) * 2.9);
        vec4 baseColor = (vTone < 0.5) ? uBrightColor : uSoftColor;
        outColor = vec4(baseColor.rgb, baseColor.a * falloff);
      }
      `;

      const program = linkProgram(vertexSource, fragmentSource);
      if (!program) {
        return null;
      }

      const vao = gl.createVertexArray();
      const indexBuffer = gl.createBuffer();
      const sizeBuffer = gl.createBuffer();
      const toneBuffer = gl.createBuffer();
      const positionTexture = gl.createTexture();
      if (!vao || !indexBuffer || !sizeBuffer || !toneBuffer || !positionTexture) {
        if (vao) {
          gl.deleteVertexArray(vao);
        }
        if (indexBuffer) {
          gl.deleteBuffer(indexBuffer);
        }
        if (sizeBuffer) {
          gl.deleteBuffer(sizeBuffer);
        }
        if (toneBuffer) {
          gl.deleteBuffer(toneBuffer);
        }
        if (positionTexture) {
          gl.deleteTexture(positionTexture);
        }
        gl.deleteProgram(program);
        return null;
      }

      const particleIndices = new Float32Array(particleCount);
      const particleSizes = new Float32Array(particleCount);
      const particleTones = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i += 1) {
        particleIndices[i] = i;
        particleSizes[i] = size[i];
        particleTones[i] = tone[i];
      }

      gl.bindVertexArray(vao);

      gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleIndices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleSizes, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, toneBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleTones, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindVertexArray(null);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, positionTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, particleCount, totalFrameCount, 0, gl.RG, gl.FLOAT, timelinePos);

      const uPositions = gl.getUniformLocation(program, 'uPositions');
      const uFrameA = gl.getUniformLocation(program, 'uFrameA');
      const uFrameB = gl.getUniformLocation(program, 'uFrameB');
      const uBlend = gl.getUniformLocation(program, 'uBlend');
      const uParticleCount = gl.getUniformLocation(program, 'uParticleCount');
      const uFrameCount = gl.getUniformLocation(program, 'uFrameCount');
      const uResolution = gl.getUniformLocation(program, 'uResolution');
      const uSizeScale = gl.getUniformLocation(program, 'uSizeScale');
      const uDpr = gl.getUniformLocation(program, 'uDpr');
      const uBrightColor = gl.getUniformLocation(program, 'uBrightColor');
      const uSoftColor = gl.getUniformLocation(program, 'uSoftColor');

      gl.useProgram(program);
      gl.uniform1i(uPositions, 0);
      gl.uniform1f(uParticleCount, particleCount);
      gl.uniform1f(uFrameCount, totalFrameCount);
      gl.uniform2f(uResolution, width, height);
      gl.uniform1f(uDpr, dpr);

      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      let rafId = 0;
      let stopped = false;
      const startAt = performance.now();

      const render = (timestamp) => {
        if (stopped) {
          return;
        }

        const elapsed = timestamp - startAt;
        const progress = clamp(elapsed / durationMs, 0, 1);
        const framePos = progress * (totalFrameCount - 1);
        const frameA = Math.floor(framePos);
        const frameB = Math.min(totalFrameCount - 1, frameA + 1);
        const blend = framePos - frameA;

        const alpha = frameAlpha[frameA] + (frameAlpha[frameB] - frameAlpha[frameA]) * blend;
        const sizeScale = frameSizeScale[frameA] + (frameSizeScale[frameB] - frameSizeScale[frameA]) * blend;

        const bR = (brightR[frameA] + (brightR[frameB] - brightR[frameA]) * blend) / 255;
        const bG = (brightG[frameA] + (brightG[frameB] - brightG[frameA]) * blend) / 255;
        const bB = (brightB[frameA] + (brightB[frameB] - brightB[frameA]) * blend) / 255;
        const sR = (softR[frameA] + (softR[frameB] - softR[frameA]) * blend) / 255;
        const sG = (softG[frameA] + (softG[frameB] - softG[frameA]) * blend) / 255;
        const sB = (softB[frameA] + (softB[frameB] - softB[frameA]) * blend) / 255;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(uFrameA, frameA);
        gl.uniform1f(uFrameB, frameB);
        gl.uniform1f(uBlend, blend);
        gl.uniform1f(uSizeScale, sizeScale);
        gl.uniform4f(uBrightColor, bR, bG, bB, alpha);
        gl.uniform4f(uSoftColor, sR, sG, sB, alpha);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, particleCount);
        gl.bindVertexArray(null);

        if (gateElement) {
          const gateOpacity = frameGateOpacity[frameA] + (frameGateOpacity[frameB] - frameGateOpacity[frameA]) * blend;
          gateElement.style.opacity = `${gateOpacity}`;
        }

        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
      return () => {
        stopped = true;
        if (rafId) {
          cancelAnimationFrame(rafId);
        }

        const dispose = () => {
          gl.deleteTexture(positionTexture);
          gl.deleteBuffer(indexBuffer);
          gl.deleteBuffer(sizeBuffer);
          gl.deleteBuffer(toneBuffer);
          gl.deleteVertexArray(vao);
          gl.deleteProgram(program);
        };

        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(dispose, { timeout: 1000 });
        } else {
          window.setTimeout(dispose, 0);
        }
      };
    };

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      desynchronized: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });

    if (gl) {
      const stopWebGL = startWebGL2Renderer(gl);
      if (stopWebGL) {
        return stopWebGL;
      }
    }

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) {
      return () => {};
    }

    return startCanvas2DRenderer(ctx);
  };

  document.body.classList.add('intro-lock');

  requestAnimationFrame(() => {
    introGate.classList.add('is-visible');
  });

  let stopIntroParticles = () => {};
  if (introParticleCanvas) {
    stopIntroParticles = startIntroParticles(
      introParticleCanvas,
      INTRO_DURATION_MS,
      FORM_PHASE_MS,
      DISSOLVE_PHASE_MS,
      INTRO_FPS,
      introGate
    );
  }

  window.setTimeout(() => {
    stopIntroParticles();
    stopIntroParticles = () => {};
    const finishIntro = () => {
      introGate.remove();
      document.body.classList.remove('intro-lock');
    };
    window.requestAnimationFrame(finishIntro);
  }, INTRO_DURATION_MS);
}
const revealElements = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  { threshold: 0.14 }
);

revealElements.forEach((element, index) => {
  element.style.transitionDelay = `${index * 0.08}s`;
  observer.observe(element);
});

const yearElement = document.getElementById('year');
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const contactForm = document.getElementById('contact-form');
if (contactForm) {
  const contactMailAppButton = document.getElementById('contact-mail-app');
  const contactTo = 'yuma.suzuki.work@gmail.com';

  const getContactPayload = () => {
    const name = (document.getElementById('contact-name')?.value || '').trim();
    const email = (document.getElementById('contact-email')?.value || '').trim();
    const subjectInput = (document.getElementById('contact-subject')?.value || '').trim();
    const message = (document.getElementById('contact-message')?.value || '').trim();
    const subject = subjectInput || 'Portfolio Inquiry';
    const body = [
      `Name: ${name || '(not provided)'}`,
      `Email: ${email || '(not provided)'}`,
      '',
      message || '(no message)'
    ].join('\n');
    return { subject, body };
  };

  const openMailApp = () => {
    const { subject, body } = getContactPayload();
    const mailto = `mailto:${contactTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const openGmailCompose = () => {
    const { subject, body } = getContactPayload();
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', contactTo);
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', body);

    const popup = window.open(gmailUrl.toString(), '_blank', 'noopener,noreferrer');
    if (!popup) {
      openMailApp();
    }
  };

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    openGmailCompose();
  });

  if (contactMailAppButton) {
    contactMailAppButton.addEventListener('click', openMailApp);
  }
}

const rootElement = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const THEME_STORAGE_KEY = 'portfolio-theme-mode';
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

let themeMode = 'system';
let resolvedTheme = systemDarkQuery.matches ? 'dark' : 'light';

const updateThemeToggleLabel = () => {
  if (!themeToggle) {
    return;
  }

  if (themeMode === 'system') {
    themeToggle.textContent = `Theme: Auto (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`;
  } else {
    themeToggle.textContent = `Theme: ${themeMode === 'dark' ? 'Dark' : 'Light'}`;
  }
};

const applyThemeMode = (nextMode) => {
  themeMode = nextMode;

  if (themeMode === 'system') {
    rootElement.removeAttribute('data-theme');
    resolvedTheme = systemDarkQuery.matches ? 'dark' : 'light';
  } else {
    rootElement.setAttribute('data-theme', themeMode);
    resolvedTheme = themeMode;
  }

  updateThemeToggleLabel();
};

try {
  const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedMode === 'dark' || storedMode === 'light' || storedMode === 'system') {
    themeMode = storedMode;
  }
} catch {
  themeMode = 'system';
}

applyThemeMode(themeMode);

const handleSystemThemeChange = () => {
  if (themeMode === 'system') {
    applyThemeMode('system');
  }
};

if (typeof systemDarkQuery.addEventListener === 'function') {
  systemDarkQuery.addEventListener('change', handleSystemThemeChange);
} else if (typeof systemDarkQuery.addListener === 'function') {
  systemDarkQuery.addListener(handleSystemThemeChange);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextMode = themeMode === 'system' ? 'dark' : themeMode === 'dark' ? 'light' : 'system';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage errors.
    }
    applyThemeMode(nextMode);
  });
}

const applyMediaConfig = (mediaConfig) => {
  document.querySelectorAll('[data-media-key]').forEach((element) => {
    const key = element.dataset.mediaKey;
    const media = mediaConfig[key];
    if (!media) {
      return;
    }

    if (element.tagName === 'IMG') {
      if (media.src) {
        element.src = media.src;
      }
      if (media.alt) {
        element.alt = media.alt;
      }
    } else if (element.tagName === 'SOURCE') {
      if (media.src) {
        element.src = media.src;
      }
    } else if (element.tagName === 'VIDEO') {
      if (media.src) {
        const source = element.querySelector('source');
        if (source) {
          source.src = media.src;
        }
      }
    }
  });

  document.querySelectorAll('[data-media-poster-key]').forEach((element) => {
    const key = element.dataset.mediaPosterKey;
    const media = mediaConfig[key];
    if (!media || !media.src || element.tagName !== 'VIDEO') {
      return;
    }
    element.poster = media.src;
  });

  document.querySelectorAll('[data-media-caption-key]').forEach((element) => {
    const key = element.dataset.mediaCaptionKey;
    const media = mediaConfig[key];
    if (media && media.caption) {
      element.textContent = media.caption;
    }
  });

  document.querySelectorAll('video').forEach((video) => {
    video.load();
  });
};

const loadMediaConfig = async () => {
  try {
    const response = await fetch('assets/media/media.json', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const mediaConfig = await response.json();
    applyMediaConfig(mediaConfig);
    applyVideoThumbnailTime();
  } catch {
    // Keep fallback values in HTML when json is unavailable.
  }
};

const applyVideoThumbnailTime = () => {
  document.querySelectorAll('video[data-thumbnail-time]').forEach((video) => {
    const thumbnailTime = Number(video.dataset.thumbnailTime);
    if (!Number.isFinite(thumbnailTime) || thumbnailTime < 0) {
      return;
    }

    const seekToThumbnailFrame = () => {
      try {
        if (video.currentTime < thumbnailTime) {
          video.currentTime = thumbnailTime;
        }
      } catch {
        // Ignore seeking errors in unsupported states.
      }
    };

    if (video.readyState >= 1) {
      seekToThumbnailFrame();
    } else {
      video.addEventListener('loadedmetadata', seekToThumbnailFrame, { once: true });
    }
  });
};

const protectMediaAssets = () => {
  const mediaSelector = 'img, video';

  document.querySelectorAll('img').forEach((image) => {
    image.draggable = false;
  });

  document.querySelectorAll('video').forEach((video) => {
    video.setAttribute('controlslist', 'nodownload noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
  });

  document.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest(mediaSelector)) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', (event) => {
    if (event.target instanceof Element && event.target.closest(mediaSelector)) {
      event.preventDefault();
    }
  });
};

loadMediaConfig();
applyVideoThumbnailTime();
protectMediaAssets();

const fluidCanvas = document.getElementById('fluid-bg');
if (fluidCanvas) {
  const probeCanvas = document.createElement('canvas');
  const canUseWebGL2 = (() => {
    const probeGl = probeCanvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true
    });
    if (!probeGl) {
      return false;
    }

    const testTexture = probeGl.createTexture();
    if (!testTexture) {
      return false;
    }

    probeGl.bindTexture(probeGl.TEXTURE_2D, testTexture);
    probeGl.texParameteri(probeGl.TEXTURE_2D, probeGl.TEXTURE_MIN_FILTER, probeGl.NEAREST);
    probeGl.texParameteri(probeGl.TEXTURE_2D, probeGl.TEXTURE_MAG_FILTER, probeGl.NEAREST);
    probeGl.texParameteri(probeGl.TEXTURE_2D, probeGl.TEXTURE_WRAP_S, probeGl.CLAMP_TO_EDGE);
    probeGl.texParameteri(probeGl.TEXTURE_2D, probeGl.TEXTURE_WRAP_T, probeGl.CLAMP_TO_EDGE);
    probeGl.texImage2D(
      probeGl.TEXTURE_2D,
      0,
      probeGl.R32F,
      2,
      2,
      0,
      probeGl.RED,
      probeGl.FLOAT,
      new Float32Array([0, 0, 0, 0])
    );
    const ok = probeGl.getError() === probeGl.NO_ERROR;
    probeGl.deleteTexture(testTexture);
    return ok;
  })();

  const gl = canUseWebGL2
    ? fluidCanvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        desynchronized: true,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      })
    : null;
  const ctx = gl ? null : fluidCanvas.getContext('2d', { alpha: true, desynchronized: true });

  if (!gl && !ctx) {
    console.warn('Canvas rendering context is not available.');
  } else {
    const baseGridScale = 2.2;
    const maxCells = 420000;
    const damping = 0.018;
    const waveSpeed = 0.285;
    const c2 = waveSpeed * waveSpeed;
    const maxAmplitude = 30;
    const minAmplitude = -30;

    const wavePaletteDark = {
      rBase: 8,
      rGlow: 60,
      rTrough: 16,
      gBase: 20,
      gGlow: 140,
      gTrough: 24,
      bBase: 36,
      bGlow: 184,
      bCrest: 18,
      aBase: 18,
      aScale: 235
    };

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let prev = new Float32Array(0);
    let curr = new Float32Array(0);
    let next = new Float32Array(0);
    let imageData = null;
    let pixels = null;
    let rafId = null;
    let lastTime = 0;
    const targetFrameMs = 1000 / 60;
    let pageVisible = !document.hidden;
    let dropAccumulator = 0;
    let randomDropAccumulator = 0;
    let resizeQueued = false;
    const pointerInjectionIntervalMs = 88;

    let waveProgram = null;
    let waveVao = null;
    let waveVertexBuffer = null;
    let waveHeightTexture = null;
    let uWaveHeight = null;
    let uTexel = null;
    let uLightTheme = null;

    const rainPointer = {
      x: 0,
      y: 0,
      active: false
    };

    const compileShader = (shaderType, source) => {
      if (!gl) {
        return null;
      }
      const shader = gl.createShader(shaderType);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const createWaveProgram = () => {
      if (!gl) {
        return false;
      }

      const vertexSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 aPosition;
      out vec2 vUv;

      void main() {
        // Flip Y so texture sampling matches top-left-origin CPU grid coordinates.
        vUv = vec2(aPosition.x * 0.5 + 0.5, 1.0 - (aPosition.y * 0.5 + 0.5));
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
      `;

      const fragmentSource = `#version 300 es
      precision highp float;

      in vec2 vUv;
      uniform sampler2D uWaveHeight;
      uniform vec2 uTexel;
      uniform int uLightTheme;
      out vec4 outColor;

      void main() {
        float h = texture(uWaveHeight, vUv).r;
        float left = texture(uWaveHeight, vUv - vec2(uTexel.x, 0.0)).r;
        float right = texture(uWaveHeight, vUv + vec2(uTexel.x, 0.0)).r;
        float up = texture(uWaveHeight, vUv - vec2(0.0, uTexel.y)).r;
        float down = texture(uWaveHeight, vUv + vec2(0.0, uTexel.y)).r;

        float sx = right - left;
        float sy = down - up;
        float slope = min(1.0, (abs(sx) + abs(sy)) * (1.0 / 14.0));
        float crest = h > 0.0 ? min(1.0, h / 18.0) : 0.0;
        float trough = h < 0.0 ? min(1.0, -h / 22.0) : 0.0;
        float glow = slope * 0.9 + crest * 0.28;

        if (uLightTheme == 1) {
          float ink = min(1.0, slope * 0.68 + trough * 0.82 + crest * 0.18);
          float wash = min(1.0, slope * 0.34 + crest * 0.14);
          float alpha = min(1.0, ink * 0.72 + wash * 0.28);
          float tone = max(32.0, 78.0 - ink * 32.0 + wash * 8.0);

          outColor = vec4(
            tone / 255.0,
            (tone + 2.0) / 255.0,
            (tone + 6.0) / 255.0,
            (alpha * 88.0) / 255.0
          );
          return;
        }

        float alpha = min(1.0, glow + trough * 0.56);
        float r = min(255.0, 8.0 + glow * 60.0 + trough * 16.0);
        float g = min(255.0, 20.0 + glow * 140.0 + trough * 24.0);
        float b = min(255.0, 36.0 + glow * 184.0 + crest * 18.0);
        float a = min(255.0, 18.0 + alpha * 235.0);

        outColor = vec4(r / 255.0, g / 255.0, b / 255.0, a / 255.0);
      }
      `;

      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertexShader || !fragmentShader) {
        if (vertexShader) {
          gl.deleteShader(vertexShader);
        }
        if (fragmentShader) {
          gl.deleteShader(fragmentShader);
        }
        return false;
      }

      const program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return false;
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return false;
      }

      waveProgram = program;
      uWaveHeight = gl.getUniformLocation(waveProgram, 'uWaveHeight');
      uTexel = gl.getUniformLocation(waveProgram, 'uTexel');
      uLightTheme = gl.getUniformLocation(waveProgram, 'uLightTheme');
      return true;
    };

    const destroyWaveResources = () => {
      if (!gl) {
        return;
      }

      if (waveHeightTexture) {
        gl.deleteTexture(waveHeightTexture);
        waveHeightTexture = null;
      }
      if (waveVertexBuffer) {
        gl.deleteBuffer(waveVertexBuffer);
        waveVertexBuffer = null;
      }
      if (waveVao) {
        gl.deleteVertexArray(waveVao);
        waveVao = null;
      }
      if (waveProgram) {
        gl.deleteProgram(waveProgram);
        waveProgram = null;
      }
      uWaveHeight = null;
      uTexel = null;
      uLightTheme = null;
    };

    const initWaveRenderer = () => {
      if (!gl) {
        return;
      }

      destroyWaveResources();
      if (!createWaveProgram()) {
        return;
      }

      waveVao = gl.createVertexArray();
      waveVertexBuffer = gl.createBuffer();
      waveHeightTexture = gl.createTexture();
      if (!waveVao || !waveVertexBuffer || !waveHeightTexture) {
        destroyWaveResources();
        return;
      }

      const quad = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
      ]);

      gl.bindVertexArray(waveVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, waveVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindVertexArray(null);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, waveHeightTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, cols, rows, 0, gl.RED, gl.FLOAT, curr);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(waveProgram);
      if (uWaveHeight) {
        gl.uniform1i(uWaveHeight, 0);
      }
      if (uTexel) {
        gl.uniform2f(uTexel, 1 / cols, 1 / rows);
      }
    };

    const getEffectiveScale = () => {
      let scale = baseGridScale;
      const estimate = Math.floor(width / scale) * Math.floor(height / scale);
      if (estimate > maxCells) {
        scale *= Math.sqrt(estimate / maxCells);
      }
      return scale;
    };

    const allocate = () => {
      const scale = getEffectiveScale();
      cols = Math.max(12, Math.floor(width / scale));
      rows = Math.max(10, Math.floor(height / scale));
      const size = cols * rows;
      prev = new Float32Array(size);
      curr = new Float32Array(size);
      next = new Float32Array(size);

      fluidCanvas.width = cols;
      fluidCanvas.height = rows;

      if (gl) {
        initWaveRenderer();
        imageData = null;
        pixels = null;
      } else if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        imageData = ctx.createImageData(cols, rows);
        pixels = imageData.data;
      }
    };

    const resizeCanvas = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      allocate();
    };

    const splash = (mx, my, power = 8, radius = 6) => {
      const gx = Math.floor((mx / width) * cols);
      const gy = Math.floor((my / height) * rows);
      const minX = Math.max(1, gx - radius);
      const maxX = Math.min(cols - 2, gx + radius);
      const minY = Math.max(1, gy - radius);
      const maxY = Math.min(rows - 2, gy + radius);
      const spread = radius * radius * 0.42;

      for (let y = minY; y <= maxY; y += 1) {
        const row = y * cols;
        const dy = y - gy;
        for (let x = minX; x <= maxX; x += 1) {
          const dx = x - gx;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > radius * radius) {
            continue;
          }
          const i = row + x;
          const impulse = power * Math.exp(-dist2 / spread);
          let value = curr[i] + impulse;
          if (value > maxAmplitude) {
            value = maxAmplitude;
          } else if (value < minAmplitude) {
            value = minAmplitude;
          }
          curr[i] = value;
        }
      }
    };

    const updateWave = () => {
      for (let y = 1; y < rows - 1; y += 1) {
        const row = y * cols;
        const up = row - cols;
        const down = row + cols;
        for (let x = 1; x < cols - 1; x += 1) {
          const i = row + x;
          const laplacian = curr[i - 1] + curr[i + 1] + curr[up + x] + curr[down + x] - 4 * curr[i];
          let value = (2 - damping) * curr[i] - (1 - damping) * prev[i] + c2 * laplacian;
          if (value > maxAmplitude) {
            value = maxAmplitude;
          } else if (value < minAmplitude) {
            value = minAmplitude;
          }
          next[i] = value;
        }
      }

      next.fill(0, 0, cols);
      next.fill(0, (rows - 1) * cols, rows * cols);
      for (let y = 1; y < rows - 1; y += 1) {
        const row = y * cols;
        next[row] = 0;
        next[row + cols - 1] = 0;
      }

      const temp = prev;
      prev = curr;
      curr = next;
      next = temp;
    };

    const renderWave2D = () => {
      if (!ctx || !pixels || !imageData) {
        return;
      }

      pixels.fill(0);
      const slopeNorm = 1 / 14;
      const isLightTheme = resolvedTheme === 'light';

      for (let y = 1; y < rows - 1; y += 1) {
        const row = y * cols;
        const up = row - cols;
        const down = row + cols;

        for (let x = 1; x < cols - 1; x += 1) {
          const i = row + x;
          const sx = curr[i + 1] - curr[i - 1];
          const sy = curr[down + x] - curr[up + x];
          const slope = Math.min(1, (Math.abs(sx) + Math.abs(sy)) * slopeNorm);
          const h = curr[i];
          const crest = h > 0 ? Math.min(1, h / 18) : 0;
          const trough = h < 0 ? Math.min(1, -h / 22) : 0;
          const glow = slope * 0.9 + crest * 0.28;
          const p = i << 2;

          if (isLightTheme) {
            const ink = Math.min(1, slope * 0.68 + trough * 0.82 + crest * 0.18);
            const wash = Math.min(1, slope * 0.34 + crest * 0.14);
            const alpha = Math.min(1, ink * 0.72 + wash * 0.28);
            const tone = Math.max(32, 78 - ink * 32 + wash * 8);

            pixels[p] = tone;
            pixels[p + 1] = tone + 2;
            pixels[p + 2] = tone + 6;
            pixels[p + 3] = Math.min(255, alpha * 88);
            continue;
          }

          const alpha = Math.min(1, glow + trough * 0.56);

          pixels[p] = Math.min(255, wavePaletteDark.rBase + glow * wavePaletteDark.rGlow + trough * wavePaletteDark.rTrough);
          pixels[p + 1] = Math.min(255, wavePaletteDark.gBase + glow * wavePaletteDark.gGlow + trough * wavePaletteDark.gTrough);
          pixels[p + 2] = Math.min(255, wavePaletteDark.bBase + glow * wavePaletteDark.bGlow + crest * wavePaletteDark.bCrest);
          pixels[p + 3] = Math.min(255, wavePaletteDark.aBase + alpha * wavePaletteDark.aScale);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const renderWaveWebGL = () => {
      if (!gl || !waveProgram || !waveVao || !waveHeightTexture) {
        return;
      }

      gl.viewport(0, 0, fluidCanvas.width, fluidCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, waveHeightTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.FLOAT, curr);

      gl.useProgram(waveProgram);
      if (uTexel) {
        gl.uniform2f(uTexel, 1 / cols, 1 / rows);
      }
      if (uLightTheme) {
        gl.uniform1i(uLightTheme, resolvedTheme === 'light' ? 1 : 0);
      }
      gl.bindVertexArray(waveVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    };

    const renderWave = () => {
      if (gl) {
        renderWaveWebGL();
      } else {
        renderWave2D();
      }
    };

    const animate = (timestamp) => {
      if (!pageVisible) {
        rafId = null;
        return;
      }

      if (!lastTime) {
        lastTime = timestamp;
      }
      const elapsed = timestamp - lastTime;
      if (elapsed < targetFrameMs) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const dt = Math.min(48, elapsed);
      lastTime = timestamp;

      updateWave();

      if (rainPointer.active) {
        dropAccumulator += dt;
        while (dropAccumulator >= pointerInjectionIntervalMs) {
          dropAccumulator -= pointerInjectionIntervalMs;
          splash(rainPointer.x, rainPointer.y, 13.6, 16);
        }
      } else {
        dropAccumulator = 0;
      }

      randomDropAccumulator += dt;
      while (randomDropAccumulator >= 820) {
        randomDropAccumulator -= 820;
        splash(Math.random() * width, Math.random() * height, 4.4, 6);
      }

      renderWave();
      rafId = requestAnimationFrame(animate);
    };

    const onPointerMove = (event) => {
      if (!pageVisible) {
        return;
      }
      rainPointer.x = clamp(event.clientX, 0, width - 1);
      rainPointer.y = clamp(event.clientY, 0, height - 1);
      rainPointer.active = true;
    };

    const onPointerDown = (event) => {
      onPointerMove(event);
      splash(rainPointer.x, rainPointer.y, 14.0, 16);
      dropAccumulator = 0;
    };

    const onPointerLeave = () => {
      rainPointer.active = false;
      dropAccumulator = 0;
    };

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) {
        lastTime = 0;
        if (!rafId) {
          rafId = requestAnimationFrame(animate);
        }
        return;
      }

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      onPointerLeave();
    };

    const scheduleResize = () => {
      if (resizeQueued) {
        return;
      }
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        resizeCanvas();
      });
    };

    window.addEventListener('resize', scheduleResize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('pointercancel', onPointerLeave, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    resizeCanvas();
    rafId = requestAnimationFrame(animate);

    window.addEventListener('beforeunload', () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      destroyWaveResources();
    });
  }
}
const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');
if (cursorDot && cursorRing && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.body.style.cursor = 'none';
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let rx = x;
  let ry = y;
  let cursorRafId = 0;

  const moveCursor = (event) => {
    x = event.clientX;
    y = event.clientY;
    cursorDot.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
  };

  const animateRing = () => {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    const scale = document.body.classList.contains('cursor-hover') ? 1.35 : 1;
    cursorRing.style.transform = `translate(${rx - 17}px, ${ry - 17}px) scale(${scale})`;
    cursorRafId = requestAnimationFrame(animateRing);
  };

  const stopCursorLoop = () => {
    if (cursorRafId) {
      cancelAnimationFrame(cursorRafId);
      cursorRafId = 0;
    }
  };

  const startCursorLoop = () => {
    if (!cursorRafId) {
      cursorRafId = requestAnimationFrame(animateRing);
    }
  };

  document.addEventListener('pointermove', moveCursor, { passive: true });
  startCursorLoop();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCursorLoop();
    } else {
      startCursorLoop();
    }
  });

  const hoverTargets = document.querySelectorAll('a, button, video');
  hoverTargets.forEach((target) => {
    target.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    target.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}









