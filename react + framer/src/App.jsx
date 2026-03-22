import { useState, useEffect, useRef } from "react";
import { motion as Motion} from "framer-motion";
import confetti from "canvas-confetti";
import "./App.css";
import { initEnvelope } from "./threeEnvelope";

export default function App() {
  const [opened, setOpened] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [noBtnPos, setNoBtnPos] = useState({});
  const canvasRef = useRef(null);
  const noBtnRef = useRef(null);
  const threeRef = useRef(null);
  const responseRef = useRef(null);
  const triggerResponseRippleRef = useRef(() => {});
  const pendingResponseRippleRef = useRef(false);

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

  const handleYes = (e) => {
    e.stopPropagation();
    fireConfetti();
    setTimeout(() => {
      setShowResponse(true);
      pendingResponseRippleRef.current = true;
      triggerResponseRippleRef.current();
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
    let unmounted = false;
    let cleanup = () => {};

    const init = async () => {
      try {
        if (!navigator.gpu || typeof GPUBufferUsage === "undefined") {
          console.error("WebGPU not supported");
          return () => {};
        }

        const canvas = canvasRef.current;
        if (!canvas) return () => {};

        const context = canvas.getContext("webgpu");
        if (!context) {
          console.error("Failed to get WebGPU context");
          return () => {};
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error("No GPU adapter available");
          return () => {};
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

      const triggerResponseRipple = () => {
        const rect = responseRef.current?.getBoundingClientRect();

        if (rect) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          const burst = [
            [0, 0, 14],
            [-70, -24, 10],
            [70, -24, 10],
            [-110, 22, 8],
            [110, 22, 8],
            [0, 0, 10],
          ];

          for (let i = 0; i < burst.length; i += 1) {
            const [dx, dy, strength] = burst[i];
            setTimeout(() => {
              pushWaveFromClientPoint(cx + dx, cy + dy, strength);
            }, i * 85);
          }
          return;
        }

        pushWave(0.5, 0.6, 12);
        setTimeout(() => pushWave(0.5, 0.6, 9), 100);
        setTimeout(() => pushWave(0.5, 0.6, 7), 200);
      };

      triggerResponseRippleRef.current = triggerResponseRipple;

      if (pendingResponseRippleRef.current) {
        triggerResponseRipple();
        pendingResponseRippleRef.current = false;
      }

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
          triggerResponseRippleRef.current = () => {};
        };
      } catch (error) {
        console.error("WebGPU init failed:", error);
        return () => {};
      }
    };

    init().then((fn) => {
      const safeCleanup = fn || (() => {});
      if (unmounted) {
        safeCleanup();
        return;
      }
      cleanup = safeCleanup;
    });

    return () => {
      unmounted = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!threeRef.current) return;

    let cleanup = () => {};

    try {
      cleanup = initEnvelope(threeRef.current, () => {
        setOpened(true);
        setTimeout(() => {
          setShowLetter(true);
        }, 600);
      }) || (() => {});
    } catch (error) {
      console.error("Three envelope init failed:", error);
    }

    return () => cleanup();
  }, []);

  const responseVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 110,
        damping: 20,
        mass: 0.9,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const responseItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" },
    },
  };

  const questionVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 160,
        damping: 24,
        mass: 0.9,
        when: "beforeChildren",
        staggerChildren: 0.08,
      },
    },
  };

  const questionItemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28, ease: "easeOut" },
    },
  };

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
            className="envelope-wrap envelope-3d-wrap"
            style={{ transformPerspective: 1200 }}
            whileHover={{
              scale: 1.05,
              rotateX: 4,
              z: 24,
              filter: "drop-shadow(0 52px 90px rgba(232, 57, 106, 0.58))",
            }}
            animate={{
              y: [0, -6, 0],
              z: 0,
              rotateX: 0,
              scale: 1,
              filter: "drop-shadow(0 40px 80px rgba(232, 57, 106, 0.5))",
            }}
            transition={{
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              z: {
                type: "spring",
                stiffness: 220,
                damping: 24,
              },
              rotateX: {
                type: "spring",
                stiffness: 220,
                damping: 24,
              },
              scale: {
                type: "spring",
                stiffness: 220,
                damping: 24,
              },
              filter: {
                duration: 0.25,
                ease: "easeOut",
              },
            }}
          >
            <div ref={threeRef} className="three-envelope"></div>

            {showLetter && (
              <Motion.div
                className="letter-wrap"
                initial="hidden"
                animate="visible"
                variants={questionVariants}
              >
                <div className="letter">
                  <Motion.div className="letter-question" variants={questionItemVariants}>
                    Will you go <br /> bowling with me?
                  </Motion.div>

                  <Motion.div className="btns" variants={questionItemVariants}>
                    <Motion.button
                      className="btn btn-yes"
                      onClick={handleYes}
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.04 }}
                    >
                      Yes! 💕
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
                  </Motion.div>
                </div>
              </Motion.div>
            )}
          </Motion.div>
        </div>

        {showResponse && (
          <Motion.div
            ref={responseRef}
            className="response show"
            initial="hidden"
            animate="visible"
            variants={responseVariants}
          >
            <Motion.div variants={responseItemVariants}>
              <Motion.div
                className="response-emoji"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: "easeInOut",
                }}
              >
                🎳💕🎉
              </Motion.div>
            </Motion.div>

            <Motion.div className="response-text" variants={responseItemVariants}>
              Yay! It's a date! 🥂
            </Motion.div>

            <Motion.div className="response-sub" variants={responseItemVariants}>
              Get ready for the best bowling date ever —
              <br />
              I promise to let you win… maybe. 😏
            </Motion.div>
          </Motion.div>
        )}
      </div>
    </Motion.div>
  );
}
