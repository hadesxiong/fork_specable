import type { OpenAPIV3 } from 'openapi-types'
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphEdgeType,
  SchemaProperty,
} from '../store'
import { extractSchemaRefTarget, isReferenceObject } from '../utils/openapi'

interface RefInfo {
  source: string
  target: string
  type: GraphEdgeType
  sourceProperty?: string
}

function getSchemaType(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): string {
  if (isReferenceObject(schema)) {
    const target = extractSchemaRefTarget(schema.$ref)
    return target ?? '$ref'
  }

  if (schema.type === 'array' && schema.items) {
    const itemType = getSchemaType(schema.items)
    return `${itemType}[]`
  }

  if (schema.allOf) return 'allOf'
  if (schema.anyOf) return 'anyOf'
  if (schema.oneOf) return 'oneOf'

  return schema.type ?? 'object'
}

function extractSchemaProperties(
  schema: OpenAPIV3.SchemaObject,
  refs: RefInfo[],
  sourceId: string,
): SchemaProperty[] {
  const properties: SchemaProperty[] = []
  const requiredSet = new Set(schema.required ?? [])

  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const type = getSchemaType(propSchema)
      const required = requiredSet.has(name)

      let refTarget: string | undefined
      if (isReferenceObject(propSchema)) {
        refTarget = extractSchemaRefTarget(propSchema.$ref) ?? undefined
        if (refTarget) {
          refs.push({
            source: sourceId,
            target: refTarget,
            type: 'ref',
            sourceProperty: name,
          })
        }
      } else if (propSchema.type === 'array' && propSchema.items) {
        if (isReferenceObject(propSchema.items)) {
          refTarget = extractSchemaRefTarget(propSchema.items.$ref) ?? undefined
          if (refTarget) {
            refs.push({
              source: sourceId,
              target: refTarget,
              type: 'items',
              sourceProperty: name,
            })
          }
        }
      }

      properties.push({ name, type, required, refTarget })
    }
  }

  return properties
}

function collectRefsFromSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  sourceId: string,
  refs: RefInfo[],
  propertyName?: string,
): void {
  if (isReferenceObject(schema)) {
    const target = extractSchemaRefTarget(schema.$ref)
    if (target) {
      refs.push({
        source: sourceId,
        target,
        type: 'ref',
        sourceProperty: propertyName,
      })
    }
    return
  }

  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref)
        if (target) {
          refs.push({ source: sourceId, target, type: 'allOf' })
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs)
      }
    }
  }

  if (schema.anyOf) {
    for (const subSchema of schema.anyOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref)
        if (target) {
          refs.push({ source: sourceId, target, type: 'anyOf' })
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs)
      }
    }
  }

  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref)
        if (target) {
          refs.push({ source: sourceId, target, type: 'oneOf' })
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs)
      }
    }
  }

  if ('items' in schema && schema.items) {
    if (isReferenceObject(schema.items)) {
      const target = extractSchemaRefTarget(schema.items.$ref)
      if (target) {
        refs.push({
          source: sourceId,
          target,
          type: 'items',
          sourceProperty: propertyName,
        })
      }
    } else {
      collectRefsFromSchema(schema.items, sourceId, refs)
    }
  }

  // Don't collect refs from properties here - extractSchemaProperties handles that
  // to properly track which property the reference comes from

  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === 'object'
  ) {
    collectRefsFromSchema(schema.additionalProperties, sourceId, refs)
  }
}

function collectRefsFromOperation(
  operation: OpenAPIV3.OperationObject,
  operationId: string,
  refs: RefInfo[],
): void {
  if (operation.requestBody) {
    const requestBody = operation.requestBody
    if (isReferenceObject(requestBody)) {
      const target = extractSchemaRefTarget(requestBody.$ref)
      if (target) {
        refs.push({ source: operationId, target, type: 'ref' })
      }
    } else if (requestBody.content) {
      for (const mediaType of Object.values(requestBody.content)) {
        if (mediaType.schema) {
          collectRefsFromSchema(mediaType.schema, operationId, refs)
        }
      }
    }
  }

  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      if (isReferenceObject(response)) {
        const target = extractSchemaRefTarget(response.$ref)
        if (target) {
          refs.push({ source: operationId, target, type: 'ref' })
        }
      } else if (response.content) {
        for (const mediaType of Object.values(response.content)) {
          if (mediaType.schema) {
            collectRefsFromSchema(mediaType.schema, operationId, refs)
          }
        }
      }
    }
  }

  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (isReferenceObject(param)) {
        const target = extractSchemaRefTarget(param.$ref)
        if (target) {
          refs.push({ source: operationId, target, type: 'ref' })
        }
      } else if (param.schema) {
        collectRefsFromSchema(param.schema, operationId, refs)
      }
    }
  }
}

export function buildGraphData(
  spec: OpenAPIV3.Document,
  includeEndpoints: boolean = false,
): GraphData {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const refs: RefInfo[] = []
  const referencedSchemas = new Set<string>()

  const schemas = spec.components?.schemas ?? {}
  for (const [name, schema] of Object.entries(schemas)) {
    let properties: SchemaProperty[] | undefined
    let description: string | undefined

    if (!isReferenceObject(schema)) {
      properties = extractSchemaProperties(schema, refs, name)
      description = schema.description
      collectRefsFromSchema(schema, name, refs)
    }

    nodes.push({
      id: name,
      type: 'schema',
      label: name,
      jsonPath: `components.schemas.${name}`,
      referenced: false,
      properties,
      description,
    })
  }

  if (includeEndpoints && spec.paths) {
    const methods = [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
      'trace',
    ] as const

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue

      for (const method of methods) {
        const operation = pathItem[method]
        if (!operation) continue

        const operationId = `${path}.${method.toUpperCase()}`
        nodes.push({
          id: operationId,
          type: 'endpoint',
          label: `${method.toUpperCase()} ${path}`,
          jsonPath: `paths.${path}.${method}`,
          referenced: true,
        })

        collectRefsFromOperation(operation, operationId, refs)
      }
    }
  }

  for (const ref of refs) {
    referencedSchemas.add(ref.target)

    const sourceExists = nodes.some((n) => n.id === ref.source)
    const targetExists = nodes.some((n) => n.id === ref.target)

    if (sourceExists && targetExists) {
      edges.push({
        source: ref.source,
        target: ref.target,
        type: ref.type,
        sourceProperty: ref.sourceProperty,
      })
    }
  }

  for (const node of nodes) {
    if (node.type === 'schema') {
      node.referenced = referencedSchemas.has(node.id)
    }
  }

  return { nodes, edges }
}

export function filterGraphData(
  data: GraphData,
  filter: 'all' | 'referenced' | 'orphaned',
): GraphData {
  if (filter === 'all') {
    return data
  }

  const filteredNodes = data.nodes.filter((node) => {
    if (node.type === 'endpoint') return true
    return filter === 'referenced' ? node.referenced : !node.referenced
  })

  const nodeIds = new Set(filteredNodes.map((n) => n.id))
  const filteredEdges = data.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )

  return { nodes: filteredNodes, edges: filteredEdges }
}
