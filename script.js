const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const introGate = document.getElementById('intro-gate');
if (introGate) {
  const INTRO_DURATION_MS = 5300;
  const FORM_PHASE_MS = 2600;
  const DISSOLVE_PHASE_MS = INTRO_DURATION_MS - FORM_PHASE_MS;
  const INTRO_FPS = 45;
  const INTRO_EXIT_MS = 220;
  const introParticleCanvas = document.getElementById('intro-particle-canvas');

  const startIntroParticles = (canvas, durationMs, formPhaseMs, dissolvePhaseMs, fps, gateElement, onComplete) => {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const random = (min, max) => min + Math.random() * (max - min);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const COMPLETE_PROGRESS = 0.975;
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
    const labelFont = '"Oswald", "Space Grotesk", sans-serif';
    const labelY = height * 0.53;
    const measureLabel = (fontPx) => {
      offCtx.font = `700 ${fontPx}px ${labelFont}`;
      const metrics = offCtx.measureText(label);
      const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.76;
      const descent = metrics.actualBoundingBoxDescent || fontPx * 0.2;
      return {
        width: metrics.width,
        height: ascent + descent
      };
    };
    const maxLabelWidth = width * (width < 720 ? 0.92 : 0.84);
    const maxLabelHeight = height * (width < 720 ? 0.15 : 0.2);
    let fontSize = clamp(Math.min(width * 0.18, height * 0.24), 84, 420);
    let labelMetrics = measureLabel(fontSize);
    const fitScale = Math.min(maxLabelWidth / labelMetrics.width, maxLabelHeight / labelMetrics.height);
    fontSize = clamp(fontSize * clamp(fitScale, 0.68, 1.18), 72, 420);
    labelMetrics = measureLabel(fontSize);
    offCtx.clearRect(0, 0, width, height);
    offCtx.font = `700 ${fontSize}px ${labelFont}`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = '#ffffff';
    offCtx.fillText(label, width * 0.5, labelY);

    const image = offCtx.getImageData(0, 0, width, height).data;
    const sampleStep = Math.max(2, Math.floor(width / 360));
    const targets = [];
    for (let y = 0; y < height; y += sampleStep) {
      const row = y * width;
      for (let x = 0; x < width; x += sampleStep) {
        const alpha = image[(row + x) * 4 + 3];
        if (alpha > 150 && Math.random() > 0.06) {
          targets.push({ x, y });
        }
      }
    }

    if (targets.length < 40) {
      return () => {};
    }

    const centerX = width * 0.5;
    const centerY = labelY;
    const depthRange = Math.max(280, Math.min(880, Math.max(width, height) * 0.88));
    const cameraBaseDepth = Math.max(width, height) * 0.58 + depthRange * 0.74;
    // Orbit the camera slightly so the particle swarm reads as a 3D volume before settling into the title.
    const getCameraOrbit = (elapsed, progress, dissolveNow) => {
      const settle = 1 - Math.pow(progress, 1.18);
      const frontSettleStart = Math.max(formPhaseMs * 0.68, breakupStartMs - 520);
      const frontSettle = easeOutCubic(
        clamp((elapsed - frontSettleStart) / Math.max(1, breakupStartMs - frontSettleStart), 0, 1)
      );
      const orbitScale = (1 - frontSettle) * (0.14 + settle * 0.52);
      const breakupLean = dissolveNow * 0.04;
      const dollyEnvelope = 1 - frontSettle * 0.92;
      const dolly =
        Math.sin(elapsed * 0.00112 + 0.8) * (depthRange * (0.08 + settle * 0.18) * dollyEnvelope) -
        settle * depthRange * 0.075 * dollyEnvelope -
        frontSettle * depthRange * 0.04;
      return {
        yaw: Math.sin(elapsed * 0.00112) * orbitScale + Math.sin(elapsed * 0.0023 + 0.4) * breakupLean,
        pitch:
          Math.cos(elapsed * 0.00086 + 0.6) * (0.1 + settle * 0.26) * (1 - frontSettle) +
          Math.sin(elapsed * 0.0017 + 1.2) * breakupLean * 0.34,
        depth: Math.max(Math.max(width, height) * 0.4, cameraBaseDepth + dolly)
      };
    };
    const spawnFromStormRing = () => {
      const angle = random(0, Math.PI * 2);
      const maxR = Math.max(width, height) * 0.92;
      const minR = Math.max(width, height) * 0.38;
      const radius = random(minR, maxR);
      const spiral = random(-1, 1);
      const lift = Math.sin(angle * 1.7 + spiral * 2.4) * height * 0.18;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius * 0.72 + lift,
        z: Math.cos(angle * 1.13 + spiral) * radius * 1.06 + random(-depthRange * 0.9, depthRange * 0.9)
      };
    };

    const shuffledTargets = shuffleInPlace(targets.slice());
    const particleCount = Math.min(2200, Math.max(1100, Math.floor(targets.length * 0.9)));

    const posX = new Float32Array(particleCount);
    const posY = new Float32Array(particleCount);
    const posZ = new Float32Array(particleCount);
    const velX = new Float32Array(particleCount);
    const velY = new Float32Array(particleCount);
    const velZ = new Float32Array(particleCount);
    const targetX = new Float32Array(particleCount);
    const targetY = new Float32Array(particleCount);
    const targetZ = new Float32Array(particleCount);
    const size = new Float32Array(particleCount);
    const seed = new Float32Array(particleCount);
    const depthDrift = new Float32Array(particleCount);
    const tone = new Uint8Array(particleCount);
    const orbitDir = new Int8Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      const start = spawnFromStormRing();
      const targetIndex = Math.floor((i / particleCount) * shuffledTargets.length);
      const target = shuffledTargets[targetIndex];
      posX[i] = start.x;
      posY[i] = start.y;
      posZ[i] = start.z;
      velX[i] = random(-1.2, 1.2);
      velY[i] = random(-1.2, 1.2);
      velZ[i] = random(-2.4, 2.4);
      targetX[i] = target.x;
      targetY[i] = target.y;
      targetZ[i] = random(-18, 18);
      size[i] = random(1.28, 3.45);
      seed[i] = random(0, Math.PI * 2);
      depthDrift[i] = random(0.62, 1.36);
      tone[i] = Math.random() > 0.48 ? 0 : 1;
      orbitDir[i] = Math.random() > 0.5 ? 1 : -1;
    }

    const STORM_PHASE_RATIO = 0.88;
    const formFrameCount = Math.max(2, Math.ceil((formPhaseMs / 1000) * fps) + 1);
    const formStride = particleCount * 4;
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
          const pz = posZ[i];
          const pcx = px - centerX;
          const pcy = py - centerY;
          const distC = Math.hypot(pcx, pcy) || 1;
          const nx = pcx / distC;
          const ny = pcy / distC;
          const tx = -ny * orbitDir[i];
          const ty = nx * orbitDir[i];
          const radialNudge = Math.sin(simTime * 0.0036 + seed[i]) * (10 + storm * 24);
          const swirlLift = Math.sin(simTime * 0.0031 + seed[i] * 1.18) * (10 + storm * 34);
          const depthWave =
            Math.sin(simTime * 0.0042 + seed[i] * 1.8) * (30 + storm * depthRange * 0.92) * depthDrift[i];
          const dxToTarget = targetX[i] + radialNudge * nx - px;
          const dyToTarget = targetY[i] + radialNudge * ny + swirlLift * 0.06 - py;
          const dzToTarget = targetZ[i] + depthWave - pz;

          const tangentialForce =
            (0.32 + storm * 1.55) * (0.34 + clamp(distC / (Math.max(width, height) * 0.62), 0, 1));
          const centerPull = 0.008 + storm * 0.08;
          const targetPull = 0.006 + gather * 0.42;
          const depthPull = 0.004 + gather * 0.24;
          let vx = velX[i] + tx * tangentialForce - nx * centerPull + dxToTarget * targetPull * 0.06;
          let vy = velY[i] + ty * tangentialForce - ny * centerPull + dyToTarget * targetPull * 0.06;
          let vz =
            velZ[i] + dzToTarget * depthPull * 0.09 + orbitDir[i] * storm * 0.18 * Math.sin(seed[i] + simTime * 0.0018);

          const damping = 0.915 - gather * 0.17;
          vx *= damping;
          vy *= damping;
          vz *= 0.91 - gather * 0.14;

          let nextX = px + vx;
          let nextY = py + vy;
          let nextZ = pz + vz;

          if (stormProgress > 0.82) {
            const snap = (stormProgress - 0.82) / 0.18;
            const snapStrength = 0.15 + snap * 0.52;
            nextX += (targetX[i] - nextX) * snapStrength;
            nextY += (targetY[i] - nextY) * snapStrength;
            nextZ += (targetZ[i] - nextZ) * snapStrength * 0.94;
          }
          nextZ = clamp(nextZ, -depthRange * 1.8, depthRange * 1.8);

          posX[i] = nextX;
          posY[i] = nextY;
          posZ[i] = nextZ;
          velX[i] = vx;
          velY[i] = vy;
          velZ[i] = vz;
        }
      }

      const base = frame * formStride;
      for (let i = 0; i < particleCount; i += 1) {
        const p = base + i * 4;
        formTrajectory[p] = posX[i];
        formTrajectory[p + 1] = posY[i];
        formTrajectory[p + 2] = posZ[i];
        formTrajectory[p + 3] = 0;
      }
    }

    const bgColor = parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--bg'), [12, 14, 18]);
    const totalFrameCount = Math.max(2, Math.ceil((durationMs / 1000) * fps) + 1);
    const totalStride = particleCount * 4;
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

    const MAX_RIPPLES_PER_FRAME = 24;
    const ringData = new Float32Array(totalFrameCount * MAX_RIPPLES_PER_FRAME * 5);
    const ringCount = new Uint8Array(totalFrameCount);
    const waveEventCount = 10;
    const impactTargets = shuffleInPlace(targets.slice()).slice(0, waveEventCount);
    const waveEvents = impactTargets.map((target, index) => {
      const startMs =
        formPhaseMs + 320 + index * 118 + random(-22, 26);
      return {
        x: clamp(target.x + random(-sampleStep * 5, sampleStep * 5), width * 0.16, width * 0.84),
        y: clamp(target.y + random(-sampleStep * 6, sampleStep * 6), height * 0.22, height * 0.84),
        startMs,
        speed: random(0.22, 0.3),
        band: random(18, 30),
        amp: random(10.5, 16.5),
        decay: random(0.0012, 0.0022),
        phaseSpeed: random(0.024, 0.034),
        maxRadius: Math.max(width, height) * 1.12,
        freq: random(0.17, 0.23),
        scatterDuration: random(520, 900),
        scatterRadius: random(60, 122),
        scatterForce: random(24, 38),
        driftY: random(0.08, 0.3),
        depthPush: random(0.9, 1.6),
        ellipse: random(0.9, 1.06),
        phase: random(0, Math.PI * 2)
      };
    });
    const breakupStartMs = waveEvents.length > 0 ? waveEvents[0].startMs : formPhaseMs;
    const breakupPosX = new Float32Array(particleCount);
    const breakupPosY = new Float32Array(particleCount);
    const breakupPosZ = new Float32Array(particleCount);
    const breakupVelX = new Float32Array(particleCount);
    const breakupVelY = new Float32Array(particleCount);
    const breakupVelZ = new Float32Array(particleCount);
    let breakupInitialized = false;

    // Precompute full timeline: wave-driven breakup offsets + color + opacity.
    for (let frame = 0; frame < totalFrameCount; frame += 1) {
      const tMs = (frame / (totalFrameCount - 1)) * durationMs;
      const formProgress = clamp(tMs / formPhaseMs, 0, 1);
      const breakupProgress = clamp((tMs - breakupStartMs) / Math.max(1, durationMs - breakupStartMs), 0, 1);
      const breakupEase = easeOutCubic(breakupProgress);
      const blendToBg = Math.pow(breakupProgress, 0.84);
      const alphaFade = clamp((breakupProgress - 0.84) / 0.16, 0, 1);

      frameAlpha[frame] = (0.58 + (1 - breakupEase) * 0.5) * (1 - alphaFade * 0.16);
      frameSizeScale[frame] = 1.62 - breakupProgress * 0.02;
      frameGateOpacity[frame] = 1 - Math.pow(alphaFade, 1.1);

      brightR[frame] = Math.round(255 + (bgColor[0] - 255) * blendToBg);
      brightG[frame] = Math.round(255 + (bgColor[1] - 255) * blendToBg);
      brightB[frame] = Math.round(255 + (bgColor[2] - 255) * blendToBg);
      softR[frame] = Math.round(222 + (bgColor[0] - 222) * blendToBg);
      softG[frame] = Math.round(222 + (bgColor[1] - 222) * blendToBg);
      softB[frame] = Math.round(222 + (bgColor[2] - 222) * blendToBg);

      let activeRingCount = 0;
      for (let r = 0; r < waveEvents.length; r += 1) {
        const event = waveEvents[r];
        const age = tMs - event.startMs;
        if (age < 0) {
          continue;
        }

        const radius = age * event.speed;
        const ringAlpha = Math.exp(-age * event.decay) * (0.5 + (1 - breakupEase) * 0.38);
        if (ringAlpha < 0.03 || radius > event.maxRadius) {
          continue;
        }

        if (activeRingCount >= MAX_RIPPLES_PER_FRAME) {
          break;
        }

        const ringBase = frame * MAX_RIPPLES_PER_FRAME * 5 + activeRingCount * 5;
        ringData[ringBase] = event.x;
        ringData[ringBase + 1] = event.y;
        ringData[ringBase + 2] = radius;
        ringData[ringBase + 3] = ringAlpha;
        ringData[ringBase + 4] = event.ellipse;
        activeRingCount += 1;
      }
      ringCount[frame] = activeRingCount;

      const formFramePos = formProgress * (formFrameCount - 1);
      const formA = Math.floor(formFramePos);
      const formB = Math.min(formFrameCount - 1, formA + 1);
      const formBlend = formFramePos - formA;
      const formBaseA = formA * formStride;
      const formBaseB = formB * formStride;

      const breakupDriftY = breakupEase * breakupEase * (height * 0.006);
      const breakupSeedFrame = breakupProgress > 0 && !breakupInitialized;

      for (let i = 0; i < particleCount; i += 1) {
        const pIndex = i * 4;
        const ax = formTrajectory[formBaseA + pIndex];
        const ay = formTrajectory[formBaseA + pIndex + 1];
        const az = formTrajectory[formBaseA + pIndex + 2];
        const bx = formTrajectory[formBaseB + pIndex];
        const by = formTrajectory[formBaseB + pIndex + 1];
        const bz = formTrajectory[formBaseB + pIndex + 2];

        let x = ax + (bx - ax) * formBlend;
        let y = ay + (by - ay) * formBlend;
        let z = az + (bz - az) * formBlend;

        if (breakupProgress > 0) {
          if (breakupSeedFrame) {
            breakupPosX[i] = x;
            breakupPosY[i] = y;
            breakupPosZ[i] = z;
            breakupVelX[i] = Math.sin(seed[i] * 1.9) * 0.16;
            breakupVelY[i] = Math.cos(seed[i] * 1.6) * 0.16;
            breakupVelZ[i] = Math.sin(seed[i] * 2.3) * 0.3;
          }

          let flowX = breakupPosX[i];
          let flowY = breakupPosY[i];
          let flowZ = breakupPosZ[i];
          let flowVX = breakupVelX[i];
          let flowVY = breakupVelY[i];
          let flowVZ = breakupVelZ[i];
          const anchor = Math.max(0, 1 - breakupProgress * 1.7) * 0.04;

          flowVX += (x - flowX) * anchor + Math.sin(seed[i] + tMs * 0.0033) * breakupEase * 0.018;
          flowVY +=
            (y - flowY) * anchor +
            breakupDriftY * 0.06 +
            Math.cos(seed[i] * 1.27 + tMs * 0.0029) * breakupEase * 0.009;
          flowVZ += (z - flowZ) * anchor * 0.16 + Math.sin(seed[i] * 1.4 + tMs * 0.0031) * breakupEase * 0.2;

          for (let r = 0; r < waveEvents.length; r += 1) {
            const event = waveEvents[r];
            const age = tMs - event.startMs;
            if (age < 0) {
              continue;
            }

            const dx = flowX - event.x;
            const dy = flowY - event.y;
            const dist = Math.hypot(dx, dy) || 1;
            const ndx = dx / dist;
            const ndy = dy / dist;
            const tangentialX = -ndy;
            const tangentialY = ndx;
            const radius = age * event.speed;
            if (radius <= event.maxRadius) {
              const diff = dist - radius;
              const absDiff = Math.abs(diff);
              const carrierBand = event.band * 2.1;
              if (absDiff <= carrierBand) {
                const envelope = 1 - absDiff / carrierBand;
                const wave = Math.sin(diff * event.freq - age * event.phaseSpeed + seed[i]);
                const surge = envelope * (0.74 + wave * 0.42) * event.amp;
                flowVX += ndx * surge * 0.23 + tangentialX * surge * 0.09 * orbitDir[i];
                flowVY += ndy * surge * 0.26 + tangentialY * surge * 0.12 * orbitDir[i];
                flowVZ += surge * 0.06 * Math.cos(seed[i] + event.phase);
              }
            }

            if (age <= event.scatterDuration) {
              const scatterProgress = 1 - age / event.scatterDuration;
              const scatterEnvelope = Math.exp(-(dist * dist) / (event.scatterRadius * event.scatterRadius));
              const shock = scatterEnvelope * scatterProgress * event.scatterForce;
              flowVX += ndx * shock * 0.25;
              flowVY += ndy * shock * 0.29 + scatterProgress * event.driftY * 0.42;
              flowVZ += shock * event.depthPush * 0.09 * Math.sin(seed[i] * 1.18 + event.phase);
            }
          }

          const drag = 0.95 - breakupProgress * 0.035;
          flowVX *= drag;
          flowVY *= drag;
          flowVZ *= 0.955;
          flowX += flowVX;
          flowY += flowVY;
          flowZ += flowVZ;

          breakupPosX[i] = flowX;
          breakupPosY[i] = flowY;
          breakupPosZ[i] = flowZ;
          breakupVelX[i] = flowVX;
          breakupVelY[i] = flowVY;
          breakupVelZ[i] = flowVZ;

          x = flowX;
          y = flowY;
          z = flowZ;
        }

        const base = frame * totalStride + pIndex;
        timelinePos[base] = x;
        timelinePos[base + 1] = y;
        timelinePos[base + 2] = clamp(z, -depthRange * 2.0, depthRange * 2.0);
        timelinePos[base + 3] = 0;
      }

      if (breakupSeedFrame) {
        breakupInitialized = true;
      }
    }

    const drawWaveRingsToContext = (ctx, frameIndex, breakupNow) => {
      const activeRingCount = ringCount[frameIndex];
      if (activeRingCount <= 0) {
        return;
      }

      const fadeToBg = Math.pow(clamp(breakupNow * 0.88, 0, 1), 0.92);
      const ringR = Math.round(84 + (bgColor[0] - 84) * fadeToBg);
      const ringG = Math.round(168 + (bgColor[1] - 168) * fadeToBg);
      const ringB = Math.round(228 + (bgColor[2] - 228) * fadeToBg);
      const glowR = Math.round(138 + (bgColor[0] - 138) * fadeToBg);
      const glowG = Math.round(214 + (bgColor[1] - 214) * fadeToBg);
      const glowB = Math.round(255 + (bgColor[2] - 255) * fadeToBg);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < activeRingCount; i += 1) {
        const rb = frameIndex * MAX_RIPPLES_PER_FRAME * 5 + i * 5;
        const x = ringData[rb];
        const y = ringData[rb + 1];
        const radius = ringData[rb + 2];
        const alpha = ringData[rb + 3];
        const ellipse = ringData[rb + 4];
        const haloAlpha = Math.min(0.58, alpha * 0.84);
        const crestAlpha = Math.min(0.96, alpha * 1.34);
        const trailAlpha = Math.min(0.72, alpha * 0.92);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, ellipse);

        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${haloAlpha * 0.34})`;
        ctx.lineWidth = 7.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${trailAlpha})`;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, radius - 18), 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${crestAlpha})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${haloAlpha})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();
    };

    const startCanvas2DRenderer = (ctx, startAt = performance.now()) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let rafId = 0;
      let stopped = false;
      let completed = false;
      const drawProjectedParticles = (
        toneMatch,
        fillStyle,
        alpha,
        baseA,
        baseB,
        blend,
        sizeScale,
        cameraYaw,
        cameraPitch,
        cameraDepthValue
      ) => {
        const yawCos = Math.cos(cameraYaw);
        const yawSin = Math.sin(cameraYaw);
        const pitchCos = Math.cos(cameraPitch);
        const pitchSin = Math.sin(cameraPitch);

        ctx.fillStyle = fillStyle;
        for (let i = 0; i < particleCount; i += 1) {
          if (tone[i] !== toneMatch) {
            continue;
          }

          const p = i * 4;
          const ax = timelinePos[baseA + p];
          const ay = timelinePos[baseA + p + 1];
          const az = timelinePos[baseA + p + 2];
          const bx = timelinePos[baseB + p];
          const by = timelinePos[baseB + p + 1];
          const bz = timelinePos[baseB + p + 2];

          const worldX = ax + (bx - ax) * blend - centerX;
          const worldY = ay + (by - ay) * blend - centerY;
          const worldZ = az + (bz - az) * blend;

          const rotatedX = worldX * yawCos + worldZ * yawSin;
          const rotatedZ = worldZ * yawCos - worldX * yawSin;
          const rotatedY = worldY * pitchCos - rotatedZ * pitchSin;
          const finalZ = worldY * pitchSin + rotatedZ * pitchCos;

          const depth = cameraDepthValue - finalZ;
          if (depth <= cameraDepthValue * 0.14) {
            continue;
          }

          const perspective = clamp(cameraDepthValue / depth, 0.2, 4.8);
          const screenX = centerX + rotatedX * perspective;
          const screenY = centerY + rotatedY * perspective;
          const radius = Math.max(1.25, size[i] * sizeScale * perspective * (1.16 + perspective * 0.18));
          if (screenX < -radius || screenX > width + radius || screenY < -radius || screenY > height + radius) {
            continue;
          }

          ctx.globalAlpha = alpha * clamp(0.24 + Math.pow(perspective, 1.08) * 0.58, 0.22, 2.1);
          ctx.fillRect(screenX - radius * 0.5, screenY - radius * 0.5, radius, radius);
        }
        ctx.globalAlpha = 1;
      };

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

        const breakupNow = clamp((elapsed - breakupStartMs) / Math.max(1, durationMs - breakupStartMs), 0, 1);
        const alpha = frameAlpha[frameA] + (frameAlpha[frameB] - frameAlpha[frameA]) * blend;
        const sizeScale = frameSizeScale[frameA] + (frameSizeScale[frameB] - frameSizeScale[frameA]) * blend;
        const cameraOrbit = getCameraOrbit(elapsed, progress, breakupNow);

        const bR = Math.round(brightR[frameA] + (brightR[frameB] - brightR[frameA]) * blend);
        const bG = Math.round(brightG[frameA] + (brightG[frameB] - brightG[frameA]) * blend);
        const bB = Math.round(brightB[frameA] + (brightB[frameB] - brightB[frameA]) * blend);
        const sR = Math.round(softR[frameA] + (softR[frameB] - softR[frameA]) * blend);
        const sG = Math.round(softG[frameA] + (softG[frameB] - softG[frameA]) * blend);
        const sB = Math.round(softB[frameA] + (softB[frameB] - softB[frameA]) * blend);

        ctx.globalCompositeOperation = 'lighter';
        drawProjectedParticles(
          0,
          `rgb(${bR}, ${bG}, ${bB})`,
          alpha,
          baseA,
          baseB,
          blend,
          sizeScale,
          cameraOrbit.yaw,
          cameraOrbit.pitch,
          cameraOrbit.depth
        );
        drawProjectedParticles(
          1,
          `rgb(${sR}, ${sG}, ${sB})`,
          alpha,
          baseA,
          baseB,
          blend,
          sizeScale,
          cameraOrbit.yaw,
          cameraOrbit.pitch,
          cameraOrbit.depth
        );
        ctx.globalCompositeOperation = 'source-over';
        drawWaveRingsToContext(ctx, frameA, breakupNow);

        if (gateElement && !gateElement.classList.contains('is-exiting')) {
          const gateOpacity = frameGateOpacity[frameA] + (frameGateOpacity[frameB] - frameGateOpacity[frameA]) * blend;
          gateElement.style.opacity = `${gateOpacity}`;
        }

        if (!completed && progress >= COMPLETE_PROGRESS) {
          completed = true;
          if (typeof onComplete === 'function') {
            onComplete();
          }
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

    const startWaveOverlayRenderer = (ctx, startAt = performance.now()) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let rafId = 0;
      let stopped = false;

      const render = (timestamp) => {
        if (stopped) {
          return;
        }

        const elapsed = timestamp - startAt;
        const progress = clamp(elapsed / durationMs, 0, 1);
        const framePos = progress * (totalFrameCount - 1);
        const frameA = Math.floor(framePos);
        const breakupNow = clamp((elapsed - breakupStartMs) / Math.max(1, durationMs - breakupStartMs), 0, 1);

        ctx.clearRect(0, 0, width, height);
        drawWaveRingsToContext(ctx, frameA, breakupNow);
        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
      return () => {
        stopped = true;
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        ctx.clearRect(0, 0, width, height);
      };
    };

    const startWebGL2Renderer = (gl, startAt = performance.now()) => {
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
      uniform float uCameraYaw;
      uniform float uCameraPitch;
      uniform float uCameraDepth;

      out float vTone;
      out float vPerspective;

      void main() {
        float u = (aIndex + 0.5) / uParticleCount;
        float vA = (uFrameA + 0.5) / uFrameCount;
        float vB = (uFrameB + 0.5) / uFrameCount;

        vec3 posA = texture(uPositions, vec2(u, vA)).rgb;
        vec3 posB = texture(uPositions, vec2(u, vB)).rgb;
        vec3 pos = mix(posA, posB, uBlend);

        vec3 local = vec3(pos.xy - uResolution * 0.5, pos.z);

        float cosYaw = cos(uCameraYaw);
        float sinYaw = sin(uCameraYaw);
        float cosPitch = cos(uCameraPitch);
        float sinPitch = sin(uCameraPitch);

        vec3 rotated;
        rotated.x = local.x * cosYaw + local.z * sinYaw;
        float yawZ = local.z * cosYaw - local.x * sinYaw;
        rotated.y = local.y * cosPitch - yawZ * sinPitch;
        rotated.z = local.y * sinPitch + yawZ * cosPitch;

        float depth = max(uCameraDepth * 0.14, uCameraDepth - rotated.z);
        float perspective = clamp(uCameraDepth / depth, 0.18, 4.8);
        vec2 projected = rotated.xy * perspective + uResolution * 0.5;
        vec2 clip = vec2(
          (projected.x / uResolution.x) * 2.0 - 1.0,
          1.0 - (projected.y / uResolution.y) * 2.0
        );

        gl_Position = vec4(clip, clamp(rotated.z / uCameraDepth, -1.0, 1.0), 1.0);
        gl_PointSize = max(1.35, aSize * uSizeScale * uDpr * perspective * (1.1 + perspective * 0.18));
        vTone = aTone;
        vPerspective = perspective;
      }
      `;

      const fragmentSource = `#version 300 es
      precision highp float;

      in float vTone;
      in float vPerspective;
      uniform vec4 uBrightColor;
      uniform vec4 uSoftColor;

      out vec4 outColor;

      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float falloff = exp(-dot(p, p) * 2.9);
        vec4 baseColor = (vTone < 0.5) ? uBrightColor : uSoftColor;
        float depthAlpha = clamp(0.2 + pow(vPerspective, 1.1) * 0.54, 0.18, 2.0);
        outColor = vec4(baseColor.rgb, baseColor.a * falloff * depthAlpha);
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, particleCount, totalFrameCount, 0, gl.RGBA, gl.FLOAT, timelinePos);
      if (gl.getError() !== gl.NO_ERROR) {
        gl.deleteTexture(positionTexture);
        gl.deleteBuffer(indexBuffer);
        gl.deleteBuffer(sizeBuffer);
        gl.deleteBuffer(toneBuffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
        return null;
      }

      const uPositions = gl.getUniformLocation(program, 'uPositions');
      const uFrameA = gl.getUniformLocation(program, 'uFrameA');
      const uFrameB = gl.getUniformLocation(program, 'uFrameB');
      const uBlend = gl.getUniformLocation(program, 'uBlend');
      const uParticleCount = gl.getUniformLocation(program, 'uParticleCount');
      const uFrameCount = gl.getUniformLocation(program, 'uFrameCount');
      const uResolution = gl.getUniformLocation(program, 'uResolution');
      const uSizeScale = gl.getUniformLocation(program, 'uSizeScale');
      const uDpr = gl.getUniformLocation(program, 'uDpr');
      const uCameraYaw = gl.getUniformLocation(program, 'uCameraYaw');
      const uCameraPitch = gl.getUniformLocation(program, 'uCameraPitch');
      const uCameraDepth = gl.getUniformLocation(program, 'uCameraDepth');
      const uBrightColor = gl.getUniformLocation(program, 'uBrightColor');
      const uSoftColor = gl.getUniformLocation(program, 'uSoftColor');

      gl.useProgram(program);
      gl.uniform1i(uPositions, 0);
      gl.uniform1f(uParticleCount, particleCount);
      gl.uniform1f(uFrameCount, totalFrameCount);
      gl.uniform2f(uResolution, width, height);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uCameraDepth, cameraBaseDepth);

      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      let rafId = 0;
      let stopped = false;
      let completed = false;

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
        const dissolveNow = clamp((elapsed - formPhaseMs) / dissolvePhaseMs, 0, 1);

        const alpha = frameAlpha[frameA] + (frameAlpha[frameB] - frameAlpha[frameA]) * blend;
        const sizeScale = frameSizeScale[frameA] + (frameSizeScale[frameB] - frameSizeScale[frameA]) * blend;
        const cameraOrbit = getCameraOrbit(elapsed, progress, dissolveNow);

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
        gl.uniform1f(uCameraYaw, cameraOrbit.yaw);
        gl.uniform1f(uCameraPitch, cameraOrbit.pitch);
        gl.uniform1f(uCameraDepth, cameraOrbit.depth);
        gl.uniform4f(uBrightColor, bR, bG, bB, alpha);
        gl.uniform4f(uSoftColor, sR, sG, sB, alpha);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, particleCount);
        gl.bindVertexArray(null);

        if (gateElement && !gateElement.classList.contains('is-exiting')) {
          const gateOpacity = frameGateOpacity[frameA] + (frameGateOpacity[frameB] - frameGateOpacity[frameA]) * blend;
          gateElement.style.opacity = `${gateOpacity}`;
        }

        if (!completed && progress >= COMPLETE_PROGRESS) {
          completed = true;
          if (typeof onComplete === 'function') {
            onComplete();
          }
          return;
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

    const sharedStartAt = performance.now();
    const glCanvas = gateElement ? document.createElement('canvas') : null;
    if (glCanvas) {
      glCanvas.className = 'intro-gl-canvas';
      glCanvas.setAttribute('aria-hidden', 'true');
      glCanvas.width = canvas.width;
      glCanvas.height = canvas.height;
      glCanvas.style.width = `${width}px`;
      glCanvas.style.height = `${height}px`;
      gateElement.insertBefore(glCanvas, canvas);
    }

    const gl = glCanvas
      ? glCanvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          desynchronized: true,
          premultipliedAlpha: true,
          powerPreference: 'high-performance'
        })
      : null;

    if (gl && glCanvas) {
      const stopWebGL = startWebGL2Renderer(gl, sharedStartAt);
      if (stopWebGL) {
        const waveCtx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        const stopWaves = waveCtx ? startWaveOverlayRenderer(waveCtx, sharedStartAt) : () => {};
        return () => {
          stopWaves();
          stopWebGL();
          if (glCanvas.isConnected) {
            glCanvas.remove();
          }
        };
      }
      if (glCanvas.isConnected) {
        glCanvas.remove();
      }
    }

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) {
      return () => {};
    }

    return startCanvas2DRenderer(ctx, sharedStartAt);
  };

  document.body.classList.add('intro-lock');

  requestAnimationFrame(() => {
    introGate.classList.add('is-visible');
  });

  let stopIntroParticles = () => {};
  let introFinished = false;
  let introCleanupTimer = 0;
  const finishIntro = () => {
    if (introFinished) {
      return;
    }
    introFinished = true;
    introGate.style.removeProperty('opacity');
    introGate.style.removeProperty('visibility');
    introGate.classList.remove('is-visible');
    introGate.classList.add('is-exiting');

    const cleanupIntro = () => {
      stopIntroParticles();
      stopIntroParticles = () => {};
      if (introGate.isConnected) {
        introGate.remove();
      }
      document.body.classList.remove('intro-lock');
    };

    if (introCleanupTimer) {
      window.clearTimeout(introCleanupTimer);
    }
    introCleanupTimer = window.setTimeout(cleanupIntro, INTRO_EXIT_MS + 40);
  };
  if (introParticleCanvas) {
    stopIntroParticles = startIntroParticles(
      introParticleCanvas,
      INTRO_DURATION_MS,
      FORM_PHASE_MS,
      DISSOLVE_PHASE_MS,
      INTRO_FPS,
      introGate,
      finishIntro
    );
  }

  window.setTimeout(finishIntro, INTRO_DURATION_MS + 160);
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
  const enableGpuWaveSimulation = false;
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
  const colorBufferFloat = enableGpuWaveSimulation && gl ? gl.getExtension('EXT_color_buffer_float') : null;
  const ctx = gl ? null : fluidCanvas.getContext('2d', { alpha: true, desynchronized: true });
  const waveRenderer = gl ? 'webgl2' : '2d';
  fluidCanvas.dataset.renderer = waveRenderer;
  document.documentElement.dataset.waveRenderer = waveRenderer;

  if (!gl && !ctx) {
    console.warn('Canvas rendering context is not available.');
  } else {
    const baseGridScale = gl ? 2.7 : 3.1;
    const maxCells = gl ? 240000 : 160000;
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
    const wavePaletteLight = {
      inkSlope: 0.74,
      inkTrough: 0.9,
      inkCrest: 0.22,
      washSlope: 0.4,
      washCrest: 0.18,
      alphaInk: 0.78,
      alphaWash: 0.3,
      toneFloor: 26,
      toneBase: 74,
      toneInk: 38,
      toneWash: 6,
      rOffset: 0,
      gOffset: 2,
      bOffset: 7,
      alphaScale: 104
    };

    let width = 0;
    let height = 0;
    let renderWidth = 0;
    let renderHeight = 0;
    let renderDpr = 1;
    let cols = 0;
    let rows = 0;
    let prev = new Float32Array(0);
    let curr = new Float32Array(0);
    let next = new Float32Array(0);
    let imageData = null;
    let pixels = null;
    let simCanvas = null;
    let simCtx = null;
    let rafId = null;
    let lastTime = 0;
    const targetFrameMs = gl ? 0 : 1000 / 45;
    let pageVisible = !document.hidden;
    let dropAccumulator = 0;
    let randomDropAccumulator = 0;
    let resizeQueued = false;
    const pointerInjectionIntervalMs = 28;
    const maxFrameImpulses = 12;
    const frameImpulses = new Float32Array(maxFrameImpulses * 4);
    let frameImpulseCount = 0;
    let gpuSimEnabled = false;

    let waveProgram = null;
    let waveSimProgram = null;
    let waveVao = null;
    let waveVertexBuffer = null;
    let waveHeightTexture = null;
    let waveStateTextures = [];
    let waveStateFramebuffers = [];
    let waveStateIndex = 0;
    let uWaveState = null;
    let uTexel = null;
    let uLightTheme = null;
    let uSimState = null;
    let uSimTexel = null;
    let uSimImpulseCount = null;
    let uSimImpulses = null;

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

    const createProgram = (vertexSource, fragmentSource) => {
      if (!gl) {
        return null;
      }

      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertexShader || !fragmentShader) {
        if (vertexShader) {
          gl.deleteShader(vertexShader);
        }
        if (fragmentShader) {
          gl.deleteShader(fragmentShader);
        }
        return null;
      }

      const program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return null;
      }

      return program;
    };

    const createWavePrograms = () => {
      if (!gl) {
        return false;
      }

      const vertexSource = `#version 300 es
      precision highp float;

      layout(location = 0) in vec2 aPosition;
      out vec2 vUv;

      void main() {
        vUv = vec2(aPosition.x * 0.5 + 0.5, 1.0 - (aPosition.y * 0.5 + 0.5));
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
      `;

      const renderFragmentSource = `#version 300 es
      precision highp float;

      in vec2 vUv;
      uniform sampler2D uWaveState;
      uniform vec2 uTexel;
      uniform int uLightTheme;
      out vec4 outColor;

      float sampleHeight(vec2 uv) {
        vec2 texSize = 1.0 / uTexel;
        vec2 coord = clamp(uv * texSize - 0.5, vec2(0.0), texSize - vec2(1.0));
        vec2 base = floor(coord);
        vec2 f = fract(coord);
        vec2 maxBase = texSize - vec2(1.0);

        vec2 uv00 = (base + 0.5) * uTexel;
        vec2 uv10 = (min(base + vec2(1.0, 0.0), maxBase) + 0.5) * uTexel;
        vec2 uv01 = (min(base + vec2(0.0, 1.0), maxBase) + 0.5) * uTexel;
        vec2 uv11 = (min(base + vec2(1.0, 1.0), maxBase) + 0.5) * uTexel;

        float h00 = texture(uWaveState, uv00).r;
        float h10 = texture(uWaveState, uv10).r;
        float h01 = texture(uWaveState, uv01).r;
        float h11 = texture(uWaveState, uv11).r;
        return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        float left = sampleHeight(vUv - vec2(uTexel.x, 0.0));
        float right = sampleHeight(vUv + vec2(uTexel.x, 0.0));
        float up = sampleHeight(vUv - vec2(0.0, uTexel.y));
        float down = sampleHeight(vUv + vec2(0.0, uTexel.y));
        float upLeft = sampleHeight(vUv - uTexel);
        float upRight = sampleHeight(vUv + vec2(uTexel.x, -uTexel.y));
        float downLeft = sampleHeight(vUv + vec2(-uTexel.x, uTexel.y));
        float downRight = sampleHeight(vUv + uTexel);
        float h = (sampleHeight(vUv) * 4.0 + left + right + up + down + (upLeft + upRight + downLeft + downRight) * 0.7) / 10.8;

        float sx = (right - left) * 0.76 + (upRight + downRight - upLeft - downLeft) * 0.18;
        float sy = (down - up) * 0.76 + (downLeft + downRight - upLeft - upRight) * 0.18;
        float slope = min(1.0, (abs(sx) + abs(sy)) * (1.0 / 14.0));
        float crest = h > 0.0 ? min(1.0, h / 18.0) : 0.0;
        float trough = h < 0.0 ? min(1.0, -h / 22.0) : 0.0;
        float glow = slope * 0.9 + crest * 0.28;
        float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;

        if (uLightTheme == 1) {
          float ink = min(1.0, slope * ${wavePaletteLight.inkSlope} + trough * ${wavePaletteLight.inkTrough} + crest * ${wavePaletteLight.inkCrest});
          float wash = min(1.0, slope * ${wavePaletteLight.washSlope} + crest * ${wavePaletteLight.washCrest});
          float alpha = min(1.0, ink * ${wavePaletteLight.alphaInk} + wash * ${wavePaletteLight.alphaWash});
          float tone = max(float(${wavePaletteLight.toneFloor}), float(${wavePaletteLight.toneBase}) - ink * float(${wavePaletteLight.toneInk}) + wash * float(${wavePaletteLight.toneWash}));

          outColor = vec4(
            (tone + float(${wavePaletteLight.rOffset})) / 255.0 + dither,
            (tone + float(${wavePaletteLight.gOffset})) / 255.0 + dither,
            (tone + float(${wavePaletteLight.bOffset})) / 255.0 + dither,
            (alpha * float(${wavePaletteLight.alphaScale})) / 255.0
          );
          return;
        }

        float alpha = min(1.0, glow + trough * 0.56);
        float r = min(255.0, 8.0 + glow * 60.0 + trough * 16.0);
        float g = min(255.0, 20.0 + glow * 140.0 + trough * 24.0);
        float b = min(255.0, 36.0 + glow * 184.0 + crest * 18.0);
        float a = min(255.0, 18.0 + alpha * 235.0);

        outColor = vec4(r / 255.0 + dither, g / 255.0 + dither, b / 255.0 + dither, a / 255.0);
      }
      `;

      const simulationFragmentSource = `#version 300 es
      precision highp float;

      in vec2 vUv;
      uniform sampler2D uSimState;
      uniform vec2 uSimTexel;
      uniform int uSimImpulseCount;
      uniform vec4 uSimImpulses[${maxFrameImpulses}];
      out vec4 outState;

      vec2 clampUv(vec2 uv) {
        return clamp(uv, uSimTexel * 0.5, vec2(1.0) - uSimTexel * 0.5);
      }

      float inject(vec2 uv, float value) {
        for (int i = 0; i < ${maxFrameImpulses}; i += 1) {
          if (i >= uSimImpulseCount) {
            break;
          }
          vec4 impulse = uSimImpulses[i];
          vec2 delta = (uv - impulse.xy) / uSimTexel;
          float dist2 = dot(delta, delta);
          float radius = impulse.z;
          if (dist2 <= radius * radius) {
            float spread = max(1.0, radius * radius * 0.42);
            value += impulse.w * exp(-dist2 / spread);
          }
        }
        return clamp(value, ${minAmplitude}.0, ${maxAmplitude}.0);
      }

      float sampleCurrent(vec2 uv) {
        vec2 safeUv = clampUv(uv);
        return inject(safeUv, texture(uSimState, safeUv).r);
      }

      void main() {
        vec2 safeUv = clampUv(vUv);
        float current = sampleCurrent(safeUv);
        float previous = texture(uSimState, safeUv).g;
        float left = sampleCurrent(safeUv - vec2(uSimTexel.x, 0.0));
        float right = sampleCurrent(safeUv + vec2(uSimTexel.x, 0.0));
        float up = sampleCurrent(safeUv - vec2(0.0, uSimTexel.y));
        float down = sampleCurrent(safeUv + vec2(0.0, uSimTexel.y));
        float laplacian = left + right + up + down - 4.0 * current;
        float nextValue = (2.0 - ${damping}) * current - (1.0 - ${damping}) * previous + ${c2} * laplacian;

        if (vUv.x <= uSimTexel.x || vUv.x >= 1.0 - uSimTexel.x || vUv.y <= uSimTexel.y || vUv.y >= 1.0 - uSimTexel.y) {
          nextValue = 0.0;
          current = 0.0;
        } else {
          nextValue = clamp(nextValue, ${minAmplitude}.0, ${maxAmplitude}.0);
        }

        outState = vec4(nextValue, current, 0.0, 1.0);
      }
      `;

      waveProgram = createProgram(vertexSource, renderFragmentSource);
      if (!waveProgram) {
        return false;
      }

      waveSimProgram = colorBufferFloat ? createProgram(vertexSource, simulationFragmentSource) : null;

      uWaveState = gl.getUniformLocation(waveProgram, 'uWaveState');
      uTexel = gl.getUniformLocation(waveProgram, 'uTexel');
      uLightTheme = gl.getUniformLocation(waveProgram, 'uLightTheme');
      uSimState = waveSimProgram ? gl.getUniformLocation(waveSimProgram, 'uSimState') : null;
      uSimTexel = waveSimProgram ? gl.getUniformLocation(waveSimProgram, 'uSimTexel') : null;
      uSimImpulseCount = waveSimProgram ? gl.getUniformLocation(waveSimProgram, 'uSimImpulseCount') : null;
      uSimImpulses = waveSimProgram ? gl.getUniformLocation(waveSimProgram, 'uSimImpulses') : null;
      return true;
    };

    const initWaveSimulationResources = () => {
      if (!gl || !colorBufferFloat || !waveSimProgram) {
        return false;
      }

      waveStateTextures = [];
      waveStateFramebuffers = [];
      waveStateIndex = 0;
      const cleanup = () => {
        waveStateTextures.forEach((texture) => {
          if (texture) {
            gl.deleteTexture(texture);
          }
        });
        waveStateFramebuffers.forEach((framebuffer) => {
          if (framebuffer) {
            gl.deleteFramebuffer(framebuffer);
          }
        });
        waveStateTextures = [];
        waveStateFramebuffers = [];
      };

      for (let i = 0; i < 2; i += 1) {
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer) {
          if (texture) {
            gl.deleteTexture(texture);
          }
          if (framebuffer) {
            gl.deleteFramebuffer(framebuffer);
          }
          cleanup();
          return false;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, cols, rows, 0, gl.RGBA, gl.HALF_FLOAT, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteTexture(texture);
          gl.deleteFramebuffer(framebuffer);
          cleanup();
          return false;
        }

        waveStateTextures.push(texture);
        waveStateFramebuffers.push(framebuffer);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
      if (waveStateTextures.length > 0) {
        waveStateTextures.forEach((texture) => {
          if (texture) {
            gl.deleteTexture(texture);
          }
        });
        waveStateTextures = [];
      }
      if (waveStateFramebuffers.length > 0) {
        waveStateFramebuffers.forEach((framebuffer) => {
          if (framebuffer) {
            gl.deleteFramebuffer(framebuffer);
          }
        });
        waveStateFramebuffers = [];
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
      if (waveSimProgram) {
        gl.deleteProgram(waveSimProgram);
        waveSimProgram = null;
      }
      waveStateIndex = 0;
      gpuSimEnabled = false;
      frameImpulseCount = 0;
      uWaveState = null;
      uTexel = null;
      uLightTheme = null;
      uSimState = null;
      uSimTexel = null;
      uSimImpulseCount = null;
      uSimImpulses = null;
    };

    const initWaveRenderer = () => {
      if (!gl) {
        return;
      }

      destroyWaveResources();
      if (!createWavePrograms()) {
        return;
      }

      waveVao = gl.createVertexArray();
      waveVertexBuffer = gl.createBuffer();
      if (!waveVao || !waveVertexBuffer) {
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

      gpuSimEnabled = initWaveSimulationResources();
      if (!gpuSimEnabled) {
        waveHeightTexture = gl.createTexture();
        if (!waveHeightTexture) {
          destroyWaveResources();
          return;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, waveHeightTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, cols, rows, 0, gl.RED, gl.FLOAT, curr);
      }

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(waveProgram);
      if (uWaveState) {
        gl.uniform1i(uWaveState, 0);
      }
      if (uTexel) {
        gl.uniform2f(uTexel, 1 / cols, 1 / rows);
      }

      if (waveSimProgram) {
        gl.useProgram(waveSimProgram);
        if (uSimState) {
          gl.uniform1i(uSimState, 0);
        }
        if (uSimTexel) {
          gl.uniform2f(uSimTexel, 1 / cols, 1 / rows);
        }
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

      renderDpr = Math.min(window.devicePixelRatio || 1, gl ? 1.75 : 1.25);
      renderWidth = Math.max(1, Math.round(width * renderDpr));
      renderHeight = Math.max(1, Math.round(height * renderDpr));
      fluidCanvas.width = renderWidth;
      fluidCanvas.height = renderHeight;
      fluidCanvas.style.width = `${width}px`;
      fluidCanvas.style.height = `${height}px`;

      if (gl) {
        initWaveRenderer();
        fluidCanvas.dataset.simulation = gpuSimEnabled ? 'gpu' : 'cpu';
        imageData = null;
        pixels = null;
      } else if (ctx) {
        fluidCanvas.dataset.simulation = 'cpu';
        if (!simCanvas) {
          simCanvas = document.createElement('canvas');
          simCtx = simCanvas.getContext('2d', { alpha: true });
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (simCanvas && simCtx) {
          simCanvas.width = cols;
          simCanvas.height = rows;
          imageData = simCtx.createImageData(cols, rows);
          pixels = imageData.data;
        } else {
          imageData = ctx.createImageData(cols, rows);
          pixels = imageData.data;
        }
      }
    };

    const resizeCanvas = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      allocate();
    };

    const queueWaveImpulse = (mx, my, power, radius) => {
      if (!gpuSimEnabled || frameImpulseCount >= maxFrameImpulses) {
        return false;
      }
      const base = frameImpulseCount * 4;
      frameImpulses[base] = clamp(mx / width, 0, 1);
      frameImpulses[base + 1] = clamp(my / height, 0, 1);
      frameImpulses[base + 2] = radius;
      frameImpulses[base + 3] = power;
      frameImpulseCount += 1;
      return true;
    };

    const splash = (mx, my, power = 8, radius = 6) => {
      if (gpuSimEnabled) {
        queueWaveImpulse(mx, my, power, radius);
        return;
      }
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

    const stepWaveGpu = () => {
      if (!gl || !gpuSimEnabled || !waveSimProgram || waveStateTextures.length < 2 || waveStateFramebuffers.length < 2 || !waveVao) {
        frameImpulseCount = 0;
        return;
      }

      const writeIndex = (waveStateIndex + 1) & 1;
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, cols, rows);
      gl.bindFramebuffer(gl.FRAMEBUFFER, waveStateFramebuffers[writeIndex]);
      gl.useProgram(waveSimProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, waveStateTextures[waveStateIndex]);
      if (uSimTexel) {
        gl.uniform2f(uSimTexel, 1 / cols, 1 / rows);
      }
      if (uSimImpulseCount) {
        gl.uniform1i(uSimImpulseCount, frameImpulseCount);
      }
      if (uSimImpulses && frameImpulseCount > 0) {
        gl.uniform4fv(uSimImpulses, frameImpulses);
      }
      gl.bindVertexArray(waveVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      waveStateIndex = writeIndex;
      frameImpulseCount = 0;
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
            const ink = Math.min(1, slope * wavePaletteLight.inkSlope + trough * wavePaletteLight.inkTrough + crest * wavePaletteLight.inkCrest);
            const wash = Math.min(1, slope * wavePaletteLight.washSlope + crest * wavePaletteLight.washCrest);
            const alpha = Math.min(1, ink * wavePaletteLight.alphaInk + wash * wavePaletteLight.alphaWash);
            const tone = Math.max(wavePaletteLight.toneFloor, wavePaletteLight.toneBase - ink * wavePaletteLight.toneInk + wash * wavePaletteLight.toneWash);

            pixels[p] = tone + wavePaletteLight.rOffset;
            pixels[p + 1] = tone + wavePaletteLight.gOffset;
            pixels[p + 2] = tone + wavePaletteLight.bOffset;
            pixels[p + 3] = Math.min(255, alpha * wavePaletteLight.alphaScale);
            continue;
          }

          const alpha = Math.min(1, glow + trough * 0.56);

          pixels[p] = Math.min(255, wavePaletteDark.rBase + glow * wavePaletteDark.rGlow + trough * wavePaletteDark.rTrough);
          pixels[p + 1] = Math.min(255, wavePaletteDark.gBase + glow * wavePaletteDark.gGlow + trough * wavePaletteDark.gTrough);
          pixels[p + 2] = Math.min(255, wavePaletteDark.bBase + glow * wavePaletteDark.bGlow + crest * wavePaletteDark.bCrest);
          pixels[p + 3] = Math.min(255, wavePaletteDark.aBase + alpha * wavePaletteDark.aScale);
        }
      }

      if (simCanvas && simCtx) {
        simCtx.putImageData(imageData, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, renderWidth, renderHeight);
        ctx.drawImage(simCanvas, 0, 0, renderWidth, renderHeight);
      } else {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    const renderWaveWebGL = () => {
      if (!gl || !waveProgram || !waveVao) {
        return;
      }

      const activeTexture = gpuSimEnabled ? waveStateTextures[waveStateIndex] : waveHeightTexture;
      if (!activeTexture) {
        return;
      }

      gl.viewport(0, 0, renderWidth, renderHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, activeTexture);
      if (!gpuSimEnabled) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.FLOAT, curr);
      }

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

      if (document.body.classList.contains('intro-lock')) {
        lastTime = timestamp;
        rafId = requestAnimationFrame(animate);
        return;
      }

      if (!lastTime) {
        lastTime = timestamp;
      }
      const elapsed = timestamp - lastTime;
      if (!gl && elapsed < targetFrameMs) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const dt = Math.min(48, elapsed);
      lastTime = timestamp;

      if (rainPointer.active) {
        dropAccumulator += dt;
        while (dropAccumulator >= pointerInjectionIntervalMs) {
          dropAccumulator -= pointerInjectionIntervalMs;
          splash(rainPointer.x, rainPointer.y, 11.6, 14);
        }
      } else {
        dropAccumulator = 0;
      }

      randomDropAccumulator += dt;
      while (randomDropAccumulator >= 820) {
        randomDropAccumulator -= 820;
        splash(Math.random() * width, Math.random() * height, 4.4, 6);
      }

      if (gpuSimEnabled) {
        stepWaveGpu();
      } else {
        updateWave();
      }

      renderWave();
      rafId = requestAnimationFrame(animate);
    };

    const onPointerMove = (event) => {
      if (!pageVisible) {
        return;
      }
      const nextX = clamp(event.clientX, 0, width - 1);
      const nextY = clamp(event.clientY, 0, height - 1);

      if (rainPointer.active) {
        const dx = nextX - rainPointer.x;
        const dy = nextY - rainPointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1.5) {
          const steps = Math.min(6, Math.max(1, Math.floor(distance / 18)));
          for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            splash(rainPointer.x + dx * t, rainPointer.y + dy * t, 8.8, 12);
          }
        } else {
          splash(nextX, nextY, 7.6, 11);
        }
      } else {
        splash(nextX, nextY, 10.4, 13);
      }

      rainPointer.x = nextX;
      rainPointer.y = nextY;
      rainPointer.active = true;
      dropAccumulator = 0;
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
    if (document.body.classList.contains('intro-lock')) {
      return;
    }
    cursorDot.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
  };

  const animateRing = () => {
    rx += (x - rx) * 0.3;
    ry += (y - ry) * 0.3;
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

  const syncCursorLoop = () => {
    const introActive = document.body.classList.contains('intro-lock');
    const shouldRun = !document.hidden && !introActive;
    cursorDot.style.opacity = shouldRun ? '1' : '0';
    cursorRing.style.opacity = shouldRun ? '1' : '0';
    if (shouldRun) {
      startCursorLoop();
    } else {
      stopCursorLoop();
    }
  };

  document.addEventListener('pointermove', moveCursor, { passive: true });
  syncCursorLoop();

  document.addEventListener('visibilitychange', () => {
    syncCursorLoop();
  });

  const bodyClassObserver = new MutationObserver(() => {
    syncCursorLoop();
  });
  bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const hoverTargets = document.querySelectorAll('a, button, video');
  hoverTargets.forEach((target) => {
    target.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    target.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}









