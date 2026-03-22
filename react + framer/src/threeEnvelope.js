import * as THREE from "three";
import gsap from "gsap";

export function initEnvelope(container, onOpen) {
  if (!container) return () => {};

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );

  camera.position.set(0, 0.2, 5.2);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    console.error("Failed to initialize Three renderer:", error);
    return () => {};
  }

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1f7, 1.1);
  keyLight.position.set(2.4, 3.2, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffd6e5, 0.45);
  fillLight.position.set(-2, 1.2, 2.4);
  scene.add(fillLight);

  const envelope = new THREE.Group();
  scene.add(envelope);

  const paperMain = new THREE.MeshStandardMaterial({
    color: "#f3c7d2",
    roughness: 0.86,
    metalness: 0.03,
  });
  const paperFold = new THREE.MeshStandardMaterial({
    color: "#e9b7c6",
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const flapMat = new THREE.MeshStandardMaterial({
    color: "#cf355f",
    roughness: 0.64,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  const backBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 2.05, 0.08),
    paperMain
  );
  backBody.position.y = -0.04;
  envelope.add(backBody);

  const leftFoldShape = new THREE.Shape();
  leftFoldShape.moveTo(-1.55, -1.02);
  leftFoldShape.lineTo(0, 0.03);
  leftFoldShape.lineTo(-1.55, 1.02);
  leftFoldShape.closePath();

  const rightFoldShape = new THREE.Shape();
  rightFoldShape.moveTo(1.55, -1.02);
  rightFoldShape.lineTo(0, 0.03);
  rightFoldShape.lineTo(1.55, 1.02);
  rightFoldShape.closePath();

  const bottomFoldShape = new THREE.Shape();
  bottomFoldShape.moveTo(-1.55, -1.02);
  bottomFoldShape.lineTo(0, 0.02);
  bottomFoldShape.lineTo(1.55, -1.02);
  bottomFoldShape.closePath();

  const leftFold = new THREE.Mesh(
    new THREE.ShapeGeometry(leftFoldShape),
    paperFold
  );
  leftFold.position.z = 0.055;
  envelope.add(leftFold);

  const rightFold = new THREE.Mesh(
    new THREE.ShapeGeometry(rightFoldShape),
    paperFold
  );
  rightFold.position.z = 0.055;
  envelope.add(rightFold);

  const bottomFold = new THREE.Mesh(
    new THREE.ShapeGeometry(bottomFoldShape),
    paperFold
  );
  bottomFold.position.z = 0.07;
  envelope.add(bottomFold);

  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 1.02, 0.09);
  envelope.add(flapPivot);

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-1.55, 0);
  flapShape.lineTo(0, -1.2);
  flapShape.lineTo(1.55, 0);
  flapShape.closePath();

  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), flapMat);
  flapPivot.add(flap);

  const letter = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 1.55, 0.03),
    new THREE.MeshStandardMaterial({
      color: "#fffaf4",
      roughness: 0.88,
      metalness: 0,
    })
  );
  letter.position.set(0, -0.15, 0.035);
  envelope.add(letter);

  let opened = false;

  // 🖱️ click handler
  const onClick = () => {
    if (opened) return;
    opened = true;

    gsap.to(flapPivot.rotation, {
      x: -Math.PI * 0.98,
      duration: 1.05,
      ease: "power3.out",
    });

    if (onOpen) onOpen();
  };

  container.addEventListener("click", onClick);

  const onResize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  };

  window.addEventListener("resize", onResize);

  // 🎥 render loop
  let rafId = 0;
  const animate = () => {
    try {
      const t = clock.getElapsedTime();
      envelope.rotation.y = Math.sin(t * 0.8) * 0.05;
      envelope.position.y = Math.sin(t * 1.1) * 0.035;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    } catch (error) {
      console.error("Three render failed:", error);
    }
  };

  animate();

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    container.removeEventListener("click", onClick);

    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m?.dispose?.());
      } else {
        obj.material?.dispose?.();
      }
    });

    renderer.dispose();

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}