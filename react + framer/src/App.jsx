import { useState, useEffect, useRef } from "react";
import { motion as Motion} from "framer-motion";
import confetti from "canvas-confetti";
import "./App.css";

export default function App() {
  const [opened, setOpened] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [noBtnPos, setNoBtnPos] = useState({});
  const [smsStatus, setSmsStatus] = useState("idle");
  const canvasRef = useRef(null);
  const noBtnRef = useRef(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const handleOpen = () => {
    if (opened) return;
    setOpened(true);

    setTimeout(() => {
      setShowLetter(true);
    }, 600);
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 200,
      spread: 200,
      origin: { y: 0.6 },
    });

    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 120,
      });
    }, 300);
  };

  const handleYes = async (e) => {
    e.stopPropagation();
    if (smsStatus === "sending" || showResponse) return;

    setSmsStatus("sending");

    try {
      const response = await fetch(`${apiBaseUrl}/send-sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Failed to send SMS");
      }

      setSmsStatus("sent");
    } catch (error) {
      console.error("SMS send failed:", error);
      setSmsStatus("failed");
    }

    fireConfetti();
    setTimeout(() => {
      setShowResponse(true);
    }, 650);
  };

  const runAway = () => {
    const isPhone = window.matchMedia("(max-width: 430px)").matches;

    if (isPhone) {
      const btnWidth = noBtnRef.current?.offsetWidth ?? 120;
      const btnHeight = noBtnRef.current?.offsetHeight ?? 44;
      const safe = 12;

      const maxX = Math.max(safe, window.innerWidth - btnWidth - safe);
      const maxY = Math.max(safe, window.innerHeight - btnHeight - safe);

      const newX = safe + Math.random() * (maxX - safe);
      const newY = safe + Math.random() * (maxY - safe);

      setNoBtnPos({
        position: "fixed",
        left: newX,
        top: newY,
        zIndex: 30,
      });

      return;
    }

    const range = 400;

    setNoBtnPos((prev) => {
      const currentX = prev.left || 0;
      const currentY = prev.top || 0;

      let newX = currentX + (Math.random() * range - range / 2);
      let newY = currentY + (Math.random() * range - range / 2);

      const limit = 500;
      newX = Math.max(-limit, Math.min(limit, newX));
      newY = Math.max(-limit, Math.min(limit, newY));

      return {
        position: "relative",
        left: newX,
        top: newY,
      };
    });
  };

  useEffect(() => {
    const init = async () => {
      if (!navigator.gpu) {
        console.error("WebGPU not supported");
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("webgpu");
      if (!context) {
        console.error("Failed to get WebGPU context");
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error("No GPU adapter available");
        return;
      }

      const device = await adapter.requestDevice();
      const format = navigator.gpu.getPreferredCanvasFormat();

      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
      });

      const setCanvasSize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
      };

      setCanvasSize();

      const maxWaves = 24;
      const shader = device.createShaderModule({
        code: `
          struct Uniforms {
            resolution: vec2<f32>,
            globalTime: f32,
            waveCount: f32,
            waves: array<vec4<f32>, ${maxWaves}>,
          };

          @group(0) @binding(0) var<uniform> u: Uniforms;

          fn orb(uv: vec2<f32>, center: vec2<f32>, radius: f32, color: vec3<f32>) -> vec3<f32> {
            let d = distance(uv, center);
            let glow = exp(-pow(d / radius, 2.0));
            return color * glow;
          }

          fn sceneColor(uv: vec2<f32>, t: f32) -> vec3<f32> {
            let p = uv * 2.0 - vec2<f32>(1.0, 1.0);
            let vignette = 1.0 - smoothstep(0.35, 1.25, length(p));

            var col = vec3<f32>(0.08, 0.02, 0.06);
            col += vec3<f32>(0.18, 0.03, 0.11) * (1.0 - uv.y);
            col += vec3<f32>(0.05, 0.01, 0.04) * sin((uv.x + uv.y) * 7.0 + t * 0.4);

            let c1 = vec2<f32>(0.22 + sin(t * 0.12) * 0.03, 0.24 + cos(t * 0.16) * 0.03);
            let c2 = vec2<f32>(0.78 + cos(t * 0.1) * 0.04, 0.72 + sin(t * 0.14) * 0.04);
            let c3 = vec2<f32>(0.56 + sin(t * 0.09) * 0.03, 0.45 + cos(t * 0.12) * 0.03);

            col += orb(uv, c1, 0.26, vec3<f32>(0.45, 0.08, 0.23));
            col += orb(uv, c2, 0.22, vec3<f32>(0.36, 0.07, 0.2));
            col += orb(uv, c3, 0.18, vec3<f32>(0.28, 0.06, 0.17));

            return col * (0.55 + vignette * 0.45);
          }

          @fragment
          fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
            let uv = pos.xy / u.resolution;
            var offset = vec2<f32>(0.0, 0.0);

            for (var i: u32 = 0u; i < ${maxWaves}u; i = i + 1u) {
              if (f32(i) >= u.waveCount) {
                continue;
              }

              let w = u.waves[i];
              let center = w.xy;
              let age = w.z;
              let strength = w.w;

              let dist = distance(uv, center);
              let influence = exp(-dist * 9.0) * exp(-age * 1.5);
              let phase = sin(dist * 72.0 - age * 11.0);
              let dir = select(vec2<f32>(0.0), normalize(uv - center), dist > 0.001);

              offset += dir * phase * influence * strength * 0.014;
            }

            let distortedUV = clamp(uv + offset, vec2<f32>(0.0), vec2<f32>(1.0));
            let col = sceneColor(distortedUV, u.globalTime);
            return vec4<f32>(col, 1.0);
          }

          @vertex
          fn vs(@builtin(vertex_index) vIndex: u32)
            -> @builtin(position) vec4<f32> {

            var pos = array<vec2<f32>, 6>(
              vec2<f32>(-1.0, -1.0),
              vec2<f32>( 1.0, -1.0),
              vec2<f32>(-1.0,  1.0),
              vec2<f32>(-1.0,  1.0),
              vec2<f32>( 1.0, -1.0),
              vec2<f32>( 1.0,  1.0)
            );

            return vec4<f32>(pos[vIndex], 0.0, 1.0);
          }
        `,
      });

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shader,
          entryPoint: "vs",
        },
        fragment: {
          module: shader,
          entryPoint: "fs",
          targets: [{ format }],
        },
      });

      let rafId = 0;
      const waves = [];
      const maxWaveAge = 1.2;
      let globalTime = 0;

      const pushWave = (x, y, strength = 1) => {
        waves.push({ x, y, time: 0, strength });
        if (waves.length > maxWaves) waves.shift();
      };

      const pushWaveFromClientPoint = (clientX, clientY, strength = 1) => {
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        pushWave(x, y, strength);
      };

      const onMouseMove = (e) => {
        pushWaveFromClientPoint(e.clientX, e.clientY, 4);
      };

      const onTouchMove = (e) => {
        if (!e.touches[0]) return;
        const touch = e.touches[0];
        pushWaveFromClientPoint(touch.clientX, touch.clientY, 4.4);
      };

      const onPointerDown = (e) => {
        pushWaveFromClientPoint(e.clientX, e.clientY, 7);
      };

      const onResize = () => {
        setCanvasSize();
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      window.addEventListener("resize", onResize);

      const uniformBuffer = device.createBuffer({
        size: (4 + maxWaves * 4) * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const render = () => {
        const encoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              loadOp: "clear",
              storeOp: "store",
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
            },
          ],
        });

        try {
          globalTime += 0.016;

          for (let i = waves.length - 1; i >= 0; i -= 1) {
            const wave = waves[i];
            wave.time += 0.018;

            if (wave.time > maxWaveAge) {
              waves.splice(i, 1);
            }
          }

          const data = new Float32Array(4 + maxWaves * 4);
          data[0] = canvas.width;
          data[1] = canvas.height;
          data[2] = globalTime;
          data[3] = waves.length;

          for (let i = 0; i < waves.length; i += 1) {
            const base = 4 + i * 4;
            const wave = waves[i];
            const life = 1 - wave.time / maxWaveAge;

            data[base] = wave.x;
            data[base + 1] = wave.y;
            data[base + 2] = wave.time;
            data[base + 3] = life * wave.strength;
          }

          device.queue.writeBuffer(uniformBuffer, 0, data);

          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(6);

          pass.end();
          device.queue.submit([encoder.finish()]);
        } catch (e) {
          console.error("Render error:", e);
        }

        rafId = requestAnimationFrame(render);
      };

      render();

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("resize", onResize);
      };
    };

    let cleanup = null;

    init().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <Motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 80,
        damping: 12,
      }}
    >
      <canvas id="webglCanvas" ref={canvasRef} className="webgl-canvas"></canvas>
      <div>
        <div className="stage">
          {!opened && <p className="hint">✉️ tap the envelope...</p>}

          <Motion.div
            className="envelope-wrap"
            onClick={handleOpen}
            whileHover={{ scale: 1.05 }}
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="env-body"></div>
            <div className="env-left"></div>
            <div className="env-right"></div>
            <div className="env-bottom"></div>

            {showLetter && (
              <Motion.div
                className="letter-wrap slide-up"
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 10,
                }}
              >
                <div className="letter">
                  <div className="letter-question">
                    Will you go <br /> bowling with me?
                  </div>

                  <div className="btns">
                    <Motion.button
                      className="btn btn-yes"
                      onClick={handleYes}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      disabled={smsStatus === "sending"}
                    >
                      {smsStatus === "sending" ? "Sending..." : "Yes! 💕"}
                    </Motion.button>

                    <button
                      ref={noBtnRef}
                      className="btn btn-no"
                      style={noBtnPos}
                      onMouseEnter={runAway}
                      onTouchStart={runAway}
                    >
                      Maybe not
                    </button>
                  </div>
                </div>
              </Motion.div>
            )}

            <Motion.div
              className="env-flap"
              animate={opened ? { rotateX: 180 } : { rotateX: 0 }}
              transition={{
                type: "spring",
                stiffness: 80,
                damping: 12,
              }}
            />

            {!opened && (
              <Motion.div
                className="seal"
                initial={{ scale: 1 }}
                animate={{ scale: opened ? 0 : 1, opacity: opened ? 0 : 1 }}
                transition={{ duration: 0.3 }}
              >
                💌
              </Motion.div>
            )}
          </Motion.div>
        </div>

        {showResponse && (
          <Motion.div
            className="response show"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Motion.div
              className="response-emoji"
              animate={{ y: [0, -15, 0] }}
              transition={{
                repeat: Infinity,
                duration: 1,
                ease: "easeInOut",
              }}
            >
              🎳💕🎉
            </Motion.div>

            <div className="response-text">Yay! It's a date! 🥂</div>

            {smsStatus === "failed" && (
              <div className="response-sub">I couldn't send the SMS notification, but it's still a YES.</div>
            )}

            <div className="response-sub">
              Get ready for the best bowling date ever —
              <br />
              I promise to let you win… maybe. 😏
            </div>
          </Motion.div>
        )}
      </div>
    </Motion.div>
  );
}
