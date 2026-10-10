import { useEffect, useLayoutEffect, useRef } from "react"
import { useTheme } from "@emotion/react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { createGraph3DLayout } from "./layout3d"
import type { Graph3DLayout } from "./layout3d"
import { graphNodeRadius, RELATION_STYLES } from "./types"
import type { GraphSceneProps, GraphLayoutOptions, RelationKind, SceneLink } from "./types"
import type { EditorColors } from "src/styles/colors"

type Runtime = {
  invalidate: () => void
  updateOptions: (options: GraphLayoutOptions) => void
}
type EdgeBatch = {
  kind: RelationKind
  links: SceneLink[]
  segments: number
  lines: THREE.InstancedMesh
  arrows: THREE.InstancedMesh
}

const isDirected = (link: SceneLink) => link.kind !== "similar-topic"

/** The renderer and layout live outside React; props only invalidate the next frame. */
export default function GraphScene(props: GraphSceneProps) {
  const theme = useTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const palette = useRef(theme.colors.editor)
  const runtime = useRef<Runtime | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    latest.current = props
    palette.current = theme.colors.editor
  }, [props, theme.colors.editor])

  useEffect(() => {
    const host = hostRef.current
    const labelLayer = labelsRef.current
    if (!host || !labelLayer) return
    labelLayer.hidden = false
    const errorLayer = errorRef.current
    if (errorLayer) {
      errorLayer.textContent = ""
      errorLayer.style.display = "none"
    }

    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const listeners: (() => void)[] = []
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let layout: Graph3DLayout | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let raf = 0
    let disposed = false
    let contextLost = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      runtime.current = null
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      for (const remove of listeners) remove()
      controls?.dispose()
      layout?.stop()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      renderer?.dispose()
      renderer?.forceContextLoss()
      renderer?.domElement.remove()
      labelLayer.replaceChildren()
    }
    const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
      geometries.add(value)
      return value
    }
    const material = <T extends THREE.Material>(value: T): T => {
      materials.add(value)
      return value
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "default" })
      const gl = renderer
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      gl.outputColorSpace = THREE.SRGBColorSpace
      gl.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none"
      gl.domElement.setAttribute("aria-label", "3D graph. Drag to rotate, Shift-drag or right-drag to pan, scroll to zoom. Alt-drag a node to move it. Tab to explore node labels.")
      gl.domElement.tabIndex = 0
      host.prepend(gl.domElement)

      const scene = new THREE.Scene()
      const fog = new THREE.Fog(palette.current.bg, 1000, 4000)
      scene.fog = fog
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20000)
      const orbit = new OrbitControls(camera, gl.domElement)
      controls = orbit
      orbit.enableDamping = true
      orbit.dampingFactor = 0.12
      orbit.screenSpacePanning = true
      orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN
      orbit.touches.ONE = THREE.TOUCH.ROTATE
      orbit.touches.TWO = THREE.TOUCH.DOLLY_PAN
      orbit.minDistance = 15
      orbit.maxDistance = 15000
      let sceneRadius = 30
      const simulation = createGraph3DLayout(props.nodes, props.edges, latest.current.layoutOptions)
      layout = simulation
      simulation.tick(60)
      const nodes = simulation.nodes
      const count = nodes.length
      const sphere = geometry(new THREE.SphereGeometry(1, 16, 12))
      const octahedron = geometry(new THREE.OctahedronGeometry(1))
      const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 5, 1))
      const cone = geometry(new THREE.ConeGeometry(1, 1, 8))
      const particleGeometry = geometry(new THREE.SphereGeometry(1, 6, 4))
      const nodeMaterials = new Map<string, THREE.MeshStandardMaterial>()
      const meshes: THREE.Mesh[] = []
      const buttons: HTMLButtonElement[] = []
      const visible = new Uint8Array(count)
      const dimmed = new Uint8Array(count)
      const fitScope = new Uint8Array(count)
      const neighbors = new Uint8Array(count)
      const radii = new Float32Array(count)
      const labelWidths = new Float32Array(count)
      const labelX = new Float32Array(count)
      const labelY = new Float32Array(count)
      const labelScore = new Float32Array(count)
      const labelOrder = Array.from({ length: count }, (_, index) => index)
      const occupied = new Float32Array(count * 4)
      const projected = new THREE.Vector3()
      const position = new THREE.Vector3()
      const direction = new THREE.Vector3()
      const start = new THREE.Vector3()
      const end = new THREE.Vector3()
      const normal = new THREE.Vector3()
      const up = new THREE.Vector3(0, 1, 0)
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      const background = new THREE.Color()
      const edgeColor = new THREE.Color()
      const tint = new THREE.Color()
      const raycaster = new THREE.Raycaster()
      const intersections: THREE.Intersection[] = []
      const pointer = new THREE.Vector2()
      const dragPlane = new THREE.Plane()
      const dragPoint = new THREE.Vector3()
      const dragOffset = new THREE.Vector3()
      const fitCenter = new THREE.Vector3()
      const fitMin = new THREE.Vector3()
      const fitMax = new THREE.Vector3()
      const fitRight = new THREE.Vector3()
      const fitUp = new THREE.Vector3()
      const tweenFrom = new THREE.Vector3()
      const tweenTo = new THREE.Vector3()
      const targetFrom = new THREE.Vector3()
      const targetTo = new THREE.Vector3()
      const viewDirection = new THREE.Vector3(0.85, 0.65, 1).normalize()
      const light = new THREE.HemisphereLight(0xffffff, 0x45413c, 2.2)
      scene.add(light)
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
      keyLight.position.set(200, 400, 300)
      scene.add(keyLight)
      const rim = new THREE.DirectionalLight(0x94bfff, 1.1)
      rim.position.set(-300, 120, -250)
      scene.add(rim)
      const grid = new THREE.GridHelper(1, 20, 0x666666, 0x666666)
      geometries.add(grid.geometry)
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
      for (const value of gridMaterials) {
        materials.add(value)
        value.transparent = true
        value.opacity = 0.12
        value.depthWrite = false
      }
      scene.add(grid)
      const particleMaterial = material(new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }))
      let particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, 1)
      particles.count = 0
      particles.frustumCulled = false
      scene.add(particles)
      let batches: EdgeBatch[] = []
      const particleLinks: SceneLink[] = []
      let lastLinks: SceneLink[] | null = null
      let lastPalette: EditorColors | null = null
      listeners.push(() => {
        for (const batch of batches) { batch.lines.dispose(); batch.arrows.dispose() }
        particles.dispose()
      })
      let width = 1
      let height = 1
      const fitRect = new THREE.Vector4()
      const graphLayout = host.closest(".graph-layout")
      const heading = graphLayout?.querySelector<HTMLElement>(".graph-heading")
      const drawer = graphLayout?.querySelector<HTMLElement>(".detail-panel")
      let fitWidth = -1
      let fitHeight = -1
      let fitSelection = -2
      let drawable = false
      let inViewport = true
      let dirty = true
      let cameraDirty = true
      let simulationActive = true
      let cameraInteracting = false
      let inFrame = false
      let tweenStarted = -1
      let tweenDuration = 0
      let keyboardIndex = -1
      let pointerHover = -1
      let resetToken = latest.current.resetViewToken
      let focusToken = latest.current.focusRequest?.token ?? -1
      let autoFit = true
      let dragIndex = -1
      let primaryPointer = -1
      let downX = 0
      let downY = 0
      let downNode = -1
      let dragged = false
      let modified = false
      let downButton = -1
      const activePointers = new Set<number>()
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
      let reducedMotion = motion.matches
      orbit.enableDamping = !reducedMotion

      const wake = () => {
        if (disposed) return
        if (!disposed && !contextLost && !raf && !inFrame && drawable && inViewport && !document.hidden) raf = requestAnimationFrame(frame)
      }
      const getNodeMaterial = (color: string, wireframe: boolean, dim: boolean, focus: boolean) => {
        const key = `${color}:${wireframe}:${dim}:${focus}`
        let value = nodeMaterials.get(key)
        if (!value) {
          value = material(new THREE.MeshStandardMaterial({ color, wireframe, roughness: 0.46, metalness: 0.08, transparent: dim, opacity: dim ? 0.22 : 1, depthWrite: !dim }))
          nodeMaterials.set(key, value)
        }
        value.emissive.set(focus ? color : 0x000000)
        value.emissiveIntensity = focus ? (background.getHex() < 0x808080 ? 0.4 : 0.24) : 0
        return value
      }
      const focusNode = (index: number, smooth = true) => {
        if (!nodes[index] || !visible[index]) return
        fit(smooth, false, index)
        autoFit = false
      }
      const startTween = (smooth: boolean) => {
        tweenFrom.copy(camera.position)
        targetFrom.copy(orbit.target)
        tweenStarted = performance.now()
        tweenDuration = smooth && !reducedMotion ? 520 : 0
        if (tweenDuration === 0) {
          camera.position.copy(tweenTo)
          orbit.target.copy(targetTo)
          orbit.update()
          tweenStarted = -1
        }
        wake()
      }
      const fit = (smooth: boolean, oblique = false, focusIndex = -1) => {
        // Cache overlay measurements; the settling simulation fits on every frame.
        if (fitWidth !== width || fitHeight !== height || fitSelection !== latest.current.selectedIndex) {
          fitWidth = width
          fitHeight = height
          fitSelection = latest.current.selectedIndex
          fitRect.set(14, Math.min(height * 0.4, (heading ? heading.offsetTop + heading.offsetHeight : 100) + 20), width - 14, height - 80)
          if (fitSelection >= 0 && drawer) {
            if (drawer.offsetWidth >= width * 0.9) fitRect.w = Math.min(fitRect.w, drawer.offsetTop - 18)
            else fitRect.z = Math.min(fitRect.z, drawer.offsetLeft - 18)
          }
          fitRect.z = Math.max(fitRect.x + 60, fitRect.z)
          fitRect.w = Math.max(fitRect.y + 60, fitRect.w)
        }
        const centerX = (fitRect.x + fitRect.z - width) / width
        const centerY = (height - fitRect.y - fitRect.w) / height
        fitScope.fill(focusIndex < 0 ? 1 : 0)
        if (focusIndex >= 0) {
          fitScope[focusIndex] = 1
          for (const link of latest.current.links) {
            if (link.a === focusIndex) fitScope[link.b] = 1
            else if (link.b === focusIndex) fitScope[link.a] = 1
          }
        }
        fitMin.set(Infinity, Infinity, Infinity)
        fitMax.set(-Infinity, -Infinity, -Infinity)
        let any = false
        for (let index = 0; index < count; index++) {
          if (!visible[index] || !fitScope[index]) continue
          const node = nodes[index]
          const radius = radii[index] + 10
          fitMin.x = Math.min(fitMin.x, node.x - radius)
          fitMin.y = Math.min(fitMin.y, node.y - radius)
          fitMin.z = Math.min(fitMin.z, node.z - radius)
          fitMax.x = Math.max(fitMax.x, node.x + radius)
          fitMax.y = Math.max(fitMax.y, node.y + radius)
          fitMax.z = Math.max(fitMax.z, node.z + radius)
          any = true
        }
        if (!any) { fitMin.set(-30, -30, -30); fitMax.set(30, 30, 30) }
        fitCenter.addVectors(fitMin, fitMax).multiplyScalar(0.5)
        if (oblique) viewDirection.set(0.85, 0.65, 1).normalize()
        else viewDirection.subVectors(camera.position, orbit.target).normalize()
        if (viewDirection.lengthSq() < 0.5) viewDirection.set(0.85, 0.65, 1).normalize()
        fitRight.crossVectors(camera.up, viewDirection).normalize()
        fitUp.crossVectors(viewDirection, fitRight).normalize()
        const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        const horizontalTangent = verticalTangent * camera.aspect
        const availableHorizontal = horizontalTangent * (fitRect.z - fitRect.x) / width
        const availableVertical = verticalTangent * (fitRect.w - fitRect.y) / height
        let distance = 60
        for (let index = 0; index < count; index++) {
          if (!visible[index] || !fitScope[index]) continue
          const node = nodes[index]
          position.set(node.x, node.y, node.z).sub(fitCenter)
          const clearance = radii[index] + 14
          const depth = position.dot(viewDirection)
          distance = Math.max(distance,
            depth + (Math.abs(position.dot(fitRight) + centerX * depth * horizontalTangent) + clearance) / availableHorizontal,
            depth + (Math.abs(position.dot(fitUp) + centerY * depth * verticalTangent) + clearance) / availableVertical)
        }
        distance *= 1.16
        targetTo.copy(fitCenter)
          .addScaledVector(fitRight, -centerX * distance * horizontalTangent)
          .addScaledVector(fitUp, -centerY * distance * verticalTangent)
        tweenTo.copy(targetTo).addScaledVector(viewDirection, distance)
        startTween(smooth)
      }
      const pick = (event: PointerEvent) => {
        const bounds = gl.domElement.getBoundingClientRect()
        pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        intersections.length = 0
        raycaster.intersectObjects(meshes, false, intersections)
        for (const hit of intersections) {
          const index = hit.object.userData.nodeIndex as number
          if (visible[index]) return index
        }
        return -1
      }
      const hover = (index: number) => {
        if (pointerHover === index) return
        pointerHover = index
        gl.domElement.style.cursor = index >= 0 ? "pointer" : "grab"
        gl.domElement.title = index >= 0 ? nodes[index].title : ""
        latest.current.onHover(index)
        wake()
      }
      const select = (index: number) => latest.current.onSelect(latest.current.selectedIndex === index ? -1 : index)
      for (let index = 0; index < count; index++) {
        const node = nodes[index]
        radii[index] = graphNodeRadius(node.degree)
        const mesh = new THREE.Mesh(node.kind === "post" ? sphere : octahedron, getNodeMaterial(node.color, node.kind === "series", false, false))
        mesh.userData.nodeIndex = index
        meshes.push(mesh)
        scene.add(mesh)
        const button = document.createElement("button")
        button.type = "button"
        button.dataset.nodeIndex = String(index)
        button.title = node.title
        button.textContent = node.title
        button.setAttribute("aria-label", `${node.title}, ${node.kind}, ${node.degree} connections`)
        button.style.cssText = "position:absolute;left:0;top:0;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;font-size:12px;line-height:18px;padding:2px 6px;border:1px solid transparent;border-radius:3px;cursor:pointer;pointer-events:auto;box-sizing:border-box;outline-offset:2px"
        button.addEventListener("click", () => select(index))
        button.addEventListener("mouseenter", () => hover(index))
        button.addEventListener("mouseleave", () => { if (keyboardIndex !== index) hover(-1) })
        button.addEventListener("focus", () => {
          keyboardIndex = index
          dirty = true
          hover(index)
          if (labelScore[index] < 0) focusNode(index)
          wake()
        })
        button.addEventListener("blur", () => { keyboardIndex = -1; dirty = true; hover(-1); wake() })
        button.addEventListener("keydown", (event) => {
          if (event.key === "Escape") { latest.current.onSelect(-1); gl.domElement.focus() }
        })
        labelLayer.append(button)
        buttons.push(button)
      }

      const rebuildEdges = (links: SceneLink[]) => {
        for (const batch of batches) {
          scene.remove(batch.lines, batch.arrows)
          batch.lines.dispose()
          batch.arrows.dispose()
          const lineMaterial = batch.lines.material as THREE.Material
          const arrowMaterial = batch.arrows.material as THREE.Material
          lineMaterial.dispose()
          arrowMaterial.dispose()
          materials.delete(lineMaterial)
          materials.delete(arrowMaterial)
        }
        batches = []
        const grouped = new Map<RelationKind, SceneLink[]>()
        for (const link of links) {
          if (!nodes[link.a] || !nodes[link.b] || link.a === link.b) continue
          const group = grouped.get(link.kind)
          if (group) group.push(link)
          else grouped.set(link.kind, [link])
        }
        for (const [kind, group] of grouped) {
          const segments = RELATION_STYLES[kind].dashed ? 12 : 1
          const lineMaterial = material(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }))
          const arrowMaterial = material(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.94, depthWrite: false }))
          const lines = new THREE.InstancedMesh(cylinder, lineMaterial, group.length * segments)
          const arrows = new THREE.InstancedMesh(cone, arrowMaterial, group.length)
          lines.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          lines.frustumCulled = arrows.frustumCulled = false
          lines.renderOrder = 0
          arrows.renderOrder = 1
          scene.add(lines, arrows)
          batches.push({ kind, links: group, segments, lines, arrows })
        }
        scene.remove(particles)
        particles.dispose()
        particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, Math.max(1, links.length))
        particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        particles.frustumCulled = false
        particles.count = 0
        particles.renderOrder = 2
        scene.add(particles)
        lastLinks = links
      }
      const updateVisibility = () => {
        const state = latest.current
        const focus = state.neighborhoodOnly && state.selectedIndex >= 0 ? state.selectedIndex : state.hoveredIndex >= 0 ? state.hoveredIndex : state.selectedIndex
        neighbors.fill(0)
        if (focus >= 0 && focus < count) {
          neighbors[focus] = 1
          for (const link of state.links) {
            if (link.a === focus && nodes[link.b]) neighbors[link.b] = 1
            if (link.b === focus && nodes[link.a]) neighbors[link.a] = 1
          }
          state.focusNeighbors?.forEach((index) => { if (nodes[index]) neighbors[index] = 1 })
        }
        for (let index = 0; index < count; index++) {
          const node = nodes[index]
          const revealed = state.revealCount === null || state.nodeAppearRank[index] < state.revealCount
          const inNeighborhood = focus < 0 || neighbors[index] === 1
          const categoryMatch = state.highlightedCategory === null || node.category === state.highlightedCategory
          visible[index] = revealed && (!state.neighborhoodOnly || inNeighborhood) ? 1 : 0
          dimmed[index] = !inNeighborhood || !categoryMatch ? 1 : 0
          meshes[index].visible = visible[index] === 1
          const emphasized = index === state.selectedIndex || index === focus
          meshes[index].material = getNodeMaterial(node.color, node.kind === "series", dimmed[index] === 1 && !emphasized, emphasized)
          buttons[index].tabIndex = visible[index] ? 0 : -1
          buttons[index].hidden = !visible[index]
          buttons[index].setAttribute("aria-pressed", index === state.selectedIndex ? "true" : "false")
          buttons[index].style.fontWeight = emphasized ? "600" : "400"
          buttons[index].style.borderColor = emphasized ? palette.current.accent : "transparent"
        }
        if (pointerHover >= 0 && !visible[pointerHover]) hover(-1)
        if (statusRef.current) {
          const any = visible.some((value) => value === 1)
          statusRef.current.textContent = count === 0 ? "No graph nodes available." : !any ? "No nodes match the current graph filters." : ""
          statusRef.current.style.display = any ? "none" : "grid"
        }
      }
      const updateTheme = () => {
        const colors = palette.current
        background.set(colors.bg)
        scene.background = background
        if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(background)
        for (const value of gridMaterials) value.color.set(colors.fg3)
        particleMaterial.color.set(colors.fg)
        light.intensity = background.getHex() < 0x808080 ? 2.5 : 2
        for (const button of buttons) {
          button.style.background = colors.bg2
          button.style.color = colors.fg
          button.style.outlineColor = colors.accent
          button.style.boxShadow = `0 1px 4px ${colors.bg}`
        }
        lastPalette = colors
      }
      const endpoints = (link: SceneLink) => {
        const a = nodes[link.a]
        const b = nodes[link.b]
        start.set(a.x, a.y, a.z)
        end.set(b.x, b.y, b.z)
        direction.subVectors(end, start)
        const length = direction.length()
        if (length < 0.001) return false
        direction.multiplyScalar(1 / length)
        start.addScaledVector(direction, Math.min(radii[link.a] + 1.5, length * 0.3))
        end.addScaledVector(direction, -Math.min(radii[link.b] + 2, length * 0.3))
        return true
      }
      const updateGeometry = () => {
        const state = latest.current
        const focus = state.neighborhoodOnly && state.selectedIndex >= 0 ? state.selectedIndex : state.hoveredIndex >= 0 ? state.hoveredIndex : state.selectedIndex
        let minY = Infinity
        let extent = 80
        let radiusSquared = 0
        let maxNodeRadius = 0
        for (let index = 0; index < count; index++) {
          const node = nodes[index]
          const mesh = meshes[index]
          mesh.position.set(node.x, node.y, node.z)
          const emphasized = index === state.selectedIndex || index === focus
          mesh.scale.setScalar(radii[index] * (emphasized ? 1.12 : 1))
          radiusSquared = Math.max(radiusSquared, mesh.position.lengthSq())
          maxNodeRadius = Math.max(maxNodeRadius, mesh.scale.x)
          if (visible[index]) {
            minY = Math.min(minY, node.y - radii[index])
            extent = Math.max(extent, Math.abs(node.x), Math.abs(node.z))
          }
        }
        sceneRadius = Math.max(30, Math.sqrt(radiusSquared) + maxNodeRadius)
        grid.position.y = (Number.isFinite(minY) ? minY : -30) - 28
        grid.scale.setScalar(extent * 2.7)
        particleLinks.length = 0
        for (const batch of batches) {
          let lineCount = 0
          let arrowCount = 0
          for (const link of batch.links) {
            if (!visible[link.a] || !visible[link.b] || !endpoints(link)) continue
            const incident = focus >= 0 && (link.a === focus || link.b === focus)
            const unrelated = focus >= 0 && !incident
            const categoryDim = dimmed[link.a] && dimmed[link.b]
            const strength = incident ? 1 : unrelated || categoryDim ? 0.12 : 0.6
            edgeColor.set(RELATION_STYLES[batch.kind].color)
            tint.copy(background).lerp(edgeColor, strength)
            const weight = Math.min(3, Math.max(0.5, Math.sqrt(Math.max(0, link.weight))))
            const thickness = (incident ? 1.15 : 0.5) * weight
            quaternion.setFromUnitVectors(up, direction)
            const length = start.distanceTo(end)
            const arrowLength = Math.min(length * 0.2, incident ? 8 : 5)
            const usableLength = Math.max(0.1, length - (isDirected(link) ? arrowLength * 0.75 : 0))
            for (let segment = 0; segment < batch.segments; segment++) {
              const segmentLength = usableLength / batch.segments
              const dashLength = segmentLength * (batch.segments > 1 ? 0.55 : 1)
              position.copy(start).addScaledVector(direction, segmentLength * segment + dashLength / 2)
              scale.set(thickness, dashLength, thickness)
              matrix.compose(position, quaternion, scale)
              batch.lines.setMatrixAt(lineCount, matrix)
              batch.lines.setColorAt(lineCount++, tint)
            }
            if (isDirected(link)) {
              position.copy(end).addScaledVector(direction, -arrowLength / 2)
              scale.set(incident ? 3.4 : 2, arrowLength, incident ? 3.4 : 2)
              matrix.compose(position, quaternion, scale)
              batch.arrows.setMatrixAt(arrowCount, matrix)
              batch.arrows.setColorAt(arrowCount++, tint)
            }
            if (state.selectedIndex >= 0 && (link.a === state.selectedIndex || link.b === state.selectedIndex) && isDirected(link) && link.confidence === undefined) particleLinks.push(link)
          }
          batch.lines.count = lineCount
          batch.arrows.count = arrowCount
          batch.lines.instanceMatrix.needsUpdate = true
          batch.arrows.instanceMatrix.needsUpdate = true
          if (batch.lines.instanceColor) batch.lines.instanceColor.needsUpdate = true
          if (batch.arrows.instanceColor) batch.arrows.instanceColor.needsUpdate = true
        }
        scene.updateMatrixWorld(true)
      }
      const updateParticles = (time: number) => {
        particles.count = reducedMotion ? 0 : particleLinks.length
        for (let index = 0; index < particles.count; index++) {
          const link = particleLinks[index]
          if (!endpoints(link)) continue
          const progress = (time * 0.00024 + index * 0.381966) % 1
          position.copy(start).lerp(end, progress)
          quaternion.identity()
          scale.setScalar(1.7)
          matrix.compose(position, quaternion, scale)
          particles.setMatrixAt(index, matrix)
          tint.set(RELATION_STYLES[link.kind].color).lerp(particleMaterial.color, 0.25)
          particles.setColorAt(index, tint)
        }
        if (particles.count) {
          particles.instanceMatrix.needsUpdate = true
          if (particles.instanceColor) particles.instanceColor.needsUpdate = true
        }
      }
      const compareLabels = (a: number, b: number) => labelScore[b] - labelScore[a]
      const hideLabel = (button: HTMLButtonElement) => {
        button.style.width = "1px"
        button.style.height = "1px"
        button.style.padding = "0"
        button.style.clipPath = "inset(50%)"
        button.style.pointerEvents = "none"
      }
      const updateLabels = () => {
        const state = latest.current
        let occupiedCount = 0
        const labelBudget = Math.max(8, Math.min(36, Math.floor(width * height / 22000)))
        for (let index = 0; index < count; index++) {
          labelScore[index] = -1
          if (!visible[index]) continue
          const node = nodes[index]
          projected.set(node.x, node.y, node.z).project(camera)
          labelX[index] = (projected.x + 1) * width / 2
          labelY[index] = (1 - projected.y) * height / 2
          const prominent = index === state.selectedIndex || index === state.hoveredIndex || index === keyboardIndex
          if (!prominent && dimmed[index]) continue
          if (projected.z < -1 || projected.z > 1 || labelX[index] < 8 || labelX[index] > width - 8 || labelY[index] < 8 || labelY[index] > height - 8) continue
          const distance = camera.position.distanceTo(meshes[index].position)
          const projectedRadius = radii[index] * height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, distance))
          const nearby = projectedRadius > 8
          if (!prominent && !nearby && node.degree < 3 && node.kind === "post") continue
          labelY[index] += projectedRadius + 6
          labelScore[index] = prominent ? 100000 + (index === keyboardIndex ? 1000 : 0) : (neighbors[index] ? 10000 : 0) + node.degree * 10 + projectedRadius
        }
        labelOrder.sort(compareLabels)
        for (const index of labelOrder) {
          const button = buttons[index]
          if (!visible[index]) continue
          const important = labelScore[index] >= 100000
          if (labelScore[index] < 0 || (!important && occupiedCount >= labelBudget)) { hideLabel(button); continue }
          const labelWidth = Math.min(labelWidths[index] || 120, Math.max(40, width - 16))
          const x = Math.max(8, Math.min(width - labelWidth - 8, labelX[index] - labelWidth / 2))
          const y = Math.max(8, Math.min(height - 32, labelY[index]))
          let overlap = false
          for (let slot = 0; slot < occupiedCount; slot++) {
            const offset = slot * 4
            if (x < occupied[offset + 2] + 5 && x + labelWidth + 5 > occupied[offset] && y < occupied[offset + 3] + 4 && y + 26 + 4 > occupied[offset + 1]) { overlap = true; break }
          }
          if (overlap && !important) { hideLabel(button); continue }
          const offset = occupiedCount++ * 4
          occupied[offset] = x
          occupied[offset + 1] = y
          occupied[offset + 2] = x + labelWidth
          occupied[offset + 3] = y + 26
          button.style.width = `${labelWidth}px`
          button.style.height = "26px"
          button.style.padding = "2px 6px"
          button.style.clipPath = "none"
          button.style.pointerEvents = "auto"
          button.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`
          button.style.zIndex = important ? "2" : "1"
        }
      }
      const frame = (time: number) => {
        raf = 0
        if (disposed || contextLost || !drawable || !inViewport || document.hidden) return
        inFrame = true
        const refresh = dirty
        dirty = false
        const cameraMoved = cameraDirty
        cameraDirty = false
        if (lastLinks !== latest.current.links) rebuildEdges(latest.current.links)
        if (lastPalette !== palette.current) updateTheme()
        if (refresh) updateVisibility()
        const stepped = simulationActive
        if (simulationActive) simulationActive = simulation.tick(reducedMotion ? 4 : 2)
        const changed = orbit.update()
        const tweening = tweenStarted >= 0
        if (tweenStarted >= 0) {
          const progress = Math.min(1, (time - tweenStarted) / Math.max(1, tweenDuration))
          const eased = 1 - Math.pow(1 - progress, 3)
          camera.position.lerpVectors(tweenFrom, tweenTo, eased)
          orbit.target.lerpVectors(targetFrom, targetTo, eased)
          orbit.update()
          if (progress === 1) tweenStarted = -1
        }
        if (refresh || stepped || dragIndex >= 0) updateGeometry()
        if (autoFit && stepped && !cameraInteracting) fit(false)
        if (resetToken !== latest.current.resetViewToken) {
          resetToken = latest.current.resetViewToken
          autoFit = false
          fit(true, true)
        }
        const request = latest.current.focusRequest
        if (request && request.token !== focusToken) {
          focusToken = request.token
          focusNode(request.index)
        }
        if (refresh || stepped || changed || cameraMoved || tweening || cameraDirty) {
          const distance = camera.position.length()
          const far = Math.max(2000, distance + sceneRadius * 8)
          if (camera.far !== far) {
            camera.far = far
            camera.updateProjectionMatrix()
          }
          fog.near = Math.max(30, distance - sceneRadius * 0.2)
          fog.far = distance + sceneRadius * 3
        }
        camera.updateMatrixWorld()
        updateParticles(time)
        if (refresh || stepped || changed || cameraMoved || tweening || dragIndex >= 0) updateLabels()
        gl.render(scene, camera)
        inFrame = false
        if (simulationActive || cameraInteracting || changed || cameraDirty || tweenStarted >= 0 || (!reducedMotion && particleLinks.length > 0) || dirty) {
          if (drawable && inViewport && !document.hidden) raf = requestAnimationFrame(frame)
        }
      }
      const listen = <K extends keyof HTMLElementEventMap>(target: HTMLElement, name: K, handler: (event: HTMLElementEventMap[K]) => void, capture = false) => {
        target.addEventListener(name, handler as EventListener, capture)
        listeners.push(() => target.removeEventListener(name, handler as EventListener, capture))
      }
      const stopTween = () => { tweenStarted = -1; autoFit = false }
      const onControlStart = () => { cameraInteracting = true; stopTween(); wake() }
      const onControlEnd = () => { cameraInteracting = false; wake() }
      const onControlChange = () => { cameraDirty = true; wake() }
      orbit.addEventListener("start", onControlStart)
      orbit.addEventListener("end", onControlEnd)
      orbit.addEventListener("change", onControlChange)
      listeners.push(() => {
        orbit.removeEventListener("start", onControlStart)
        orbit.removeEventListener("end", onControlEnd)
        orbit.removeEventListener("change", onControlChange)
      })
      const releaseDrag = () => {
        if (dragIndex >= 0) {
          simulation.pin(dragIndex, null)
          simulationActive = true
          dragIndex = -1
          orbit.enabled = true
        }
      }
      const cancelInteraction = () => {
        if (activePointers.size === 0 && dragIndex < 0 && !cameraInteracting) return
        releaseDrag()
        primaryPointer = -1
        cameraInteracting = false
        // Reconnect the same controls to clear their gesture state without moving the camera.
        orbit.connect(gl.domElement)
        for (const pointerId of activePointers) {
          activePointers.delete(pointerId)
          if (gl.domElement.hasPointerCapture(pointerId)) gl.domElement.releasePointerCapture(pointerId)
        }
        gl.domElement.style.cursor = "grab"
      }
      listen(gl.domElement, "pointerdown", (event) => {
        activePointers.add(event.pointerId)
        if (activePointers.size > 1) { dragged = true; releaseDrag(); return }
        primaryPointer = event.pointerId
        downX = event.clientX
        downY = event.clientY
        downButton = event.button
        modified = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey
        dragged = false
        downNode = pick(event)
        if (event.button === 0 && event.altKey && downNode >= 0) {
          stopTween()
          dragIndex = downNode
          orbit.enabled = false
          event.stopImmediatePropagation()
          gl.domElement.setPointerCapture(event.pointerId)
          camera.getWorldDirection(normal)
          position.copy(meshes[dragIndex].position)
          dragPlane.setFromNormalAndCoplanarPoint(normal, position)
          raycaster.ray.intersectPlane(dragPlane, dragPoint)
          dragOffset.subVectors(position, dragPoint)
          simulation.pin(dragIndex, position)
          simulationActive = true
          gl.domElement.style.cursor = "grabbing"
          wake()
        }
      }, true)
      listen(gl.domElement, "pointermove", (event) => {
        if (primaryPointer === event.pointerId && activePointers.size > 0 && Math.hypot(event.clientX - downX, event.clientY - downY) > 5) dragged = true
        if (dragIndex >= 0 && primaryPointer === event.pointerId) {
          event.stopImmediatePropagation()
          pick(event)
          if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
            dragPoint.add(dragOffset)
            simulation.pin(dragIndex, dragPoint)
            simulationActive = true
            wake()
          }
        } else if (activePointers.size === 0 && event.pointerType !== "touch") hover(pick(event))
      }, true)
      const endPointer = (event: PointerEvent, cancelled: boolean) => {
        activePointers.delete(event.pointerId)
        if (event.pointerId !== primaryPointer) return
        const wasNodeDrag = dragIndex >= 0
        releaseDrag()
        if (wasNodeDrag) {
          event.stopImmediatePropagation()
          if (gl.domElement.hasPointerCapture(event.pointerId)) gl.domElement.releasePointerCapture(event.pointerId)
        }
        if (!cancelled && !dragged && !modified && downButton === 0 && activePointers.size === 0) {
          const index = pick(event)
          if (index === downNode) select(index)
        }
        primaryPointer = -1
        wake()
      }
      listen(gl.domElement, "pointerup", (event) => endPointer(event, false), true)
      listen(gl.domElement, "pointercancel", (event) => endPointer(event, true), true)
      listen(gl.domElement, "lostpointercapture", (event) => {
        if (activePointers.has(event.pointerId)) { cancelInteraction(); wake() }
      })
      listen(gl.domElement, "pointerleave", () => { if (dragIndex < 0 && keyboardIndex < 0) hover(-1) })
      listen(gl.domElement, "keydown", (event) => {
        if (event.key === "Escape") latest.current.onSelect(-1)
        else if (event.key === "Home") { event.preventDefault(); autoFit = false; fit(true, true) }
      })
      const visibilityChange = () => {
        if (document.hidden) {
          cancelAnimationFrame(raf)
          raf = 0
          cancelInteraction()
        } else wake()
      }
      document.addEventListener("visibilitychange", visibilityChange)
      listeners.push(() => document.removeEventListener("visibilitychange", visibilityChange))
      window.addEventListener("blur", cancelInteraction)
      listeners.push(() => window.removeEventListener("blur", cancelInteraction))
      const motionChange = () => { reducedMotion = motion.matches; orbit.enableDamping = !reducedMotion; if (reducedMotion && tweenStarted >= 0) startTween(false); wake() }
      motion.addEventListener("change", motionChange)
      listeners.push(() => motion.removeEventListener("change", motionChange))
      const lostContext = (event: Event) => {
        event.preventDefault()
        contextLost = true
        cancelAnimationFrame(raf)
        raf = 0
        if (errorLayer) {
          errorLayer.textContent = "The WebGL context was lost. Reload this page to restore the 3D graph."
          errorLayer.style.display = "grid"
        }
        labelLayer.hidden = true
      }
      gl.domElement.addEventListener("webglcontextlost", lostContext)
      listeners.push(() => gl.domElement.removeEventListener("webglcontextlost", lostContext))
      const resize = () => {
        dirty = true
        const oldAspect = camera.aspect
        width = host.clientWidth
        height = host.clientHeight
        drawable = width > 0 && height > 0
        if (!drawable) { cancelAnimationFrame(raf); raf = 0; return }
        gl.setSize(width, height, false)
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        if (autoFit) fit(false)
        else {
          // Preserve the user's target and orientation, but keep the same horizontal framing.
          const adjustment = Math.min(1, oldAspect) / Math.min(1, camera.aspect)
          if (adjustment > 1) {
            camera.position.sub(orbit.target).multiplyScalar(adjustment).add(orbit.target)
            orbit.update()
          }
        }
        wake()
      }
      updateTheme()
      rebuildEdges(latest.current.links)
      updateVisibility()
      updateGeometry()
      for (let index = 0; index < count; index++) labelWidths[index] = Math.min(220, Math.max(50, buttons[index].scrollWidth + 14))
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)
      intersectionObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting
        if (inViewport) wake()
        else { cancelAnimationFrame(raf); raf = 0 }
      })
      intersectionObserver.observe(host)
      runtime.current = {
        invalidate: () => { dirty = true; wake() },
        updateOptions: (options) => { simulation.updateOptions(options); simulationActive = true; wake() },
      }
      resize()
      if (latest.current.focusRequest) {
        focusToken = latest.current.focusRequest.token
        focusNode(latest.current.focusRequest.index, false)
      }
      return dispose
    } catch (error) {
      dispose()
      const message = error instanceof Error ? error.message : "WebGL initialization failed"
      if (errorLayer) {
        errorLayer.textContent = `The 3D graph could not start: ${message}. This view requires a browser with WebGL support.`
        errorLayer.style.display = "grid"
      }
      return dispose
    }
    // Only graph topology replaces the renderer. Selection, links, options, and theme do not.
  }, [props.nodes, props.edges])

  useEffect(() => { runtime.current?.invalidate() }, [props.links, props.selectedIndex, props.hoveredIndex, props.focusNeighbors, props.highlightedCategory, props.neighborhoodOnly, props.nodeAppearRank, props.revealCount, props.resetViewToken, props.focusRequest, theme])
  useEffect(() => { runtime.current?.updateOptions(props.layoutOptions) }, [props.layoutOptions])

  return (
    <div ref={hostRef} style={{ position: "relative", width: "100%", height: "100%", minHeight: 240, overflow: "hidden", background: theme.colors.editor.bg }}>
      <div ref={labelsRef} aria-label="Graph nodes" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
      <div ref={statusRef} role="status" style={{ position: "absolute", inset: 0, display: "none", placeItems: "center", padding: 24, textAlign: "center", pointerEvents: "none", color: theme.colors.editor.fg2 }} />
      <div ref={errorRef} role="alert" style={{ position: "absolute", inset: 0, display: "none", placeItems: "center", padding: 28, textAlign: "center", background: theme.colors.editor.bg, color: theme.colors.editor.fg }} />
    </div>
  )
}
