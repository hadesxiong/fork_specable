import { useMemo } from 'react'
import type { OpenAPIV3 } from 'openapi-types'
import { useEditorStore } from '../../store'
import { resolveRef } from '../Preview/schema-utils'

interface ParameterFormProps {
  operation: OpenAPIV3.OperationObject
  pathItem: OpenAPIV3.PathItemObject
  spec: OpenAPIV3.Document
}

type ParameterLocation = 'path' | 'query' | 'header' | 'cookie'

interface ResolvedParameter {
  name: string
  in: ParameterLocation
  required: boolean
  description?: string
  schema?: OpenAPIV3.SchemaObject
  example?: unknown
  enum?: unknown[]
}

const LOCATION_LABELS: Record<ParameterLocation, string> = {
  path: 'Path Parameters',
  query: 'Query Parameters',
  header: 'Headers',
  cookie: 'Cookies',
}

const LOCATION_ORDER: ParameterLocation[] = [
  'path',
  'query',
  'header',
  'cookie',
]

export function ParameterForm({
  operation,
  pathItem,
  spec,
}: ParameterFormProps) {
  const parameterValues = useEditorStore((state) => state.tryIt.parameterValues)
  const setTryItParameter = useEditorStore((state) => state.setTryItParameter)

  const parameters = useMemo(() => {
    const allParams: OpenAPIV3.ParameterObject[] = []

    // Collect parameters from path item (common to all operations)
    if (pathItem.parameters) {
      for (const param of pathItem.parameters) {
        if ('$ref' in param) {
          const resolved = resolveRef(param as OpenAPIV3.ReferenceObject, spec)
          if (resolved?.schema) {
            allParams.push(resolved.schema as OpenAPIV3.ParameterObject)
          }
        } else {
          allParams.push(param)
        }
      }
    }

    // Collect parameters from operation (can override path item params)
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if ('$ref' in param) {
          const resolved = resolveRef(param as OpenAPIV3.ReferenceObject, spec)
          if (resolved?.schema) {
            allParams.push(resolved.schema as OpenAPIV3.ParameterObject)
          }
        } else {
          allParams.push(param)
        }
      }
    }

    // Deduplicate by name+in (operation params take precedence)
    const seen = new Map<string, OpenAPIV3.ParameterObject>()
    for (const param of allParams) {
      const key = `${param.in}.${param.name}`
      seen.set(key, param)
    }

    // Convert to resolved parameters
    const resolved: ResolvedParameter[] = []
    for (const param of seen.values()) {
      const schema = param.schema as OpenAPIV3.SchemaObject | undefined
      resolved.push({
        name: param.name,
        in: param.in as ParameterLocation,
        required: param.required ?? false,
        description: param.description,
        schema,
        example: param.example ?? schema?.example,
        enum: schema?.enum,
      })
    }

    return resolved
  }, [operation.parameters, pathItem.parameters, spec])

  const groupedParameters = useMemo(() => {
    const groups: Record<ParameterLocation, ResolvedParameter[]> = {
      path: [],
      query: [],
      header: [],
      cookie: [],
    }

    for (const param of parameters) {
      groups[param.in].push(param)
    }

    return groups
  }, [parameters])

  const hasParameters = parameters.length > 0

  if (!hasParameters) {
    return null
  }

  return (
    <div className="space-y-4">
      {LOCATION_ORDER.map((location) => {
        const params = groupedParameters[location]
        if (params.length === 0) return null

        return (
          <div key={location}>
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              {LOCATION_LABELS[location]}
            </h3>
            <div className="space-y-2">
              {params.map((param) => (
                <ParameterInput
                  key={`${param.in}.${param.name}`}
                  parameter={param}
                  value={parameterValues[`${param.in}.${param.name}`] ?? ''}
                  onChange={(value) =>
                    setTryItParameter(`${param.in}.${param.name}`, value)
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface ParameterInputProps {
  parameter: ResolvedParameter
  value: string
  onChange: (value: string) => void
}

function ParameterInput({ parameter, value, onChange }: ParameterInputProps) {
  const placeholder = useMemo(() => {
    if (parameter.example !== undefined) {
      return String(parameter.example)
    }
    if (parameter.schema?.type) {
      return parameter.schema.type
    }
    return ''
  }, [parameter.example, parameter.schema?.type])

  const schemaType = parameter.schema?.type ?? 'string'

  // Enum values use a select
  if (parameter.enum && parameter.enum.length > 0) {
    return (
      <div className="flex items-start gap-3">
        <label className="w-32 flex-shrink-0 pt-2">
          <span className="text-sm text-zinc-300">{parameter.name}</span>
          {parameter.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <div className="flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">Select...</option>
            {parameter.enum.map((enumValue) => (
              <option key={String(enumValue)} value={String(enumValue)}>
                {String(enumValue)}
              </option>
            ))}
          </select>
          {parameter.description && (
            <p className="text-xs text-zinc-500 mt-1">
              {parameter.description}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Boolean uses a checkbox-style toggle
  if (schemaType === 'boolean') {
    return (
      <div className="flex items-start gap-3">
        <label className="w-32 flex-shrink-0 pt-2">
          <span className="text-sm text-zinc-300">{parameter.name}</span>
          {parameter.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <div className="flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">Not set</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          {parameter.description && (
            <p className="text-xs text-zinc-500 mt-1">
              {parameter.description}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Default text input
  return (
    <div className="flex items-start gap-3">
      <label className="w-32 flex-shrink-0 pt-2">
        <span className="text-sm text-zinc-300">{parameter.name}</span>
        {parameter.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="flex-1">
        <input
          type={
            schemaType === 'integer' || schemaType === 'number'
              ? 'number'
              : 'text'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
        />
        {parameter.description && (
          <p className="text-xs text-zinc-500 mt-1">{parameter.description}</p>
        )}
      </div>
    </div>
  )
}
