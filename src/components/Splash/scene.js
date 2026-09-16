import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const DOOR_ANGLE = THREE.MathUtils.degToRad(112)
const DIST_MIN = 4.2
const DIST_MAX = 26
const W = 4.3
const D = 3.7
const H = 2.55
const T = 0.05
const F = 0.11
const PITCH = 1.05
const BASE = 0.22
const BOOK_COLORS = [0xc0504d, 0x4f81bd, 0xe8a33d, 0x6aa84f, 0x8e6bb5, 0x3c4a5c, 0xe07b39, 0x2f9e8f, 0xb0563f, 0x7a5230]

const CineShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVig: { value: 0.9 },
    uChroma: { value: 0.0022 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float uVig,uChroma,uGrain,uTime; varying vec2 vUv;',
    'float rnd(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }',
    'void main(){',
    'vec2 uv=vUv; vec2 d=uv-0.5; float r2=dot(d,d); float amt=uChroma*r2*3.2;',
    'vec3 col; col.r=texture2D(tDiffuse,uv+d*amt).r; col.g=texture2D(tDiffuse,uv).g; col.b=texture2D(tDiffuse,uv-d*amt).b;',
    'col*=1.0-uVig*smoothstep(0.22,0.92,r2*1.55);',
    'col+=(rnd(uv*vec2(1100.0)+fract(uTime)*91.0)-0.5)*uGrain;',
    'gl_FragColor=vec4(col,1.0);',
    '}',
  ].join('\n'),
}

export function createSplashScene({ canvas, rendererRef, sceneRef, cameraRef, rafRef, onReady, onEntering, onDoorOpened, onFinish }) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  const timers = new Set()
  const listeners = []
  const hitTargets = []
  const doorHinges = []
  const clouds = []
  const floaters = []
  const previousBody = { cursor: document.body.style.cursor, overflow: document.body.style.overflow }
  const root = canvas.closest('.splash-root')
  const ring = root.querySelector('.splash-ring')
  const flash = root.querySelector('.splash-flash')
  let disposed = false
  let hq = true
  let entered = false
  let hovering = false
  let dragging = false
  let dragMoved = 0
  let lastPX = 0
  let lastPY = 0
  let downT = 0
  let autoSpin = 0.045
  let intro = 0
  let doorPhase = 0
  let doorT = 0
  let doorDone = false
  let doorOpenedReported = false
  let doorStartedAt = 0
  let camAzim0 = 0
  let camPolar0 = 0
  let camDist0 = 0
  let readyReported = false
  let renderPausedForReveal = false

  const later = (callback, delay) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      if (!disposed) callback()
    }, delay)
    timers.add(id)
    return id
  }
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options)
    listeners.push(() => target.removeEventListener(name, handler, options))
  }
  const geometry = (Ctor, ...args) => {
    const value = new Ctor(...args)
    geometries.add(value)
    return value
  }
  const material = (Ctor, options) => {
    const value = new Ctor(options)
    materials.add(value)
    return value
  }
  const trackTexture = value => {
    textures.add(value)
    return value
  }
  const mesh = (parent, geo, mat, cast = false, receive = false) => {
    const value = new THREE.Mesh(geo, mat)
    value.userData.splashCastShadow = cast
    value.userData.splashReceiveShadow = receive
    value.castShadow = hq && cast
    value.receiveShadow = hq && receive
    parent.add(value)
    return value
  }
  const points = (parent, geo, mat) => {
    const value = new THREE.Points(geo, mat)
    parent.add(value)
    return value
  }
  const hit = value => {
    hitTargets.push(value)
    return value
  }
  const canvasTexture = (width, height, draw, repeat = [1, 1]) => {
    const source = document.createElement('canvas')
    source.width = width
    source.height = height
    draw(source.getContext('2d'), width, height)
    const value = trackTexture(new THREE.CanvasTexture(source))
    value.wrapS = value.wrapT = THREE.RepeatWrapping
    value.repeat.set(repeat[0], repeat[1])
    value.anisotropy = hq ? 8 : 1
    value.colorSpace = THREE.SRGBColorSpace
    return value
  }
  const noise = (context, width, height, amount) => {
    const image = context.getImageData(0, 0, width, height)
    for (let i = 0; i < image.data.length; i += 4) {
      const value = (Math.random() - 0.5) * amount
      image.data[i] += value
      image.data[i + 1] += value
      image.data[i + 2] += value
    }
    context.putImageData(image, 0, 0)
  }
  const woodTexture = (base, dark, planks = 7) => canvasTexture(512, 512, (context, width, height) => {
    context.fillStyle = base
    context.fillRect(0, 0, width, height)
    const plankHeight = height / planks
    for (let plank = 0; plank < planks; plank += 1) {
      const y0 = plank * plankHeight
      context.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')'
      context.fillRect(0, y0, width, plankHeight)
      for (let line = 0; line < 26; line += 1) {
        context.strokeStyle = 'rgba(0,0,0,' + (0.03 + Math.random() * 0.07) + ')'
        context.lineWidth = 0.6 + Math.random() * 1.6
        context.beginPath()
        const y = y0 + Math.random() * plankHeight
        context.moveTo(0, y)
        for (let x = 0; x <= width; x += 16) context.lineTo(x, y + Math.sin(x * 0.02 + line) * 2.2 + (Math.random() - 0.5) * 1.4)
        context.stroke()
      }
      context.fillStyle = dark
      context.fillRect(0, y0 + plankHeight - 2, width, 2)
    }
    noise(context, width, height, 12)
  })
  const mossTexture = () => canvasTexture(512, 512, (context, width, height) => {
    context.fillStyle = '#4a6b3c'
    context.fillRect(0, 0, width, height)
    for (let i = 0; i < 2600; i += 1) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = 1 + Math.random() * 3.2
      context.fillStyle = 'hsla(' + (80 + Math.random() * 40) + ',' + (28 + Math.random() * 26) + '%,' + (18 + Math.random() * 26) + '%,' + (0.3 + Math.random() * 0.5) + ')'
      context.fillRect(x, y, size, size * 1.5)
    }
    noise(context, width, height, 26)
  })
  const rockTexture = () => canvasTexture(512, 512, (context, width, height) => {
    context.fillStyle = '#463f39'
    context.fillRect(0, 0, width, height)
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * width
      const y = Math.random() * height
      const radius = 3 + Math.random() * 26
      context.fillStyle = 'rgba(' + (30 + Math.random() * 50) + ',' + (26 + Math.random() * 44) + ',' + (22 + Math.random() * 40) + ',' + (0.16 + Math.random() * 0.3) + ')'
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
    noise(context, width, height, 34)
  })
  const bookTexture = color => canvasTexture(64, 256, (context, width, height) => {
    context.fillStyle = '#' + color.toString(16).padStart(6, '0')
    context.fillRect(0, 0, width, height)
    context.fillStyle = 'rgba(0,0,0,.22)'
    context.fillRect(0, 0, 7, height)
    context.fillStyle = 'rgba(255,255,255,.10)'
    context.fillRect(width - 6, 0, 6, height)
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = 'rgba(240,215,150,.55)'
      context.fillRect(12, 40 + i * 58, width - 24, 2.5)
    }
    noise(context, width, height, 16)
  })
  const radialTexture = stops => canvasTexture(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126)
    stops.forEach(([position, color]) => gradient.addColorStop(position, color))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  })

  document.body.style.cursor = 'grab'
  document.body.style.overflow = 'hidden'

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  rendererRef.current = renderer
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  sceneRef.current = scene
  scene.fog = new THREE.FogExp2(0x0a1024, 0.017)
  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 300)
  cameraRef.current = camera

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envScene = new THREE.Scene()
  const roomEnvironment = new RoomEnvironment(renderer)
  roomEnvironment.traverse(object => {
    if (object.material?.color) {
      const originalMaterial = object.material
      object.material = originalMaterial.clone()
      originalMaterial.dispose()
      object.material.color.multiplyScalar(0.55)
      object.material.color.offsetHSL(0, 0.05, -0.06)
    }
  })
  envScene.add(roomEnvironment)
  const warmMaterial = material(THREE.MeshBasicMaterial, { color: 0xffa860 })
  ;[[0, 2.2, -2.6], [0, 2.2, 2.6]].forEach(([x, y, z]) => {
    const panel = mesh(envScene, geometry(THREE.PlaneGeometry, 3.2, 2.2), warmMaterial)
    panel.position.set(x, y, z)
    if (z < 0) panel.rotation.y = Math.PI
  })
  const envRT = pmrem.fromScene(envScene, 0.03)
  scene.environment = envRT.texture

  const skyCanvas = document.createElement('canvas')
  skyCanvas.width = 2
  skyCanvas.height = 512
  const skyContext = skyCanvas.getContext('2d')
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 512)
  ;[[0, '#02030a'], [0.3, '#080e22'], [0.55, '#111c33'], [0.78, '#25223a'], [1, '#4b3345']].forEach(([stop, color]) => skyGradient.addColorStop(stop, color))
  skyContext.fillStyle = skyGradient
  skyContext.fillRect(0, 0, 2, 512)
  const skyTexture = trackTexture(new THREE.CanvasTexture(skyCanvas))
  skyTexture.colorSpace = THREE.SRGBColorSpace
  mesh(scene, geometry(THREE.SphereGeometry, 140, 32, 24), material(THREE.MeshBasicMaterial, { map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false }))

  scene.add(new THREE.HemisphereLight(0x8fb2e8, 0x241a12, 0.45))
  const moon = new THREE.DirectionalLight(0xc4d8ff, 0.8)
  moon.position.set(-11, 15, 8)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  moon.shadow.camera.near = 1
  moon.shadow.camera.far = 48
  Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11 })
  moon.shadow.bias = -0.0011
  moon.shadow.normalBias = 0.02
  scene.add(moon)
  const rim = new THREE.DirectionalLight(0x6f9dd8, 0.4)
  rim.position.set(8, 5, -10)
  scene.add(rim)
  const roomLight = new THREE.PointLight(0xffb060, 10, 17, 2)
  roomLight.position.set(0, 1.8, 0.1)
  roomLight.castShadow = true
  roomLight.shadow.mapSize.set(1024, 1024)
  roomLight.shadow.bias = -0.004
  roomLight.shadow.camera.near = 0.3
  scene.add(roomLight)
  const deskLight = new THREE.PointLight(0xffd090, 3.4, 6.5, 2)
  deskLight.position.set(-1.02, 1.16, 0.52)
  scene.add(deskLight)
  const porchLight = new THREE.PointLight(0xffc070, 1.5, 5.5, 2)
  porchLight.position.set(0, 1.9, 2.15)
  scene.add(porchLight)

  const woodFloorTexture = woodTexture('#8a5a32', '#3a2415', 8)
  woodFloorTexture.repeat.set(3, 3)
  const woodFrameTexture = woodTexture('#7c5330', '#33200f', 3)
  const mossMap = mossTexture()
  mossMap.repeat.set(4, 4)
  const rockMap = rockTexture()
  rockMap.repeat.set(2, 2)
  const glassHigh = material(THREE.MeshPhysicalMaterial, {
    color: 0xe6f4ff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.34, ior: 1.47,
    transparent: true, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6,
    specularIntensity: 1, attenuationColor: new THREE.Color(0xbfe4ff), attenuationDistance: 2.6, side: THREE.DoubleSide,
  })
  const glassLow = material(THREE.MeshPhysicalMaterial, {
    color: 0xd6f0ff, roughness: 0.07, metalness: 0, transmission: 0, transparent: true, opacity: 0.22,
    clearcoat: 1, envMapIntensity: 1.7, side: THREE.DoubleSide,
  })
  const M = {
    wood: material(THREE.MeshStandardMaterial, { map: woodFrameTexture, color: 0xffffff, roughness: 0.66, metalness: 0.03 }),
    woodD: material(THREE.MeshStandardMaterial, { color: 0x4e3320, roughness: 0.72, metalness: 0.03 }),
    floor: material(THREE.MeshStandardMaterial, { map: woodFloorTexture, roughness: 0.58, metalness: 0.02 }),
    glass: glassHigh,
    moss: material(THREE.MeshStandardMaterial, { map: mossMap, roughness: 0.95 }),
    rock: material(THREE.MeshStandardMaterial, { map: rockMap, roughness: 0.97, flatShading: true }),
    lamp: material(THREE.MeshStandardMaterial, { color: 0xffe6bd, emissive: 0xffb060, emissiveIntensity: 7, roughness: 0.3 }),
    metal: material(THREE.MeshStandardMaterial, { color: 0x2b2725, roughness: 0.38, metalness: 0.88 }),
  }

  const island = new THREE.Group()
  scene.add(island)
  const islandTop = mesh(island, geometry(THREE.CylinderGeometry, 3.4, 3.2, 0.44, 64, 1), M.moss, false, true)
  islandTop.position.y = -0.22
  const islandRock = mesh(island, geometry(THREE.ConeGeometry, 3.15, 4.8, 10, 4), M.rock)
  islandRock.position.y = -2.7
  islandRock.rotation.y = 0.4
  for (let i = 0; i < 5; i += 1) {
    const value = mesh(island, geometry(THREE.DodecahedronGeometry, 0.3 + Math.random() * 0.5, 0), M.rock)
    const angle = Math.random() * Math.PI * 2
    value.position.set(Math.cos(angle) * 2.6, -1.4 - Math.random() * 1.6, Math.sin(angle) * 2.6)
    value.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
  }
  for (let i = 0; i < 8; i += 1) {
    const value = mesh(island, geometry(THREE.DodecahedronGeometry, 0.14 + Math.random() * 0.36, 0), M.rock)
    const angle = Math.random() * Math.PI * 2
    const radius = 1.3 + Math.random() * 2.5
    value.position.set(Math.cos(angle) * radius, -4.4 - Math.random() * 2.6, Math.sin(angle) * radius)
    value.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    value.userData.spin = (Math.random() - 0.5) * 0.28
    value.userData.bob = Math.random() * Math.PI * 2
    value.userData.y0 = value.position.y
    floaters.push(value)
  }
  for (let i = 0; i < 70; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = 1.6 + Math.random() * 1.55
    const grass = mesh(island, geometry(THREE.ConeGeometry, 0.035, 0.16 + Math.random() * 0.16, 4), material(THREE.MeshStandardMaterial, { color: 0x48703a, roughness: 0.9 }))
    grass.position.set(Math.cos(angle) * radius, 0.06, Math.sin(angle) * radius)
    grass.rotation.z = (Math.random() - 0.5) * 0.3
  }
  const ao = mesh(island, geometry(THREE.CircleGeometry, 4.6, 48), material(THREE.MeshBasicMaterial, {
    map: radialTexture([[0, 'rgba(0,0,0,.55)'], [.55, 'rgba(0,0,0,.22)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, opacity: 0.9,
  }))
  ao.rotation.x = -Math.PI / 2
  ao.position.y = 0.005
  const spill = mesh(island, geometry(THREE.CircleGeometry, 5.2, 48), material(THREE.MeshBasicMaterial, {
    map: radialTexture([[0, 'rgba(255,176,96,.42)'], [.4, 'rgba(255,150,70,.16)'], [1, 'rgba(255,140,60,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  spill.rotation.x = -Math.PI / 2
  spill.position.y = 0.012

  const study = new THREE.Group()
  scene.add(study)
  const box = (width, height, depth, mat, x, y, z, parent = study, shadow = true) => {
    const value = hit(mesh(parent, geometry(THREE.BoxGeometry, width, height, depth), mat, shadow, shadow))
    value.position.set(x, y, z)
    return value
  }
  const glassH = H - 0.3
  const glassCenterY = BASE + glassH / 2
  const glassPane = (width, height, x, z, rotationY, parent = study) => {
    const value = hit(mesh(parent, geometry(THREE.BoxGeometry, width, height, T), M.glass))
    value.userData.splashGlass = true
    value.position.set(x, glassCenterY, z)
    value.rotation.y = rotationY
    return value
  }
  const mullion = (x, z, rotationY, height = glassH) => {
    const value = hit(mesh(study, geometry(THREE.BoxGeometry, 0.065, height, 0.075), M.wood, true))
    value.position.set(x, glassCenterY, z)
    value.rotation.y = rotationY
    return value
  }

  box(W + 0.5, 0.18, D + 0.5, M.woodD, 0, 0.09, 0)
  box(W, 0.07, D, M.floor, 0, BASE, 0)
  ;[-1, 1].forEach(side => {
    for (let i = 0; i < 3; i += 1) glassPane(D / 3 - 0.05, glassH, side * W / 2, -D / 2 + (i + 0.5) * D / 3, Math.PI / 2)
    for (let i = 1; i < 3; i += 1) mullion(side * W / 2, -D / 2 + i * D / 3, Math.PI / 2)
  })
  for (let i = 0; i < 3; i += 1) glassPane(W / 3 - 0.05, glassH, -W / 2 + (i + 0.5) * W / 3, -D / 2, 0)
  for (let i = 1; i < 3; i += 1) mullion(-W / 2 + i * W / 3, -D / 2, 0)

  const doorWidth = W / 2 - 0.09
  ;[-1, 1].forEach(side => {
    const hinge = new THREE.Group()
    hinge.position.set(side * (W / 2 - 0.09), 0, D / 2)
    study.add(hinge)
    doorHinges.push(hinge)
    const centerX = -side * doorWidth / 2
    const doorHeight = glassH - 0.06
    const pane = hit(mesh(hinge, geometry(THREE.BoxGeometry, doorWidth, doorHeight, T), M.glass))
    pane.userData.splashGlass = true
    pane.position.set(centerX, glassCenterY, 0)
    box(0.06, doorHeight, 0.06, M.wood, centerX - doorWidth / 2, glassCenterY, 0, hinge)
    box(0.06, doorHeight, 0.06, M.wood, centerX + doorWidth / 2, glassCenterY, 0, hinge)
    box(doorWidth, 0.06, 0.06, M.wood, centerX, glassCenterY + doorHeight / 2, 0, hinge)
    box(doorWidth, 0.09, 0.06, M.wood, centerX, glassCenterY - doorHeight / 2, 0, hinge)
    box(0.04, doorHeight - 0.2, 0.045, M.wood, centerX, glassCenterY + 0.05, 0, hinge)
    const handle = mesh(hinge, geometry(THREE.SphereGeometry, 0.052, 14, 12), M.metal, true)
    handle.position.set(-side * (doorWidth - 0.14), glassCenterY - 0.05, 0.075)
  })

  ;[[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].forEach(([x, z]) => box(F, H, F, M.wood, x, BASE + H / 2, z))
  const beam = (width, depth, x, z, rotationY, y) => {
    const value = hit(mesh(study, geometry(THREE.BoxGeometry, width, F, depth), M.wood, true, true))
    value.position.set(x, y, z)
    value.rotation.y = rotationY
    return value
  }
  const yLow = BASE + 0.02
  const yTop = BASE + H - 0.12
  beam(W + 0.15, F + 0.04, 0, D / 2, 0, yLow)
  beam(W + 0.15, F + 0.04, 0, -D / 2, 0, yLow)
  beam(D + 0.15, F + 0.04, W / 2, 0, Math.PI / 2, yLow)
  beam(D + 0.15, F + 0.04, -W / 2, 0, Math.PI / 2, yLow)
  beam(W + 0.15, F + 0.04, 0, D / 2, 0, yTop)
  beam(W + 0.15, F + 0.04, 0, -D / 2, 0, yTop)
  beam(D + 0.15, F + 0.04, W / 2, 0, Math.PI / 2, yTop)
  beam(D + 0.15, F + 0.04, -W / 2, 0, Math.PI / 2, yTop)

  // Rebuilt roof: each visible slope owns its glass, rafters and purlins once.
  const eaveY = yTop + F / 2 + 0.02
  const slopeLength = Math.hypot(W / 2, PITCH)
  const slopeAngle = Math.atan2(PITCH, W / 2)
  ;[-1, 1].forEach(side => {
    const roofGlass = hit(mesh(study, geometry(THREE.BoxGeometry, slopeLength - 0.05, T, D + 0.62), M.glass))
    roofGlass.userData.splashGlass = true
    roofGlass.position.set(side * (W / 4 + 0.02), eaveY + PITCH / 2, 0)
    roofGlass.rotation.z = side * -slopeAngle
    for (let i = 0; i <= 7; i += 1) {
      const z = -(D + 0.6) / 2 + i * (D + 0.6) / 7
      const rafter = mesh(study, geometry(THREE.BoxGeometry, slopeLength - 0.02, 0.085, 0.075), M.wood, true)
      rafter.position.set(side * (W / 4 + 0.02), eaveY + PITCH / 2, z)
      rafter.rotation.z = side * -slopeAngle
    }
    ;[0.32, 0.72].forEach(position => {
      const purlin = mesh(study, geometry(THREE.BoxGeometry, 0.075, 0.075, D + 0.6), M.wood, true)
      purlin.position.set(side * (W / 2 * position), eaveY + PITCH * position, 0)
    })
  })
  const ridge = hit(mesh(study, geometry(THREE.BoxGeometry, 0.15, 0.15, D + 0.68), M.wood, true))
  ridge.position.set(0, eaveY + PITCH + 0.05, 0)
  ;[-1, 1].forEach(side => {
    const finial = mesh(study, geometry(THREE.ConeGeometry, 0.09, 0.24, 8), M.woodD)
    finial.position.set(0, eaveY + PITCH + 0.2, side * (D + 0.68) / 2)
  })

  const shelf = new THREE.Group()
  shelf.position.set(W / 2 - 0.4, BASE, 0)
  shelf.rotation.y = -Math.PI / 2
  study.add(shelf)
  const shelfWidth = 2.5
  const shelfHeight = 1.95
  const shelfDepth = 0.34
  box(0.075, shelfHeight, shelfDepth, M.woodD, -shelfWidth / 2, shelfHeight / 2, 0, shelf)
  box(0.075, shelfHeight, shelfDepth, M.woodD, shelfWidth / 2, shelfHeight / 2, 0, shelf)
  box(shelfWidth + 0.15, 0.075, shelfDepth, M.woodD, 0, shelfHeight, 0, shelf)
  box(shelfWidth, 0.05, shelfDepth, M.woodD, 0, 0.02, 0, shelf)
  for (let level = 0; level < 4; level += 1) {
    const y = 0.3 + level * 0.5
    box(shelfWidth, 0.055, shelfDepth, M.woodD, 0, y, 0, shelf)
    let x = -shelfWidth / 2 + 0.13
    while (x < shelfWidth / 2 - 0.22) {
      const bookWidth = 0.05 + Math.random() * 0.08
      const bookHeight = 0.27 + Math.random() * 0.13
      const bookMaterial = material(THREE.MeshStandardMaterial, { map: bookTexture(BOOK_COLORS[(Math.random() * BOOK_COLORS.length) | 0]), roughness: 0.8 })
      const book = mesh(shelf, geometry(THREE.BoxGeometry, bookWidth, bookHeight, shelfDepth * 0.74), bookMaterial, true, true)
      book.position.set(x + bookWidth / 2, y + bookHeight / 2 + 0.03, 0.03)
      book.rotation.z = Math.random() < 0.14 ? 0.2 : 0
      x += bookWidth + 0.01 + Math.random() * 0.018
    }
  }
  const vase = mesh(shelf, geometry(THREE.CylinderGeometry, 0.07, 0.09, 0.2, 12), material(THREE.MeshStandardMaterial, { color: 0x8a6a4a, roughness: 0.7 }), true)
  vase.position.set(0.55, 0.12, 0)
  const ornament = mesh(shelf, geometry(THREE.SphereGeometry, 0.075, 14, 12), material(THREE.MeshStandardMaterial, { color: 0xc8b8a0, roughness: 0.85 }), true)
  ornament.position.set(-0.62, 0.095, 0)

  const desk = new THREE.Group()
  desk.position.set(-0.98, BASE, 0.5)
  study.add(desk)
  box(1.95, 0.08, 0.98, M.wood, 0, 0.78, 0, desk)
  box(1.72, 0.16, 0.5, M.woodD, 0, 0.52, -0.16, desk)
  ;[[-0.87, -0.42], [0.87, -0.42], [-0.87, 0.42], [0.87, 0.42]].forEach(([x, z]) => box(0.085, 0.78, 0.085, M.woodD, x, 0.39, z, desk))
  box(0.24, 0.035, 0.24, M.metal, -0.6, 0.845, -0.2, desk)
  box(0.038, 0.44, 0.038, M.metal, -0.6, 1.08, -0.2, desk)
  const deskShade = mesh(desk, geometry(THREE.ConeGeometry, 0.2, 0.26, 20, 1, true), material(THREE.MeshStandardMaterial, { color: 0x3a3330, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), true)
  deskShade.position.set(-0.6, 1.38, -0.2)
  deskShade.rotation.x = Math.PI
  const bulb = mesh(desk, geometry(THREE.SphereGeometry, 0.072, 14, 12), M.lamp)
  bulb.position.set(-0.6, 1.3, -0.2)
  box(0.44, 0.04, 0.32, material(THREE.MeshStandardMaterial, { color: 0xf4efe4, roughness: 0.85 }), 0.16, 0.82, 0.06, desk)
  box(0.4, 0.012, 0.29, material(THREE.MeshStandardMaterial, { color: 0xdad2c4, roughness: 0.9 }), 0.16, 0.845, 0.06, desk)
  const pen = mesh(desk, geometry(THREE.CylinderGeometry, 0.012, 0.012, 0.2, 8), material(THREE.MeshStandardMaterial, { color: 0x22201e, roughness: 0.4 }))
  pen.position.set(0.3, 0.85, 0.16)
  pen.rotation.z = Math.PI / 2
  pen.rotation.y = 0.5
  const cup = mesh(desk, geometry(THREE.CylinderGeometry, 0.078, 0.062, 0.17, 20), material(THREE.MeshStandardMaterial, { color: 0xded8ce, roughness: 0.45 }), true)
  cup.position.set(0.62, 0.905, -0.12)
  const steam = mesh(desk, geometry(THREE.SphereGeometry, 0.055, 10, 8), material(THREE.MeshBasicMaterial, { color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false }))
  steam.position.set(0.62, 1.05, -0.12)
  steam.scale.y = 1.7

  const chair = new THREE.Group()
  chair.position.set(-0.98, BASE, 1.55)
  chair.rotation.y = 0.12
  study.add(chair)
  box(0.54, 0.065, 0.52, M.wood, 0, 0.46, 0, chair)
  box(0.54, 0.62, 0.065, M.wood, 0, 0.78, -0.23, chair)
  box(0.5, 0.05, 0.05, M.wood, 0, 0.62, -0.2, chair)
  ;[[-0.23, -0.21], [0.23, -0.21], [-0.23, 0.21], [0.23, 0.21]].forEach(([x, z]) => box(0.06, 0.46, 0.06, M.woodD, x, 0.23, z, chair))

  const rug = mesh(study, geometry(THREE.CircleGeometry, 1.18, 44), material(THREE.MeshStandardMaterial, { color: 0x8c4a38, roughness: 0.96 }), false, true)
  rug.rotation.x = -Math.PI / 2
  rug.position.set(0.2, BASE + 0.04, -0.78)
  const rugInner = mesh(study, geometry(THREE.CircleGeometry, 0.82, 40), material(THREE.MeshStandardMaterial, { color: 0xa85c42, roughness: 0.96 }))
  rugInner.rotation.x = -Math.PI / 2
  rugInner.position.set(0.2, BASE + 0.045, -0.78)

  const floorLamp = new THREE.Group()
  floorLamp.position.set(-W / 2 + 0.55, BASE, -D / 2 + 0.6)
  study.add(floorLamp)
  const lampBase = mesh(floorLamp, geometry(THREE.CylinderGeometry, 0.16, 0.19, 0.045, 18), M.metal, true)
  lampBase.position.y = 0.02
  const lampPole = mesh(floorLamp, geometry(THREE.CylinderGeometry, 0.03, 0.03, 1.3, 12), M.metal, true)
  lampPole.position.y = 0.67
  const floorShade = mesh(floorLamp, geometry(THREE.CylinderGeometry, 0.19, 0.23, 0.3, 20, 1, true), material(THREE.MeshStandardMaterial, {
    color: 0xf0e2c8, emissive: 0xffc98a, emissiveIntensity: 1.5, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  }))
  floorShade.position.y = 1.42

  const pot = mesh(study, geometry(THREE.CylinderGeometry, 0.21, 0.155, 0.3, 18), material(THREE.MeshStandardMaterial, { color: 0xa9663f, roughness: 0.82 }), true)
  pot.position.set(-W / 2 + 0.52, BASE + 0.15, D / 2 - 0.62)
  const soil = mesh(study, geometry(THREE.CylinderGeometry, 0.19, 0.19, 0.03, 16), material(THREE.MeshStandardMaterial, { color: 0x33261c, roughness: 1 }))
  soil.position.set(-W / 2 + 0.52, BASE + 0.3, D / 2 - 0.62)
  for (let i = 0; i < 14; i += 1) {
    const leaf = mesh(study, geometry(THREE.SphereGeometry, 0.1 + Math.random() * 0.08, 8, 7), material(THREE.MeshStandardMaterial, {
      color: new THREE.Color().setHSL(0.28, 0.34, 0.2 + Math.random() * 0.14), roughness: 0.86,
    }), true)
    leaf.position.set(-W / 2 + 0.52 + (Math.random() - 0.5) * 0.4, BASE + 0.42 + Math.random() * 0.42, D / 2 - 0.62 + (Math.random() - 0.5) * 0.4)
    leaf.scale.set(1, 0.72, 1)
  }
  const pictureFrame = mesh(study, geometry(THREE.BoxGeometry, 0.5, 0.38, 0.03), material(THREE.MeshStandardMaterial, { color: 0x4a3524, roughness: 0.7 }), true)
  pictureFrame.position.set(-0.1, BASE + 1.62, -D / 2 + 0.09)
  const picture = mesh(study, geometry(THREE.PlaneGeometry, 0.42, 0.3), material(THREE.MeshStandardMaterial, { color: 0x9fb8cf, roughness: 0.9 }))
  picture.position.set(-0.1, BASE + 1.62, -D / 2 + 0.107)

  const glowMaterial = material(THREE.MeshBasicMaterial, {
    map: radialTexture([[0, 'rgba(255,190,120,.30)'], [.45, 'rgba(255,160,90,.10)'], [1, 'rgba(255,150,80,0)']]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  })
  ;[[0, 1, D / 2 + 0.6], [0, 1, -D / 2 - 0.6], [W / 2 + 0.6, 1, 0], [-W / 2 - 0.6, 1, 0]].forEach(([x, y, z]) => {
    const panel = mesh(scene, geometry(THREE.PlaneGeometry, 4.6, 3.4), glowMaterial)
    panel.position.set(x, BASE + y, z)
    if (Math.abs(x) > Math.abs(z)) panel.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2
    else if (z < 0) panel.rotation.y = Math.PI
  })

  const cloudTexture = canvasTexture(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126)
    gradient.addColorStop(0, 'rgba(255,255,255,.5)')
    gradient.addColorStop(0.4, 'rgba(224,236,255,.22)')
    gradient.addColorStop(1, 'rgba(200,220,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
    noise(context, width, height, 10)
  })
  for (let i = 0; i < 20; i += 1) {
    const cloud = mesh(scene, geometry(THREE.PlaneGeometry, 24 + Math.random() * 28, 24 + Math.random() * 28), material(THREE.MeshBasicMaterial, {
      map: cloudTexture, transparent: true, opacity: 0.09 + Math.random() * 0.15, depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    cloud.rotation.x = -Math.PI / 2
    const angle = Math.random() * Math.PI * 2
    const radius = 6 + Math.random() * 28
    cloud.position.set(Math.cos(angle) * radius, -5.5 - Math.random() * 8, Math.sin(angle) * radius)
    cloud.userData.sp = (Math.random() - 0.5) * 0.012
    clouds.push(cloud)
  }

  const starCount = 1400
  const starPositions = new Float32Array(starCount * 3)
  const starColors = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2
    let phi = Math.acos(Math.random() * 0.9 + 0.04)
    if (i % 3 === 0) phi = Math.PI / 2 + (Math.random() - 0.5) * 0.28
    const radius = 95 + Math.random() * 30
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.8 + 18
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    const brightness = 0.55 + Math.random() * 0.45
    starColors[i * 3] = brightness * (0.85 + Math.random() * 0.15)
    starColors[i * 3 + 1] = brightness * 0.92
    starColors[i * 3 + 2] = brightness
  }
  const starGeometry = geometry(THREE.BufferGeometry)
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
  points(scene, starGeometry, material(THREE.PointsMaterial, { size: 0.55, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true, fog: false }))

  const dustCount = 1000
  const dustPositions = new Float32Array(dustCount * 3)
  const dustVelocity = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 16
    dustPositions[i * 3 + 1] = Math.random() * 8 - 1.5
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 16
    dustVelocity[i] = 0.1 + Math.random() * 0.26
  }
  const dustGeometry = geometry(THREE.BufferGeometry)
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = points(scene, dustGeometry, material(THREE.PointsMaterial, {
    color: 0xffcf94, size: 0.06, transparent: true, opacity: 0.7, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  dust.userData.velocity = dustVelocity

  const fireflyCount = 26
  const fireflyPositions = new Float32Array(fireflyCount * 3)
  const fireflyData = []
  for (let i = 0; i < fireflyCount; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = 2.2 + Math.random() * 3.4
    const y0 = 0.4 + Math.random() * 1.6
    fireflyPositions[i * 3] = Math.cos(angle) * radius
    fireflyPositions[i * 3 + 1] = y0
    fireflyPositions[i * 3 + 2] = Math.sin(angle) * radius
    fireflyData.push({ phase: Math.random() * Math.PI * 2, speed: 0.15 + Math.random() * 0.3, radius, y0, amplitude: 0.2 + Math.random() * 0.5 })
  }
  const fireflyGeometry = geometry(THREE.BufferGeometry)
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3))
  const fireflies = points(scene, fireflyGeometry, material(THREE.PointsMaterial, {
    color: 0xffd27a, size: 0.11, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  fireflies.userData.values = fireflyData

  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, camera)
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.68, 0.5, 0.8)
  const outputPass = new OutputPass()
  const cinePass = new ShaderPass(CineShader)
  composer.addPass(renderPass)
  composer.addPass(bloomPass)
  composer.addPass(outputPass)
  composer.addPass(cinePass)
  composer.setSize(window.innerWidth, window.innerHeight)
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const lookBase = new THREE.Vector3(0, 1.5, 0)
  const introState = { distance: 28, azim: 0.55, polar: 0.3 }
  const userState = { distance: 0, azim: 0, polar: 0 }
  const cameraState = { distance: 28, azim: 0.55, polar: 0.3 }
  const cameraTarget = { distance: 13.2, azim: 0.55, polar: 0.245 }
  const mouse = new THREE.Vector2(2, 2)
  const raycaster = new THREE.Raycaster()
  const clock = new THREE.Clock()
  let spinOffset = 0

  const applyCamera = () => {
    camera.position.set(
      lookBase.x + cameraState.distance * Math.cos(cameraState.polar) * Math.sin(cameraState.azim),
      lookBase.y + cameraState.distance * Math.sin(cameraState.polar),
      lookBase.z + cameraState.distance * Math.cos(cameraState.polar) * Math.cos(cameraState.azim),
    )
    camera.lookAt(lookBase)
  }
  const updatePointer = event => {
    mouse.x = event.clientX / window.innerWidth * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    ring.style.left = event.clientX + 'px'
    ring.style.top = event.clientY + 'px'
  }
  const hitTest = () => {
    raycaster.setFromCamera(mouse, camera)
    return raycaster.intersectObjects(hitTargets, false).length > 0
  }
  const updateFlashOrigin = () => {
    const projected = new THREE.Vector3(0, 1.3, 0.2).project(camera)
    flash.style.setProperty('--fx', (((projected.x + 1) / 2 * 100).toFixed(1)) + '%')
    flash.style.setProperty('--fy', (((-projected.y + 1) / 2 * 100).toFixed(1)) + '%')
  }
  const reveal = (centered, animationDelay = 0) => {
    if (centered) {
      flash.style.setProperty('--fx', '50%')
      flash.style.setProperty('--fy', '50%')
    } else {
      updateFlashOrigin()
    }
    flash.style.animationDelay = animationDelay + 's'
    flash.classList.add('is-going')
  }
  const startEntry = force => {
    if (entered || (!force && !hovering)) return
    entered = true
    doorPhase = 1
    doorT = 0
    doorStartedAt = performance.now()
    doorDone = false
    doorOpenedReported = false
    camAzim0 = cameraState.azim
    camPolar0 = cameraState.polar
    camDist0 = cameraState.distance
    hovering = false
    root.dataset.enteredAt = String(performance.now())
    root.dataset.timelineMs = '4400'
    ring.classList.remove('is-on')
    document.body.style.cursor = 'default'
    onEntering?.({ skipped: false })
    reveal(false, 2.9)
    later(() => {
      doorDone = true
      onFinish?.({ reveal: true })
    }, 4400)
  }
  const skip = () => {
    if (entered) return
    entered = true
    renderPausedForReveal = true
    window.cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    onEntering?.({ skipped: true })
    reveal(true)
    later(() => onFinish?.({ reveal: true }), 720)
  }

  const onPointerDown = event => {
    if (entered) return
    updatePointer(event)
    hovering = hitTest()
    dragging = true
    dragMoved = 0
    downT = performance.now()
    lastPX = event.clientX
    lastPY = event.clientY
    canvas.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = event => {
    updatePointer(event)
    if (dragging && !entered) {
      const dx = event.clientX - lastPX
      const dy = event.clientY - lastPY
      lastPX = event.clientX
      lastPY = event.clientY
      dragMoved += Math.abs(dx) + Math.abs(dy)
      userState.azim += dx * 0.0062
      userState.polar += dy * 0.0038
      autoSpin = 0
    }
  }
  const onPointerUp = event => {
    if (!dragging) return
    dragging = false
    canvas.releasePointerCapture?.(event.pointerId)
    hovering = hitTest()
    if (performance.now() - downT < 400 && dragMoved < 6) startEntry(false)
  }
  const onPointerCancel = () => { dragging = false }
  const onWheel = event => {
    if (entered) return
    event.preventDefault()
    userState.distance = THREE.MathUtils.clamp(userState.distance + event.deltaY * 0.0055, DIST_MIN - introState.distance, DIST_MAX - introState.distance)
    autoSpin = 0
  }
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    composer.setSize(window.innerWidth, window.innerHeight)
  }
  const onContextLost = event => {
    event.preventDefault()
    onFinish?.()
  }
  const onVisibility = () => {
    if (document.hidden) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    } else if (!disposed && !rafRef.current) {
      clock.getDelta()
      rafRef.current = window.requestAnimationFrame(frame)
    }
  }

  listen(canvas, 'pointerdown', onPointerDown)
  listen(window, 'pointermove', onPointerMove)
  listen(window, 'pointerup', onPointerUp)
  listen(window, 'pointercancel', onPointerCancel)
  listen(window, 'wheel', onWheel, { passive: false })
  listen(window, 'resize', onResize)
  listen(canvas, 'webglcontextlost', onContextLost)
  listen(document, 'visibilitychange', onVisibility)
  applyCamera()

  function frame() {
    rafRef.current = 0
    if (disposed || document.hidden) return
    const delta = Math.min(clock.getDelta(), 0.05)
    const elapsed = clock.getElapsedTime()
    if (!entered && doorPhase === 0) {
      intro = Math.min(1, intro + delta / 3.8)
      const ease = 1 - Math.pow(1 - intro, 3)
      introState.distance = THREE.MathUtils.lerp(28, 13.2, ease)
      introState.azim = THREE.MathUtils.lerp(0.55, 0.3, ease)
      introState.polar = THREE.MathUtils.lerp(0.3, 0.245, ease)
      if (!dragging && autoSpin) spinOffset += autoSpin * delta
      cameraTarget.azim = introState.azim + userState.azim + spinOffset
      cameraTarget.polar = THREE.MathUtils.clamp(introState.polar + userState.polar, 0.02, 0.72)
      cameraTarget.distance = THREE.MathUtils.clamp(introState.distance + userState.distance, DIST_MIN, DIST_MAX)
      cameraState.azim += (cameraTarget.azim - cameraState.azim) * Math.min(1, delta * 6)
      cameraState.polar += (cameraTarget.polar - cameraState.polar) * Math.min(1, delta * 6)
      cameraState.distance += (cameraTarget.distance - cameraState.distance) * Math.min(1, delta * 5)
      applyCamera()
      const currentHover = hitTest()
      if (currentHover !== hovering) {
        hovering = currentHover
        ring.classList.toggle('is-on', hovering)
        document.body.style.cursor = hovering ? 'pointer' : dragging ? 'grabbing' : 'grab'
        bloomPass.strength = hovering ? (hq ? 1.1 : 0.8) : (hq ? 0.68 : 0.48)
      }
    }
    if (doorPhase > 0) {
      doorT = (performance.now() - doorStartedAt) / 1000
      const cameraProgress = Math.min(1, doorT / 2)
      const cameraEase = 1 - Math.pow(1 - cameraProgress, 3)
      cameraState.azim = THREE.MathUtils.lerp(camAzim0, 0, cameraEase)
      cameraState.polar = THREE.MathUtils.lerp(camPolar0, 0.16, cameraEase)
      cameraState.distance = THREE.MathUtils.lerp(camDist0, 5.6, cameraEase)
      lookBase.y = THREE.MathUtils.lerp(1.5, 1.42, cameraEase)
      applyCamera()
      renderer.toneMappingExposure = 1.18 - 0.3 * cameraEase
      const dim = 1 - 0.42 * cameraEase
      roomLight.intensity = (10 + Math.sin(elapsed * 2.1) * 0.8) * dim
      deskLight.intensity = 3.4 * dim
      porchLight.intensity = 1.5 * (1 - 0.55 * cameraEase)
      M.lamp.emissiveIntensity = (7 + Math.sin(elapsed * 2.1)) * (1 - 0.6 * cameraEase)
      bloomPass.strength = (hq ? 0.68 : 0.48) - 0.22 * cameraEase
      const doorProgress = THREE.MathUtils.clamp((doorT - 1.2) / 1.2, 0, 1)
      const doorEase = doorProgress < 0.5 ? 4 * Math.pow(doorProgress, 3) : 1 - Math.pow(-2 * doorProgress + 2, 3) / 2
      doorHinges[0].rotation.y = -doorEase * DOOR_ANGLE
      doorHinges[1].rotation.y = doorEase * DOOR_ANGLE
      if (!doorDone && doorT < 2.4) updateFlashOrigin()
      if (doorT >= 2.4) {
        if (!doorOpenedReported) {
          doorOpenedReported = true
          onDoorOpened?.()
        }
        renderPausedForReveal = true
      }
    } else {
      roomLight.intensity = 10 + Math.sin(elapsed * 2.1) * 0.8 + Math.sin(elapsed * 6.9) * 0.35 + Math.sin(elapsed * 13.3) * 0.12
      deskLight.intensity = 3.4 + Math.sin(elapsed * 3.3) * 0.22
      porchLight.intensity = 1.5 + Math.sin(elapsed * 1.7) * 0.16
      M.lamp.emissiveIntensity = 7 + Math.sin(elapsed * 2.1)
    }
    clouds.forEach(cloud => { cloud.rotation.z += cloud.userData.sp * delta * 6 })
    floaters.forEach(value => {
      value.rotation.y += value.userData.spin * delta
      value.position.y = value.userData.y0 + Math.sin(elapsed * 0.5 + value.userData.bob) * 0.28
    })
    const movingDust = dust.geometry.attributes.position
    for (let i = 0; i < movingDust.count; i += 1) {
      let y = movingDust.getY(i) + dust.userData.velocity[i] * delta * 0.42
      if (y > 8) y = -1.6
      movingDust.setXYZ(i, movingDust.getX(i) + Math.sin(elapsed * 0.5 + i) * 0.0024, y, movingDust.getZ(i))
    }
    movingDust.needsUpdate = true
    const movingFireflies = fireflies.geometry.attributes.position
    fireflies.userData.values.forEach((value, index) => {
      value.phase += value.speed * delta
      movingFireflies.setXYZ(index, Math.cos(value.phase) * value.radius, value.y0 + Math.sin(elapsed * 0.7 + index) * value.amplitude, Math.sin(value.phase) * value.radius)
    })
    movingFireflies.needsUpdate = true
    fireflies.material.opacity = 0.6 + Math.sin(elapsed * 2.4) * 0.35
    cinePass.uniforms.uTime.value = elapsed
    try {
      composer.render()
      if (!readyReported) {
        readyReported = true
        later(() => onReady?.(), 450)
      }
      if (!renderPausedForReveal) rafRef.current = window.requestAnimationFrame(frame)
    } catch (error) {
      console.error('3D splash render failed.', error)
      onFinish?.()
    }
  }

  const setQuality = nextQuality => {
    hq = nextQuality === 'high'
    renderer.setPixelRatio(hq ? Math.min(window.devicePixelRatio, 2) : 1)
    renderer.shadowMap.enabled = hq
    moon.castShadow = hq
    roomLight.castShadow = hq
    scene.traverse(object => {
      if (object.isMesh) {
        object.castShadow = hq && Boolean(object.userData.splashCastShadow)
        object.receiveShadow = hq && Boolean(object.userData.splashReceiveShadow)
        if (object.userData.splashGlass) object.material = hq ? glassHigh : glassLow
      }
    })
    textures.forEach(value => {
      value.anisotropy = hq ? 8 : 1
      value.needsUpdate = true
    })
    cinePass.uniforms.uChroma.value = hq ? 0.0022 : 0
    bloomPass.strength = hq ? 0.68 : 0.48
    composer.setPixelRatio(hq ? Math.min(window.devicePixelRatio, 2) : 1)
  }

  const disposeGpuResources = () => {
    const disposedGeometries = new Set()
    const disposedMaterials = new Set()
    const disposedTextures = new Set()
    const disposeTexture = value => {
      if (!value?.isTexture || disposedTextures.has(value)) return
      disposedTextures.add(value)
      value.dispose()
    }
    const disposeMaterial = value => {
      if (!value || disposedMaterials.has(value)) return
      disposedMaterials.add(value)
      Object.values(value).forEach(disposeTexture)
      value.dispose?.()
    }
    const disposeGeometry = value => {
      if (!value || disposedGeometries.has(value)) return
      disposedGeometries.add(value)
      value.dispose?.()
    }
    const disposeTree = rootObject => {
      rootObject?.traverse(object => {
        disposeGeometry(object.geometry)
        const materialValues = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
        materialValues.forEach(disposeMaterial)
      })
    }
    composer.passes.forEach(pass => pass.dispose?.())
    composer.dispose?.()
    disposeTree(scene)
    disposeTree(envScene)
    geometries.forEach(disposeGeometry)
    materials.forEach(disposeMaterial)
    textures.forEach(disposeTexture)
    envRT.dispose()
    pmrem.dispose()
    scene.environment = null
    scene.clear()
    envScene.clear()
    const gl = renderer.getContext()
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    listeners.splice(0).forEach(remove => remove())
    timers.forEach(id => window.clearTimeout(id))
    timers.clear()
    document.body.style.cursor = previousBody.cursor
    document.body.style.overflow = previousBody.overflow
    rendererRef.current = null
    sceneRef.current = null
    cameraRef.current = null
    queueMicrotask(disposeGpuResources)
  }

  rafRef.current = window.requestAnimationFrame(frame)
  return { dispose, enter: startEntry, setQuality, skip }
}
