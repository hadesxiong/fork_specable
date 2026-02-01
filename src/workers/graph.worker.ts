import { expose } from 'comlink';
import type { OpenAPIV3 } from 'openapi-types';
import type { GraphResult, GraphWorkerApi, GraphNode, GraphEdge, GraphEdgeType } from './types';
import { extractSchemaRefTarget, isReferenceObject } from '../utils/openapi';

interface RefInfo {
  source: string;
  target: string;
  type: GraphEdgeType;
}

function collectRefsFromSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  sourceId: string,
  refs: RefInfo[]
): void {
  if (isReferenceObject(schema)) {
    const target = extractSchemaRefTarget(schema.$ref);
    if (target) {
      refs.push({ source: sourceId, target, type: 'ref' });
    }
    return;
  }

  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref);
        if (target) {
          refs.push({ source: sourceId, target, type: 'allOf' });
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs);
      }
    }
  }

  if (schema.anyOf) {
    for (const subSchema of schema.anyOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref);
        if (target) {
          refs.push({ source: sourceId, target, type: 'anyOf' });
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs);
      }
    }
  }

  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      if (isReferenceObject(subSchema)) {
        const target = extractSchemaRefTarget(subSchema.$ref);
        if (target) {
          refs.push({ source: sourceId, target, type: 'oneOf' });
        }
      } else {
        collectRefsFromSchema(subSchema, sourceId, refs);
      }
    }
  }

  if ('items' in schema && schema.items) {
    if (isReferenceObject(schema.items)) {
      const target = extractSchemaRefTarget(schema.items.$ref);
      if (target) {
        refs.push({ source: sourceId, target, type: 'items' });
      }
    } else {
      collectRefsFromSchema(schema.items, sourceId, refs);
    }
  }

  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      collectRefsFromSchema(prop, sourceId, refs);
    }
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    collectRefsFromSchema(schema.additionalProperties, sourceId, refs);
  }
}

function collectRefsFromOperation(
  operation: OpenAPIV3.OperationObject,
  operationId: string,
  refs: RefInfo[]
): void {
  if (operation.requestBody) {
    const requestBody = operation.requestBody;
    if (isReferenceObject(requestBody)) {
      const target = extractSchemaRefTarget(requestBody.$ref);
      if (target) {
        refs.push({ source: operationId, target, type: 'ref' });
      }
    } else if (requestBody.content) {
      for (const mediaType of Object.values(requestBody.content)) {
        if (mediaType.schema) {
          collectRefsFromSchema(mediaType.schema, operationId, refs);
        }
      }
    }
  }

  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      if (isReferenceObject(response)) {
        const target = extractSchemaRefTarget(response.$ref);
        if (target) {
          refs.push({ source: operationId, target, type: 'ref' });
        }
      } else if (response.content) {
        for (const mediaType of Object.values(response.content)) {
          if (mediaType.schema) {
            collectRefsFromSchema(mediaType.schema, operationId, refs);
          }
        }
      }
    }
  }

  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (isReferenceObject(param)) {
        const target = extractSchemaRefTarget(param.$ref);
        if (target) {
          refs.push({ source: operationId, target, type: 'ref' });
        }
      } else if (param.schema) {
        collectRefsFromSchema(param.schema, operationId, refs);
      }
    }
  }
}

class GraphWorker implements GraphWorkerApi {
  async buildGraph(spec: OpenAPIV3.Document, includeEndpoints: boolean): Promise<GraphResult> {
    const startTime = performance.now();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const refs: RefInfo[] = [];
    const referencedSchemas = new Set<string>();

    const schemas = spec.components?.schemas ?? {};
    for (const [name, schema] of Object.entries(schemas)) {
      nodes.push({
        id: name,
        type: 'schema',
        label: name,
        jsonPath: `components.schemas.${name}`,
        referenced: false,
      });

      if (!isReferenceObject(schema)) {
        collectRefsFromSchema(schema, name, refs);
      }
    }

    if (includeEndpoints && spec.paths) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem) continue;

        for (const method of methods) {
          const operation = pathItem[method];
          if (!operation) continue;

          const operationId = `${path}.${method.toUpperCase()}`;
          nodes.push({
            id: operationId,
            type: 'endpoint',
            label: `${method.toUpperCase()} ${path}`,
            jsonPath: `paths.${path}.${method}`,
            referenced: true,
          });

          collectRefsFromOperation(operation, operationId, refs);
        }
      }
    }

    for (const ref of refs) {
      referencedSchemas.add(ref.target);

      const sourceExists = nodes.some((n) => n.id === ref.source);
      const targetExists = nodes.some((n) => n.id === ref.target);

      if (sourceExists && targetExists) {
        edges.push({
          source: ref.source,
          target: ref.target,
          type: ref.type,
        });
      }
    }

    for (const node of nodes) {
      if (node.type === 'schema') {
        node.referenced = referencedSchemas.has(node.id);
      }
    }

    const computeTimeMs = performance.now() - startTime;

    return {
      data: { nodes, edges },
      computeTimeMs,
    };
  }
}

expose(new GraphWorker());
