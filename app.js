/**
 * LOCK MOSKVA - 3D Interactive Lock Landing Page Logic
 * Built with Three.js & GSAP
 * Powered by transparent mechanical padlock simulation
 */

// Global WebGL State for the new padlock mechanism
let scene, camera, renderer, controls;
let masterGroup;       // Tilted parent group for lock and key
let lockGroup, keyGroup, shackleMesh;
let centralCore, keyholeMesh;
let keyholeLight;

// Internal mechanism objects
let keyPins = [];      // Bottom pins (rotate with core)
let driverPins = [];   // Top pins (stationary vertically, slide in chambers)
let pinSprings = [];   // Springs at the top (compress)
let lockingLatch;      // Horizontal locking bolt
let gearA, gearB;      // Two subtle interlocking gears

// Color themes mapping (Navy background, Turquoise/Mint neon)
const THEMES = {
    cyan: {
        primary: 0x00b2ff,     // Sci-fi neon blue matching the CTA gradient side
        secondary: 0xffd875,   // Warm yellow sunlight backlight
        lightColor: 0x00b2ff   // Keyhole light color
    }
};

let currentTheme = 'cyan';
let loopTimeline = null;

// Initialize Three.js scene, camera, renderer, and controls
function initThree() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    // Scene setup with transparent background
    scene = new THREE.Scene();

    // Camera setup (Static 3/4 perspective, no zoom-in during animation)
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.8, 1.8, 7.3);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0.0); // Transparent clear color
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls setup
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.4, 0); // Lock center focus point
    controls.minDistance = 3.5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // Resize listener
    window.addEventListener('resize', onWindowResize);
    
    createEnvironment();
    createLock();
    createKey();
}

// Create ambient elements: Grid floor and lights
function createEnvironment() {
    // Lights
    const ambientLight = new THREE.AmbientLight(0x0f1c3f, 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff5ea, 2.2); // Warm white light to prevent washed-out colors
    dirLight1.position.set(-5, 5, 8); // Moved in front of the lock (Z=8) and reflected horizontally (X=-5)
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.bias = -0.001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(THEMES[currentTheme].secondary, 2.0); // Slightly stronger backlight for richer warm reflections
    dirLight2.position.set(5, -3, -2); // Reflected horizontally (X=5)
    scene.add(dirLight2);

    // HemisphereLight simulating sky/ground ambient reflection (provides beautiful gradients on metallic surface)
    const hemiLight = new THREE.HemisphereLight(0xffeebb, 0x0a1428, 2.2);
    scene.add(hemiLight);

    // Side specular highlight light (paints sharp specular reflection on key and shackle)
    const dirLight3 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight3.position.set(8, 2, 4);
    scene.add(dirLight3);

    // Cyberpunk themed cyan reflection light from bottom-left (creates stunning cyan rim reflections on the bottom of the shackle and key)
    const dirLight4 = new THREE.DirectionalLight(THEMES[currentTheme].primary, 1.8);
    dirLight4.position.set(-3, -6, 2);
    scene.add(dirLight4);

    // Add a point light inside keyhole
    keyholeLight = new THREE.PointLight(THEMES[currentTheme].primary, 3.5, 5, 1.5);
    keyholeLight.position.set(0, 0, 0.51);
    scene.add(keyholeLight);

    // Cyberpunk grid floor helper removed as per request
}

// Procedurally create the 3D Transparent Lock with internal mechanisms
function createLock() {
    // Create master group tilted slightly back (Z-axis upwards tilt)
    masterGroup = new THREE.Group();
    masterGroup.rotation.x = -0.22; // Tilt lock back so keyhole points slightly upwards
    scene.add(masterGroup);

    lockGroup = new THREE.Group();
    masterGroup.add(lockGroup);

    // --- MATERIALS ---
    const glassCasingMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0f1f45,           // Richer deep navy blue tint
        metalness: 0.15,
        roughness: 0.22,
        transparent: true,
        opacity: 0.65,             // Increased opacity to make the lock more visible
        transmission: 0.55,        // Reduced transmission so it catches reflections/highlights better
        ior: 1.55,
        thickness: 1.5,            // Generates thick glass refraction edges
        side: THREE.DoubleSide,
        depthWrite: true
    });

    const contourLineMaterial = new THREE.LineBasicMaterial({
        color: THEMES[currentTheme].primary,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
        color: 0x8a95a5,
        metalness: 0.95,
        roughness: 0.12,
        envMapIntensity: 1.0
    });

    const bronzeMaterial = new THREE.MeshStandardMaterial({
        color: 0xbb7f44,       // Bright metallic bronze #bb7f44
        metalness: 0.85,       // High metalness for rich metallic reflection
        roughness: 0.06,       // Very low roughness for sharp, brilliant specular highlights
        envMapIntensity: 1.5
    });

    const brassMaterial = new THREE.MeshStandardMaterial({
        color: 0xdca818,
        metalness: 0.5,        // Lower metalness to preserve the rich yellow/gold base color
        roughness: 0.15
    });

    const copperMaterial = new THREE.MeshStandardMaterial({
        color: 0xd47a55,
        metalness: 0.55,       // Lower metalness to preserve the rich copper base color
        roughness: 0.12
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
        color: THEMES[currentTheme].primary,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
    });

    // --- 1. THE SHACKLE ---
    const shackleGroup = new THREE.Group();
    
    const heelLegGeom = new THREE.CylinderGeometry(0.18, 0.18, 1.9, 16); // Taller shackle heel leg
    const leftLeg = new THREE.Mesh(heelLegGeom, bronzeMaterial);
    leftLeg.position.set(0, 0.95, 0); 
    leftLeg.castShadow = true;
    shackleGroup.add(leftLeg);

    const toeLegGeom = new THREE.CylinderGeometry(0.18, 0.18, 1.3, 16); // Taller shackle toe leg
    const rightLeg = new THREE.Mesh(toeLegGeom, bronzeMaterial);
    rightLeg.position.set(2.6, 1.25, 0); 
    rightLeg.castShadow = true;
    shackleGroup.add(rightLeg);

    const shackleTorusGeom = new THREE.TorusGeometry(1.3, 0.18, 16, 64, Math.PI);
    const shackleTorus = new THREE.Mesh(shackleTorusGeom, bronzeMaterial);
    shackleTorus.position.set(1.3, 1.9, 0); // Position torus at the top of the taller legs
    shackleTorus.castShadow = true;
    shackleGroup.add(shackleTorus);

    shackleMesh = shackleGroup;
    shackleMesh.position.set(-1.3, 0, 0);
    lockGroup.add(shackleMesh);

    // --- 2. SINGLE SOLID LOCK CASING ---
    const casingOuterRadius = 1.8;
    const casingThickness = 0.8;

    const lockShape = new THREE.Shape();
    lockShape.moveTo(-1.8, 0.8);
    lockShape.lineTo(1.8, 0.8);
    lockShape.lineTo(1.8, 0);
    lockShape.absarc(0, 0, casingOuterRadius, 0, Math.PI, true);
    lockShape.lineTo(-1.8, 0.8);
    lockShape.closePath();

    const extrudeSettings = { depth: casingThickness, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.03, bevelThickness: 0.03 };
    const casingGeom = new THREE.ExtrudeGeometry(lockShape, extrudeSettings);
    casingGeom.center();

    const casingGlass = new THREE.Mesh(casingGeom, glassCasingMaterial);
    casingGlass.castShadow = true;
    casingGlass.receiveShadow = true;
    casingGlass.position.set(0, 0, 0);
    lockGroup.add(casingGlass);

    const edges = new THREE.EdgesGeometry(casingGeom, 25);
    const contourLines = new THREE.LineSegments(edges, contourLineMaterial);
    contourLines.position.set(0, 0, 0);
    lockGroup.add(contourLines);

    // --- 3. CENTRAL CYLINDER PLUG CORE ---
    centralCore = new THREE.Group();
    centralCore.position.set(0, 0, 0);

    const coreGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x2e3b52,
        metalness: 0.8,
        roughness: 0.1,
        transparent: true,
        opacity: 0.35,
        transmission: 0.7,
        ior: 1.4
    });

    const coreGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.9, 32);
    coreGeom.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeom, coreGlassMaterial);
    centralCore.add(coreMesh);

    const coreGlowRingGeom = new THREE.RingGeometry(0.55, 0.62, 32);
    const coreGlowRing = new THREE.Mesh(coreGlowRingGeom, glowMaterial);
    coreGlowRing.position.z = 0.46;
    centralCore.add(coreGlowRing);
    centralCore.userData.glow = coreGlowRing;

    const keyholeShape = new THREE.Shape();
    keyholeShape.moveTo(0.06, -0.08);
    keyholeShape.absarc(0, -0.12, 0.12, -Math.PI/6, Math.PI + Math.PI/6, false); 
    keyholeShape.lineTo(-0.08, 0.2);
    keyholeShape.lineTo(0.08, 0.2);
    keyholeShape.closePath();

    const khExtSettings = { depth: 0.3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };
    const keyholeGeom = new THREE.ExtrudeGeometry(keyholeShape, khExtSettings);
    keyholeGeom.center();
    
    const keyholeMat = new THREE.MeshStandardMaterial({
        color: 0x05070e,
        metalness: 0.2,
        roughness: 0.8
    });
    keyholeMesh = new THREE.Mesh(keyholeGeom, keyholeMat);
    keyholeMesh.position.set(0, 0, 0.35);
    centralCore.add(keyholeMesh);

    lockGroup.add(centralCore);

    // --- 4. INTERNAL MECHANICS: PIN TUMBLER SYSTEM ---
    const pinsContainer = new THREE.Group();
    lockGroup.add(pinsContainer);

    const pinZOffsets = [0.2, 0.0, -0.2, -0.4];
    const initialKeyPinHeights = [0.18, 0.25, 0.10, 0.22];
    
    pinZOffsets.forEach((zVal, idx) => {
        const kpHeight = initialKeyPinHeights[idx];
        const kpGeom = new THREE.CylinderGeometry(0.055, 0.055, kpHeight, 16);
        kpGeom.translate(0, kpHeight / 2, 0);
        
        const kpMesh = new THREE.Mesh(kpGeom, brassMaterial);
        kpMesh.position.set(0, -0.08, zVal);
        centralCore.add(kpMesh);
        keyPins.push(kpMesh);

        const dpHeight = 0.35;
        const dpGeom = new THREE.CylinderGeometry(0.055, 0.055, dpHeight, 16);
        dpGeom.translate(0, dpHeight / 2, 0);
        
        const dpMesh = new THREE.Mesh(dpGeom, chromeMaterial);
        const initialDpY = -0.08 + kpHeight;
        dpMesh.position.set(0, initialDpY, zVal);
        pinsContainer.add(dpMesh);
        driverPins.push(dpMesh);

        const springGroup = new THREE.Group();
        springGroup.position.set(0, initialDpY + dpHeight, zVal);
        
        const springLineGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8, 4, true);
        const springMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            wireframe: true
        });
        const springMesh = new THREE.Mesh(springLineGeom, springMat);
        springMesh.position.y = 0.2;
        springGroup.add(springMesh);
        pinsContainer.add(springGroup);
        
        pinSprings.push({
            group: springGroup,
            mesh: springMesh,
            initialY: initialDpY + dpHeight,
            maxHeight: 0.4
        });
    });

    keyPins.forEach((kp, idx) => {
        const delta = 0.43 - initialKeyPinHeights[idx];
        kp.userData.targetDelta = delta;
        kp.userData.initialY = kp.position.y;
        
        if (driverPins[idx]) {
            driverPins[idx].userData.initialY = driverPins[idx].position.y;
        }
    });

    // --- 5. INTERNAL MECHANICS: LOCKING LATCH BOLT ---
    const latchGeom = new THREE.BoxGeometry(0.75, 0.18, 0.22);
    lockingLatch = new THREE.Mesh(latchGeom, bronzeMaterial);
    lockingLatch.position.set(0.95, 0.75, 0); 
    pinsContainer.add(lockingLatch);

    // --- 6. INTERNAL MECHANICS: TWO SUBTLE INTERLOCKING GEARS ---
    gearA = createProceduralGear(0.35, 0.1, 10, copperMaterial);
    gearA.position.set(0, 0, -0.42);
    centralCore.add(gearA);

    gearB = createProceduralGear(0.35, 0.1, 10, brassMaterial);
    gearB.position.set(0, 0.70, -0.42);
    pinsContainer.add(gearB);
}

// Procedural gear model generator helper
function createProceduralGear(radius, thickness, teethCount, material) {
    const gearGroup = new THREE.Group();

    const bodyGeom = new THREE.CylinderGeometry(radius - 0.10, radius - 0.10, thickness, 32);
    bodyGeom.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeom, material);
    body.castShadow = true;
    body.receiveShadow = true;
    gearGroup.add(body);

    const axleGeom = new THREE.CylinderGeometry(0.06, 0.06, thickness + 0.04, 16);
    axleGeom.rotateX(Math.PI / 2);
    const axleMat = new THREE.MeshStandardMaterial({ color: 0x708090, metalness: 0.9, roughness: 0.1 });
    const axle = new THREE.Mesh(axleGeom, axleMat);
    gearGroup.add(axle);

    const toothGeom = new THREE.BoxGeometry(0.08, thickness, 0.18);
    for (let i = 0; i < teethCount; i++) {
        const theta = (i / teethCount) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeom, material);
        tooth.position.set(Math.cos(theta) * (radius - 0.05), Math.sin(theta) * (radius - 0.05), 0);
        tooth.rotation.z = theta;
        tooth.castShadow = true;
        gearGroup.add(tooth);
    }

    return gearGroup;
}

// Procedurally create the 3D Futuristic Key
function createKey() {
    keyGroup = new THREE.Group();
    keyGroup.position.set(0, -0.04, 4.5);
    keyGroup.rotation.set(0, 0, 0);
    masterGroup.add(keyGroup); 

    const bronzeKeyMaterial = new THREE.MeshStandardMaterial({
        color: 0xbb7f44,       // Bright metallic bronze #bb7f44
        metalness: 0.85,       // High metalness for rich metallic reflection
        roughness: 0.06,       // Very low roughness for sharp, brilliant specular highlights
        envMapIntensity: 1.5
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
        color: THEMES[currentTheme].primary,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });

    // 1. KEY HEAD
    const hexShape = new THREE.Shape();
    const hexRadius = 0.55;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * hexRadius;
        const y = Math.sin(angle) * hexRadius;
        if (i === 0) hexShape.moveTo(x, y);
        else hexShape.lineTo(x, y);
    }
    hexShape.closePath();

    const holePath = new THREE.Path();
    holePath.absarc(0, 0, 0.25, 0, Math.PI * 2, true);
    hexShape.holes.push(holePath);

    const keyExtSettings = { depth: 0.12, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const keyHeadGeom = new THREE.ExtrudeGeometry(hexShape, keyExtSettings);
    keyHeadGeom.center();
    const keyHead = new THREE.Mesh(keyHeadGeom, bronzeKeyMaterial);
    keyHead.castShadow = true;
    keyHead.position.z = 0.75; 
    keyHead.rotation.y = Math.PI / 2; 
    keyGroup.add(keyHead);

    const headGlowRingGeom = new THREE.TorusGeometry(0.26, 0.03, 8, 32);
    const headGlowRing = new THREE.Mesh(headGlowRingGeom, glowMaterial);
    headGlowRing.position.z = 0.75;
    headGlowRing.rotation.y = Math.PI / 2; 
    keyGroup.add(headGlowRing);

    // 2. KEY SHAFT
    const shaftGeom = new THREE.CylinderGeometry(0.07, 0.07, 1.5, 16);
    shaftGeom.rotateX(Math.PI / 2);
    const keyShaft = new THREE.Mesh(shaftGeom, bronzeKeyMaterial);
    keyShaft.position.z = 0.0;
    keyShaft.castShadow = true;
    keyGroup.add(keyShaft);

    // Glow laser channel
    const laserGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
    laserGeom.rotateX(Math.PI / 2);
    const keyLaser = new THREE.Mesh(laserGeom, glowMaterial);
    keyLaser.position.set(0, -0.06, 0.0); 
    keyGroup.add(keyLaser);

    // 3. KEY TEETH
    const teethGroup = new THREE.Group();
    teethGroup.position.set(0, 0, 0); 

    const pinZOffsets = [0.2, 0.0, -0.2, -0.4];
    const initialKeyPinHeights = [0.18, 0.25, 0.10, 0.22];
    
    pinZOffsets.forEach((zOff, idx) => {
        const liftNeeded = 0.43 - initialKeyPinHeights[idx];
        
        const toothH = liftNeeded + 0.08;
        const toothGeom = new THREE.BoxGeometry(0.08, toothH, 0.15);
        toothGeom.translate(0, toothH / 2, 0); 
 
        const tooth = new THREE.Mesh(toothGeom, bronzeKeyMaterial);
        tooth.position.set(0, 0.07, zOff - 0.65);
        teethGroup.add(tooth);

        const toothLaserGeom = new THREE.BoxGeometry(0.09, 0.05, 0.05);
        const toothLaser = new THREE.Mesh(toothLaserGeom, glowMaterial);
        toothLaser.position.set(0, toothH - 0.02, zOff - 0.65);
        teethGroup.add(toothLaser);
    });

    keyGroup.add(teethGroup);
}

// Window resizing callback
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (!container || !renderer || !camera) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Frame loop animation callback
function animate() {
    requestAnimationFrame(animate);

    if (!renderer || !scene || !camera) return;

    // OrbitControls damping
    if (controls) controls.update();

    // Slow idle rotation of lock group (if not in main GSAP timeline)
    if (lockGroup && (!lockGroup.userData || !lockGroup.userData.isAnimating)) {
        lockGroup.rotation.y = Math.sin(Date.now() * 0.0005) * 0.06;
        lockGroup.rotation.x = Math.cos(Date.now() * 0.0005) * 0.03;
    }

    // Render step
    renderer.render(scene, camera);
}

// Configure and run the infinite GSAP loop timeline
function startLockLoop() {
    if (loopTimeline) return;

    lockGroup.userData.isAnimating = true;

    loopTimeline = gsap.timeline({
        repeat: -1, 
        yoyo: false
    });

    // 1. INITIAL STATE & FOCUS PREP
    loopTimeline.set(camera.position, { x: 3.8, y: 1.8, z: 7.3 });
    loopTimeline.set(keyGroup.position, { x: 0, y: -0.04, z: 4.5 });
    loopTimeline.set(keyGroup.rotation, { x: 0, y: 0, z: 0 });
    loopTimeline.set(centralCore.rotation, { x: 0, y: 0, z: 0 });
    loopTimeline.set(shackleMesh.position, { x: -1.3, y: 0, z: 0 });
    loopTimeline.set(shackleMesh.rotation, { x: 0, y: 0, z: 0 });
    loopTimeline.set(lockingLatch.position, { x: 0.95, y: 0.75, z: 0 }); 
    loopTimeline.set(gearB.rotation, { x: 0, y: 0, z: 0 });
    loopTimeline.set(keyholeLight, { intensity: 3.5, distance: 5 });

    keyPins.forEach((kp, idx) => {
        loopTimeline.set(kp.position, { y: kp.userData.initialY });
    });
    driverPins.forEach((dp, idx) => {
        loopTimeline.set(dp.position, { y: dp.userData.initialY });
    });
    pinSprings.forEach((spring) => {
        loopTimeline.set(spring.group.position, { y: spring.group.position.y });
        loopTimeline.set(spring.mesh.scale, { y: 1.0 });
    });

    // 2. UNLOCK PHASE
    loopTimeline.to(keyGroup.position, {
        x: 0,
        y: -0.04,
        z: 1.1,
        duration: 1.5,
        ease: 'power2.out'
    });

    loopTimeline.to(keyGroup.position, {
        z: 0.65,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: () => {
            triggerShockwave();
        }
    });

    keyPins.forEach((kp, idx) => {
        const delta = kp.userData.targetDelta;
        
        loopTimeline.to(kp.position, {
            y: kp.userData.initialY + delta,
            duration: 1.2,
            ease: 'power2.inOut'
        }, '<');

        const dp = driverPins[idx];
        const initialDpY = dp.userData.initialY;
        loopTimeline.to(dp.position, {
            y: initialDpY + delta,
            duration: 1.2,
            ease: 'power2.inOut'
        }, '<');

        const spring = pinSprings[idx];
        loopTimeline.to(spring.group.position, {
            y: spring.group.position.y + delta,
            duration: 1.2,
            ease: 'power2.inOut'
        }, '<');

        const scaleFactor = (0.4 - delta) / 0.4;
        loopTimeline.to(spring.mesh.scale, {
            y: scaleFactor,
            duration: 1.2,
            ease: 'power2.inOut'
        }, '<');
    });

    loopTimeline.to({}, { duration: 0.4 });

    loopTimeline.to([keyGroup.rotation, centralCore.rotation], {
        z: Math.PI / 2, 
        duration: 1.2,
        ease: 'power2.inOut'
    });

    loopTimeline.to(gearB.rotation, {
        z: -Math.PI / 2,
        duration: 1.2,
        ease: 'power2.inOut'
    }, '<');

    loopTimeline.to(lockingLatch.position, {
        x: 0.40,
        duration: 1.2,
        ease: 'power2.inOut'
    }, '<');

    loopTimeline.to(shackleMesh.position, {
        y: 0.8,
        duration: 0.7,
        ease: 'power2.out'
    }, '+=0.1');

    loopTimeline.to(shackleMesh.rotation, {
        y: Math.PI / 3.5,
        duration: 0.9,
        ease: 'power2.inOut'
    });

    loopTimeline.to(keyholeLight, {
        intensity: 5.5,
        distance: 7,
        duration: 0.5
    }, '-=0.5');

    // 3. HOLD OPEN VIEW
    loopTimeline.to({}, { duration: 3.5 }); 

    // 4. LOCKING/RESET PHASE
    loopTimeline.to(shackleMesh.rotation, {
        y: 0,
        duration: 0.8,
        ease: 'power2.inOut'
    });

    loopTimeline.to(shackleMesh.position, {
        y: 0,
        duration: 0.7,
        ease: 'power2.inOut'
    });

    loopTimeline.to(keyholeLight, {
        intensity: 3.5,
        distance: 5,
        duration: 0.7
    }, '<');

    loopTimeline.to([keyGroup.rotation, centralCore.rotation], {
        z: 0,
        duration: 1.2,
        ease: 'power2.inOut'
    }, '+=0.2');

    loopTimeline.to(gearB.rotation, {
        z: 0,
        duration: 1.2,
        ease: 'power2.inOut'
    }, '<');

    loopTimeline.to(lockingLatch.position, {
        x: 0.95, 
        duration: 1.2,
        ease: 'power2.inOut'
    }, '<');

    loopTimeline.to(keyGroup.position, {
        z: 1.1,
        duration: 1.0,
        ease: 'power2.inOut'
    });

    keyPins.forEach((kp, idx) => {
        loopTimeline.to(kp.position, {
            y: kp.userData.initialY,
            duration: 1.0,
            ease: 'power2.inOut'
        }, '<');

        const dp = driverPins[idx];
        loopTimeline.to(dp.position, {
            y: dp.userData.initialY,
            duration: 1.0,
            ease: 'power2.inOut'
        }, '<');

        const spring = pinSprings[idx];
        loopTimeline.to(spring.group.position, {
            y: spring.initialY,
            duration: 1.0,
            ease: 'power2.inOut'
        }, '<');

        loopTimeline.to(spring.mesh.scale, {
            y: 1.0,
            duration: 1.0,
            ease: 'power2.inOut'
        }, '<');
    });

    loopTimeline.to(keyGroup.position, {
        x: 0,
        y: -0.04,
        z: 4.5,
        duration: 1.4,
        ease: 'power2.out'
    });

    // 5. HOLD LOCKED VIEW
    loopTimeline.to({}, { duration: 2.5 }); 
}

// Emits an expanding fading ripple ring from the keyhole
function triggerShockwave() {
    const shockwaveColor = THEMES[currentTheme].primary;
    
    const geom = new THREE.RingGeometry(0.1, 0.15, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: shockwaveColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, -0.04, 0.54);
    scene.add(mesh);

    gsap.to(mesh.scale, {
        x: 25,
        y: 25,
        z: 1,
        duration: 1.2,
        ease: 'power2.out'
    });

    gsap.to(mesh.material, {
        opacity: 0,
        duration: 1.2,
        ease: 'power2.out',
        onComplete: () => {
            scene.remove(mesh);
            geom.dispose();
            mat.dispose();
        }
    });
}


let currentReviewsCount = 3;
const reviewsIncrement = 6;

function renderReviews() {
    const container = document.getElementById('reviews-container');
    if (!container) return;

    container.innerHTML = '';
    const reviewsToShow = reviewsData.slice(0, currentReviewsCount);

    reviewsToShow.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-card';

        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < review.rating ? '★' : '☆';
        }

        card.innerHTML = `
            <div class="review-header">
                <div class="review-user">
                    <div class="user-avatar">👤</div>
                    <div class="user-meta">
                        <span class="user-name">${review.name}</span>
                        <span class="user-district">${review.district}</span>
                    </div>
                </div>
                <div class="rating-stars">${stars}</div>
            </div>
            <p class="review-text">${review.text}</p>
        `;
        container.appendChild(card);
    });

    const loadMoreBtn = document.getElementById('load-more-reviews');
    if (loadMoreBtn) {
        if (currentReviewsCount >= reviewsData.length) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
        }
    }
}

function initReviews() {
    renderReviews();

    const loadMoreBtn = document.getElementById('load-more-reviews');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentReviewsCount += reviewsIncrement;
            renderReviews();
        });
    }

    const writeReviewBtn = document.getElementById('write-review-btn');
    const reviewModal = document.getElementById('review-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    if (writeReviewBtn && reviewModal) {
        writeReviewBtn.addEventListener('click', () => {
            reviewModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });
    }

    if (modalCloseBtn && reviewModal) {
        modalCloseBtn.addEventListener('click', () => {
            reviewModal.classList.add('hidden');
            document.body.style.overflow = '';
            // Reset form
            document.getElementById('add-review-form').classList.remove('hidden');
            document.getElementById('modal-success-msg').classList.add('hidden');
        });
    }

    // Modal Star Rating
    const starItems = document.querySelectorAll('.star-item');
    const ratingInput = document.getElementById('review-rating');

    starItems.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-value'));
            ratingInput.value = val;

            starItems.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-value'));
                if (sVal <= val) {
                    s.classList.add('gold');
                } else {
                    s.classList.remove('gold');
                }
            });
        });
    });

    // Form submit
    const addReviewForm = document.getElementById('add-review-form');
    const modalSuccessMsg = document.getElementById('modal-success-msg');

    if (addReviewForm) {
        addReviewForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameVal = document.getElementById('review-name').value;
            const districtVal = document.getElementById('review-district').value;
            const ratingVal = parseInt(ratingInput.value);
            const textVal = document.getElementById('review-text').value;

            // Prepend new review
            reviewsData.unshift({
                name: nameVal,
                district: districtVal,
                rating: ratingVal,
                text: textVal,
                date: "Только что"
            });

            addReviewForm.classList.add('hidden');
            modalSuccessMsg.classList.remove('hidden');

            // Re-render
            currentReviewsCount = Math.max(currentReviewsCount, 3);
            renderReviews();

            // Reset
            addReviewForm.reset();
            starItems.forEach(s => s.classList.add('gold'));
            ratingInput.value = 5;
        });
    }
}

function initFloatingBar() {
    const floatingCallBar = document.getElementById('floating-call-bar');
    const problemsSection = document.querySelector('.problems-section');
    
    function checkScroll() {
        if (!floatingCallBar) return;
        
        let triggerPoint = 0;
        if (problemsSection) {
            // Показываем кнопку, когда доскроллили до заголовка "ЕСЛИ У ВАС"
            triggerPoint = problemsSection.offsetTop - 80;
        } else {
            const heroSection = document.querySelector('.hero-section');
            if (heroSection) {
                triggerPoint = heroSection.offsetHeight - 100;
            }
        }
        
        let shouldShow = window.scrollY > triggerPoint;
        
        // Скрываем плавающую кнопку, если она перекрывает телефон в футере
        const footerPhone = document.querySelector('.footer-phone-block .phone-number');
        if (footerPhone) {
            const phoneRect = footerPhone.getBoundingClientRect();
            // Если верхняя граница номера телефона в футере поднялась в область видимости
            if (phoneRect.top < window.innerHeight - 10) {
                shouldShow = false;
            }
        }
        
        if (shouldShow) {
            floatingCallBar.classList.add('visible');
        } else {
            floatingCallBar.classList.remove('visible');
        }
    }
    
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Проверяем сразу при загрузке
}

function initServicesAccordion() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = item.querySelector('.accordion-content');
            const isOpen = item.classList.contains('active');
            
            if (isOpen) {
                item.classList.remove('active');
                content.style.maxHeight = null;
                header.setAttribute('aria-expanded', 'false');
            } else {
                // Close other accordion items
                document.querySelectorAll('.accordion-item').forEach(otherItem => {
                    otherItem.classList.remove('active');
                    const otherContent = otherItem.querySelector('.accordion-content');
                    if (otherContent) otherContent.style.maxHeight = null;
                    const otherHeader = otherItem.querySelector('.accordion-header');
                    if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
                });

                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + "px";
                header.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

function initMapInteractivity() {
    const districts = document.querySelectorAll('.map-district');
    const statusText = document.getElementById('map-hover-status');
    
    if (!statusText) return;
    
    const districtNames = {
        'district-mitino': 'Митино — приеду за 15 минут',
        'district-kurkino': 'Куркино — приеду за 15 минут',
        'district-stushino': 'Северное Тушино — приеду за 15 минут',
        'district-ytushino': 'Южное Тушино — приеду за 15 минут',
        'district-pokrovskoe': 'Покровское-Стрешнево — приеду за 15 минут',
        'district-strogino': 'Строгино — приеду за 15 минут',
        'district-schukino': 'Щукино — приеду за 15 минут',
        'district-horoshevo': 'Хорошёво-Мнёвники — приеду за 20 минут',
        'district-khimki': 'Химки — приеду за 20 минут',
        'district-putilkovo': 'Путилково — приеду за 20 минут',
        'district-yurlovo': 'Юрлово — приеду за 25 минут',
        'district-saburovo': 'Сабурово — приеду за 25 минут',
        'district-aristovo': 'Аристово — приеду за 25 минут',
        'district-angelovo': 'Ангелово — приеду за 20 минут',
        'district-krasnogorsk': 'Красногорск — приеду за 20 минут',
        'district-opaliha': 'Опалиха — приеду за 25 минут'
    };
    
    districts.forEach(d => {
        const id = d.id;
        const name = districtNames[id] || 'Близлежащий район';
        const isAdjacent = d.classList.contains('adjacent-district');
        d.addEventListener('mouseenter', () => {
            statusText.textContent = name;
            statusText.style.fill = isAdjacent ? '#ffd200' : '#00f0ff';
        });
        d.addEventListener('mouseleave', () => {
            statusText.textContent = 'Районы обслуживания (СЗАО и МО)';
            statusText.style.fill = '';
        });
        // Click-to-call interactivity removed from map contours as requested
    });
}


// Premium Gallery Slider & Lightbox
function initGallerySlider() {
    const slider = document.getElementById('gallery-slider');
    const dotsContainer = document.getElementById('gallery-dots');
    const prevBtn = document.getElementById('gallery-prev');
    const nextBtn = document.getElementById('gallery-next');
    const cards = slider.querySelectorAll('.gallery-slide-card');
    
    if (!slider || cards.length === 0) return;
    
    const totalCards = cards.length;
    
    // Create pagination dots
    for (let i = 0; i < totalCards; i++) {
        const dot = document.createElement('div');
        dot.classList.add('gallery-dot');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
            const cardWidth = cards[0].offsetWidth;
            const gap = parseFloat(window.getComputedStyle(slider).gap) || 16;
            slider.scrollTo({
                left: i * (cardWidth + gap),
                behavior: 'smooth'
            });
        });
        dotsContainer.appendChild(dot);
    }
    
    const dots = dotsContainer.querySelectorAll('.gallery-dot');
    
    // Update dots on scroll
    let isScrolling;
    slider.addEventListener('scroll', () => {
        window.clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
            const cardWidth = cards[0].offsetWidth;
            const gap = parseFloat(window.getComputedStyle(slider).gap) || 16;
            const index = Math.round(slider.scrollLeft / (cardWidth + gap));
            
            dots.forEach(d => d.classList.remove('active'));
            if (dots[index]) {
                dots[index].classList.add('active');
            }
        }, 100);
    });
    
    // Navigation arrows
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            const cardWidth = cards[0].offsetWidth;
            const gap = parseFloat(window.getComputedStyle(slider).gap) || 16;
            slider.scrollBy({ left: -(cardWidth + gap), behavior: 'smooth' });
        });
        
        nextBtn.addEventListener('click', () => {
            const cardWidth = cards[0].offsetWidth;
            const gap = parseFloat(window.getComputedStyle(slider).gap) || 16;
            slider.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
        });
    }
    
    // Lightbox modal functionality
    const modal = document.getElementById('lightbox-modal');
    const modalImg = document.getElementById('lightbox-img');
    const modalCaption = document.getElementById('lightbox-caption');
    const closeBtn = document.getElementById('lightbox-close');
    
    if (modal && modalImg && modalCaption) {
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const img = card.querySelector('img');
                const caption = card.querySelector('.gallery-caption p');
                
                if (img) {
                    modalImg.src = img.src;
                    modalImg.alt = img.alt;
                    modalCaption.textContent = caption ? caption.textContent : '';
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden'; // prevent page scroll
                }
            });
        });
        
        const closeModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            // Clear source after fade out to prevent flashing
            setTimeout(() => {
                modalImg.src = '';
            }, 300);
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('lightbox-content')) {
                closeModal();
            }
        });
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });
    }
}



// Premium Scroll-Driven 3D Lock Unlocking & Split Reveal Transition
function initScrollTransitions() {
    const heroSection = document.querySelector('.hero-section');
    const textContent = document.querySelector('.hero-text-content');
    const badges = document.querySelector('.hero-badges');
    const actions = document.querySelector('.hero-actions');
    const canvasWrapper = document.querySelector('.hero-canvas-wrapper');
    const scrollIndicator = document.getElementById('scroll-indicator');

    if (!heroSection) return;

    // Scroll Indicator Click Handler
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const nextSection = heroSection.nextElementSibling;
            if (nextSection) {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Scroll driven interactive lock opening & layout disassembly
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        // Max scroll depth for transition (approx 1st viewport)
        const maxScroll = 350;
        const progress = Math.min(scrollY / maxScroll, 1);

        if (progress > 0) {
            // 1. DISASSEMBLE LAYOUT (Layout splits apart metaphorically like lock plates opening)
            if (textContent) {
                textContent.style.transform = `translateX(${-140 * progress}px)`;
                textContent.style.opacity = 1 - progress * 1.5;
            }
            if (badges) {
                badges.style.transform = `translateX(${-90 * progress}px)`;
                badges.style.opacity = 1 - progress * 1.5;
            }
            if (actions) {
                actions.style.transform = `translateX(${140 * progress}px)`;
                actions.style.opacity = 1 - progress * 1.5;
            }
            if (canvasWrapper) {
                canvasWrapper.style.transform = `translateY(${-70 * progress}px) scale(${1 - 0.12 * progress})`;
                canvasWrapper.style.opacity = 1 - progress * 1.3;
            }
            if (scrollIndicator) {
                scrollIndicator.style.opacity = 1 - progress * 3;
            }

            // 2. 3D LOCK UNLOCKING
            // Pause loop animation while scrolling
            if (loopTimeline) {
                loopTimeline.pause();
            }

            // Insert key: progress from 0.0 to 0.4
            const insertProgress = Math.min(progress / 0.4, 1);
            if (keyGroup) {
                keyGroup.position.z = 4.5 - 3.85 * insertProgress; // 4.5 is locked, 0.65 is inserted
            }

            // Align pins during insertion
            keyPins.forEach((kp, idx) => {
                const delta = kp.userData.targetDelta;
                kp.position.y = kp.userData.initialY + delta * insertProgress;
            });
            driverPins.forEach((dp, idx) => {
                const delta = dp.userData.targetDelta;
                dp.position.y = dp.userData.initialY + delta * insertProgress;
            });
            pinSprings.forEach((spring, idx) => {
                const delta = keyPins[idx].userData.targetDelta;
                const scaleFactor = (0.4 - delta * insertProgress) / 0.4;
                spring.mesh.scale.y = scaleFactor;
            });

            // Rotate key and core: progress from 0.4 to 0.7
            const rotateProgress = Math.max(0, Math.min((progress - 0.4) / 0.3, 1));
            const angleZ = rotateProgress * (Math.PI / 2);
            if (keyGroup) keyGroup.rotation.z = angleZ;
            if (centralCore) centralCore.rotation.z = angleZ;
            if (gearB) gearB.rotation.z = -angleZ;
            if (lockingLatch) lockingLatch.position.x = 0.95 - 0.55 * rotateProgress;

            // Pop shackle: progress from 0.7 to 1.0
            const shackleProgress = Math.max(0, Math.min((progress - 0.7) / 0.3, 1));
            if (shackleMesh) {
                shackleMesh.position.y = 0.8 * shackleProgress;
                shackleMesh.rotation.y = (Math.PI / 3.5) * shackleProgress;
            }
            if (keyholeLight) {
                keyholeLight.intensity = 3.5 + 2.0 * shackleProgress;
                keyholeLight.distance = 5 + 2 * shackleProgress;
            }
        } else {
            // 3. RESET TO ANIMATING LOOP (when user is at the top of the page)
            if (textContent) { textContent.style.transform = ''; textContent.style.opacity = ''; }
            if (badges) { badges.style.transform = ''; badges.style.opacity = ''; }
            if (actions) { actions.style.transform = ''; actions.style.opacity = ''; }
            if (canvasWrapper) { canvasWrapper.style.transform = ''; canvasWrapper.style.opacity = ''; }
            if (scrollIndicator) { scrollIndicator.style.opacity = ''; }
            
            // Resume infinite GSAP loop
            if (loopTimeline && loopTimeline.paused()) {
                loopTimeline.play();
            }
        }
    });
}


function initDisclaimerModal() {
    const link = document.getElementById('disclaimer-link');
    const modal = document.getElementById('disclaimer-modal');
    const closeBtn = document.getElementById('disclaimer-close-btn');

    if (link && modal && closeBtn) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });

        const closeModal = () => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        };

        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// Window OnLoad Initializer
window.addEventListener('load', () => {
    initThree();
    startLockLoop();
    initReviews();
    initFloatingBar();
    initServicesAccordion();
    initMapInteractivity();
    initGallerySlider();
    initScrollTransitions();
    initDisclaimerModal();
    animate();
});
