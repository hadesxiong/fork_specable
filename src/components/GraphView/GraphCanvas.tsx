import { useEffect, useRef, useCallback, useState } from 'react'
import { Application, Graphics, Text, Container, TextStyle } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphEdgeType,
} from '../../workers/types'

interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

interface GraphCanvasProps {
  data: GraphData
  onNodeClick: (nodeId: string, jsonPath: string) => void
}

const BOX_MIN_WIDTH = 180
const BOX_PADDING = 12
const HEADER_HEIGHT = 28
const ROW_HEIGHT = 20
const GRID_GAP_X = 80
const GRID_GAP_Y = 40
const MAX_PROPERTIES = 12

const COLORS = {
  background: 0x09090b,
  boxFill: 0x18181b,
  boxStroke: 0x3f3f46,
  boxStrokeHover: 0xa855f7,
  headerFill: 0x27272a,
  headerText: 0xfafafa,
  propertyText: 0xa1a1aa,
  typeText: 0x71717a,
  requiredBadge: 0xf87171,
  refIndicator: 0xa855f7,
  orphanStroke: 0x52525b,
}

const EDGE_COLORS: Record<GraphEdgeType, number> = {
  ref: 0xa855f7,
  allOf: 0x8b5cf6,
  anyOf: 0xf59e0b,
  oneOf: 0xec4899,
  items: 0x06b6d4,
}

function calculateNodeSize(node: GraphNode): { width: number; height: number } {
  const properties = node.properties ?? []
  const displayCount = Math.min(properties.length, MAX_PROPERTIES)
  const hasMore = properties.length > MAX_PROPERTIES

  let maxTextWidth = node.id.length * 8
  for (const prop of properties.slice(0, MAX_PROPERTIES)) {
    const propText = `${prop.name}: ${prop.type}`
    maxTextWidth = Math.max(maxTextWidth, propText.length * 6.5)
  }

  const width = Math.max(BOX_MIN_WIDTH, maxTextWidth + BOX_PADDING * 2 + 40)
  const height =
    HEADER_HEIGHT +
    (displayCount + (hasMore ? 1 : 0)) * ROW_HEIGHT +
    BOX_PADDING

  return { width, height }
}

function layoutNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>()
  const schemaNodes = nodes.filter((n) => n.type === 'schema')
  const endpointNodes = nodes.filter((n) => n.type === 'endpoint')

  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()

  for (const node of schemaNodes) {
    outgoing.set(node.id, new Set())
    incoming.set(node.id, new Set())
  }

  for (const edge of edges) {
    if (outgoing.has(edge.source) && incoming.has(edge.target)) {
      outgoing.get(edge.source)!.add(edge.target)
      incoming.get(edge.target)!.add(edge.source)
    }
  }

  const layers: GraphNode[][] = []
  const placed = new Set<string>()

  const firstLayer = schemaNodes.filter((n) => incoming.get(n.id)!.size === 0)
  if (firstLayer.length > 0) {
    layers.push(firstLayer)
    firstLayer.forEach((n) => placed.add(n.id))
  }

  while (placed.size < schemaNodes.length) {
    const nextLayer = schemaNodes.filter((n) => {
      if (placed.has(n.id)) return false
      const deps = incoming.get(n.id)!
      return [...deps].every((d) => placed.has(d))
    })

    if (nextLayer.length === 0) {
      const remaining = schemaNodes.filter((n) => !placed.has(n.id))
      layers.push(remaining)
      remaining.forEach((n) => placed.add(n.id))
    } else {
      layers.push(nextLayer)
      nextLayer.forEach((n) => placed.add(n.id))
    }
  }

  let currentX = 50

  for (const layer of layers) {
    let maxWidth = 0
    let currentY = 50

    for (const node of layer) {
      const { width, height } = calculateNodeSize(node)
      positions.set(node.id, { x: currentX, y: currentY, width, height })
      maxWidth = Math.max(maxWidth, width)
      currentY += height + GRID_GAP_Y
    }

    currentX += maxWidth + GRID_GAP_X
  }

  if (endpointNodes.length > 0) {
    let endpointY = 50
    for (const node of endpointNodes) {
      const { width, height } = calculateNodeSize(node)
      positions.set(node.id, {
        x: -width - GRID_GAP_X,
        y: endpointY,
        width,
        height,
      })
      endpointY += height + GRID_GAP_Y
    }
  }

  return positions
}

export function GraphCanvas({ data, onNodeClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const nodeContainersRef = useRef<Map<string, Container>>(new Map())
  const edgeGraphicsRef = useRef<Graphics | null>(null)
  const nodePositionsRef = useRef<Map<string, NodePosition>>(new Map())

  const drawEdges = useCallback(
    (
      edges: GraphEdge[],
      positions: Map<string, NodePosition>,
      highlighted: string | null,
    ) => {
      const g = edgeGraphicsRef.current
      if (!g) return

      g.clear()

      for (const edge of edges) {
        const sourcePos = positions.get(edge.source)
        const targetPos = positions.get(edge.target)
        if (!sourcePos || !targetPos) continue

        const isHighlighted =
          highlighted !== null &&
          (edge.source === highlighted || edge.target === highlighted)
        const alpha = highlighted === null ? 0.6 : isHighlighted ? 1 : 0.1
        const color = EDGE_COLORS[edge.type]
        const lineWidth = isHighlighted ? 2 : 1

        let startX = sourcePos.x + sourcePos.width
        let startY = sourcePos.y + HEADER_HEIGHT / 2

        if (edge.sourceProperty) {
          const node = data.nodes.find((n) => n.id === edge.source)
          if (node?.properties) {
            const propIndex = node.properties.findIndex(
              (p) => p.name === edge.sourceProperty,
            )
            if (propIndex !== -1 && propIndex < MAX_PROPERTIES) {
              startY =
                sourcePos.y +
                HEADER_HEIGHT +
                propIndex * ROW_HEIGHT +
                ROW_HEIGHT / 2
            }
          }
        }

        let endX = targetPos.x
        const endY = targetPos.y + HEADER_HEIGHT / 2

        if (targetPos.x + targetPos.width < sourcePos.x) {
          startX = sourcePos.x
          endX = targetPos.x + targetPos.width
        }

        const midX = (startX + endX) / 2

        g.moveTo(startX, startY)
        g.bezierCurveTo(midX, startY, midX, endY, endX, endY)
        g.stroke({ width: lineWidth, color, alpha })

        const arrowSize = 6
        const angle = Math.atan2(endY - startY, endX - startX)
        const arrowAngle = Math.PI / 6

        if (endX > startX) {
          g.moveTo(endX, endY)
          g.lineTo(
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle),
          )
          g.moveTo(endX, endY)
          g.lineTo(
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle),
          )
          g.stroke({ width: lineWidth, color, alpha })
        } else {
          g.moveTo(endX, endY)
          g.lineTo(
            endX + arrowSize * Math.cos(arrowAngle),
            endY - arrowSize * Math.sin(arrowAngle),
          )
          g.moveTo(endX, endY)
          g.lineTo(
            endX + arrowSize * Math.cos(arrowAngle),
            endY + arrowSize * Math.sin(arrowAngle),
          )
          g.stroke({ width: lineWidth, color, alpha })
        }
      }
    },
    [data.nodes],
  )

  const updateHighlight = useCallback(
    (highlighted: string | null) => {
      for (const node of data.nodes) {
        const container = nodeContainersRef.current.get(node.id)
        if (!container) continue

        const isHighlighted = highlighted === node.id
        const alpha = highlighted === null || isHighlighted ? 1 : 0.3

        container.alpha = alpha

        const boxGraphics = container.children[0] as Graphics | undefined
        if (boxGraphics instanceof Graphics) {
          const pos = nodePositionsRef.current.get(node.id)
          if (pos) {
            boxGraphics.clear()
            const strokeColor = isHighlighted
              ? COLORS.boxStrokeHover
              : node.referenced
                ? COLORS.boxStroke
                : COLORS.orphanStroke

            boxGraphics.roundRect(0, 0, pos.width, pos.height, 6)
            boxGraphics.fill({ color: COLORS.boxFill })
            boxGraphics.stroke({
              width: isHighlighted ? 2 : 1,
              color: strokeColor,
            })

            boxGraphics.roundRect(0, 0, pos.width, HEADER_HEIGHT, 6)
            boxGraphics.fill({ color: COLORS.headerFill })
          }
        }
      }

      drawEdges(data.edges, nodePositionsRef.current, highlighted)
    },
    [data.nodes, data.edges, drawEdges],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    let cancelled = false
    const app = new Application()

    const init = async () => {
      await app.init({
        width,
        height,
        backgroundColor: COLORS.background,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (cancelled) {
        app.destroy(true, { children: true })
        return
      }

      container.appendChild(app.canvas)
      appRef.current = app

      const viewport = new Viewport({
        screenWidth: width,
        screenHeight: height,
        worldWidth: width * 4,
        worldHeight: height * 4,
        events: app.renderer.events,
      })

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.1, maxScale: 2 })

      app.stage.addChild(viewport)
      viewportRef.current = viewport

      const positions = layoutNodes(data.nodes, data.edges)
      nodePositionsRef.current = positions

      const edgeGraphics = new Graphics()
      viewport.addChild(edgeGraphics)
      edgeGraphicsRef.current = edgeGraphics

      const headerStyle = new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLORS.headerText,
      })

      const propertyStyle = new TextStyle({
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        fill: COLORS.propertyText,
      })

      const typeStyle = new TextStyle({
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        fill: COLORS.typeText,
      })

      for (const node of data.nodes) {
        const pos = positions.get(node.id)
        if (!pos) continue

        const nodeContainer = new Container()
        nodeContainer.position.set(pos.x, pos.y)
        nodeContainer.eventMode = 'static'
        nodeContainer.cursor = 'pointer'

        nodeContainer.on('pointerover', () => setHoveredNode(node.id))
        nodeContainer.on('pointerout', () => setHoveredNode(null))
        nodeContainer.on('pointertap', () =>
          onNodeClick(node.id, node.jsonPath),
        )

        const boxGraphics = new Graphics()
        const strokeColor = node.referenced
          ? COLORS.boxStroke
          : COLORS.orphanStroke

        boxGraphics.roundRect(0, 0, pos.width, pos.height, 6)
        boxGraphics.fill({ color: COLORS.boxFill })
        boxGraphics.stroke({ width: 1, color: strokeColor })

        boxGraphics.roundRect(0, 0, pos.width, HEADER_HEIGHT, 6)
        boxGraphics.fill({ color: COLORS.headerFill })

        nodeContainer.addChild(boxGraphics)

        const headerText = new Text({ text: node.id, style: headerStyle })
        headerText.position.set(
          BOX_PADDING,
          (HEADER_HEIGHT - headerText.height) / 2,
        )
        nodeContainer.addChild(headerText)

        const properties = node.properties ?? []
        const displayProps = properties.slice(0, MAX_PROPERTIES)

        displayProps.forEach((prop, index) => {
          const y = HEADER_HEIGHT + index * ROW_HEIGHT + (ROW_HEIGHT - 11) / 2

          const propText = new Text({ text: prop.name, style: propertyStyle })
          propText.position.set(BOX_PADDING, y)
          nodeContainer.addChild(propText)

          const typeText = new Text({
            text: `: ${prop.type}`,
            style: typeStyle,
          })
          typeText.position.set(BOX_PADDING + propText.width, y)
          nodeContainer.addChild(typeText)

          if (prop.required) {
            const badge = new Graphics()
            badge.roundRect(0, 0, 8, 8, 2)
            badge.fill({ color: COLORS.requiredBadge })
            badge.position.set(pos.width - BOX_PADDING - 8, y + 2)
            nodeContainer.addChild(badge)
          }

          if (prop.refTarget) {
            const indicator = new Graphics()
            indicator.circle(0, 0, 3)
            indicator.fill({ color: COLORS.refIndicator })
            indicator.position.set(
              pos.width - BOX_PADDING - (prop.required ? 20 : 8),
              y + 5,
            )
            nodeContainer.addChild(indicator)
          }
        })

        if (properties.length > MAX_PROPERTIES) {
          const moreText = new Text({
            text: `... ${properties.length - MAX_PROPERTIES} more`,
            style: typeStyle,
          })
          moreText.position.set(
            BOX_PADDING,
            HEADER_HEIGHT + MAX_PROPERTIES * ROW_HEIGHT + (ROW_HEIGHT - 11) / 2,
          )
          nodeContainer.addChild(moreText)
        }

        viewport.addChild(nodeContainer)
        nodeContainersRef.current.set(node.id, nodeContainer)
      }

      drawEdges(data.edges, positions, null)

      const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      }
      for (const pos of positions.values()) {
        bounds.minX = Math.min(bounds.minX, pos.x)
        bounds.minY = Math.min(bounds.minY, pos.y)
        bounds.maxX = Math.max(bounds.maxX, pos.x + pos.width)
        bounds.maxY = Math.max(bounds.maxY, pos.y + pos.height)
      }

      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2
      viewport.moveCenter(centerX, centerY)

      const contentWidth = bounds.maxX - bounds.minX + 100
      const contentHeight = bounds.maxY - bounds.minY + 100
      const scaleX = width / contentWidth
      const scaleY = height / contentHeight
      const scale = Math.min(scaleX, scaleY, 1)
      viewport.setZoom(scale, true)
    }

    init()

    return () => {
      cancelled = true
      nodeContainersRef.current.clear()
      edgeGraphicsRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
      viewportRef.current = null
    }
  }, [data, onNodeClick, drawEdges])

  useEffect(() => {
    updateHighlight(hoveredNode)
  }, [hoveredNode, updateHighlight])

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !appRef.current || !viewportRef.current)
        return

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      appRef.current.renderer.resize(width, height)
      viewportRef.current.resize(width, height)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
