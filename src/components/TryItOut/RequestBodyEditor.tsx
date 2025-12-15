import { useMemo } from 'react';
import type { OpenAPIV3 } from 'openapi-types';
import { useEditorStore } from '../../store';
import { resolveRef } from '../Preview/schema-utils';

interface RequestBodyEditorProps {
  operation: OpenAPIV3.OperationObject;
  spec: OpenAPIV3.Document;
}

const CONTENT_TYPES = [
  { value: 'application/json', label: 'JSON' },
  { value: 'application/x-www-form-urlencoded', label: 'Form URL Encoded' },
  { value: 'text/plain', label: 'Plain Text' },
];

export function RequestBodyEditor({ operation, spec }: RequestBodyEditorProps) {
  const requestBody = useEditorStore((state) => state.tryIt.requestBody);
  const requestContentType = useEditorStore((state) => state.tryIt.requestContentType);
  const setTryItRequestBody = useEditorStore((state) => state.setTryItRequestBody);
  const setTryItContentType = useEditorStore((state) => state.setTryItContentType);

  const requestBodySpec = useMemo(() => {
    if (!operation.requestBody) return null;

    if ('$ref' in operation.requestBody) {
      const resolved = resolveRef(operation.requestBody as OpenAPIV3.ReferenceObject, spec);
      return resolved?.schema as OpenAPIV3.RequestBodyObject | undefined;
    }

    return operation.requestBody as OpenAPIV3.RequestBodyObject;
  }, [operation.requestBody, spec]);

  const availableContentTypes = useMemo(() => {
    if (!requestBodySpec?.content) return CONTENT_TYPES;

    const specContentTypes = Object.keys(requestBodySpec.content);
    return CONTENT_TYPES.filter((ct) =>
      specContentTypes.some((sct) => sct.includes(ct.value.split('/')[1]))
    );
  }, [requestBodySpec?.content]);

  const schemaInfo = useMemo(() => {
    if (!requestBodySpec?.content) return null;

    const mediaType = requestBodySpec.content[requestContentType] ??
                      requestBodySpec.content['application/json'] ??
                      Object.values(requestBodySpec.content)[0];

    if (!mediaType?.schema) return null;

    let schema = mediaType.schema;
    if ('$ref' in schema) {
      const resolved = resolveRef(schema as OpenAPIV3.ReferenceObject, spec);
      schema = resolved?.schema as OpenAPIV3.SchemaObject;
    }

    return schema as OpenAPIV3.SchemaObject;
  }, [requestBodySpec?.content, requestContentType, spec]);

  const isRequired = requestBodySpec?.required ?? false;

  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
        Request Body
        {isRequired && <span className="text-red-400 ml-1">*</span>}
      </h3>

      {/* Content Type Selector */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg mb-2">
        {availableContentTypes.map((ct) => (
          <button
            key={ct.value}
            type="button"
            onClick={() => setTryItContentType(ct.value)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              requestContentType === ct.value
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Body Input */}
      <textarea
        value={requestBody}
        onChange={(e) => setTryItRequestBody(e.target.value)}
        placeholder={requestContentType === 'application/json' ? '{\n  "key": "value"\n}' : 'Enter request body...'}
        rows={8}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors resize-y"
        spellCheck={false}
      />

      {/* Schema hint */}
      {schemaInfo?.description && (
        <p className="text-xs text-zinc-500 mt-1">{schemaInfo.description}</p>
      )}
    </div>
  );
}
